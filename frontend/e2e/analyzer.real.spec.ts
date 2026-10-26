import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";

/** Against a live backend: E2E_REAL_BACKEND=1 E2E_BASE_URL=http://127.0.0.1:5173 (or :8080 for Docker). */
const WAV = process.env.E2E_WAV ?? "../backend/dataset/ICBHI_as_folders/copd/218_1b1_Al_sc_Meditron.wav";

test.skip(!process.env.E2E_REAL_BACKEND, "needs a live backend (E2E_REAL_BACKEND=1)");

test("uploading the sample COPD recording gets the served model's 87%", async ({ page }) => {
  test.skip(!existsSync(WAV), "sample recording not available");
  await page.goto("/analyze", { waitUntil: "networkidle" });
  await page.setInputFiles("#analyzer-upload", WAV);
  await expect(page.getByText("Strongest match")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole("img", { name: "87%" })).toBeVisible();
  await expect(page.getByText(/30 windows/).first()).toBeVisible();
});
