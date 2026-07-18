import { describe, expect, it } from "vitest";
import { PlayerProgression } from "./PlayerProgression";

const memoryStorage = () => {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
};

describe("PlayerProgression", () => {
  it("awards pickups, distance, and a completed mission", () => {
    const progression = new PlayerProgression(memoryStorage());
    const earned = progression.completeRun({
      distance: 188,
      score: 420,
      collectedCoins: 5,
      missionComplete: true,
    });
    expect(earned).toBe(13);
    expect(progression.snapshot.coins).toBe(13);
    expect(progression.snapshot.bestDistance).toBe(188);
  });

  it("persists purchases and exposes their physics effects", () => {
    const storage = memoryStorage();
    const progression = new PlayerProgression(storage);
    progression.completeRun({
      distance: 300,
      score: 900,
      collectedCoins: 10,
      missionComplete: true,
    });
    expect(progression.purchase("launch")).toBe(true);
    expect(progression.launchSpeedBonus).toBe(0.75);
    expect(new PlayerProgression(storage).snapshot.launchLevel).toBe(1);
  });

  it("recovers safely from corrupt save data", () => {
    const progression = new PlayerProgression({
      getItem: () => "not-json",
      setItem: () => undefined,
    });
    expect(progression.snapshot.coins).toBe(0);
    expect(progression.purchase("glide")).toBe(false);
  });
});
