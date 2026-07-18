import { describe, expect, it } from "vitest";
import type { SledSnapshot } from "../simulation/SledSimulation";
import { penguinPoseAt } from "./PenguinRider";

const snapshot = (grounded: boolean, steer = 0): SledSnapshot => ({
  elapsedSeconds: 1,
  distanceMeters: 70,
  x: 0,
  z: 70,
  height: 4,
  forwardSpeed: 18,
  lateralSpeed: 0,
  verticalSpeed: grounded ? 0 : 3,
  headingRadians: 0,
  pitchRadians: 0,
  rollRadians: 0,
  slopeRadians: 0,
  steer,
  grounded,
  airborneSeconds: grounded ? 0 : 0.4,
  landingImpact: 0,
  moving: true,
  stopped: false,
});

describe("penguinPoseAt", () => {
  it("opens the flippers into a clear airborne silhouette", () => {
    const grounded = penguinPoseAt(
      snapshot(true),
      "RIDING",
      { power: 0, aim: 0 },
      false,
    );
    const airborne = penguinPoseAt(
      snapshot(false),
      "RIDING",
      { power: 0, aim: 0 },
      false,
    );
    expect(airborne.flipperSpread).toBeGreaterThan(grounded.flipperSpread);
  });

  it("leans and looks toward steering input", () => {
    const pose = penguinPoseAt(
      snapshot(true, 1),
      "RIDING",
      { power: 0, aim: 0 },
      false,
    );
    expect(pose.bodyLean).toBeLessThan(0);
    expect(pose.headYaw).toBeGreaterThan(0);
  });

  it("removes oscillating secondary motion for reduced motion", () => {
    const pose = penguinPoseAt(
      snapshot(true),
      "RIDING",
      { power: 0, aim: 0 },
      true,
    );
    expect(pose.bodyBob).toBe(0);
    expect(pose.scarfSway).toBe(0);
  });
});
