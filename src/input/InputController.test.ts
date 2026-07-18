import { describe, expect, it } from "vitest";
import { dragToSteer } from "./InputController";

describe("dragToSteer", () => {
  it("maps the mobile drag into the corrected camera-relative direction", () => {
    expect(dragToSteer(0.7)).toBeCloseTo(-0.7);
    expect(dragToSteer(-0.4)).toBeCloseTo(0.4);
    expect(dragToSteer(4)).toBe(-1);
  });
});
