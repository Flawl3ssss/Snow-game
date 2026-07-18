import { DebugOverlay } from "../diagnostics/DebugOverlay";
import { LocalPlatformBridge } from "../platform/LocalPlatformBridge";
import { SnowScene } from "../render/SnowScene";
import {
  FixedStepLoop,
  type FixedStepMetrics,
} from "../simulation/FixedStepLoop";
import { FoundationSimulation } from "../simulation/FoundationSimulation";
import { GameShell } from "../ui/GameShell";
import { GameStateMachine } from "./GameStateMachine";

export class GameApp {
  private readonly stateMachine = new GameStateMachine();
  private readonly fixedStep = new FixedStepLoop();
  private readonly simulation = new FoundationSimulation();
  private readonly platform = new LocalPlatformBridge();
  private readonly shell: GameShell;
  private readonly scene: SnowScene;
  private readonly debug: DebugOverlay;
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private lastRenderSeconds = 0;
  private smoothedFps = 60;
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

    this.stateMachine.subscribe((next) => {
      this.shell.setState(next);
      if (next === "RIDING") this.platform.gameplayStart();
      if (next === "RESULTS" || next === "BASE") this.platform.gameplayStop();
    });

    this.shell.onAction(() => this.runFoundationPreview());
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.handlePageHide);
    this.resizeObserver.observe(this.shell.sceneLayer);
  }

  async start(): Promise<void> {
    this.stateMachine.transition("LOADING");
    await this.platform.initialize();
    this.stateMachine.transition("BASE");
    this.resize();
    this.fixedStep.reset(performance.now() / 1000);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("pagehide", this.handlePageHide);
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

    this.fixedMetrics = this.fixedStep.tick(nowSeconds, (dt) => {
      this.simulation.update(dt, this.stateMachine.state === "RIDING");
      if (
        this.stateMachine.state === "RIDING" &&
        this.simulation.snapshot.speedMetersPerSecond <= 0.05
      ) {
        this.stateMachine.transition("STOPPING");
        this.stateMachine.transition("RESULTS");
      }
    });

    const snapshot = this.simulation.snapshot;
    this.scene.render(snapshot);
    this.shell.setMetrics(snapshot);
    this.debug.render({
      fps: this.smoothedFps,
      state: this.stateMachine.state,
      simulation: snapshot,
      fixed: this.fixedMetrics,
      renderSize: this.scene.sizeLabel,
    });
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private runFoundationPreview(): void {
    if (this.stateMachine.state === "RESULTS") {
      this.stateMachine.transition("BASE");
    }
    if (this.stateMachine.state !== "BASE") return;

    this.simulation.reset();
    this.stateMachine.transition("AIMING");
    this.stateMachine.transition("LAUNCHING");
    this.simulation.launch();
    this.stateMachine.transition("RIDING");
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
