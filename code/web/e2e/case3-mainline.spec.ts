/**
 * Case3 Playwright 主线（前端隔离）。
 * Node/Case3 stub 未就绪时用 page.route mock；不得宣称全栈 E2E 已通过。
 */
import { expect, test } from "@playwright/test";

test.describe("case3 mainline (frontend-isolated)", () => {
  test("进入 Case3 Tab 可见测试对比面板", async ({ page }) => {
    // 若后端未就绪，路由拦截避免初始化无限探活刷错
    await page.route("**/api/case3/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/control-file") && route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            control: {
              case: "case3",
              command: "init",
              dt_type: "",
              status: "",
              save_picture_flag: 0,
            },
          }),
        });
        return;
      }
      if (url.includes("/control-file") && route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            control: {
              case: "case3",
              command: "init",
              dt_type: "",
              status: "",
              save_picture_flag: 0,
            },
          }),
        });
        return;
      }
      if (url.includes("/init-data")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            baseRoute: [
              { no: 1, x: 1, y: 2, z: 0 },
              { no: 2, x: 3, y: 4, z: 0 },
            ],
            beamAccuracyBaseline: { success: 80, total: 100 },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "NOT_FOUND", message: "not mocked" },
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "DT for Comm" }).click();
    await expect(page.locator(".case3-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "测试对比" })).toBeVisible();
    await expect(
      page.locator('[data-side="without"] .case3-btn--start'),
    ).toBeEnabled({ timeout: 10000 });
  });
});
