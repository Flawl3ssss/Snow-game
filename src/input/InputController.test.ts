import { describe, expect, it } from "vitest";
import { dragToAim, dragToSteer } from "./InputController";

describe("dragToSteer", () => {
  it("maps the mobile drag into the corrected camera-relative direction", () => {
    expect(dragToSteer(0.7)).toBeCloseTo(-0.7);
    expect(dragToSteer(-0.4)).toBeCloseTo(0.4);
    expect(dragToSteer(4)).toBe(-1);
  });
});

describe("dragToAim", () => {
  it("launches toward the corrected side of the slingshot gesture", () => {
    expect(dragToAim(0.65)).toBeCloseTo(-0.65);
    expect(dragToAim(-0.35)).toBeCloseTo(0.35);
    expect(dragToAim(-3)).toBe(1);
  });
});
