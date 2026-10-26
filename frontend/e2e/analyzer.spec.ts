import { expect, test } from "@playwright/test";

test("a demo recording produces the story report (mock mode, recorded real responses)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/analyze", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "COPD example" }).click();
  await expect(page.getByText("Strongest match")).toBeVisible();
  await expect(page.getByText(/\d of 4 agree/)).toBeVisible();
  await expect(page.getByText("RespiNet's reading of each window")).toBeVisible();
  await expect(page.getByText(/research prototype, not a diagnostic device/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("an abstaining demo says the model isn't sure", async ({ page }) => {
  await page.goto("/analyze", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Bronchial example" }).click();
  await expect(page.getByText("The model isn't sure")).toBeVisible();
});

test("reloading /analyze serves the app", async ({ page }) => {
  const response = await page.goto("/analyze");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Analyse a recording" })).toBeVisible();
});
