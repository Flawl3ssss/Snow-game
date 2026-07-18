import type { GameState } from "../app/GameStateMachine";
import type { FixedStepMetrics } from "../simulation/FixedStepLoop";
import type { SledSnapshot } from "../simulation/SledSimulation";

type DebugFrame = {
  fps: number;
  state: GameState;
  simulation: SledSnapshot;
  fixed: FixedStepMetrics;
  renderSize: string;
};

export class DebugOverlay {
  readonly element: HTMLPreElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("pre");
    this.element.className = "debug-overlay";
    this.element.dataset.testid = "debug-overlay";
    this.element.setAttribute("aria-hidden", "true");
    this.element.hidden = !new URLSearchParams(window.location.search).has(
      "debug",
    );
    parent.append(this.element);
  }

  render(frame: DebugFrame): void {
    this.element.textContent = [
      `state ${frame.state}`,
      `fps ${frame.fps.toFixed(0)}`,
      `fixed ${frame.fixed.fixedSteps} alpha ${frame.fixed.interpolationAlpha.toFixed(2)}`,
      `speed ${frame.simulation.forwardSpeed.toFixed(1)} m/s`,
      `distance ${frame.simulation.distanceMeters.toFixed(1)} m`,
      `x ${frame.simulation.x.toFixed(2)} steer ${frame.simulation.steer.toFixed(2)}`,
      `render ${frame.renderSize}`,
    ].join("\n");
  }
}
