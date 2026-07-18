import { describe, expect, it, vi } from "vitest";
import { FixedStepLoop } from "./FixedStepLoop";

describe("FixedStepLoop", () => {
  it("runs deterministic 60 Hz updates across uneven render frames", () => {
    const loop = new FixedStepLoop();
    const update = vi.fn();
    loop.tick(0, update);
    loop.tick(0.01, update);
    loop.tick(0.02, update);
    loop.tick(0.05, update);
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenLastCalledWith(1 / 60);
  });

  it("caps work after a long background pause", () => {
    const loop = new FixedStepLoop();
    const update = vi.fn();
    loop.tick(0, update);
    const metrics = loop.tick(10, update);
    expect(update).toHaveBeenCalledTimes(5);
    expect(metrics.droppedSeconds).toBeGreaterThan(9);
  });

  it("can reset without producing catch-up steps", () => {
    const loop = new FixedStepLoop();
    const update = vi.fn();
    loop.tick(0, update);
    loop.reset(20);
    loop.tick(20.001, update);
    expect(update).not.toHaveBeenCalled();
  });
});
