export type SledInput = {
  steer: number;
};

export type LaunchParameters = {
  power: number;
  aim: number;
};

export type SledUpgradeTuning = {
  launchSpeedBonus: number;
  snowResistanceMultiplier: number;
};

export type SledSnapshot = {
  elapsedSeconds: number;
  distanceMeters: number;
  x: number;
  z: number;
  height: number;
  forwardSpeed: number;
  lateralSpeed: number;
  verticalSpeed: number;
  headingRadians: number;
  pitchRadians: number;
  rollRadians: number;
  slopeRadians: number;
  steer: number;
  grounded: boolean;
  airborneSeconds: number;
  landingImpact: number;
  moving: boolean;
  stopped: boolean;
};

export const SLED_PHYSICS = {
  gravity: 9.81,
  trackHalfWidth: 13.5,
  minimumLaunchSpeed: 16,
  maximumLaunchSpeed: 24,
  maximumAimRadians: (14 * Math.PI) / 180,
  baseSnowResistance: 0.64,
  distanceSnowResistance: 0.0048,
  aerodynamicDrag: 0.0018,
  airDragPerSecond: 0.035,
  activeLateralResponse: 9,
  neutralLateralResponse: 0.62,
  groundSteerResponse: 15,
  airSteerResponse: 4.2,
  airSteerAcceleration: 3.4,
  maximumAirLateralSpeed: 4.8,
  takeoffGravityRatio: 0.72,
  minimumTakeoffVerticalSpeed: 1,
  minimumRampTakeoffVerticalSpeed: 2.2,
  landingLossPerImpact: 0.014,
  maximumLandingLoss: 0.24,
  stopSpeed: 0.55,
  stopConfirmationSeconds: 1.25,
} as const;

const DERIVATIVE_STEP = 0.2;
const CURVATURE_STEP = 0.35;
export const RAMP_PHYSICAL_HALF_WIDTH = 6.4;

export const RAMP_SURFACES = [
  { start: 58, crest: 72, end: 77, height: 3.4 },
  { start: 128, crest: 140, end: 145, height: 2.7 },
] as const;

const RAMP_TAKEOFF_ZONES = [
  { start: 68.5, end: 71.2, sample: 69 },
  { start: 134.5, end: 137.2, sample: 135.5 },
] as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const rampHeightAt = (
  z: number,
  start: number,
  crest: number,
  end: number,
  height: number,
): number => {
  if (z <= start || z >= end) return 0;
  if (z <= crest) return height * smoothstep((z - start) / (crest - start));
  return height * (1 - smoothstep((z - crest) / (end - crest)));
};

const rampLateralMask = (x: number): number =>
  Math.exp(-Math.pow(Math.abs(x) / RAMP_PHYSICAL_HALF_WIDTH, 6));

export const surfaceHeightAt = (x: number, z: number): number => {
  const edgeLift = Math.pow(Math.abs(x) / 29, 2) * 2.8;
  const baseDescent = -z * 0.072;
  const longWave = 1.9 * (Math.sin(z * 0.06 + 2.2) - Math.sin(2.2));
  const shortWave = 0.45 * (Math.sin(z * 0.145 + 1.5) - Math.sin(1.5));
  const rampMask = rampLateralMask(x);
  const rampHeight = RAMP_SURFACES.reduce(
    (height, ramp) =>
      height +
      rampHeightAt(z, ramp.start, ramp.crest, ramp.end, ramp.height) * rampMask,
    0,
  );
  return baseDescent + longWave + shortWave + edgeLift + rampHeight;
};

export const surfaceSlopeZAt = (x: number, z: number): number =>
  (surfaceHeightAt(x, z + DERIVATIVE_STEP) -
    surfaceHeightAt(x, z - DERIVATIVE_STEP)) /
  (DERIVATIVE_STEP * 2);

export const surfaceCurvatureZAt = (x: number, z: number): number =>
  (surfaceHeightAt(x, z + CURVATURE_STEP) -
    2 * surfaceHeightAt(x, z) +
    surfaceHeightAt(x, z - CURVATURE_STEP)) /
  (CURVATURE_STEP * CURVATURE_STEP);

const sweptRampTakeoffSlope = (
  startX: number,
  endX: number,
  startZ: number,
  endZ: number,
): { index: number; slope: number } | undefined => {
  const minimumX = Math.min(startX, endX);
  const maximumX = Math.max(startX, endX);
  if (
    minimumX > RAMP_PHYSICAL_HALF_WIDTH ||
    maximumX < -RAMP_PHYSICAL_HALF_WIDTH
  ) {
    return undefined;
  }
  const sampleX = clamp(0, minimumX, maximumX);
  for (const [index, zone] of RAMP_TAKEOFF_ZONES.entries()) {
    if (endZ < zone.start || startZ > zone.end) continue;
    return {
      index,
      slope: Math.max(0.08, surfaceSlopeZAt(sampleX, zone.sample)),
    };
  }
  return undefined;
};

export class SledSimulation {
  private elapsedSeconds = 0;
  private x = 0;
  private z = 0;
  private height = surfaceHeightAt(0, 0);
  private forwardSpeed = 0;
  private lateralSpeed = 0;
  private verticalSpeed = 0;
  private headingRadians = 0;
  private pitchRadians = 0;
  private rollRadians = 0;
  private slopeRadians = Math.atan(surfaceSlopeZAt(0, 0));
  private steer = 0;
  private grounded = true;
  private airborneSeconds = 0;
  private landingImpact = 0;
  private landingCooldownSeconds = 0;
  private moving = false;
  private stopped = false;
  private belowStopSeconds = 0;
  private launchSpeedBonus = 0;
  private snowResistanceMultiplier = 1;
  private readonly triggeredRampTakeoffs = new Set<number>();

  configureUpgrades(tuning: SledUpgradeTuning): void {
    this.launchSpeedBonus = clamp(tuning.launchSpeedBonus, 0, 6);
    this.snowResistanceMultiplier = clamp(
      tuning.snowResistanceMultiplier,
      0.65,
      1,
    );
  }

  launch(parameters: LaunchParameters): void {
    const power = clamp(parameters.power, 0, 1);
    const aim = clamp(parameters.aim, -1, 1);
    const launchSpeed =
      SLED_PHYSICS.minimumLaunchSpeed +
      (SLED_PHYSICS.maximumLaunchSpeed - SLED_PHYSICS.minimumLaunchSpeed) *
        power +
      this.launchSpeedBonus;
    const launchHeading = aim * SLED_PHYSICS.maximumAimRadians;

    this.elapsedSeconds = 0;
    this.x = 0;
    this.z = 0;
    this.height = surfaceHeightAt(0, 0);
    this.forwardSpeed = launchSpeed * Math.cos(launchHeading);
    this.lateralSpeed = launchSpeed * Math.sin(launchHeading);
    this.verticalSpeed = this.forwardSpeed * surfaceSlopeZAt(0, 0);
    this.headingRadians = launchHeading;
    this.slopeRadians = Math.atan(surfaceSlopeZAt(0, 0));
    this.pitchRadians = this.slopeRadians;
    this.rollRadians = 0;
    this.steer = 0;
    this.grounded = true;
    this.airborneSeconds = 0;
    this.landingImpact = 0;
    this.landingCooldownSeconds = 0;
    this.moving = true;
    this.stopped = false;
    this.belowStopSeconds = 0;
    this.triggeredRampTakeoffs.clear();
  }

  reset(): void {
    this.elapsedSeconds = 0;
    this.x = 0;
    this.z = 0;
    this.height = surfaceHeightAt(0, 0);
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.verticalSpeed = 0;
    this.headingRadians = 0;
    this.slopeRadians = Math.atan(surfaceSlopeZAt(0, 0));
    this.pitchRadians = this.slopeRadians;
    this.rollRadians = 0;
    this.steer = 0;
    this.grounded = true;
    this.airborneSeconds = 0;
    this.landingImpact = 0;
    this.landingCooldownSeconds = 0;
    this.moving = false;
    this.stopped = false;
    this.belowStopSeconds = 0;
    this.triggeredRampTakeoffs.clear();
  }

  update(dt: number, input: SledInput): void {
    if (!this.moving || this.stopped) return;

    const safeDt = clamp(dt, 0, 0.05);
    const targetSteer = clamp(input.steer, -1, 1);
    this.updateSteer(safeDt, targetSteer);

    if (this.grounded) this.updateGrounded(safeDt, targetSteer);
    else this.updateAirborne(safeDt, targetSteer);

    this.headingRadians = Math.atan2(
      this.lateralSpeed,
      Math.max(0.01, this.forwardSpeed),
    );
    this.elapsedSeconds += safeDt;
    this.updateStopState(safeDt);
  }

  private updateSteer(dt: number, targetSteer: number): void {
    const steerResponse = this.grounded
      ? SLED_PHYSICS.groundSteerResponse
      : SLED_PHYSICS.airSteerResponse;
    this.steer += (targetSteer - this.steer) * Math.min(1, steerResponse * dt);
  }

  private updateGrounded(dt: number, targetSteer: number): void {
    this.airborneSeconds = 0;
    this.landingCooldownSeconds = Math.max(0, this.landingCooldownSeconds - dt);
    this.landingImpact = Math.max(0, this.landingImpact - 8 * dt);

    this.updateLateralGroundSpeed(dt, targetSteer);

    const slope = surfaceSlopeZAt(this.x, this.z);
    const curvature = surfaceCurvatureZAt(this.x, this.z);
    this.slopeRadians = Math.atan(slope);
    const gravityAlongSlope =
      (-SLED_PHYSICS.gravity * slope) / Math.sqrt(1 + slope * slope);
    const snowResistance =
      SLED_PHYSICS.baseSnowResistance +
      this.z * SLED_PHYSICS.distanceSnowResistance;
    const aerodynamicDrag =
      SLED_PHYSICS.aerodynamicDrag * this.forwardSpeed * this.forwardSpeed;
    const steeringLoss =
      0.022 * Math.pow(Math.abs(this.steer), 1.4) * this.forwardSpeed;
    const acceleration =
      gravityAlongSlope -
      snowResistance * this.snowResistanceMultiplier -
      aerodynamicDrag -
      steeringLoss;

    this.forwardSpeed = Math.max(0, this.forwardSpeed + acceleration * dt);

    const requiredVerticalAcceleration =
      curvature * this.forwardSpeed * this.forwardSpeed;
    const projectedZ = this.z + this.forwardSpeed * dt;
    const projectedX = this.x + this.lateralSpeed * dt;
    const rampTakeoff = sweptRampTakeoffSlope(
      this.x,
      projectedX,
      this.z,
      projectedZ,
    );
    const rampTakeoffSlope =
      rampTakeoff && !this.triggeredRampTakeoffs.has(rampTakeoff.index)
        ? rampTakeoff.slope
        : undefined;
    const naturalTakeoff =
      this.landingCooldownSeconds <= 0 &&
      this.z > 8 &&
      this.forwardSpeed > 6 &&
      slope > 0 &&
      this.forwardSpeed * slope >= SLED_PHYSICS.minimumTakeoffVerticalSpeed &&
      requiredVerticalAcceleration <
        -SLED_PHYSICS.gravity * SLED_PHYSICS.takeoffGravityRatio;
    const guaranteedRampTakeoff =
      this.forwardSpeed > 7 && rampTakeoffSlope !== undefined;

    if (naturalTakeoff || guaranteedRampTakeoff) {
      if (rampTakeoff && rampTakeoffSlope !== undefined) {
        this.triggeredRampTakeoffs.add(rampTakeoff.index);
      }
      this.grounded = false;
      const launchSlope = Math.max(slope, rampTakeoffSlope ?? slope);
      this.verticalSpeed = Math.max(
        guaranteedRampTakeoff
          ? SLED_PHYSICS.minimumRampTakeoffVerticalSpeed
          : SLED_PHYSICS.minimumTakeoffVerticalSpeed,
        this.forwardSpeed * launchSlope,
      );
      this.height += 0.025;
      this.updateAirborne(dt, targetSteer);
      return;
    }

    this.x += this.lateralSpeed * dt;
    this.z += this.forwardSpeed * dt;
    this.resolveTrackEdges();
    const nextSlope = surfaceSlopeZAt(this.x, this.z);
    this.height = surfaceHeightAt(this.x, this.z);
    this.verticalSpeed = this.forwardSpeed * nextSlope;
    this.slopeRadians = Math.atan(nextSlope);
    const targetPitch = this.slopeRadians;
    this.pitchRadians +=
      (targetPitch - this.pitchRadians) * Math.min(1, 9 * dt);
    const targetRoll = -this.steer * Math.min(0.15, this.forwardSpeed * 0.006);
    this.rollRadians += (targetRoll - this.rollRadians) * Math.min(1, 7 * dt);
  }

  private updateLateralGroundSpeed(dt: number, targetSteer: number): void {
    const maxLateralSpeed = 3.4 + this.forwardSpeed * 0.13;
    const remainingEdgeRoom = SLED_PHYSICS.trackHalfWidth - Math.abs(this.x);
    const steeringOutward = this.x * this.steer > 0;
    const edgeSteeringFactor = steeringOutward
      ? clamp(remainingEdgeRoom / 2.25, 0, 1)
      : 1;
    const speedTraction = clamp(1.2 - this.forwardSpeed * 0.009, 0.82, 1);
    // Steering redirects forward momentum; it must never become a sideways
    // motor after the sled has effectively stopped.
    const movementControl = smoothstep(this.forwardSpeed / 2.4);
    const targetLateralSpeed =
      this.steer *
      maxLateralSpeed *
      edgeSteeringFactor *
      speedTraction *
      movementControl;
    const isActivelySteering = Math.abs(targetSteer) > 0.025;
    const lateralResponse = isActivelySteering
      ? SLED_PHYSICS.activeLateralResponse
      : SLED_PHYSICS.neutralLateralResponse;
    this.lateralSpeed +=
      (targetLateralSpeed - this.lateralSpeed) *
      Math.min(1, lateralResponse * dt);
  }

  private updateAirborne(dt: number, targetSteer: number): void {
    this.airborneSeconds += dt;
    const dragFactor = Math.max(0, 1 - SLED_PHYSICS.airDragPerSecond * dt);
    this.forwardSpeed *= dragFactor;
    this.lateralSpeed *= dragFactor;
    const airControl =
      targetSteer *
      SLED_PHYSICS.airSteerAcceleration *
      clamp(this.forwardSpeed / 18, 0.65, 1.25);
    this.lateralSpeed = clamp(
      this.lateralSpeed + airControl * dt,
      -SLED_PHYSICS.maximumAirLateralSpeed,
      SLED_PHYSICS.maximumAirLateralSpeed,
    );
    const nextVerticalSpeed = this.verticalSpeed - SLED_PHYSICS.gravity * dt;
    const nextX = this.x + this.lateralSpeed * dt;
    const nextZ = this.z + this.forwardSpeed * dt;
    const nextHeight =
      this.height +
      this.verticalSpeed * dt -
      0.5 * SLED_PHYSICS.gravity * dt * dt;
    const terrainHeight = surfaceHeightAt(nextX, nextZ);

    this.x = nextX;
    this.z = nextZ;
    this.height = nextHeight;
    this.verticalSpeed = nextVerticalSpeed;
    this.resolveTrackEdges();

    const horizontalSpeed = Math.hypot(this.forwardSpeed, this.lateralSpeed);
    const flightPitch = Math.atan2(
      this.verticalSpeed,
      Math.max(0.01, horizontalSpeed),
    );
    this.pitchRadians +=
      (flightPitch - this.pitchRadians) * Math.min(1, 5 * dt);
    const targetAirRoll = -this.steer * 0.1;
    this.rollRadians +=
      (targetAirRoll - this.rollRadians) * Math.min(1, 2.6 * dt);

    if (this.height <= terrainHeight) this.landOnSurface(terrainHeight);
  }

  private landOnSurface(terrainHeight: number): void {
    const slope = surfaceSlopeZAt(this.x, this.z);
    const surfaceVerticalSpeed = this.forwardSpeed * slope;
    this.landingImpact = Math.abs(this.verticalSpeed - surfaceVerticalSpeed);
    const landingLoss = clamp(
      this.landingImpact * SLED_PHYSICS.landingLossPerImpact,
      0,
      SLED_PHYSICS.maximumLandingLoss,
    );
    this.forwardSpeed *= 1 - landingLoss;
    this.lateralSpeed *= 1 - landingLoss * 0.65;
    this.height = terrainHeight;
    this.verticalSpeed = surfaceVerticalSpeed;
    this.slopeRadians = Math.atan(slope);
    this.grounded = true;
    this.airborneSeconds = 0;
    this.landingCooldownSeconds = 0.22;
  }

  applyBoost(speedGain: number): void {
    if (!this.moving || this.stopped) return;
    this.forwardSpeed = Math.min(
      31,
      this.forwardSpeed + Math.max(0, speedGain),
    );
  }

  applyObstacleHit(): void {
    if (!this.moving || this.stopped) return;
    this.forwardSpeed *= 0.72;
    this.lateralSpeed *= 0.45;
  }

  private resolveTrackEdges(): void {
    if (this.x > SLED_PHYSICS.trackHalfWidth) {
      this.x = SLED_PHYSICS.trackHalfWidth;
      this.lateralSpeed = Math.min(0, this.lateralSpeed);
      this.forwardSpeed *= 0.965;
    } else if (this.x < -SLED_PHYSICS.trackHalfWidth) {
      this.x = -SLED_PHYSICS.trackHalfWidth;
      this.lateralSpeed = Math.max(0, this.lateralSpeed);
      this.forwardSpeed *= 0.965;
    }
  }

  private updateStopState(dt: number): void {
    const totalSpeed = Math.hypot(
      this.forwardSpeed,
      this.lateralSpeed,
      this.verticalSpeed,
    );
    if (this.grounded && totalSpeed < SLED_PHYSICS.stopSpeed) {
      this.belowStopSeconds += dt;
      if (this.belowStopSeconds >= SLED_PHYSICS.stopConfirmationSeconds) {
        this.forwardSpeed = 0;
        this.lateralSpeed = 0;
        this.verticalSpeed = 0;
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
      height: this.height,
      forwardSpeed: this.forwardSpeed,
      lateralSpeed: this.lateralSpeed,
      verticalSpeed: this.verticalSpeed,
      headingRadians: this.headingRadians,
      pitchRadians: this.pitchRadians,
      rollRadians: this.rollRadians,
      slopeRadians: this.slopeRadians,
      steer: this.steer,
      grounded: this.grounded,
      airborneSeconds: this.airborneSeconds,
      landingImpact: this.landingImpact,
      moving: this.moving,
      stopped: this.stopped,
    };
  }
}
