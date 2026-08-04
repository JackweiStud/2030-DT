import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sharedDir =
  process.env.CASE2_E2E_SHARED_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.tmp/case2-e2e-shared");

async function screenshotCount(): Promise<number> {
  const outDir = path.join(sharedDir, "out/case2");
  try {
    const files = await fs.readdir(outDir);
    return files.filter((file) => /^calibrated-\d{3}\.png$/.test(file)).length;
  } catch {
    return 0;
  }
}

async function controlFlag(): Promise<number | null> {
  try {
    const text = await fs.readFile(path.join(sharedDir, "case_control.json"), "utf8");
    const control = JSON.parse(text) as { save_picture_flag?: unknown };
    return control.save_picture_flag === 0 || control.save_picture_flag === 1
      ? control.save_picture_flag
      : null;
  } catch {
    return null;
  }
}

test.describe("case2 mainline", () => {
  test("进页、启动、截图、重置主线", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DT Calibration")).toBeVisible();
    await expect(page.getByText("等待启动测试")).toBeVisible();

    const start = page.getByRole("button", { name: "启动" });
    const reset = page.getByRole("button", { name: "重置" });
    await expect(start).toBeEnabled();
    await expect(reset).toBeDisabled();

    await start.click();
    await expect(page.locator(".case2-page")).toHaveAttribute(
      "data-state",
      "calibrating",
    );
    await expect(page.getByText("测试运行中")).toBeVisible();

    await expect(page.locator(".case2-page")).toHaveAttribute(
      "data-state",
      "completed",
      { timeout: 20_000 },
    );
    await expect(page.getByText("已完成")).toBeVisible();
    await expect(reset).toBeEnabled();

    await expect.poll(screenshotCount, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(controlFlag, { timeout: 5_000 }).toBe(0);

    await reset.click();
    await expect(page.locator(".case2-page")).toHaveAttribute(
      "data-state",
      "initial",
      { timeout: 20_000 },
    );
    await expect(page.getByText("等待启动测试")).toBeVisible();
    await expect(start).toBeEnabled();
    await expect(reset).toBeDisabled();
  });
});
