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
    expect(snapshot.distanceMeters).toBeLessThan(240);
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
});
