import { expect, test, type Page } from "@playwright/test";

type GameText = {
  state: string;
  distanceMeters: number;
  rider: { x: number; forwardSpeed: number; stopped: boolean };
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

test("slingshot horizontal pull launches directly toward that side", async ({
  page,
}) => {
  await page.goto("/");
  await launch(page, 52);
  await advance(page, 1800);

  const state = await readGame(page);
  expect(state.state).toBe("RIDING");
  expect(state.rider.x).toBeGreaterThan(0.5);
});
