import type { GameState } from "../app/GameStateMachine";
import type { RunDynamicsSnapshot } from "../gameplay/RunDynamics";
import type {
  ProgressSnapshot,
  UpgradeKind,
} from "../progression/PlayerProgression";
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
  private readonly scoreLabel: HTMLSpanElement;
  private readonly coinLabel: HTMLSpanElement;
  private readonly comboLabel: HTMLDivElement;
  private readonly goalLabel: HTMLDivElement;
  private readonly eventToast: HTMLDivElement;
  private readonly launchPanel: HTMLDivElement;
  private readonly launchTitle: HTMLHeadingElement;
  private readonly powerFill: HTMLDivElement;
  private readonly aimLabel: HTMLSpanElement;
  private readonly resultsPanel: HTMLDivElement;
  private readonly resultDistance: HTMLElement;
  private readonly resultScore: HTMLElement;
  private readonly resultCoins: HTMLElement;
  private readonly resultBest: HTMLElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly launchUpgradeButton: HTMLButtonElement;
  private readonly glideUpgradeButton: HTMLButtonElement;

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
            <div><strong data-testid="score">0</strong><span>очки</span></div>
            <div><strong data-testid="coins">0</strong><span>❄</span></div>
          </div>
          <div class="run-goal" data-testid="run-goal" hidden>Цель: снежинки 0/3</div>
          <div class="combo-chip" data-testid="combo" hidden>СЕРИЯ ×2</div>
          <div class="event-toast" data-testid="event-toast" hidden>+12</div>
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
            <div class="result-summary">
              <span><strong data-testid="result-score">0</strong> очков</span>
              <span><strong data-testid="result-coins">+0</strong> ❄</span>
              <span>рекорд <strong data-testid="result-best">0</strong> м</span>
            </div>
            <div class="upgrade-grid">
              <button class="upgrade-action" type="button" data-upgrade="launch" data-testid="upgrade-launch"></button>
              <button class="upgrade-action" type="button" data-upgrade="glide" data-testid="upgrade-glide"></button>
            </div>
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
    const scoreLabel = root.querySelector<HTMLSpanElement>(
      '[data-testid="score"]',
    );
    const coinLabel = root.querySelector<HTMLSpanElement>(
      '[data-testid="coins"]',
    );
    const comboLabel = root.querySelector<HTMLDivElement>(
      '[data-testid="combo"]',
    );
    const goalLabel = root.querySelector<HTMLDivElement>(
      '[data-testid="run-goal"]',
    );
    const eventToast = root.querySelector<HTMLDivElement>(
      '[data-testid="event-toast"]',
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
    const resultScore = root.querySelector<HTMLElement>(
      '[data-testid="result-score"]',
    );
    const resultCoins = root.querySelector<HTMLElement>(
      '[data-testid="result-coins"]',
    );
    const resultBest = root.querySelector<HTMLElement>(
      '[data-testid="result-best"]',
    );
    const resetButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="reset-action"]',
    );
    const launchUpgradeButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="upgrade-launch"]',
    );
    const glideUpgradeButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="upgrade-glide"]',
    );

    if (
      !canvas ||
      !sceneLayer ||
      !stateChip ||
      !distanceLabel ||
      !speedLabel ||
      !scoreLabel ||
      !coinLabel ||
      !comboLabel ||
      !goalLabel ||
      !eventToast ||
      !launchPanel ||
      !launchTitle ||
      !powerFill ||
      !aimLabel ||
      !resultsPanel ||
      !resultDistance ||
      !resultScore ||
      !resultCoins ||
      !resultBest ||
      !resetButton ||
      !launchUpgradeButton ||
      !glideUpgradeButton
    ) {
      throw new Error("Failed to create game shell");
    }

    this.canvas = canvas;
    this.sceneLayer = sceneLayer;
    this.stateChip = stateChip;
    this.distanceLabel = distanceLabel;
    this.speedLabel = speedLabel;
    this.scoreLabel = scoreLabel;
    this.coinLabel = coinLabel;
    this.comboLabel = comboLabel;
    this.goalLabel = goalLabel;
    this.eventToast = eventToast;
    this.launchPanel = launchPanel;
    this.launchTitle = launchTitle;
    this.powerFill = powerFill;
    this.aimLabel = aimLabel;
    this.resultsPanel = resultsPanel;
    this.resultDistance = resultDistance;
    this.resultScore = resultScore;
    this.resultCoins = resultCoins;
    this.resultBest = resultBest;
    this.resetButton = resetButton;
    this.launchUpgradeButton = launchUpgradeButton;
    this.glideUpgradeButton = glideUpgradeButton;
  }

  onReset(listener: () => void): void {
    this.resetButton.addEventListener("click", listener);
  }

  onUpgrade(listener: (kind: UpgradeKind) => void): void {
    this.launchUpgradeButton.addEventListener("click", () =>
      listener("launch"),
    );
    this.glideUpgradeButton.addEventListener("click", () => listener("glide"));
  }

  setState(state: GameState): void {
    this.stateChip.textContent = state;
    this.stateChip.dataset.state = state;

    this.launchPanel.hidden = state !== "BASE" && state !== "AIMING";
    this.resultsPanel.hidden = state !== "RESULTS";
    this.goalLabel.hidden = state !== "RIDING";
    if (state !== "RIDING") this.comboLabel.hidden = true;
    if (state === "BASE") this.launchTitle.textContent = "Потяни героя вниз";
    if (state === "AIMING")
      this.launchTitle.textContent = "Отпусти для запуска";
  }

  setAim(parameters: LaunchParameters): void {
    this.powerFill.style.transform = `scaleX(${parameters.power.toFixed(3)})`;
    const direction =
      parameters.aim < -0.15
        ? "вправо"
        : parameters.aim > 0.15
          ? "влево"
          : "прямо";
    this.aimLabel.textContent = `сила ${Math.round(parameters.power * 100)}% · ${direction}`;
  }

  setMetrics(snapshot: SledSnapshot): void {
    this.distanceLabel.textContent = snapshot.distanceMeters.toFixed(0);
    this.speedLabel.textContent = snapshot.forwardSpeed.toFixed(1);
    this.resultDistance.textContent = snapshot.distanceMeters.toFixed(0);
  }

  setDynamics(dynamics: RunDynamicsSnapshot, bankCoins: number): void {
    this.scoreLabel.textContent = dynamics.score.toString();
    this.coinLabel.textContent = `${bankCoins + dynamics.runCoins}`;
    this.goalLabel.textContent = dynamics.missionComplete
      ? "Цель выполнена · +5 ❄"
      : `Цель: снежинки ${dynamics.missionProgress}/${dynamics.missionTarget}`;
    this.goalLabel.classList.toggle("is-complete", dynamics.missionComplete);
    this.comboLabel.hidden = dynamics.combo < 2;
    this.comboLabel.textContent = `СЕРИЯ ×${dynamics.combo}`;
  }

  showEvent(text: string, tone: "good" | "boost" | "hit" = "good"): void {
    this.eventToast.textContent = text;
    this.eventToast.dataset.tone = tone;
    this.eventToast.hidden = false;
    this.eventToast.classList.remove("is-active");
    void this.eventToast.offsetWidth;
    this.eventToast.classList.add("is-active");
  }

  setRunResult(input: {
    distance: number;
    score: number;
    earnedCoins: number;
    progress: ProgressSnapshot;
    launchCost: number;
    glideCost: number;
    canLaunchUpgrade: boolean;
    canGlideUpgrade: boolean;
  }): void {
    this.resultDistance.textContent = input.distance.toFixed(0);
    this.resultScore.textContent = input.score.toString();
    this.resultCoins.textContent = `+${input.earnedCoins}`;
    this.resultBest.textContent = input.progress.bestDistance.toFixed(0);
    this.launchUpgradeButton.innerHTML = `<strong>РАЗГОН · ${input.progress.launchLevel}/5</strong><span>+0,75 м/с · ${input.launchCost} ❄</span>`;
    this.glideUpgradeButton.innerHTML = `<strong>СКОЛЬЖЕНИЕ · ${input.progress.glideLevel}/5</strong><span>меньше трения · ${input.glideCost} ❄</span>`;
    this.launchUpgradeButton.disabled = !input.canLaunchUpgrade;
    this.glideUpgradeButton.disabled = !input.canGlideUpgrade;
  }
}
