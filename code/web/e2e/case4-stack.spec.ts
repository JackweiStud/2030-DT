/**
 * Case4 三进程 Playwright。依赖独立 stack（Web 55174 / 适配 33104）。
 * 不能用前端 mock 冒充本文件已通过。
 */
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const sharedDir = process.env.CASE4_E2E_SHARED_DIR
  ? process.env.CASE4_E2E_SHARED_DIR
  : resolve(process.cwd(), "../.tmp/case4-e2e-shared");

function pngPath(seq: string) {
  return resolve(sharedDir, "out/case4", `case4-${seq}.png`);
}

function assertPng(file: string) {
  expect(existsSync(file), `missing ${file}`).toBe(true);
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    true,
  );
  expect(buf.length).toBeGreaterThan(10_000);
}

test.describe("case4 three-process stack", () => {
  test("进入 case4 后 Start 可用，不读旧完成态", async ({ page }) => {
    const trajCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/case4/trajectory")) trajCalls.push(req.url());
    });
    await page.goto("/");
    await page.getByRole("button", { name: "DT辅助定位" }).click();
    await expect(page.locator(".case4-page")).toBeVisible();
    await expect(page.getByRole("button", { name: "开始" })).toBeEnabled({
      timeout: 15_000,
    });
    await expect(page.locator(".c4-ctrl-status")).toHaveText("未开始");
    expect(trajCalls).toEqual([]);
  });

  test("Start 完成、截图落盘、重置后再 Start", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await page.getByRole("button", { name: "DT辅助定位" }).click();
    const start = page.getByRole("button", { name: "开始" });
    const reset = page.getByRole("button", { name: "重置" });
    await expect(start).toBeEnabled({ timeout: 15_000 });
    const trajUrls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/case4/trajectory")) trajUrls.push(req.url());
    });
    await start.click();
    await expect(page.locator("[data-reflection-state='ready']")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator(".c4-reflection__beam").first()).toBeVisible();
    await expect(page.locator(".case4-page")).toHaveAttribute(
      "data-state",
      "completed",
      { timeout: 90_000 },
    );
    await expect(page.locator(".c4-nlos-value")).not.toHaveText("--");
    await expect(reset).toBeEnabled({ timeout: 30_000 });
    assertPng(pngPath("000"));
    const jsonlPath = resolve(sharedDir, "out/case4/points/trajectory.jsonl");
    expect(existsSync(jsonlPath)).toBe(true);
    const jsonl = readFileSync(jsonlPath, "utf8").trim();
    expect(jsonl.length).toBeGreaterThan(0);
    const last = JSON.parse(jsonl.split("\n").at(-1) ?? "{}") as {
      reflection?: { state?: string };
    };
    expect(last.reflection?.state).toMatch(/ready|invalid|missing/);
    await expect(page.locator("[data-reflection]")).toBeVisible();
    await expect(page.locator(".c4-reflection.is-static")).toBeVisible();
    await expect(page.locator(".c4-reflection__beam")).toHaveCount(0);
    expect(trajUrls.some((url) => url.includes("reflection=true"))).toBe(true);

    await reset.click();
    await expect(start).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator(".c4-ctrl-status")).toHaveText("未开始");
    await expect(page.locator(".c4-nlos-value")).toHaveText("--");

    await start.click();
    await expect(page.locator(".case4-page")).toHaveAttribute(
      "data-state",
      "completed",
      { timeout: 90_000 },
    );
    await expect(reset).toBeEnabled({ timeout: 30_000 });
    assertPng(pngPath("001"));
  });
});
