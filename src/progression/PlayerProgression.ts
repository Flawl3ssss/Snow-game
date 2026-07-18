export type UpgradeKind = "launch" | "glide";

export type ProgressSnapshot = {
  version: 1;
  coins: number;
  bestDistance: number;
  bestScore: number;
  totalRuns: number;
  launchLevel: number;
  glideLevel: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "snow-sling-progress-v1";
const MAX_UPGRADE_LEVEL = 5;

const createDefault = (): ProgressSnapshot => ({
  version: 1,
  coins: 0,
  bestDistance: 0,
  bestScore: 0,
  totalRuns: 0,
  launchLevel: 0,
  glideLevel: 0,
});

const finiteNonNegative = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

export class PlayerProgression {
  private data: ProgressSnapshot;

  constructor(private readonly storage?: StorageLike) {
    this.data = this.load();
  }

  get snapshot(): ProgressSnapshot {
    return { ...this.data };
  }

  get launchSpeedBonus(): number {
    return this.data.launchLevel * 0.75;
  }

  get snowResistanceMultiplier(): number {
    return Math.max(0.72, 1 - this.data.glideLevel * 0.06);
  }

  upgradeCost(kind: UpgradeKind): number {
    const level =
      kind === "launch" ? this.data.launchLevel : this.data.glideLevel;
    return kind === "launch" ? 10 + level * 12 : 12 + level * 15;
  }

  canUpgrade(kind: UpgradeKind): boolean {
    const level =
      kind === "launch" ? this.data.launchLevel : this.data.glideLevel;
    return (
      level < MAX_UPGRADE_LEVEL && this.data.coins >= this.upgradeCost(kind)
    );
  }

  purchase(kind: UpgradeKind): boolean {
    if (!this.canUpgrade(kind)) return false;
    this.data.coins -= this.upgradeCost(kind);
    if (kind === "launch") this.data.launchLevel += 1;
    else this.data.glideLevel += 1;
    this.save();
    return true;
  }

  completeRun(input: {
    distance: number;
    score: number;
    collectedCoins: number;
    missionComplete: boolean;
  }): number {
    const distanceReward = Math.floor(Math.max(0, input.distance) / 55);
    const missionReward = input.missionComplete ? 5 : 0;
    const earned = input.collectedCoins + distanceReward + missionReward;
    this.data.coins += earned;
    this.data.bestDistance = Math.max(this.data.bestDistance, input.distance);
    this.data.bestScore = Math.max(this.data.bestScore, input.score);
    this.data.totalRuns += 1;
    this.save();
    return earned;
  }

  private load(): ProgressSnapshot {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return createDefault();
      const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>;
      if (parsed.version !== 1) return createDefault();
      return {
        version: 1,
        coins: Math.floor(finiteNonNegative(parsed.coins)),
        bestDistance: finiteNonNegative(parsed.bestDistance),
        bestScore: Math.floor(finiteNonNegative(parsed.bestScore)),
        totalRuns: Math.floor(finiteNonNegative(parsed.totalRuns)),
        launchLevel: Math.min(
          MAX_UPGRADE_LEVEL,
          Math.floor(finiteNonNegative(parsed.launchLevel)),
        ),
        glideLevel: Math.min(
          MAX_UPGRADE_LEVEL,
          Math.floor(finiteNonNegative(parsed.glideLevel)),
        ),
      };
    } catch {
      return createDefault();
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Progress persistence is optional; gameplay must continue in private mode.
    }
  }
}
