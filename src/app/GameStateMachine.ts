export const GAME_STATES = [
  "BOOT",
  "LOADING",
  "BASE",
  "AIMING",
  "LAUNCHING",
  "RIDING",
  "STOPPING",
  "RESULTS",
  "PAUSED",
] as const;

export type GameState = (typeof GAME_STATES)[number];

const allowedTransitions: Readonly<Record<GameState, readonly GameState[]>> = {
  BOOT: ["LOADING"],
  LOADING: ["BASE"],
  BASE: ["AIMING", "PAUSED"],
  AIMING: ["BASE", "LAUNCHING", "PAUSED"],
  LAUNCHING: ["RIDING", "PAUSED"],
  RIDING: ["STOPPING", "PAUSED"],
  STOPPING: ["RESULTS", "PAUSED"],
  RESULTS: ["BASE", "AIMING", "PAUSED"],
  PAUSED: ["BASE", "AIMING", "LAUNCHING", "RIDING", "STOPPING", "RESULTS"],
};

type StateListener = (next: GameState, previous: GameState) => void;

export class GameStateMachine {
  private currentState: GameState = "BOOT";
  private stateBeforePause: Exclude<GameState, "PAUSED"> = "BOOT";
  private readonly listeners = new Set<StateListener>();

  get state(): GameState {
    return this.currentState;
  }

  transition(next: GameState): void {
    if (next === this.currentState) return;

    if (!allowedTransitions[this.currentState].includes(next)) {
      throw new Error(
        `Invalid game-state transition: ${this.currentState} -> ${next}`,
      );
    }

    const previous = this.currentState;
    if (next === "PAUSED") {
      this.stateBeforePause = previous as Exclude<GameState, "PAUSED">;
    }
    this.currentState = next;
    this.listeners.forEach((listener) => listener(next, previous));
  }

  pause(): void {
    if (this.currentState !== "PAUSED") this.transition("PAUSED");
  }

  resume(): void {
    if (this.currentState === "PAUSED") this.transition(this.stateBeforePause);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
