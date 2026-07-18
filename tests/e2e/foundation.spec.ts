import { expect, test } from "@playwright/test";

test("boots the foundation scene and runs a fixed-step preview", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("state-chip")).toHaveText("BASE");
  await expect(page.getByTestId("primary-action")).toBeEnabled();
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("state-chip")).toHaveText("RIDING");
  await expect(page.getByTestId("speed")).not.toHaveText("0.0");
  await expect(page.getByTestId("debug-overlay")).toContainText("fixed");
  await page.screenshot({
    path: `artifacts/playtests/g0-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});
