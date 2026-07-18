import type { GameState } from "../app/GameStateMachine";
import type { LaunchParameters } from "../simulation/SledSimulation";

type InputCallbacks = {
  getState: () => GameState;
  onAimStart: () => void;
  onAimChange: (parameters: LaunchParameters) => void;
  onAimCancel: () => void;
  onLaunch: (parameters: LaunchParameters) => void;
  onSteer: (steer: number) => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const dragToSteer = (horizontalDrag: number): number =>
  clamp(-horizontalDrag, -1, 1);

export const dragToAim = (horizontalDrag: number): number =>
  clamp(-horizontalDrag, -1, 1);

export const pullAimToLaunchAim = (pullAim: number): number =>
  clamp(-pullAim, -1, 1);

export class InputController {
  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private mode: "aim" | "steer" | null = null;
  private aim: LaunchParameters = { power: 0, aim: 0 };

  constructor(
    private readonly target: HTMLElement,
    private readonly callbacks: InputCallbacks,
  ) {
    target.addEventListener("pointerdown", this.handlePointerDown);
    target.addEventListener("pointermove", this.handlePointerMove);
    target.addEventListener("pointerup", this.handlePointerUp);
    target.addEventListener("pointercancel", this.handlePointerCancel);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  destroy(): void {
    this.target.removeEventListener("pointerdown", this.handlePointerDown);
    this.target.removeEventListener("pointermove", this.handlePointerMove);
    this.target.removeEventListener("pointerup", this.handlePointerUp);
    this.target.removeEventListener("pointercancel", this.handlePointerCancel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    const state = this.callbacks.getState();
    if (state !== "BASE" && state !== "RIDING") return;

    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.target.setPointerCapture(event.pointerId);

    if (state === "BASE") {
      this.mode = "aim";
      this.aim = { power: 0, aim: 0 };
      this.callbacks.onAimStart();
      this.callbacks.onAimChange(this.aim);
    } else {
      this.mode = "steer";
      this.callbacks.onSteer(0);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    const bounds = this.target.getBoundingClientRect();

    if (this.mode === "aim") {
      const maxPullPixels = Math.min(240, bounds.height * 0.3);
      const maxAimPixels = Math.max(90, bounds.width * 0.28);
      this.aim = {
        power: clamp((event.clientY - this.startY) / maxPullPixels, 0, 1),
        aim: dragToAim((event.clientX - this.startX) / maxAimPixels),
      };
      this.callbacks.onAimChange(this.aim);
    } else if (this.mode === "steer") {
      const fullSteerPixels = Math.max(64, bounds.width * 0.18);
      const rawSteer = (event.clientX - this.startX) / fullSteerPixels;
      const deadZone = 0.04;
      const steer = Math.abs(rawSteer) < deadZone ? 0 : dragToSteer(rawSteer);
      this.callbacks.onSteer(steer);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;

    if (this.mode === "aim") {
      if (this.aim.power >= 0.22) this.callbacks.onLaunch(this.aim);
      else this.callbacks.onAimCancel();
    } else if (this.mode === "steer") {
      this.callbacks.onSteer(0);
    }

    this.releasePointer(event.pointerId);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    if (this.mode === "aim") this.callbacks.onAimCancel();
    if (this.mode === "steer") this.callbacks.onSteer(0);
    this.releasePointer(event.pointerId);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "KeyF" && !event.repeat) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      } else {
        void this.target.parentElement
          ?.requestFullscreen()
          .catch(() => undefined);
      }
      return;
    }
    if (this.callbacks.getState() !== "RIDING") return;
    if (event.code === "ArrowLeft" || event.code === "KeyA")
      this.callbacks.onSteer(-1);
    if (event.code === "ArrowRight" || event.code === "KeyD")
      this.callbacks.onSteer(1);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (
      event.code === "ArrowLeft" ||
      event.code === "KeyA" ||
      event.code === "ArrowRight" ||
      event.code === "KeyD"
    ) {
      this.callbacks.onSteer(0);
    }
  };

  private releasePointer(pointerId: number): void {
    if (this.target.hasPointerCapture(pointerId))
      this.target.releasePointerCapture(pointerId);
    this.activePointerId = null;
    this.mode = null;
  }
}
