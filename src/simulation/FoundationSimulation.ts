export type FoundationSnapshot = {
  elapsedSeconds: number;
  distanceMeters: number;
  speedMetersPerSecond: number;
};

export class FoundationSimulation {
  private elapsedSeconds = 0;
  private distanceMeters = 0;
  private speedMetersPerSecond = 0;

  launch(): void {
    this.elapsedSeconds = 0;
    this.distanceMeters = 0;
    this.speedMetersPerSecond = 18;
  }

  reset(): void {
    this.elapsedSeconds = 0;
    this.distanceMeters = 0;
    this.speedMetersPerSecond = 0;
  }

  update(dt: number, active: boolean): void {
    if (!active) return;
    this.elapsedSeconds += dt;
    this.distanceMeters += this.speedMetersPerSecond * dt;
    this.speedMetersPerSecond = Math.max(
      0,
      this.speedMetersPerSecond - 1.25 * dt,
    );
  }

  get snapshot(): FoundationSnapshot {
    return {
      elapsedSeconds: this.elapsedSeconds,
      distanceMeters: this.distanceMeters,
      speedMetersPerSecond: this.speedMetersPerSecond,
    };
  }
}
