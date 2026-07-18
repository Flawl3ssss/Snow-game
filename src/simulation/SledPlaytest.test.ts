import { describe, expect, it } from "vitest";
import {
  SLED_PHYSICS,
  SledSimulation,
  surfaceHeightAt,
} from "./SledSimulation";

type RunOptions = {
  power?: number;
  aim?: number;
  seconds?: number;
  steer?: (time: number) => number;
};

const run = ({
  power = 0.92,
  aim = 0,
  seconds = 8,
  steer = () => 0,
}: RunOptions = {}) => {
  const simulation = new SledSimulation();
  simulation.launch({ power, aim });
  const initial = simulation.snapshot;
  const samples = [initial];
  const takeoffs: typeof samples = [];
  const landings: Array<{
    impact: number;
    beforeSpeed: number;
    afterSpeed: number;
  }> = [];
  let previous = initial;
  let maximumClearance = 0;
  let minimumClearance = Number.POSITIVE_INFINITY;

  for (let tick = 0; tick < seconds * 60; tick += 1) {
    simulation.update(1 / 60, { steer: steer(tick / 60) });
    const snapshot = simulation.snapshot;
    const clearance = snapshot.height - surfaceHeightAt(snapshot.x, snapshot.z);
    maximumClearance = Math.max(maximumClearance, clearance);
    minimumClearance = Math.min(minimumClearance, clearance);
    if (previous.grounded && !snapshot.grounded) takeoffs.push(snapshot);
    if (!previous.grounded && snapshot.grounded) {
      landings.push({
        impact: snapshot.landingImpact,
        beforeSpeed: previous.forwardSpeed,
        afterSpeed: snapshot.forwardSpeed,
      });
    }
    samples.push(snapshot);
    previous = snapshot;
  }

  return {
    initial,
    final: simulation.snapshot,
    samples,
    takeoffs,
    landings,
    maximumClearance,
    minimumClearance,
  };
};

const firstAtZ = (samples: ReturnType<typeof run>["samples"], z: number) =>
  samples.find((sample) => sample.z >= z);

describe("20-scenario sled physics playtest", () => {
  it("01 minimum-power launch is controlled but clearly moving", () => {
    const result = run({ power: 0.22, seconds: 0 });
    expect(result.initial.forwardSpeed).toBeGreaterThanOrEqual(17.7);
    expect(result.initial.forwardSpeed).toBeLessThan(18);
  });

  it("02 maximum-power launch reaches the configured cap", () => {
    const result = run({ power: 1, seconds: 0 });
    expect(result.initial.forwardSpeed).toBeCloseTo(24, 8);
  });

  it("03 neutral center launch holds the center line", () => {
    expect(run({ seconds: 2 }).final.x).toBeCloseTo(0, 8);
  });

  it("04 full world-left launch remains visibly separated", () => {
    expect(run({ aim: -1, seconds: 2 }).final.x).toBeLessThan(-5);
  });

  it("05 full world-right launch remains visibly separated", () => {
    expect(run({ aim: 1, seconds: 2 }).final.x).toBeGreaterThan(5);
  });

  it("06 stronger aim produces a stronger lateral trajectory", () => {
    const weak = run({ aim: 0.3, seconds: 1.5 }).final.x;
    const strong = run({ aim: 0.9, seconds: 1.5 }).final.x;
    expect(strong).toBeGreaterThan(weak * 2.5);
  });

  it("07 mirrored launch angles remain physically symmetric", () => {
    const left = run({ aim: -0.75, seconds: 1.5 }).final.x;
    const right = run({ aim: 0.75, seconds: 1.5 }).final.x;
    expect(left).toBeCloseTo(-right, 5);
  });

  it("08 sustained left steering moves left without inversion", () => {
    expect(run({ seconds: 2, steer: () => -1 }).final.x).toBeLessThan(-4);
  });

  it("09 sustained right steering moves right without inversion", () => {
    expect(run({ seconds: 2, steer: () => 1 }).final.x).toBeGreaterThan(4);
  });

  it("10 launch drift fades gradually without snapping to center", () => {
    const result = run({ aim: 0.8, seconds: 4 });
    expect(result.final.x).toBeGreaterThan(6);
    expect(Math.abs(result.final.lateralSpeed)).toBeLessThan(
      Math.abs(result.initial.lateralSpeed),
    );
  });

  it("11 released steering settles instead of oscillating", () => {
    const result = run({ seconds: 4, steer: (time) => (time < 1 ? 1 : 0) });
    expect(result.final.lateralSpeed).toBeGreaterThanOrEqual(0);
    expect(result.final.lateralSpeed).toBeLessThan(1);
  });

  it("12 a left-right correction reverses direction smoothly", () => {
    const result = run({
      seconds: 5,
      steer: (time) => (time < 1.5 ? 1 : time < 3.5 ? -1 : 0),
    });
    expect(
      Math.max(...result.samples.map((sample) => sample.x)),
    ).toBeGreaterThan(4);
    expect(result.final.lateralSpeed).toBeLessThan(0);
  });

  it("13 a downhill section increases forward speed", () => {
    const result = run({ power: 0.22, seconds: 2 });
    const early = firstAtZ(result.samples, 2)?.forwardSpeed ?? 0;
    const downhill = firstAtZ(result.samples, 10)?.forwardSpeed ?? 0;
    expect(downhill).toBeGreaterThan(early + 0.2);
  });

  it("14 the first ramp climb removes meaningful speed", () => {
    const result = run({ power: 0.22, seconds: 5 });
    const approach = firstAtZ(result.samples, 58)?.forwardSpeed ?? 0;
    const climb = firstAtZ(result.samples, 65)?.forwardSpeed ?? 100;
    expect(climb).toBeLessThan(approach - 1);
  });

  it("15 the first ramp creates a readable ballistic jump", () => {
    const result = run({ power: 0.22, seconds: 7 });
    expect(result.takeoffs).toHaveLength(1);
    expect(result.maximumClearance).toBeGreaterThan(2);
    expect(result.landings[0]?.impact ?? 0).toBeGreaterThan(5);
  });

  it("16 maximum power clears both intended jump lines", () => {
    const result = run({ power: 1, seconds: 10 });
    expect(result.takeoffs).toHaveLength(2);
    expect(result.landings).toHaveLength(2);
    expect(
      result.landings.every(
        (landing) => landing.afterSpeed < landing.beforeSpeed,
      ),
    ).toBe(true);
  });

  it("17 lower speed still creates two deliberate ramp takeoffs", () => {
    const result = run({ power: 0.22, seconds: 12 });
    expect(result.takeoffs).toHaveLength(2);
    expect(result.takeoffs[1]?.verticalSpeed ?? 0).toBeGreaterThanOrEqual(
      SLED_PHYSICS.minimumRampTakeoffVerticalSpeed - 0.2,
    );
  });

  it("18 an off-center route bypasses the central ramps", () => {
    const result = run({ power: 1, aim: 1, seconds: 10 });
    expect(result.takeoffs).toHaveLength(0);
    expect(result.final.x).toBeGreaterThan(7);
  });

  it("19 holding outward at the edge no longer drains all speed", () => {
    const result = run({ power: 1, seconds: 12, steer: () => 1 });
    expect(result.final.x).toBeCloseTo(SLED_PHYSICS.trackHalfWidth, 5);
    expect(result.final.stopped).toBe(false);
    expect(result.final.z).toBeGreaterThan(150);
  });

  it("20 a full run never penetrates terrain and stops stably", () => {
    const result = run({ power: 1, seconds: 45 });
    expect(result.minimumClearance).toBeGreaterThanOrEqual(-1e-8);
    expect(result.final.stopped).toBe(true);
    expect(result.final.forwardSpeed).toBe(0);
    expect(result.final.lateralSpeed).toBe(0);
  });
});
