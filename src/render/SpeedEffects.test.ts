import { describe, expect, it } from "vitest";
import { speedEffectIntensity } from "./SpeedEffects";

describe("speedEffectIntensity", () => {
  it("keeps low-speed travel visually calm", () => {
    expect(speedEffectIntensity(0)).toBe(0);
    expect(speedEffectIntensity(9.5)).toBe(0);
  });

  it("builds progressively and clamps at full intensity", () => {
    expect(speedEffectIntensity(17.25)).toBeCloseTo(0.5);
    expect(speedEffectIntensity(25)).toBe(1);
    expect(speedEffectIntensity(80)).toBe(1);
  });
});
