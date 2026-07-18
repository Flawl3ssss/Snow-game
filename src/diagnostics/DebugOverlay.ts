import type { GameState } from "../app/GameStateMachine";
import type { FoundationSnapshot } from "../simulation/FoundationSimulation";
import type { FixedStepMetrics } from "../simulation/FixedStepLoop";

type DebugFrame = {
  fps: number;
  state: GameState;
  simulation: FoundationSnapshot;
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
    parent.append(this.element);
  }

  render(frame: DebugFrame): void {
    this.element.textContent = [
      `state ${frame.state}`,
      `fps ${frame.fps.toFixed(0)}`,
      `fixed ${frame.fixed.fixedSteps} alpha ${frame.fixed.interpolationAlpha.toFixed(2)}`,
      `speed ${frame.simulation.speedMetersPerSecond.toFixed(1)} m/s`,
      `distance ${frame.simulation.distanceMeters.toFixed(1)} m`,
      `render ${frame.renderSize}`,
    ].join("\n");
  }
}
