import type { GameState } from "../app/GameStateMachine";
import type { FoundationSnapshot } from "../simulation/FoundationSimulation";

export class GameShell {
  readonly canvas: HTMLCanvasElement;
  readonly sceneLayer: HTMLDivElement;
  private readonly stateChip: HTMLDivElement;
  private readonly distanceLabel: HTMLSpanElement;
  private readonly speedLabel: HTMLSpanElement;
  private readonly actionButton: HTMLButtonElement;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <main class="game-shell">
        <div class="scene-layer">
          <canvas class="game-canvas" aria-label="Трёхмерная снежная трасса"></canvas>
        </div>
        <section class="hud" aria-live="polite">
          <div class="hud__top">
            <div class="brand-chip"><span class="brand-chip__mark">S</span> Snow Sling</div>
            <div class="state-chip" data-testid="state-chip">BOOT</div>
          </div>
          <div class="hud__metrics">
            <div><strong data-testid="distance">0</strong><span>м</span></div>
            <div><strong data-testid="speed">0</strong><span>м/с</span></div>
          </div>
          <div class="foundation-card">
            <span class="foundation-card__eyebrow">G0 · FOUNDATION</span>
            <h1>Основа снежного спуска</h1>
            <p>Сейчас проверяются архитектура, fixed-step цикл и стабильная 3D-сцена. Герой временный.</p>
            <button class="primary-action" type="button" data-testid="primary-action" disabled>
              Подготовка…
            </button>
          </div>
        </section>
      </main>
    `;

    const canvas = root.querySelector<HTMLCanvasElement>(".game-canvas");
    const sceneLayer = root.querySelector<HTMLDivElement>(".scene-layer");
    const stateChip = root.querySelector<HTMLDivElement>(".state-chip");
    const distanceLabel = root.querySelector<HTMLSpanElement>(
      '[data-testid="distance"]',
    );
    const speedLabel = root.querySelector<HTMLSpanElement>(
      '[data-testid="speed"]',
    );
    const actionButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="primary-action"]',
    );

    if (
      !canvas ||
      !sceneLayer ||
      !stateChip ||
      !distanceLabel ||
      !speedLabel ||
      !actionButton
    ) {
      throw new Error("Failed to create game shell");
    }

    this.canvas = canvas;
    this.sceneLayer = sceneLayer;
    this.stateChip = stateChip;
    this.distanceLabel = distanceLabel;
    this.speedLabel = speedLabel;
    this.actionButton = actionButton;
  }

  onAction(listener: () => void): void {
    this.actionButton.addEventListener("click", listener);
  }

  setState(state: GameState): void {
    this.stateChip.textContent = state;
    this.stateChip.dataset.state = state;

    if (state === "BASE" || state === "RESULTS") {
      this.actionButton.disabled = false;
      this.actionButton.textContent =
        state === "BASE" ? "Проверить сцену" : "Повторить проверку";
    } else if (state === "RIDING") {
      this.actionButton.disabled = true;
      this.actionButton.textContent = "Fixed-step работает";
    } else {
      this.actionButton.disabled = true;
      this.actionButton.textContent = "Подготовка…";
    }
  }

  setMetrics(snapshot: FoundationSnapshot): void {
    this.distanceLabel.textContent = snapshot.distanceMeters.toFixed(0);
    this.speedLabel.textContent = snapshot.speedMetersPerSecond.toFixed(1);
  }
}
