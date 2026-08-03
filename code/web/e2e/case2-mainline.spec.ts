import { test, expect } from "@playwright/test";

/**
 * 占位主线：需要本机 3102 适配服务。当前跳过，留给联调。
 */
test.describe("case2 mainline", () => {
  test.skip(true, "等待 Node 适配服务与 realback_no 打桩就绪后再跑");

  test("进入 case2 显示 Initial", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DT Calibration")).toBeVisible();
    await expect(page.getByText("等待启动测试")).toBeVisible();
  });
});
