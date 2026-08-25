/**
 * Case3 V2 ReInit 与 31 点回溯拖动（前端隔离）。
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
    throughputGbps: 8 + no,
    scanBeamIds: [0, no * 10],
  };
}

function withPoint(no: number) {
  return {
    no,
    ue: { x: no === 1 ? 1 : 1, y: no === 1 ? 15 : 15 - no, z: 0 },
    selectedBeamId: no === 2 ? 21 : no * 10,
    throughputGbps: 8 + no,
    reflection: { x: 0, y: 0, z: 0, los: true },
  };
}

function lRoute(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    no: index + 1,
    x: index === 0 ? 1 : 1,
    y: index === 0 ? 15 : Math.max(1, 15 - index),
    z: 0,
  }));
}

type Control = {
  case: string;
  command: string;
  dt_type: string;
  status: string;
  save_picture_flag: number;
};

async function installCase3Mock(
  page: Page,
  options: { routeCount: number; liveCap?: number },
) {
  const routeCount = options.routeCount;
  const liveCap = options.liveCap ?? routeCount;
  let control: Control = {
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
  const retained: { without: number; with: number } = { without: 0, with: 0 };

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
      } else if (control.command === "reinit") {
        startPolls += 1;
        if (startPolls <= 2) {
          control = { ...control, status: "execute success" };
        } else if (control.status !== "reinit complete") {
          control = { ...control, status: "reinit complete" };
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
        if (payload.command === "start") {
          if (activeDtType === "without dt") retained.without = 0;
          if (activeDtType === "with dt") retained.with = 0;
        } else if (payload.command === "reinit") {
          if (activeDtType === "without dt") retained.without = 0;
          if (activeDtType === "with dt") retained.with = 0;
        }
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
          baseRoute: lRoute(routeCount),
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
      let count = 0;
      if (runningThisSide) {
        count =
          control.status === "case complete"
            ? liveCap
            : Math.max(0, Math.min(startPolls, liveCap));
        if (side === "without") retained.without = count;
        if (side === "with") retained.with = count;
      } else if (side === "without") {
        count = retained.without;
      } else if (side === "with") {
        count = retained.with;
      }
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

  return { screenshotPosts, getCompletionInitPosts: () => completionInitPosts };
}

async function waitIdle(page: Page, title: string) {
  await expect(page.getByTitle(title)).toBeEnabled({ timeout: 20000 });
}

test.describe("case3 v2 reinit (frontend-isolated)", () => {
  test("双侧完成后 Reset With/Without，主地图不回填，可开新一轮", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await installCase3Mock(page, { routeCount: 5, liveCap: 3 });
    await page.goto("/");
    await page.getByRole("button", { name: "DT for Comm new" }).click();
    const root = page.getByTestId("case3-v2-page");
    await expect(root).toBeVisible();
    await expect(page.getByTitle("启动无 DT")).toBeEnabled({ timeout: 10000 });

    await page.getByTitle("启动无 DT").click();
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(3, { timeout: 15000 });
    await waitIdle(page, "启动有 DT");

    await page.getByTitle("启动有 DT").click();
    await expect(root).toHaveAttribute("data-map-side", "with");
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(3, { timeout: 15000 });
    await waitIdle(page, "重置有 DT");
    await expect(root.locator("[data-cost-delta]")).toHaveText("-50.0");
    await expect(root.locator("[data-point-value]")).toHaveText("P3");

    await page.getByTitle("重置有 DT").click();
    await expect(root).toHaveAttribute("data-map-cleared", "1");
    await expect(root).toHaveAttribute("data-map-side", "without");
    await expect(root.locator("[data-beam-mode]")).toHaveAttribute("data-beam-mode", "without");
    await expect(root.locator("[data-legend-scan]")).toHaveText("扫描波");
    await expect(root.locator("[data-legend-pred]")).toHaveCount(0);
    await expect(root.locator("[data-legend-best]")).toHaveText("最优波");
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(0);
    await expect(root.locator("[data-ue]")).toHaveCount(0);
    await expect(root.locator("[data-point-value]")).toHaveText("P--");
    await expect(root.locator("[data-beam-id-value]")).toHaveText("--");
    await expectAllBusinessButtonsDisabled(page);
    await expect(root.locator("[data-replay-wo-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-replay-w-value]").nth(0)).toHaveText("--");
    await expect(root.locator("[data-cost-delta]")).toHaveText("--");
    await expect(root.locator("[data-cost-wo]")).toHaveText("25.0");
    await expect(root.locator("[data-cost-w]")).toHaveText("--");
    await expect(root.locator("[data-ba-ok]")).toHaveText("222");
    await expect(root.locator("[data-replay-check]")).toHaveCount(0);

    await waitIdle(page, "启动有 DT");
    await expect(root).toHaveAttribute("data-map-cleared", "1");
    await expect(root).toHaveAttribute("data-map-side", "without");
    await expect(root.locator("[data-beam-mode]")).toHaveAttribute("data-beam-mode", "without");
    await expect(root.locator("[data-legend-scan]")).toHaveText("扫描波");
    await expect(root.locator("[data-legend-pred]")).toHaveCount(0);
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(0);
    await expect(root.locator("[data-replay-wo-value]").nth(2)).toHaveText("30");

    await page.getByTitle("启动有 DT").click();
    await expect
      .poll(() =>
        root.evaluate((element) => ({
          cleared: element.getAttribute("data-map-cleared"),
          mapSide: element.getAttribute("data-map-side"),
          beamMode: element
            .querySelector("[data-beam-mode]")
            ?.getAttribute("data-beam-mode"),
          scanLegend: element.querySelector("[data-legend-scan]")?.textContent,
          predLegendCount: element.querySelectorAll("[data-legend-pred]").length,
          litPins: element.querySelectorAll('[data-pin-lit="1"]').length,
        })),
      )
      .toEqual({
        cleared: "1",
        mapSide: "without",
        beamMode: "without",
        scanLegend: "扫描波",
        predLegendCount: 0,
        litPins: 0,
      });
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(1, { timeout: 10000 });
    await expect(root).toHaveAttribute("data-map-cleared", "0");
    await expect(root).toHaveAttribute("data-map-side", "with");
    await expect(root.locator("[data-beam-mode]")).toHaveAttribute("data-beam-mode", "with");
    await expect(root.locator("[data-legend-pred]")).toHaveText("预测波");
    await expect(root.locator("[data-legend-scan]")).toHaveCount(0);
    await expect(root.locator("[data-point-value]")).toHaveText("P1");
    await expect(root.locator("[data-replay-wo-value]").nth(2)).toHaveText("30");
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(3, { timeout: 15000 });
    await waitIdle(page, "重置无 DT");
    await expect(root.locator("[data-cost-delta]")).toHaveText("-50.0");

    await page.getByTitle("重置无 DT").click();
    await expect(root).toHaveAttribute("data-map-cleared", "1");
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(0);
    await expect(root.locator("[data-point-value]")).toHaveText("P--");
    await expect(root.locator("[data-replay-w-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-replay-w-tone]").nth(0)).toHaveAttribute(
      "data-replay-w-tone",
      "idle",
    );
    await expect(root.locator("[data-replay-check]")).toHaveCount(0);
    await expect(root.locator("[data-cost-wo]")).toHaveText("--");
    await expect(root.locator("[data-cost-w]")).toHaveText("12.5");
    await expect(root.locator("[data-cost-delta]")).toHaveText("--");
    await expect(root.locator("[data-ba-ok]")).toHaveText("222");
    await waitIdle(page, "启动无 DT");
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(0);
  });

  test("31 点默认最新窗口，拖动两行与勾叉同步且不改地图当前点", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await installCase3Mock(page, { routeCount: 31, liveCap: 31 });
    await page.goto("/");
    await page.getByRole("button", { name: "DT for Comm new" }).click();
    const root = page.getByTestId("case3-v2-page");
    await expect(root).toBeVisible();
    await expect(page.getByTitle("启动无 DT")).toBeEnabled({ timeout: 10000 });

    await page.getByTitle("启动无 DT").click();
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(31, { timeout: 20000 });
    await waitIdle(page, "启动有 DT");
    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(0)).toHaveText(
      "P12",
    );
    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(19)).toHaveText(
      "P31",
    );
    await expect(root.locator("[data-point-value]")).toHaveText("P31");
    await expect(root.locator("[data-replay-can-drag]")).toHaveAttribute(
      "data-replay-can-drag",
      "1",
    );

    await page.getByTitle("启动有 DT").click();
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(31, { timeout: 20000 });
    await waitIdle(page, "重置有 DT");
    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(0)).toHaveText(
      "P12",
    );
    await expect(root.locator("[data-replay-check]")).toHaveCount(20);
    await expect(root.locator("[data-point-value]")).toHaveText("P31");

    const surface = root.locator("[data-replay-surface]");
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    const y = box!.y + 24;
    const innerRight = box!.x + box!.width - 40;
    const dragPx = 85 * 12;
    await page.mouse.move(innerRight, y);
    await page.mouse.down();
    await page.mouse.move(innerRight + dragPx, y, { steps: 12 });
    await page.mouse.up();

    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(0)).toHaveText(
      "P1",
    );
    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(19)).toHaveText(
      "P20",
    );
    await expect(root.locator("[data-replay-wo-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-replay-w-value]").nth(0)).toHaveText("10");
    await expect(root.locator("[data-replay-check]").first()).toHaveAttribute(
      "data-replay-check-no",
      "1",
    );
    await expect(root.locator("[data-replay-check]").first()).toHaveAttribute(
      "data-replay-check-slot",
      "0",
    );
    await expect(root.locator("[data-point-value]")).toHaveText("P31");
    await expect(root.locator('[data-pin-lit="1"]')).toHaveCount(31);

    await page.mouse.move(innerRight, y);
    await page.mouse.down();
    await page.mouse.move(innerRight - dragPx, y, { steps: 12 });
    await page.mouse.up();
    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(0)).toHaveText(
      "P12",
    );
    await expect(root.locator("[data-replay-headers] .case3v2-replay-col").nth(19)).toHaveText(
      "P31",
    );
    await expect(root.locator("[data-replay-follow-latest]")).toHaveAttribute(
      "data-replay-follow-latest",
      "1",
    );
    await expect(root.locator("[data-point-value]")).toHaveText("P31");
  });
});
