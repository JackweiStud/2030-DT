import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.CASE4_E2E_WEB_PORT || "55174";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "case4-stack.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: "bash ../scripts/e2e-case4-stack.sh",
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
