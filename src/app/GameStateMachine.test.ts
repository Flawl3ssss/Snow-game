import { describe, expect, it, vi } from "vitest";
import { GameStateMachine } from "./GameStateMachine";

describe("GameStateMachine", () => {
  it("moves through the foundation boot flow", () => {
    const machine = new GameStateMachine();
    machine.transition("LOADING");
    machine.transition("BASE");
    expect(machine.state).toBe("BASE");
  });

  it("rejects invalid transitions", () => {
    const machine = new GameStateMachine();
    expect(() => machine.transition("RIDING")).toThrow(/BOOT -> RIDING/);
  });

  it("resumes the state that was active before pause", () => {
    const machine = new GameStateMachine();
    machine.transition("LOADING");
    machine.transition("BASE");
    machine.transition("AIMING");
    machine.pause();
    machine.resume();
    expect(machine.state).toBe("AIMING");
  });

  it("notifies subscribers once per actual change", () => {
    const machine = new GameStateMachine();
    const listener = vi.fn();
    machine.subscribe(listener);
    machine.transition("LOADING");
    machine.transition("LOADING");
    expect(listener).toHaveBeenCalledOnce();
  });
});
