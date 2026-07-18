export type SledInput = {
  steer: number;
};

export type LaunchParameters = {
  power: number;
  aim: number;
};

export type SledSnapshot = {
  elapsedSeconds: number;
  distanceMeters: number;
  x: number;
  z: number;
  height: number;
  forwardSpeed: number;
  lateralSpeed: number;
  headingRadians: number;
  steer: number;
  moving: boolean;
  stopped: boolean;
};

const TRACK_HALF_WIDTH = 13.5;
const MIN_LAUNCH_SPEED = 16;
const MAX_LAUNCH_SPEED = 24;
const MAX_AIM_RADIANS = (14 * Math.PI) / 180;
const STOP_SPEED = 0.55;
const STOP_CONFIRM_SECONDS = 1.25;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const surfaceHeightAt = (x: number, z: number): number => {
  const edgeLift = Math.pow(Math.abs(x) / 29, 2) * 2.8;
  const gentleWave = Math.sin(z * 0.075) * 0.18;
  return -z * 0.08 + edgeLift + gentleWave;
};

export class SledSimulation {
  private elapsedSeconds = 0;
  private x = 0;
  private z = 0;
  private forwardSpeed = 0;
  private lateralSpeed = 0;
  private headingRadians = 0;
  private steer = 0;
  private moving = false;
  private stopped = false;
  private belowStopSeconds = 0;

  launch(parameters: LaunchParameters): void {
    const power = clamp(parameters.power, 0, 1);
    const aim = clamp(parameters.aim, -1, 1);
    const launchSpeed =
      MIN_LAUNCH_SPEED + (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED) * power;
    const launchHeading = aim * MAX_AIM_RADIANS;

    this.elapsedSeconds = 0;
    this.x = 0;
    this.z = 0;
    this.forwardSpeed = launchSpeed * Math.cos(launchHeading);
    this.lateralSpeed = launchSpeed * Math.sin(launchHeading);
    this.headingRadians = launchHeading;
    this.steer = 0;
    this.moving = true;
    this.stopped = false;
    this.belowStopSeconds = 0;
  }

  reset(): void {
    this.elapsedSeconds = 0;
    this.x = 0;
    this.z = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.headingRadians = 0;
    this.steer = 0;
    this.moving = false;
    this.stopped = false;
    this.belowStopSeconds = 0;
  }

  update(dt: number, input: SledInput): void {
    if (!this.moving || this.stopped) return;

    const safeDt = clamp(dt, 0, 0.05);
    const targetSteer = clamp(input.steer, -1, 1);
    const steerResponse = 8.5;
    this.steer +=
      (targetSteer - this.steer) * Math.min(1, steerResponse * safeDt);

    const maxLateralSpeed = 2.5 + this.forwardSpeed * 0.095;
    const targetLateralSpeed = this.steer * maxLateralSpeed;
    const lateralResponse = 4.8;
    this.lateralSpeed +=
      (targetLateralSpeed - this.lateralSpeed) *
      Math.min(1, lateralResponse * safeDt);

    const gravityAlongSlope = 9.81 * 0.08 * 0.72;
    const rollingResistance = 0.52 + this.z * 0.0042;
    const aerodynamicDrag = 0.0018 * this.forwardSpeed * this.forwardSpeed;
    const steeringLoss =
      0.022 * Math.pow(Math.abs(this.steer), 1.4) * this.forwardSpeed;
    const acceleration =
      gravityAlongSlope - rollingResistance - aerodynamicDrag - steeringLoss;

    this.forwardSpeed = Math.max(0, this.forwardSpeed + acceleration * safeDt);
    this.x += this.lateralSpeed * safeDt;
    this.z += this.forwardSpeed * safeDt;

    if (Math.abs(this.x) > TRACK_HALF_WIDTH) {
      this.x = clamp(this.x, -TRACK_HALF_WIDTH, TRACK_HALF_WIDTH);
      this.lateralSpeed *= -0.18;
      this.forwardSpeed *= 0.965;
    }

    this.headingRadians = Math.atan2(
      this.lateralSpeed,
      Math.max(0.01, this.forwardSpeed),
    );
    this.elapsedSeconds += safeDt;

    if (this.forwardSpeed < STOP_SPEED) {
      this.belowStopSeconds += safeDt;
      if (this.belowStopSeconds >= STOP_CONFIRM_SECONDS) {
        this.forwardSpeed = 0;
        this.lateralSpeed = 0;
        this.moving = false;
        this.stopped = true;
      }
    } else {
      this.belowStopSeconds = 0;
    }
  }

  get snapshot(): SledSnapshot {
    return {
      elapsedSeconds: this.elapsedSeconds,
      distanceMeters: this.z,
      x: this.x,
      z: this.z,
      height: surfaceHeightAt(this.x, this.z),
      forwardSpeed: this.forwardSpeed,
      lateralSpeed: this.lateralSpeed,
      headingRadians: this.headingRadians,
      steer: this.steer,
      moving: this.moving,
      stopped: this.stopped,
    };
  }
}
