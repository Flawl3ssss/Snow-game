import { describe, expect, it } from "vitest";
import { PlayerProgression } from "../progression/PlayerProgression";
import { SledSimulation } from "../simulation/SledSimulation";
import { RunDynamics } from "./RunDynamics";

const playRun = (steer: (time: number) => number) => {
  const simulation = new SledSimulation();
  const dynamics = new RunDynamics();
  simulation.launch({ power: 1, aim: 0 });
  const counts = { coin: 0, boost: 0, rock: 0, airtime: 0 };

  for (
    let tick = 0;
    tick < 60 * 45 && !simulation.snapshot.stopped;
    tick += 1
  ) {
    const previous = simulation.snapshot;
    simulation.update(1 / 60, { steer: steer(tick / 60) });
    for (const event of dynamics.update(
      previous,
      simulation.snapshot,
      1 / 60,
    )) {
      counts[event.type] += 1;
      if (event.type === "boost") simulation.applyBoost(3.8);
      if (event.type === "rock") simulation.applyObstacleHit();
    }
  }

  return {
    simulation: simulation.snapshot,
    dynamics: dynamics.snapshot,
    counts,
  };
};

describe("dynamic run balance", () => {
  it("turns the first successful center run into an affordable upgrade", () => {
    const run = playRun(() => 0);
    const progression = new PlayerProgression();
    const earned = progression.completeRun({
      distance: run.simulation.distanceMeters,
      score: run.dynamics.score,
      collectedCoins: run.dynamics.runCoins,
      missionComplete: run.dynamics.missionComplete,
    });

    expect(run.dynamics.missionComplete).toBe(true);
    expect(run.counts.airtime).toBe(2);
    expect(earned).toBeGreaterThanOrEqual(progression.upgradeCost("launch"));
    expect(progression.purchase("launch")).toBe(true);
  });

  it("supports a fast side-route style with boost and no forced collision", () => {
    const run = playRun((time) => (time < 0.5 ? -1 : 0));
    expect(run.counts.boost).toBeGreaterThanOrEqual(1);
    expect(run.counts.rock).toBe(0);
    expect(run.simulation.distanceMeters).toBeGreaterThan(260);
  });
});
