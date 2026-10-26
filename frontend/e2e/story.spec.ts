import { expect, test, type Page } from "@playwright/test";

const SCENES = Array.from({ length: 14 }, (_, i) => `s${String(i).padStart(2, "0")}`);

function watch(page: Page) {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { const u = new URL(r.url()); if (!["127.0.0.1", "localhost"].includes(u.hostname) && u.protocol !== "data:") external.push(r.url()); });
  return { errors, external };
}

async function startPresenter(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("p");
  await expect(page.getByRole("navigation", { name: "Presenter progress" })).toBeVisible();
}

const inView = (page: Page, id: string) => page.evaluate((sceneId) => {
  const r = document.querySelector(`[data-scene="${sceneId}"]`)!.getBoundingClientRect();
  return r.top < innerHeight / 2 && r.bottom > innerHeight / 2;
}, id);

test("the story loads with no console errors and no external requests", async ({ page }) => {
  const seen = watch(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("How a machine listens to your lungs");
  await page.mouse.wheel(0, 20000);
  await page.waitForTimeout(1500);
  expect(seen.errors).toEqual([]);
  expect(seen.external, "fonts and assets are self-hosted").toEqual([]);
});

test("presenter mode steps through all 14 scenes, then Home and End", async ({ page }) => {
  await startPresenter(page);
  for (let i = 1; i < SCENES.length; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1700);
    await page.screenshot({ path: `e2e/__screenshots__/scene-${SCENES[i]}.png` });
  }
  expect(await inView(page, "s13")).toBe(true);
  await expect(page.getByText("14 / 14")).toBeVisible();
  await page.keyboard.press("Home");
  await page.waitForTimeout(1800);
  expect(await inView(page, "s00")).toBe(true);
  await page.keyboard.press("End");
  await page.waitForTimeout(1800);
  expect(await inView(page, "s13")).toBe(true);
});

test("fps while the 3D scenes play", async ({ page }) => {
  await startPresenter(page);
  if (process.env.E2E_GPU) {
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "none";
    });
    console.log(`renderer: ${renderer}`);
    expect(renderer, "E2E_GPU needs hardware WebGL").not.toMatch(/swiftshader|none/i);
  }
  for (const target of [0, 8]) {
    await page.getByRole("button", { name: /^Go to / }).nth(target).click();
    const fps = await page.evaluate(() => new Promise<number>((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => { frames++; if (performance.now() - start < 3000) requestAnimationFrame(tick); else resolve(frames / 3); };
      requestAnimationFrame(tick);
    }));
    const gpu = Boolean(process.env.E2E_GPU);
    console.log(`scene ${target}: ${fps.toFixed(1)} fps (${gpu ? "hardware GPU" : "software WebGL"})`);
    // the spec's 60 fps target holds on a GPU (E2E_GPU=1, run it on the presentation laptop); software WebGL is a smoke
    // test, and the lungs' glass (a second transmission render pass) is slow there: the original lungs ran ~4 fps on it
    const softwareFloor = target === 0 ? 3 : 10;
    expect(fps).toBeGreaterThan(Number(process.env.MIN_FPS ?? (gpu ? 50 : softwareFloor)));
  }
});

for (const [width, height] of [[1280, 800], [1920, 1080], [390, 844]] as const) {
  test(`no horizontal scroll at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.mouse.wheel(0, 30000);
    await page.waitForTimeout(800);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}
