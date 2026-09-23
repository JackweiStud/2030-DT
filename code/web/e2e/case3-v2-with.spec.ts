/**
 * Case3 V2 With 主链（前端隔离）。
 * Without complete → With running → With complete，并核对矩阵/KPI/busy/截图顺序。
 */
import { expect, test, type Page } from "@playwright/test";

async function expectAllBusinessButtonsDisabled(page: Page) {
  await expect(page.getByTitle("启动无 DT")).toBeDisabled();
  await expect(page.getByTitle("重置无 DT")).toBeDisabled();
  await expect(page.getByTitle("启动有 DT")).toBeDisabled();
  await expect(page.getByTitle("重置有 DT")).toBeDisabled();
}

function withoutPoint(no: number) {
  return {
    no,
    ue: { x: no === 1 ? 1 : 1, y: no === 1 ? 15 : 15 - no, z: 0 },
    selectedBeamId: no * 10,
    scanBeamIds: [0, no * 10],
  };
}

function withPoint(no: number) {
  return {
    no,
    ue: { x: no === 1 ? 1 : 1, y: no === 1 ? 15 : 15 - no, z: 0 },
    selectedBeamId: no === 2 ? 21 : no * 10,
    reflection: { x: 0, y: 0, z: 0, los: true },
  };
}

test.describe("case3 v2 with (frontend-isolated)", () => {
  test("Without complete → With running/complete → 截图后解锁", async ({ page }) => {
    let control = {
      case: "case3",
      command: "init",
      dt_type: "",
      status: "",
      save_picture_flag: 0,
    };
    let startPolls = 0;
    let activeDtType = "";
    const screenshotPosts: Array<{ path: string; seq: number }> = [];
    let completionInitPosts = 0;
    let started = false;
    let releaseWithScreenshot!: () => void;
    const withScreenshotHold = new Promise<void>((resolve) => {
      releaseWithScreenshot = resolve;
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
          activeDtType = String(payload.dt_type);
          control = {
            case: "case3",
            command: String(payload.command),
            dt_type: activeDtType,
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
        const runningThisSide =
          control.command === "start" &&
          ((side === "without" && activeDtType === "without dt") ||
            (side === "with" && activeDtType === "with dt"));
        const count = runningThisSide
          ? control.status === "case complete"
            ? 3
            : Math.max(0, Math.min(startPolls, 3))
          : 0;
        const points =
          side === "with"
            ? Array.from({ length: count }, (_, index) => withPoint(index + 1))
            : Array.from({ length: count }, (_, index) => withoutPoint(index + 1));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            side,
            points,
            completeCount: count,
            pendingTail: false,
            costPct: side === "with" ? 12.5 : 25,
          }),
        });
        return;
      }
      if (url.includes("/screenshot") && route.request().method() === "POST") {
        const seq = screenshotPosts.length;
        const path = `out/case3/case3-${String(seq).padStart(3, "0")}.png`;
        screenshotPosts.push({ path, seq });
        if (activeDtType === "with dt") {
          await withScreenshotHold;
        }
        control = { ...control, save_picture_flag: 0 };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, path, seq }),
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
    await page.getByRole("button", { name: "DT辅助通信" }).click();
    const root = page.getByTestId("case3-v2-page");
    await expect(root).toBeVisible();
    await expect(page.getByTitle("启动无 DT")).toBeEnabled({ timeout: 10000 });

    await page.getByTitle("启动无 DT").click();
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(3, { timeout: 15000 });
    await expect(root).toHaveAttribute("data-state", "without-completed", {
      timeout: 10000,
    });
    await expect.poll(() => screenshotPosts.length, { timeout: 20000 }).toBe(1);
    await expect.poll(() => completionInitPosts, { timeout: 15000 }).toBe(1);
    await expect(page.getByTitle("启动有 DT")).toBeEnabled({ timeout: 15000 });
    await expect(root.locator("[data-replay-wo-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-ba-ok]")).toHaveText("222");

    await page.getByTitle("启动有 DT").click();
    await expect(root).toHaveAttribute("data-state", "with-running");
    await expect(root).toHaveAttribute("data-map-side", "with");
    await expect(root.locator('[data-status="with"] .case3v2-side-status__text')).toHaveText(
      "测试中",
    );
    await expectAllBusinessButtonsDisabled(page);
    await expect(page.getByRole("button", { name: "DT校正" })).toBeDisabled();
    await expect(root.locator("[data-legend-pred]")).toHaveText("预测波");
    await expect(root.locator("[data-legend-best]")).toHaveText("最优波");
    await expect(root.locator("[data-legend-scan]")).toHaveCount(0);
    await expect(root.locator("[data-replay-wo-value]").nth(2)).toHaveText("30");

    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(1, { timeout: 10000 });
    await expect(root.locator("[data-point-value]")).toHaveText("P1");
    await expect(root.locator("[data-beam-id-value]")).toHaveText("10");
    await expect(root.locator("[data-beam-badge]")).toHaveText("预测成功");
    await expect(root.locator("[data-beam-crosshair]")).toHaveAttribute("data-tone", "success");
    await expect(root.locator('[data-rc="0,10"]')).toHaveAttribute("data-beam-role", "pred");
    await expect(root.locator("[data-replay-w-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-replay-w-tone]").nth(0)).toHaveAttribute(
      "data-replay-w-tone",
      "ok",
    );
    await expect(root.locator("[data-replay-check]")).toHaveCount(1);
    await expect(root.locator("[data-replay-check]").nth(0)).toHaveAttribute(
      "data-replay-check",
      "ok",
    );
    await expect(root.locator("[data-cost-wo]")).toHaveText("25.0");
    await expect(root.locator("[data-cost-w]")).toHaveText("12.5");
    await expect(root.locator("[data-cost-delta]")).toHaveText("--");
    await expect(root.locator("[data-thr-dot-w]")).toHaveCount(1);
    await expect(root.locator("[data-ba-ok]")).toHaveText("222");
    await expectAllBusinessButtonsDisabled(page);

    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(2, { timeout: 10000 });
    await expect(root.locator("[data-point-value]")).toHaveText("P2");
    await expect(root.locator("[data-beam-id-value]")).toHaveText("21");
    await expect(root.locator("[data-beam-badge]")).toHaveText("预测失败");
    await expect(root.locator("[data-beam-crosshair]")).toHaveAttribute("data-tone", "fail");
    await expect(root.locator("[data-beam-crosshair]")).toHaveAttribute("data-beam-id", "21");
    await expect(root.locator('[data-rc="1,5"]')).toHaveClass(/is-pred/);
    await expect(root.locator('[data-rc="1,4"]')).toHaveClass(/is-best/);
    await expect(root.locator("[data-replay-w-tone]").nth(1)).toHaveAttribute(
      "data-replay-w-tone",
      "fail",
    );
    await expect(root.locator("[data-replay-check]")).toHaveCount(2);
    await expect(root.locator("[data-replay-check='fail']")).toHaveCount(1);
    await expect(root.locator("[data-thr-dot-w]")).toHaveCount(2);

    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(3, { timeout: 10000 });
    await expect(root.locator("[data-point-value]")).toHaveText("P3");
    await expect(root.locator("[data-beam-badge]")).toHaveText("预测成功");
    await expect(root.locator("[data-thr-dot-w]")).toHaveCount(3);
    await expect(root.locator("[data-replay-check]")).toHaveCount(3);
    await expect(root.locator("[data-replay-check='ok']")).toHaveCount(2);
    await expect(root.locator("[data-replay-check='fail']")).toHaveCount(1);

    await expect(root).toHaveAttribute("data-state", "with-completed", {
      timeout: 10000,
    });
    await expect(root.locator('[data-status="with"] .case3v2-side-status__text')).toHaveText(
      "已结束",
    );
    await expect(root.locator("[data-cost-delta]")).toHaveText("-50.0");
    await expect(root.locator("[data-cost-delta-label]")).toHaveText("开销减少");
    await expect(root.locator("[data-ba-ok]")).toHaveText("224");
    await expect(root.locator("[data-ba-bad]")).toHaveText("14");
    await expect(root.locator("[data-ba-pct]")).toHaveText("94.1");
    await expect.poll(() => screenshotPosts.length, { timeout: 20000 }).toBe(2);
    expect(screenshotPosts[1]).toEqual({
      path: "out/case3/case3-001.png",
      seq: 1,
    });
    expect(completionInitPosts).toBe(1);
    await expectAllBusinessButtonsDisabled(page);
    await expect(page.getByRole("button", { name: "DT校正" })).toBeDisabled();

    releaseWithScreenshot();
    await expect.poll(() => completionInitPosts, { timeout: 15000 }).toBe(2);
    expect(screenshotPosts).toHaveLength(2);
    await expect(page.getByTitle("重置有 DT")).toBeEnabled({ timeout: 15000 });
    await expect(page.getByTitle("重置无 DT")).toBeEnabled();
    await expect(page.getByTitle("启动有 DT")).toBeDisabled();
    await expect(page.getByRole("button", { name: "DT校正" })).toBeEnabled();
    await expect(root.locator("[data-point-value]")).toHaveText("P3");
    await expect(root.locator("[data-replay-wo-value]").nth(2)).toHaveText("30");
  });
});
