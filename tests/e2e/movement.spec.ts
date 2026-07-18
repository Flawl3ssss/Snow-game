import { expect, test, type Page } from "@playwright/test";

type GameText = {
  state: string;
  distanceMeters: number;
  rider: {
    x: number;
    height: number;
    forwardSpeed: number;
    verticalSpeed: number;
    grounded: boolean;
    landingImpact: number;
    stopped: boolean;
  };
  dynamics: {
    score: number;
    runCoins: number;
    combo: number;
    missionProgress: number;
    missionComplete: boolean;
    consumedIds: string[];
  };
  progress: {
    coins: number;
    totalRuns: number;
    launchLevel: number;
    glideLevel: number;
  };
  visualEffects: {
    windIntensity: number;
    activeSprayParticles: number;
    activeBurstParticles: number;
    activeShockwaves: number;
    wakeOpacity: number;
    shadowClearance: number;
  };
};

type GameHooks = {
  render_game_to_text: () => string;
  advanceTime: (milliseconds: number) => void;
};

const readGame = async (page: Page): Promise<GameText> => {
  const text = await page.evaluate(() => {
    const hooks = globalThis as typeof globalThis & GameHooks;
    return hooks.render_game_to_text();
  });
  return JSON.parse(text) as GameText;
};

const advance = async (page: Page, milliseconds: number): Promise<void> => {
  await page.evaluate((duration) => {
    const hooks = globalThis as typeof globalThis & GameHooks;
    hooks.advanceTime(duration);
  }, milliseconds);
};

const launch = async (page: Page, horizontalPull: number): Promise<void> => {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.48;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(
    startX + horizontalPull,
    startY + Math.min(180, box.height * 0.26),
    {
      steps: 8,
    },
  );
  await expect(page.getByTestId("state-chip")).toHaveText("AIMING");
  await page.mouse.up();
  await expect(page.getByTestId("state-chip")).toHaveText("RIDING");
};

const launchTowardLane = async (
  page: Page,
  normalizedPull: number,
): Promise<void> => {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");
  const maxAimPixels = Math.min(box.width * 0.42, 240);
  await launch(page, maxAimPixels * normalizedPull);
};

test("right launch, direct steering, stable stop, and reset", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("state-chip")).toHaveText("BASE");
  await page.screenshot({
    path: `artifacts/playtests/g1-base-${test.info().project.name}.png`,
    fullPage: true,
  });
  await launch(page, 42);

  await page.keyboard.down("ArrowRight");
  await advance(page, 2200);
  await page.keyboard.up("ArrowRight");
  const riding = await readGame(page);
  expect(riding.state).toBe("RIDING");
  expect(riding.rider.x).toBeGreaterThan(1);
  expect(riding.rider.forwardSpeed).toBeGreaterThan(0);

  await advance(page, 120_000);
  const result = await readGame(page);
  expect(result.state).toBe("RESULTS");
  expect(result.rider.stopped).toBe(true);
  expect(result.distanceMeters).toBeGreaterThan(40);
  await expect(page.getByTestId("results-panel")).toBeVisible();
  await page.screenshot({
    path: `artifacts/playtests/g1-result-${test.info().project.name}.png`,
    fullPage: true,
  });

  await page.getByTestId("reset-action").click();
  await expect(page.getByTestId("state-chip")).toHaveText("BASE");
  expect((await readGame(page)).distanceMeters).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test("left input remains left without hidden target attraction", async ({
  page,
}) => {
  await page.goto("/");
  await launch(page, -44);
  await page.keyboard.down("KeyA");
  await advance(page, 3000);
  await page.keyboard.up("KeyA");

  const state = await readGame(page);
  expect(state.state).toBe("RIDING");
  expect(state.rider.x).toBeLessThan(-2);
  await page.screenshot({
    path: `artifacts/playtests/g1-left-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("mobile-style drag uses the corrected steering direction", async ({
  page,
}) => {
  await page.goto("/");
  await launch(page, 0);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas has no bounds");

  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.55;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + Math.min(90, box.width * 0.2), startY, {
    steps: 6,
  });
  await advance(page, 2200);
  await page.mouse.up();

  const state = await readGame(page);
  expect(state.rider.x).toBeLessThan(-1);
});

test("right screen pull retracts and launches toward screen right", async ({
  page,
}) => {
  await page.goto("/");
  await launch(page, 52);
  await advance(page, 1800);

  const state = await readGame(page);
  expect(state.state).toBe("RIDING");
  expect(state.rider.x).toBeGreaterThan(0.5);
});

test("ramp produces a rising arc, falling arc, and grounded landing", async ({
  page,
}) => {
  await page.goto("/?debug");
  await launch(page, 0);

  await advance(page, 3200);
  const rising = await readGame(page);
  expect(rising.rider.grounded).toBe(false);
  expect(rising.rider.verticalSpeed).toBeGreaterThan(0.25);

  await page.keyboard.down("ArrowRight");
  await advance(page, 400);
  await page.keyboard.up("ArrowRight");
  const airControlled = await readGame(page);
  expect(airControlled.rider.grounded).toBe(false);
  expect(airControlled.rider.x).toBeGreaterThan(rising.rider.x + 0.12);

  await advance(page, 500);
  const falling = await readGame(page);
  expect(falling.rider.grounded).toBe(false);
  expect(falling.rider.verticalSpeed).toBeLessThan(-0.25);
  expect(falling.dynamics.consumedIds).not.toContain("c08");
  await page.screenshot({
    path: `artifacts/playtests/g1-airborne-${test.info().project.name}.png`,
    fullPage: true,
  });

  await advance(page, 1000);
  const landed = await readGame(page);
  expect(landed.rider.grounded).toBe(true);
  expect(landed.rider.landingImpact).toBeGreaterThan(1.5);
  expect(landed.visualEffects.activeShockwaves).toBeGreaterThan(0);
  await page.screenshot({
    path: `artifacts/playtests/g3-landing-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("dynamic course awards a pickup, score, and visible feedback", async ({
  page,
}) => {
  await page.goto("/");
  await launch(page, 0);
  await advance(page, 1700);

  const state = await readGame(page);
  expect(state.dynamics.runCoins).toBeGreaterThanOrEqual(1);
  expect(state.dynamics.score).toBeGreaterThan(state.distanceMeters);
  expect(state.dynamics.missionProgress).toBeGreaterThanOrEqual(1);
  expect(state.dynamics.consumedIds).toContain("c03");
  expect(state.visualEffects.windIntensity).toBeGreaterThan(0.2);
  expect(state.visualEffects.activeSprayParticles).toBeGreaterThan(0);
  expect(state.visualEffects.activeBurstParticles).toBeGreaterThan(0);
  expect(state.visualEffects.activeShockwaves).toBeGreaterThan(0);
  expect(state.visualEffects.wakeOpacity).toBeGreaterThan(0.3);
  await expect(page.getByTestId("run-goal")).toContainText("Цель выполнена");
  await page.screenshot({
    path: `artifacts/playtests/g2-dynamic-course-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("side boost creates a gold burst and readable speed feedback", async ({
  page,
}) => {
  await page.goto("/");
  // Aim directly at the side lane. Holding a key around a large deterministic
  // time jump also includes browser wall-clock frames, which varies with the
  // mobile software renderer and can overshoot the boost entirely.
  await launchTowardLane(page, -0.6);
  await advance(page, 2000);

  const state = await readGame(page);
  expect(state.dynamics.consumedIds).toContain("b01");
  expect(state.visualEffects.windIntensity).toBeGreaterThan(0.5);
  expect(state.visualEffects.activeBurstParticles).toBeGreaterThan(20);
  expect(state.visualEffects.activeShockwaves).toBeGreaterThan(0);
  await page.screenshot({
    path: `artifacts/playtests/g3-boost-${test.info().project.name}.png`,
    fullPage: true,
  });
});
