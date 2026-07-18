import { describe, expect, it } from "vitest";
import {
  SledSimulation,
  surfaceHeightAt,
  surfaceSlopeZAt,
} from "./SledSimulation";

type InputEvent = { atSeconds: number; steer: number };

const simulate = (events: InputEvent[], durationSeconds: number) => {
  const simulation = new SledSimulation();
  simulation.launch({ power: 0.92, aim: 0 });
  let eventIndex = 0;
  let steer = 0;

  for (let tick = 0; tick < durationSeconds * 60; tick += 1) {
    const time = tick / 60;
    let event = events[eventIndex];
    while (event && event.atSeconds <= time) {
      steer = event.steer;
      eventIndex += 1;
      event = events[eventIndex];
    }
    simulation.update(1 / 60, { steer });
  }

  return simulation.snapshot;
};

describe("SledSimulation", () => {
  it("replays the same input tape deterministically", () => {
    const tape = [
      { atSeconds: 0.5, steer: 0.8 },
      { atSeconds: 1.4, steer: -0.45 },
      { atSeconds: 2.1, steer: 0 },
    ];
    expect(simulate(tape, 8)).toEqual(simulate(tape, 8));
  });

  it("moves right only after right steering input", () => {
    const neutral = simulate([], 2);
    const right = simulate([{ atSeconds: 0, steer: 1 }], 2);
    const left = simulate([{ atSeconds: 0, steer: -1 }], 2);
    expect(neutral.x).toBeCloseTo(0, 8);
    expect(right.x).toBeGreaterThan(4);
    expect(left.x).toBeLessThan(-4);
  });

  it("does not gain a hidden target-directed lateral velocity", () => {
    const snapshot = simulate([{ atSeconds: 0, steer: -0.2 }], 1.5);
    expect(snapshot.x).toBeLessThan(0);
    expect(snapshot.lateralSpeed).toBeLessThan(0);
  });

  it("preserves visibly different left, center, and right launch trajectories", () => {
    const launchAndCoast = (aim: number) => {
      const simulation = new SledSimulation();
      simulation.launch({ power: 0.9, aim });
      for (let tick = 0; tick < 60 * 2; tick += 1) {
        simulation.update(1 / 60, { steer: 0 });
      }
      return simulation.snapshot;
    };

    const left = launchAndCoast(-1);
    const center = launchAndCoast(0);
    const right = launchAndCoast(1);

    expect(left.x).toBeLessThan(-5);
    expect(center.x).toBeCloseTo(0, 8);
    expect(right.x).toBeGreaterThan(5);
    expect(left.lateralSpeed).toBeLessThan(-1);
    expect(right.lateralSpeed).toBeGreaterThan(1);
  });

  it("scales lateral launch strength with the aiming angle", () => {
    const coastFromAim = (aim: number) => {
      const simulation = new SledSimulation();
      simulation.launch({ power: 0.9, aim });
      for (let tick = 0; tick < 60 * 1.5; tick += 1) {
        simulation.update(1 / 60, { steer: 0 });
      }
      return simulation.snapshot.x;
    };

    const weakRight = coastFromAim(0.25);
    const strongRight = coastFromAim(0.9);
    const weakLeft = coastFromAim(-0.25);
    const strongLeft = coastFromAim(-0.9);

    expect(strongRight).toBeGreaterThan(weakRight * 3);
    expect(strongLeft).toBeLessThan(weakLeft * 3);
    expect(weakRight).toBeCloseTo(-weakLeft, 5);
    expect(strongRight).toBeCloseTo(-strongLeft, 5);
  });

  it("gains speed downhill and loses speed on the ramp climb", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 0.22, aim: 0 });
    const speeds = new Map<number, number>();
    const checkpoints = [2, 10, 58, 65];

    for (let tick = 0; tick < 60 * 8; tick += 1) {
      simulation.update(1 / 60, { steer: 0 });
      const snapshot = simulation.snapshot;
      for (const checkpoint of checkpoints) {
        if (!speeds.has(checkpoint) && snapshot.z >= checkpoint) {
          speeds.set(checkpoint, snapshot.forwardSpeed);
        }
      }
    }

    expect(surfaceSlopeZAt(0, 5)).toBeLessThan(-0.1);
    expect(surfaceSlopeZAt(0, 62)).toBeGreaterThan(0.2);
    expect(speeds.get(10) ?? 0).toBeGreaterThan((speeds.get(2) ?? 0) + 0.2);
    expect(speeds.get(65) ?? 100).toBeLessThan((speeds.get(58) ?? 0) - 1);
  });

  it("takes off, crosses an apex, and lands on the terrain", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 0.22, aim: 0 });
    let wasGrounded = true;
    let sawTakeoff = false;
    let sawRisingFlight = false;
    let sawFallingFlight = false;
    let sawLanding = false;
    let maximumClearance = 0;
    let landingImpact = 0;

    for (let tick = 0; tick < 60 * 8; tick += 1) {
      simulation.update(1 / 60, { steer: 0 });
      const snapshot = simulation.snapshot;
      const terrainHeight = surfaceHeightAt(snapshot.x, snapshot.z);
      expect(snapshot.height).toBeGreaterThanOrEqual(terrainHeight - 1e-8);

      if (!snapshot.grounded) {
        sawTakeoff = true;
        sawRisingFlight ||= snapshot.verticalSpeed > 0.5;
        sawFallingFlight ||= snapshot.verticalSpeed < -0.5;
        maximumClearance = Math.max(
          maximumClearance,
          snapshot.height - terrainHeight,
        );
      }
      if (!wasGrounded && snapshot.grounded) {
        sawLanding = true;
        landingImpact = snapshot.landingImpact;
        expect(snapshot.height).toBeCloseTo(terrainHeight, 8);
      }
      wasGrounded = snapshot.grounded;
    }

    expect(sawTakeoff).toBe(true);
    expect(sawRisingFlight).toBe(true);
    expect(sawFallingFlight).toBe(true);
    expect(sawLanding).toBe(true);
    expect(maximumClearance).toBeGreaterThan(2);
    expect(landingImpact).toBeGreaterThan(2);
  });

  it("slows down and reaches a stable stopped state", () => {
    const snapshot = simulate([], 45);
    expect(snapshot.stopped).toBe(true);
    expect(snapshot.forwardSpeed).toBe(0);
    expect(snapshot.distanceMeters).toBeGreaterThan(140);
    expect(snapshot.distanceMeters).toBeLessThan(280);
  });

  it("applies launch aim without exceeding the track boundary", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 1, aim: 1 });
    for (let tick = 0; tick < 60 * 15; tick += 1) {
      simulation.update(1 / 60, { steer: 0 });
    }
    expect(simulation.snapshot.x).toBeLessThanOrEqual(13.5);
    expect(Number.isFinite(simulation.snapshot.headingRadians)).toBe(true);
  });

  it("settles smoothly at an edge instead of bouncing every fixed step", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 1, aim: 0 });
    const edgeSamples: number[] = [];

    for (let tick = 0; tick < 60 * 12; tick += 1) {
      simulation.update(1 / 60, { steer: 1 });
      if (tick >= 60 * 10) edgeSamples.push(simulation.snapshot.lateralSpeed);
    }

    expect(simulation.snapshot.x).toBeCloseTo(13.5, 5);
    expect(Math.max(...edgeSamples)).toBeLessThan(0.02);
    expect(Math.min(...edgeSamples)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(simulation.snapshot.headingRadians)).toBeLessThan(0.002);
  });

  it("applies progression upgrades and course impulses predictably", () => {
    const simulation = new SledSimulation();
    simulation.configureUpgrades({
      launchSpeedBonus: 1.5,
      snowResistanceMultiplier: 0.88,
    });
    simulation.launch({ power: 1, aim: 0 });
    expect(simulation.snapshot.forwardSpeed).toBeCloseTo(25.5, 8);
    simulation.applyBoost(3.5);
    expect(simulation.snapshot.forwardSpeed).toBeCloseTo(29, 8);
    simulation.applyObstacleHit();
    expect(simulation.snapshot.forwardSpeed).toBeCloseTo(20.88, 8);
  });

  it("cannot skip either ramp takeoff after a boost or a long simulation step", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 1, aim: 0 });
    let wasGrounded = true;
    let takeoffs = 0;
    let crossedSecondRampAirborne = false;
    let firstBoost = false;
    let secondBoost = false;

    for (let tick = 0; tick < 20 / 0.05; tick += 1) {
      const before = simulation.snapshot;
      if (!firstBoost && before.z >= 46) {
        simulation.applyBoost(7);
        firstBoost = true;
      }
      if (!secondBoost && before.z >= 122) {
        simulation.applyBoost(7);
        secondBoost = true;
      }
      simulation.update(0.05, { steer: 0 });
      const snapshot = simulation.snapshot;
      if (wasGrounded && !snapshot.grounded) takeoffs += 1;
      if (before.z < 136 && snapshot.z >= 136 && !snapshot.grounded) {
        crossedSecondRampAirborne = true;
      }
      wasGrounded = snapshot.grounded;
    }

    expect(firstBoost).toBe(true);
    expect(secondBoost).toBe(true);
    expect(takeoffs).toBeGreaterThanOrEqual(1);
    expect(takeoffs === 2 || crossedSecondRampAirborne).toBe(true);
  });

  it.each([-6.2, -5, 0, 5, 6.2])(
    "clears both ramp lips on the boosted x=%s route",
    (targetX) => {
      const simulation = new SledSimulation();
      simulation.launch({ power: 1, aim: 0 });
      let previous = simulation.snapshot;
      let takeoffs = 0;
      let clearedSecondRampAirborne = false;
      let firstBoost = false;
      let secondBoost = false;

      for (let tick = 0; tick < 300; tick += 1) {
        const before = simulation.snapshot;
        if (!firstBoost && before.z >= 46) {
          simulation.applyBoost(7);
          firstBoost = true;
        }
        if (!secondBoost && before.z >= 122) {
          simulation.applyBoost(7);
          secondBoost = true;
        }
        const steer = Math.max(
          -1,
          Math.min(1, (targetX - before.x) * 0.65 - before.lateralSpeed * 0.3),
        );
        simulation.update(0.05, { steer });
        const snapshot = simulation.snapshot;
        if (previous.grounded && !snapshot.grounded) takeoffs += 1;
        if (before.z < 136 && snapshot.z >= 136 && !snapshot.grounded) {
          clearedSecondRampAirborne = true;
        }
        previous = snapshot;
        if (snapshot.z > 165) break;
      }

      expect(firstBoost).toBe(true);
      expect(secondBoost).toBe(true);
      expect(takeoffs).toBeGreaterThanOrEqual(1);
      expect(clearedSecondRampAirborne).toBe(true);
    },
  );

  it("responds sharply on snow and reverses without a long steering delay", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 1, aim: 0 });
    for (let tick = 0; tick < 30; tick += 1) {
      simulation.update(1 / 60, { steer: 1 });
    }
    expect(simulation.snapshot.lateralSpeed).toBeGreaterThan(4);

    for (let tick = 0; tick < 36; tick += 1) {
      simulation.update(1 / 60, { steer: -1 });
    }
    expect(simulation.snapshot.lateralSpeed).toBeLessThan(-3);
  });

  it("cannot use steering as sideways propulsion when forward speed reaches zero", () => {
    const simulation = new SledSimulation();
    simulation.launch({ power: 0.25, aim: 0 });
    let reachedStoppingRange = false;

    for (let tick = 0; tick < 60 * 55; tick += 1) {
      simulation.update(1 / 60, { steer: 0 });
      const snapshot = simulation.snapshot;
      if (
        snapshot.moving &&
        snapshot.grounded &&
        snapshot.forwardSpeed < 0.25
      ) {
        reachedStoppingRange = true;
        break;
      }
    }

    expect(reachedStoppingRange).toBe(true);
    const stoppingX = simulation.snapshot.x;
    for (let tick = 0; tick < 60 * 3; tick += 1) {
      simulation.update(1 / 60, { steer: 1 });
    }

    expect(simulation.snapshot.stopped).toBe(true);
    expect(Math.abs(simulation.snapshot.x - stoppingX)).toBeLessThan(0.12);
    expect(simulation.snapshot.lateralSpeed).toBe(0);
  });

  it("allows weaker but meaningful steering control while airborne", () => {
    const airborneTurn = (steer: number) => {
      const simulation = new SledSimulation();
      simulation.launch({ power: 1, aim: 0 });
      while (simulation.snapshot.grounded) {
        simulation.update(1 / 60, { steer: 0 });
      }
      const takeoffX = simulation.snapshot.x;
      for (
        let tick = 0;
        tick < 30 && !simulation.snapshot.grounded;
        tick += 1
      ) {
        simulation.update(1 / 60, { steer });
      }
      return {
        displacement: simulation.snapshot.x - takeoffX,
        lateralSpeed: simulation.snapshot.lateralSpeed,
      };
    };

    const left = airborneTurn(-1);
    const neutral = airborneTurn(0);
    const right = airborneTurn(1);
    expect(left.displacement).toBeLessThan(neutral.displacement - 0.2);
    expect(right.displacement).toBeGreaterThan(neutral.displacement + 0.2);
    expect(left.lateralSpeed).toBeLessThan(0);
    expect(right.lateralSpeed).toBeGreaterThan(0);
    expect(Math.abs(right.lateralSpeed)).toBeLessThan(3);
  });
});
