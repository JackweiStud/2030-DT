import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 骨架：本会话不强制跑通；等适配服务 + 打桩就绪后由 Codex 执行。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    viewport: { width: 1920, height: 1080 },
  },
});
