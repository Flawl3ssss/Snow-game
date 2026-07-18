import type { GameState } from "../app/GameStateMachine";
import type {
  LaunchParameters,
  SledSnapshot,
} from "../simulation/SledSimulation";

export class GameShell {
  readonly canvas: HTMLCanvasElement;
  readonly sceneLayer: HTMLDivElement;
  private readonly stateChip: HTMLDivElement;
  private readonly distanceLabel: HTMLSpanElement;
  private readonly speedLabel: HTMLSpanElement;
  private readonly launchPanel: HTMLDivElement;
  private readonly launchTitle: HTMLHeadingElement;
  private readonly powerFill: HTMLDivElement;
  private readonly aimLabel: HTMLSpanElement;
  private readonly resultsPanel: HTMLDivElement;
  private readonly resultDistance: HTMLElement;
  private readonly resetButton: HTMLButtonElement;

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
          <div class="launch-panel" data-testid="launch-panel">
            <span class="panel-eyebrow">G1 · ЗАПУСК</span>
            <h1>Потяни героя вниз</h1>
            <p>Смести палец в сторону, чтобы выбрать начальное направление, затем отпусти.</p>
            <div class="power-meter" aria-label="Сила запуска">
              <div class="power-meter__fill" data-testid="power-fill"></div>
            </div>
            <span class="aim-label" data-testid="aim-label">направление: прямо</span>
          </div>
          <div class="results-panel" data-testid="results-panel" hidden>
            <span class="panel-eyebrow">ЗАЕЗД ЗАВЕРШЁН</span>
            <h2><strong data-testid="result-distance">0</strong> м</h2>
            <p>Это техническая дистанция G1. Экономика появится только после приятного управления.</p>
            <button class="primary-action" type="button" data-testid="reset-action">Ещё запуск</button>
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
    const launchPanel = root.querySelector<HTMLDivElement>(
      '[data-testid="launch-panel"]',
    );
    const launchTitle = launchPanel?.querySelector<HTMLHeadingElement>("h1");
    const powerFill = root.querySelector<HTMLDivElement>(
      '[data-testid="power-fill"]',
    );
    const aimLabel = root.querySelector<HTMLSpanElement>(
      '[data-testid="aim-label"]',
    );
    const resultsPanel = root.querySelector<HTMLDivElement>(
      '[data-testid="results-panel"]',
    );
    const resultDistance = root.querySelector<HTMLElement>(
      '[data-testid="result-distance"]',
    );
    const resetButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="reset-action"]',
    );

    if (
      !canvas ||
      !sceneLayer ||
      !stateChip ||
      !distanceLabel ||
      !speedLabel ||
      !launchPanel ||
      !launchTitle ||
      !powerFill ||
      !aimLabel ||
      !resultsPanel ||
      !resultDistance ||
      !resetButton
    ) {
      throw new Error("Failed to create game shell");
    }

    this.canvas = canvas;
    this.sceneLayer = sceneLayer;
    this.stateChip = stateChip;
    this.distanceLabel = distanceLabel;
    this.speedLabel = speedLabel;
    this.launchPanel = launchPanel;
    this.launchTitle = launchTitle;
    this.powerFill = powerFill;
    this.aimLabel = aimLabel;
    this.resultsPanel = resultsPanel;
    this.resultDistance = resultDistance;
    this.resetButton = resetButton;
  }

  onReset(listener: () => void): void {
    this.resetButton.addEventListener("click", listener);
  }

  setState(state: GameState): void {
    this.stateChip.textContent = state;
    this.stateChip.dataset.state = state;

    this.launchPanel.hidden = state !== "BASE" && state !== "AIMING";
    this.resultsPanel.hidden = state !== "RESULTS";
    if (state === "BASE") this.launchTitle.textContent = "Потяни героя вниз";
    if (state === "AIMING")
      this.launchTitle.textContent = "Отпусти для запуска";
  }

  setAim(parameters: LaunchParameters): void {
    this.powerFill.style.transform = `scaleX(${parameters.power.toFixed(3)})`;
    const direction =
      parameters.aim < -0.15
        ? "влево"
        : parameters.aim > 0.15
          ? "вправо"
          : "прямо";
    this.aimLabel.textContent = `сила ${Math.round(parameters.power * 100)}% · ${direction}`;
  }

  setMetrics(snapshot: SledSnapshot): void {
    this.distanceLabel.textContent = snapshot.distanceMeters.toFixed(0);
    this.speedLabel.textContent = snapshot.forwardSpeed.toFixed(1);
    this.resultDistance.textContent = snapshot.distanceMeters.toFixed(0);
  }
}
