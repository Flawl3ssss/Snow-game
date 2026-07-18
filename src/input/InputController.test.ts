import { describe, expect, it } from "vitest";
import { dragToAim, dragToSteer, pullAimToLaunchAim } from "./InputController";

describe("dragToSteer", () => {
  it("maps the mobile drag into the corrected camera-relative direction", () => {
    expect(dragToSteer(0.7)).toBeCloseTo(-0.7);
    expect(dragToSteer(-0.4)).toBeCloseTo(0.4);
    expect(dragToSteer(4)).toBe(-1);
  });
});

describe("dragToAim", () => {
  it("maps the screen gesture through the camera-relative horizontal axis", () => {
    expect(dragToAim(0.2)).toBeCloseTo(-0.2);
    expect(dragToAim(0.65)).toBeCloseTo(-0.65);
    expect(dragToAim(-0.35)).toBeCloseTo(0.35);
    expect(dragToAim(-3)).toBe(1);
  });

  it("reverses pull displacement into the intended launch impulse", () => {
    expect(pullAimToLaunchAim(dragToAim(-0.7))).toBeCloseTo(-0.7);
    expect(pullAimToLaunchAim(dragToAim(0.4))).toBeCloseTo(0.4);
  });
});
