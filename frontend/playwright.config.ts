import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against a mock-mode production build (dist-e2e/, never committed): the story, presenter mode and
 * the analyzer with recorded real responses, without the 1.3 GB model. CHROMIUM_PATH points at a local Chromium
 * when Playwright's own browsers are not installed. analyzer.real.spec.ts runs against the dev server and a live
 * backend instead (E2E_REAL_BACKEND=1).
 */
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath,
      // E2E_GPU=1: the machine's real GPU (ANGLE over OpenGL, still headless); otherwise software WebGL
      args: process.env.E2E_GPU
        ? ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu"]
        : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "VITE_MOCK_API=1 npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort --host 127.0.0.1",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
