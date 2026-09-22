/**
 * Case3 V2 Without 主链（前端隔离）。
 * 必须经过 1点 → 2点 → 3点 → complete → 截图/POST init，不得从 initial 跳 complete。
 */
import { expect, test, type Page } from "@playwright/test";

const SCREENSHOT_PATH = "out/case3/case3-000.png";

async function expectAllBusinessButtonsDisabled(page: Page) {
  await expect(page.getByTitle("启动无 DT")).toBeDisabled();
  await expect(page.getByTitle("重置无 DT")).toBeDisabled();
  await expect(page.getByTitle("启动有 DT")).toBeDisabled();
  await expect(page.getByTitle("重置有 DT")).toBeDisabled();
}

test.describe("case3 v2 without (frontend-isolated)", () => {
  test("Initial → Without live 1/2/3 → 截图收尾后解锁", async ({ page }) => {
    let control = {
      case: "case3",
      command: "init",
      dt_type: "",
      status: "",
      save_picture_flag: 0,
    };
    let startPolls = 0;
    const screenshotPosts: Array<{ path: string; seq: number }> = [];
    let completionInitPosts = 0;
    let started = false;
    let releaseScreenshot!: () => void;
    const screenshotHold = new Promise<void>((resolve) => {
      releaseScreenshot = resolve;
    });

    await page.route("**/api/case3/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/control-file") && route.request().method() === "GET") {
        if (control.command === "start") {
          startPolls += 1;
          if (startPolls <= 3) {
            control = { ...control, status: "execute success" };
          } else if (control.status !== "case complete") {
            control = {
              ...control,
              status: "case complete",
              save_picture_flag: 1,
            };
          }
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, control }),
        });
        return;
      }
      if (url.includes("/control-file") && route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        if (payload.command === "init") {
          if (started) completionInitPosts += 1;
          control = {
            case: "case3",
            command: "init",
            dt_type: "",
            status: "",
            save_picture_flag: 0,
          };
        } else if (payload.command === "start" || payload.command === "reinit") {
          started = payload.command === "start";
          control = {
            case: "case3",
            command: String(payload.command),
            dt_type: String(payload.dt_type),
            status: "",
            save_picture_flag: 0,
          };
          startPolls = 0;
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
              { no: 1, x: 1, y: 15, z: 0 },
              { no: 2, x: 1, y: 9, z: 0 },
              { no: 3, x: 1, y: 2, z: 0 },
              { no: 4, x: 9, y: 2, z: 0 },
              { no: 5, x: 18, y: 2, z: 0 },
            ],
            beamAccuracyBaseline: { success: 222, total: 235 },
          }),
        });
        return;
      }
      if (url.includes("/side")) {
        const side = new URL(url).searchParams.get("side");
        if (side !== "without") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              side,
              points: [],
              completeCount: 0,
              pendingTail: false,
              costPct: null,
            }),
          });
          return;
        }
        const count =
          control.status === "case complete"
            ? 3
            : Math.max(0, Math.min(startPolls, 3));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            side: "without",
            points: Array.from({ length: count }, (_, index) => {
              const no = index + 1;
              return {
                no,
                ue: { x: no === 1 ? 1 : 1, y: no === 1 ? 15 : 15 - no, z: 0 },
                selectedBeamId: no * 10,
                throughputGbps: 8 + no,
                scanBeamIds: [0, no * 10],
              };
            }),
            completeCount: count,
            pendingTail: false,
            costPct: 25,
          }),
        });
        return;
      }
      if (url.includes("/screenshot") && route.request().method() === "POST") {
        screenshotPosts.push({ path: SCREENSHOT_PATH, seq: 0 });
        await screenshotHold;
        control = { ...control, save_picture_flag: 0 };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            path: SCREENSHOT_PATH,
            seq: 0,
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
    await page.getByRole("button", { name: "DT for Comm new" }).click();
    const root = page.getByTestId("case3-v2-page");
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-state", "initial");
    await expect(page.getByTitle("启动无 DT")).toBeEnabled({ timeout: 10000 });

    await page.getByTitle("启动无 DT").click();
    await expect(root.locator('[data-status="without"] .case3v2-side-status__text')).toHaveText(
      "测试中",
    );
    await expect(root.locator("[data-status-ellipsis]")).toHaveCount(1);
    await expectAllBusinessButtonsDisabled(page);
    await expect(page.getByRole("button", { name: "DT校正" })).toBeDisabled();

    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(1, { timeout: 10000 });
    await expect(root.locator("[data-point-value]")).toHaveText("P1");
    await expect(root.locator("[data-beam-id-value]")).toHaveText("10");
    await expect(root.locator("[data-replay-wo-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-replay-wo-value]").nth(1)).toHaveText("--");
    await expect(root.locator("[data-cost-wo]")).toHaveText("25.0");
    await expect(root.locator("[data-thr-dot-wo]")).toHaveCount(1);
    await expect(root.locator("[data-ba-ok]")).toHaveText("222");
    await expectAllBusinessButtonsDisabled(page);

    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(2, { timeout: 10000 });
    await expect(root.locator("[data-point-value]")).toHaveText("P2");
    await expect(root.locator("[data-beam-id-value]")).toHaveText("20");
    await expect(root.locator("[data-replay-wo-value]").nth(1)).toHaveText("20");
    await expect(root.locator("[data-thr-dot-wo]")).toHaveCount(2);

    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(3, { timeout: 10000 });
    await expect(root.locator("[data-point-value]")).toHaveText("P3");
    await expect(root.locator("[data-beam-id-value]")).toHaveText("30");
    await expect(root.locator("[data-replay-wo-value]").nth(2)).toHaveText("30");
    await expect(root.locator("[data-thr-dot-wo]")).toHaveCount(3);
    await expect(root.locator("[data-walked-inner]")).toHaveAttribute("points", /,/);

    await expect(root).toHaveAttribute("data-state", "without-completed", {
      timeout: 10000,
    });
    await expect(root.locator('[data-status="without"] .case3v2-side-status__text')).toHaveText(
      "已结束",
    );
    await expect.poll(() => screenshotPosts.length, { timeout: 20000 }).toBe(1);
    expect(screenshotPosts).toEqual([{ path: SCREENSHOT_PATH, seq: 0 }]);
    expect(completionInitPosts).toBe(0);
    await expectAllBusinessButtonsDisabled(page);
    await expect(page.getByRole("button", { name: "DT校正" })).toBeDisabled();

    releaseScreenshot();
    await expect.poll(() => completionInitPosts, { timeout: 15000 }).toBe(1);
    expect(screenshotPosts).toHaveLength(1);
    await expect(page.getByTitle("启动有 DT")).toBeEnabled({ timeout: 15000 });
    await expect(page.getByTitle("重置无 DT")).toBeEnabled();
    await expect(page.getByTitle("启动无 DT")).toBeDisabled();
    await expect(page.getByTitle("重置有 DT")).toBeDisabled();
    await expect(page.getByRole("button", { name: "DT校正" })).toBeEnabled();
    await expect(root.locator("[data-ba-pct]")).toHaveText("94.5");
    await expect(root.locator("[data-point-value]")).toHaveText("P3");
  });
});
