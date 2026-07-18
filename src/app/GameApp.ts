import { DebugOverlay } from "../diagnostics/DebugOverlay";
import { GameAudio } from "../audio/GameAudio";
import { RunDynamics, type DynamicsEvent } from "../gameplay/RunDynamics";
import { InputController, pullAimToLaunchAim } from "../input/InputController";
import { LocalPlatformBridge } from "../platform/LocalPlatformBridge";
import {
  PlayerProgression,
  type UpgradeKind,
} from "../progression/PlayerProgression";
import { SnowScene } from "../render/SnowScene";
import {
  FixedStepLoop,
  type FixedStepMetrics,
} from "../simulation/FixedStepLoop";
import {
  SledSimulation,
  type LaunchParameters,
} from "../simulation/SledSimulation";
import { GameShell } from "../ui/GameShell";
import { GameStateMachine } from "./GameStateMachine";

const FIXED_DT = 1 / 60;
const DEFAULT_AIM: LaunchParameters = { power: 0, aim: 0 };

export class GameApp {
  private readonly stateMachine = new GameStateMachine();
  private readonly fixedStep = new FixedStepLoop();
  private readonly simulation = new SledSimulation();
  private readonly platform = new LocalPlatformBridge();
  private readonly dynamics = new RunDynamics();
  private readonly progression = new PlayerProgression(window.localStorage);
  private readonly audio = new GameAudio();
  private readonly shell: GameShell;
  private readonly scene: SnowScene;
  private readonly debug: DebugOverlay;
  private readonly input: InputController;
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private lastRenderSeconds = 0;
  private smoothedFps = 60;
  private steer = 0;
  private aim: LaunchParameters = { ...DEFAULT_AIM };
  private manualTime = false;
  private runResolved = false;
  private lastEarnedCoins = 0;
  private fixedMetrics: FixedStepMetrics = {
    fixedSteps: 0,
    droppedSeconds: 0,
    interpolationAlpha: 0,
  };

  constructor(root: HTMLElement) {
    this.shell = new GameShell(root);
    this.scene = new SnowScene(this.shell.canvas);
    this.debug = new DebugOverlay(this.shell.sceneLayer);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.input = new InputController(this.shell.canvas, {
      getState: () => this.stateMachine.state,
      onAimStart: () => this.beginAim(),
      onAimChange: (parameters) => this.updateAim(parameters),
      onAimCancel: () => this.cancelAim(),
      onLaunch: (parameters) => this.launch(parameters),
      onSteer: (steer) => {
        this.steer = steer;
      },
    });

    this.stateMachine.subscribe((next) => {
      this.shell.setState(next);
      if (next === "RIDING") this.platform.gameplayStart();
      if (next === "RESULTS" || next === "BASE") this.platform.gameplayStop();
    });

    this.shell.onReset(() => this.resetRun());
    this.shell.onUpgrade((kind) => this.purchaseUpgrade(kind));
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.handlePageHide);
    this.resizeObserver.observe(this.shell.sceneLayer);
    this.installTestHooks();
  }

  async start(): Promise<void> {
    this.stateMachine.transition("LOADING");
    await this.platform.initialize();
    this.stateMachine.transition("BASE");
    this.shell.setAim(this.aim);
    this.shell.setDynamics(
      this.dynamics.snapshot,
      this.progression.snapshot.coins,
    );
    this.resize();
    this.fixedStep.reset(performance.now() / 1000);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.input.destroy();
    this.resizeObserver.disconnect();
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("pagehide", this.handlePageHide);
    delete window.render_game_to_text;
    delete window.advanceTime;
    this.audio.close();
    this.scene.dispose();
  }

  private readonly frame = (timeMs: number): void => {
    const nowSeconds = timeMs / 1000;
    const renderDelta =
      this.lastRenderSeconds === 0
        ? 1 / 60
        : nowSeconds - this.lastRenderSeconds;
    this.lastRenderSeconds = nowSeconds;
    const instantFps = renderDelta > 0 ? 1 / renderDelta : 60;
    this.smoothedFps += (instantFps - this.smoothedFps) * 0.08;

    if (!this.manualTime) {
      this.fixedMetrics = this.fixedStep.tick(nowSeconds, (dt) =>
        this.step(dt),
      );
    }
    this.render();
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private step(dt: number): void {
    if (this.stateMachine.state !== "RIDING") return;
    const previous = this.simulation.snapshot;
    this.simulation.update(dt, { steer: this.steer });
    const events = this.dynamics.update(previous, this.simulation.snapshot, dt);
    for (const event of events) this.resolveDynamicsEvent(event);
    if (this.simulation.snapshot.stopped) {
      this.steer = 0;
      this.resolveRun();
      this.stateMachine.transition("STOPPING");
      this.stateMachine.transition("RESULTS");
    }
  }

  private render(): void {
    const snapshot = this.simulation.snapshot;
    this.scene.render(
      snapshot,
      this.stateMachine.state,
      this.aim,
      this.dynamics.snapshot,
    );
    this.shell.setMetrics(snapshot);
    const visibleBankCoins =
      this.progression.snapshot.coins -
      (this.runResolved ? this.dynamics.snapshot.runCoins : 0);
    this.shell.setDynamics(this.dynamics.snapshot, visibleBankCoins);
    this.debug.render({
      fps: this.smoothedFps,
      state: this.stateMachine.state,
      simulation: snapshot,
      fixed: this.fixedMetrics,
      renderSize: this.scene.sizeLabel,
    });
  }

  private beginAim(): void {
    if (this.stateMachine.state !== "BASE") return;
    this.aim = { ...DEFAULT_AIM };
    this.stateMachine.transition("AIMING");
  }

  private updateAim(parameters: LaunchParameters): void {
    if (this.stateMachine.state !== "AIMING") return;
    this.aim = { ...parameters };
    this.shell.setAim(this.aim);
  }

  private cancelAim(): void {
    if (this.stateMachine.state !== "AIMING") return;
    this.aim = { ...DEFAULT_AIM };
    this.shell.setAim(this.aim);
    this.stateMachine.transition("BASE");
  }

  private launch(parameters: LaunchParameters): void {
    if (this.stateMachine.state !== "AIMING") return;
    this.aim = { ...parameters };
    this.dynamics.reset();
    this.runResolved = false;
    this.simulation.configureUpgrades({
      launchSpeedBonus: this.progression.launchSpeedBonus,
      snowResistanceMultiplier: this.progression.snowResistanceMultiplier,
    });
    this.stateMachine.transition("LAUNCHING");
    this.simulation.launch({
      ...this.aim,
      aim: pullAimToLaunchAim(this.aim.aim),
    });
    this.audio.play("launch");
    this.stateMachine.transition("RIDING");
  }

  private resetRun(): void {
    if (this.stateMachine.state !== "RESULTS") return;
    this.simulation.reset();
    this.dynamics.reset();
    this.aim = { ...DEFAULT_AIM };
    this.steer = 0;
    this.shell.setAim(this.aim);
    this.scene.resetCamera();
    this.stateMachine.transition("BASE");
  }

  private resolveDynamicsEvent(event: DynamicsEvent): void {
    this.scene.triggerCourseEvent(event);
    if (event.type === "coin") {
      this.audio.play("coin");
      this.shell.showEvent(`+${event.points} · ❄ ×${event.combo}`);
    } else if (event.type === "boost") {
      this.simulation.applyBoost(3.8);
      this.audio.play("boost");
      this.shell.showEvent("ТУРБО · +3,8 м/с", "boost");
    } else if (event.type === "rock") {
      this.simulation.applyObstacleHit();
      this.audio.play("rock");
      this.shell.showEvent("УДАР · СЕРИЯ СБРОШЕНА", "hit");
    } else {
      this.audio.play("airtime");
      this.shell.showEvent(
        `${event.seconds.toFixed(1)} с в воздухе · +${event.points}`,
        "boost",
      );
    }
  }

  private resolveRun(): void {
    if (this.runResolved) return;
    this.runResolved = true;
    const snapshot = this.simulation.snapshot;
    const dynamics = this.dynamics.snapshot;
    this.lastEarnedCoins = this.progression.completeRun({
      distance: snapshot.distanceMeters,
      score: dynamics.score,
      collectedCoins: dynamics.runCoins,
      missionComplete: dynamics.missionComplete,
    });
    this.audio.play("result");
    this.refreshResultPanel();
  }

  private purchaseUpgrade(kind: UpgradeKind): void {
    if (this.stateMachine.state !== "RESULTS") return;
    if (!this.progression.purchase(kind)) return;
    this.audio.play("upgrade");
    this.shell.showEvent(
      kind === "launch" ? "РАЗГОН УЛУЧШЕН" : "СКОЛЬЖЕНИЕ УЛУЧШЕНО",
      "boost",
    );
    this.refreshResultPanel();
  }

  private refreshResultPanel(): void {
    const progress = this.progression.snapshot;
    this.shell.setRunResult({
      distance: this.simulation.snapshot.distanceMeters,
      score: this.dynamics.snapshot.score,
      earnedCoins: this.lastEarnedCoins,
      progress,
      launchCost: this.progression.upgradeCost("launch"),
      glideCost: this.progression.upgradeCost("glide"),
      canLaunchUpgrade: this.progression.canUpgrade("launch"),
      canGlideUpgrade: this.progression.canUpgrade("glide"),
    });
  }

  private installTestHooks(): void {
    window.render_game_to_text = () => {
      const snapshot = this.simulation.snapshot;
      return JSON.stringify({
        coordinateSystem: "x right, z downhill, y up; meters and seconds",
        state: this.stateMachine.state,
        aim: this.aim,
        rider: {
          x: snapshot.x,
          z: snapshot.z,
          height: snapshot.height,
          forwardSpeed: snapshot.forwardSpeed,
          lateralSpeed: snapshot.lateralSpeed,
          verticalSpeed: snapshot.verticalSpeed,
          headingRadians: snapshot.headingRadians,
          pitchRadians: snapshot.pitchRadians,
          rollRadians: snapshot.rollRadians,
          slopeRadians: snapshot.slopeRadians,
          steer: snapshot.steer,
          grounded: snapshot.grounded,
          airborneSeconds: snapshot.airborneSeconds,
          landingImpact: snapshot.landingImpact,
          moving: snapshot.moving,
          stopped: snapshot.stopped,
        },
        distanceMeters: snapshot.distanceMeters,
        dynamics: {
          ...this.dynamics.snapshot,
          consumedIds: [...this.dynamics.snapshot.consumedIds],
        },
        progress: this.progression.snapshot,
      });
    };

    window.advanceTime = (milliseconds: number) => {
      this.manualTime = true;
      const safeMilliseconds = Math.max(0, Math.min(milliseconds, 180_000));
      const steps = Math.ceil(safeMilliseconds / (FIXED_DT * 1000));
      for (let index = 0; index < steps; index += 1) this.step(FIXED_DT);
      this.fixedMetrics = {
        fixedSteps: steps,
        droppedSeconds: 0,
        interpolationAlpha: 0,
      };
      this.scene.snapCamera(this.simulation.snapshot, this.stateMachine.state);
      this.render();
    };
  }

  private resize(): void {
    const bounds = this.shell.sceneLayer.getBoundingClientRect();
    this.scene.resize(bounds.width, bounds.height, window.devicePixelRatio);
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stateMachine.pause();
      this.fixedStep.reset();
    } else if (this.stateMachine.state === "PAUSED") {
      this.fixedStep.reset(performance.now() / 1000);
      this.stateMachine.resume();
    }
  };

  private readonly handlePageHide = (): void => {
    this.platform.gameplayStop();
  };
}
