import { describe, expect, it } from "vitest";
import type { SledSnapshot } from "../simulation/SledSimulation";
import { RunDynamics } from "./RunDynamics";

const frame = (x: number, z: number, grounded = true): SledSnapshot => ({
  elapsedSeconds: 0,
  distanceMeters: z,
  x,
  z,
  height: 0,
  forwardSpeed: 20,
  lateralSpeed: 0,
  verticalSpeed: 0,
  headingRadians: 0,
  pitchRadians: 0,
  rollRadians: 0,
  slopeRadians: 0,
  steer: 0,
  grounded,
  airborneSeconds: grounded ? 0 : 1,
  landingImpact: 0,
  moving: true,
  stopped: false,
});

describe("RunDynamics", () => {
  it("collects a swept coin once and grows the combo", () => {
    const dynamics = new RunDynamics();
    expect(dynamics.update(frame(0, 23), frame(0, 25), 1 / 60)).toEqual([
      { type: "coin", combo: 1, points: 12 },
    ]);
    expect(dynamics.update(frame(0, 23), frame(0, 25), 1 / 60)).toEqual([]);
    expect(dynamics.snapshot.runCoins).toBe(1);
  });

  it("breaks a combo on a rock and emits a slowdown event", () => {
    const dynamics = new RunDynamics();
    dynamics.update(frame(0, 23), frame(0, 25), 1 / 60);
    expect(dynamics.update(frame(4.5, 37), frame(4.5, 39), 1 / 60)).toEqual([
      { type: "rock" },
    ]);
    expect(dynamics.snapshot.combo).toBe(0);
  });

  it("rewards a completed airborne sequence", () => {
    const dynamics = new RunDynamics();
    dynamics.update(frame(0, 60), frame(0, 61, false), 0.3);
    dynamics.update(frame(0, 61, false), frame(0, 66, false), 0.5);
    const events = dynamics.update(frame(0, 66, false), frame(0, 70), 0.1);
    expect(events[0]?.type).toBe("airtime");
    expect(dynamics.snapshot.score).toBeGreaterThan(70);
  });

  it("cannot collect ground objects or hit rocks while airborne", () => {
    const dynamics = new RunDynamics();

    expect(
      dynamics.update(frame(0, 23, false), frame(0, 25, false), 1 / 60),
    ).toEqual([]);
    expect(
      dynamics.update(frame(4.5, 37, false), frame(4.5, 39, false), 1 / 60),
    ).toEqual([]);
    expect(
      dynamics.update(frame(-5, 47, false), frame(-5, 49, false), 1 / 60),
    ).toEqual([]);
    expect(dynamics.snapshot.consumedIds.size).toBe(0);

    expect(dynamics.update(frame(0, 23), frame(0, 25), 1 / 60)[0]?.type).toBe(
      "coin",
    );
    expect(
      dynamics.update(frame(4.5, 37), frame(4.5, 39), 1 / 60)[0]?.type,
    ).toBe("rock");
    expect(dynamics.update(frame(-5, 47), frame(-5, 49), 1 / 60)[0]?.type).toBe(
      "boost",
    );
  });

  it("does not trigger a ground object across takeoff or landing frames", () => {
    const dynamics = new RunDynamics();
    expect(dynamics.update(frame(0, 23), frame(0, 25, false), 1 / 60)).toEqual(
      [],
    );
    expect(dynamics.update(frame(0, 23, false), frame(0, 25), 1 / 60)).toEqual(
      [],
    );
    expect(dynamics.snapshot.consumedIds.has("c03")).toBe(false);
  });
});
