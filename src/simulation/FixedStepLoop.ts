export type FixedStepMetrics = {
  fixedSteps: number;
  droppedSeconds: number;
  interpolationAlpha: number;
};

export type FixedStepOptions = {
  stepSeconds?: number;
  maxFrameSeconds?: number;
  maxSubSteps?: number;
};

export class FixedStepLoop {
  readonly stepSeconds: number;
  private readonly maxFrameSeconds: number;
  private readonly maxSubSteps: number;
  private accumulatorSeconds = 0;
  private lastTimeSeconds: number | null = null;

  constructor(options: FixedStepOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? 1 / 60;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.1;
    this.maxSubSteps = options.maxSubSteps ?? 5;
  }

  reset(nowSeconds?: number): void {
    this.accumulatorSeconds = 0;
    this.lastTimeSeconds = nowSeconds ?? null;
  }

  tick(
    nowSeconds: number,
    fixedUpdate: (dt: number) => void,
  ): FixedStepMetrics {
    if (this.lastTimeSeconds === null) {
      this.lastTimeSeconds = nowSeconds;
      return { fixedSteps: 0, droppedSeconds: 0, interpolationAlpha: 0 };
    }

    const rawFrameSeconds = Math.max(0, nowSeconds - this.lastTimeSeconds);
    this.lastTimeSeconds = nowSeconds;
    const frameSeconds = Math.min(rawFrameSeconds, this.maxFrameSeconds);
    let droppedSeconds = rawFrameSeconds - frameSeconds;
    this.accumulatorSeconds += frameSeconds;

    let fixedSteps = 0;
    while (
      this.accumulatorSeconds >= this.stepSeconds &&
      fixedSteps < this.maxSubSteps
    ) {
      fixedUpdate(this.stepSeconds);
      this.accumulatorSeconds -= this.stepSeconds;
      fixedSteps += 1;
    }

    if (
      fixedSteps === this.maxSubSteps &&
      this.accumulatorSeconds >= this.stepSeconds
    ) {
      droppedSeconds += this.accumulatorSeconds;
      this.accumulatorSeconds = 0;
    }

    return {
      fixedSteps,
      droppedSeconds,
      interpolationAlpha: this.accumulatorSeconds / this.stepSeconds,
    };
  }
}
