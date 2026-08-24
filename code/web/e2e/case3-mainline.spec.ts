/**
 * Case3 Playwright 主线（前端隔离）。
 * Node/Case3 stub 未就绪时用 page.route mock；不得宣称全栈 E2E 已通过。
 */
import { expect, test } from "@playwright/test";

test.describe("case3 mainline (frontend-isolated)", () => {
  test("Without/With 执行、独立重置和重新配对", async ({ page }) => {
    let control = {
      case: "case3",
      command: "init",
      dt_type: "",
      status: "",
      save_picture_flag: 0,
    };
    let activePollCount = 0;

    // Node/stub 尚未施工完成，本用例只验证 Web 状态机与 REST 契约。
    await page.route("**/api/case3/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/control-file") && route.request().method() === "GET") {
        if (control.command === "start" || control.command === "reinit") {
          activePollCount += 1;
          control = {
            ...control,
            status:
              activePollCount === 1
                ? "execute success"
                : control.command === "start"
                  ? "case complete"
                  : "reinit complete",
          };
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, control }),
        });
        return;
      }
      if (url.includes("/control-file") && route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        if (payload.command === "init") {
          control = {
            case: "case3",
            command: "init",
            dt_type: "",
            status: "",
            save_picture_flag: 0,
          };
        } else if (
          payload.command === "start" ||
          payload.command === "reinit"
        ) {
          control = {
            case: "case3",
            command: payload.command,
            dt_type: String(payload.dt_type),
            status: "",
            save_picture_flag: 0,
          };
          activePollCount = 0;
        } else if (payload.save_picture_flag === 0) {
          control = { ...control, save_picture_flag: 0 };
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, control }),
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
      if (url.includes("/side")) {
        const side = new URL(url).searchParams.get("side");
        const isWithout = side === "without";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            side,
            points: [
              {
                no: 1,
                ue: { x: 1, y: 2, z: 0 },
                selectedBeamId: 4,
                throughputGbps: isWithout ? 8.5 : 9.1,
                ...(isWithout
                  ? {
                      scanBeamIds: Array.from(
                        { length: 16 },
                        (_, index) => index,
                      ),
                    }
                  : {
                      reflection: { x: 5, y: 7, z: 0, los: true },
                    }),
              },
            ],
            completeCount: 1,
            pendingTail: false,
            costPct: isWithout ? 25 : 15,
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
    await page.getByRole("button", { name: "DT for Comm", exact: true }).click();
    await expect(page.locator(".case3-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "测试对比" })).toBeVisible();
    await expect(
      page.locator('[data-side="without"] .case3-btn--start'),
    ).toBeEnabled({ timeout: 10000 });

    const without = page.locator('[data-side="without"]');
    const withSide = page.locator('[data-side="with"]');
    const withoutStatus = without.locator(".case3-status-text");
    const withStatus = withSide.locator(".case3-status-text");

    await without.locator(".case3-btn--start").click();
    await expect(withoutStatus).toHaveText("已完成", { timeout: 10000 });
    await expect(withSide.locator(".case3-btn--start")).toBeEnabled();

    await withSide.locator(".case3-btn--start").click();
    await expect(withStatus).toHaveText("已完成", { timeout: 10000 });
    await expect(page.locator(".case3-cost-delta__value")).toHaveText("-40.0");

    await without.locator(".case3-btn--reset").click();
    await expect(withoutStatus).toHaveText("等待启动测试", {
      timeout: 10000,
    });
    await expect(withStatus).toHaveText("历史结果");
    await expect(page.locator(".case3-cost-delta__value")).toHaveText("--");

    await without.locator(".case3-btn--start").click();
    await expect(withoutStatus).toHaveText("已完成", { timeout: 10000 });
    await expect(withStatus).toHaveText("未配对历史");
    await expect(page.locator(".case3-cost-delta__value")).toHaveText("--");

    await withSide.locator(".case3-btn--start").click();
    await expect(withStatus).toHaveText("已完成", { timeout: 10000 });
    await expect(page.locator(".case3-cost-delta__value")).toHaveText("-40.0");

    await withSide.locator(".case3-btn--reset").click();
    await expect(withoutStatus).toHaveText("已完成", { timeout: 10000 });
    await expect(withStatus).toHaveText("等待启动测试");
    await expect(page.locator(".case3-cost-delta__value")).toHaveText("--");
  });
});
