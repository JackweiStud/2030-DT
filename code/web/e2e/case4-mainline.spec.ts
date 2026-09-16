/**
 * Case4 Playwright 主线（前端隔离）。
 * Node/Case4 stub 未接入默认 e2e 端口时用 page.route mock；不得宣称三进程全栈已通过。
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const visualDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.tmp/case4-visual",
);

function xyz(x: number, y: number, z = 0) {
  return { x, y, z };
}

function baseRoute(count: number) {
  const pts: Array<{ no: number; x: number; y: number; z: number }> = [];
  let no = 1;
  for (let y = 15; y >= 2 && no <= count; y -= 1) {
    pts.push({ no, x: 1, y, z: 0 });
    no += 1;
  }
  for (let x = 2; no <= count; x += 1) {
    pts.push({ no, x, y: 2, z: 0 });
    no += 1;
  }
  return pts;
}

function trajPoints(count: number, route: ReturnType<typeof baseRoute>) {
  return route.slice(0, count).map((p) => ({
    no: p.no,
    traditional: xyz(p.x + 0.3, p.y),
    commercial: xyz(p.x + 0.2, p.y),
    dt: xyz(p.x + 0.1, p.y),
  }));
}

function statistics() {
  return {
    cdf: {
      traditional: [
        { errorM: 0.2, probability: 0.4 },
        { errorM: 0.8, probability: 0.9 },
      ],
      commercial: [
        { errorM: 0.15, probability: 0.5 },
        { errorM: 0.6, probability: 0.9 },
      ],
      dt: [
        { errorM: 0.05, probability: 0.5 },
        { errorM: 0.2, probability: 0.9 },
      ],
    },
    cep: {
      traditional: { p50M: 0.4, p90M: 0.9 },
      commercial: { p50M: 0.3, p90M: 0.7 },
      dt: { p50M: 0.1, p90M: 0.25 },
    },
    nlosRatio: 0.897,
  };
}

async function mockCase4(
  page: Page,
  options: {
    expectedCount?: number;
    completeCount?: number;
    withoutCount?: number;
    withCount?: number;
    failStart?: boolean;
  } = {},
) {
  const expectedCount = options.expectedCount ?? 38;
  const completeCount = options.completeCount ?? 30;
  const withoutCount = options.withoutCount ?? 4;
  const withCount = options.withCount ?? 7;
  const route = baseRoute(expectedCount);
  let control = {
    case: "case4",
    command: "init",
    dt_type: "",
    status: "",
    save_picture_flag: 0,
  };
  let startPolls = 0;

  await page.route("**/api/case4/**", async (routeObj) => {
    const req = routeObj.request();
    const url = req.url();
    if (url.includes("/control-file") && req.method() === "GET") {
      if (control.command === "start") {
        startPolls += 1;
        if (options.failStart) {
          control = { ...control, status: "execute fail" };
        } else if (startPolls === 1) {
          control = { ...control, status: "execute success" };
        } else {
          control = {
            ...control,
            status: "case complete",
            save_picture_flag: 1,
          };
        }
      }
      if (control.command === "reinit") {
        startPolls += 1;
        control = {
          ...control,
          status: startPolls === 1 ? "execute success" : "reinit complete",
        };
      }
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, control }),
      });
      return;
    }
    if (url.includes("/control-file") && req.method() === "POST") {
      const payload = req.postDataJSON() as Record<string, unknown>;
      if (payload.command === "init") {
        control = {
          case: "case4",
          command: "init",
          dt_type: "",
          status: "",
          save_picture_flag: 0,
        };
        startPolls = 0;
      } else if (payload.command === "start" || payload.command === "reinit") {
        control = {
          case: "case4",
          command: String(payload.command),
          dt_type: String(payload.dt_type),
          status: "",
          save_picture_flag: 0,
        };
        startPolls = 0;
      } else if (payload.save_picture_flag === 0) {
        control = { ...control, save_picture_flag: 0 };
      }
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, control }),
      });
      return;
    }
    if (url.includes("/init-data")) {
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, baseRoute: route }),
      });
      return;
    }
    if (url.includes("/trajectory")) {
      const points = trajPoints(completeCount, route);
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          points,
          completeCount: points.length,
          pendingTail: false,
        }),
      });
      return;
    }
    if (url.includes("/throughput")) {
      const side = new URL(url).searchParams.get("side");
      const count = side === "with" ? withCount : withoutCount;
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          side,
          samples: Array.from({ length: count }, (_, i) => ({
            no: i + 1,
            gbps: 8 + i * 0.2,
          })),
          pendingTail: false,
        }),
      });
      return;
    }
    if (url.includes("/result")) {
      const points = trajPoints(completeCount, route);
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          trajectory: {
            points,
            completeCount: points.length,
            pendingTail: false,
          },
          throughput: {
            without: {
              samples: Array.from({ length: withoutCount }, (_, i) => ({
                no: i + 1,
                gbps: 8 + i * 0.2,
              })),
              pendingTail: false,
            },
            with: {
              samples: Array.from({ length: withCount }, (_, i) => ({
                no: i + 1,
                gbps: 8.5 + i * 0.1,
              })),
              pendingTail: false,
            },
          },
          statistics: statistics(),
        }),
      });
      return;
    }
    if (url.includes("/screenshot")) {
      await routeObj.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          path: "out/case4/case4-000.png",
          seq: 0,
        }),
      });
      return;
    }
    await routeObj.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: { code: "NOT_FOUND", message: "not mocked" },
      }),
    });
  });
}

async function openCase4(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "DT for positioning" }).click();
  await expect(page.locator(".case4-page")).toBeVisible();
}

async function shot(page: Page, name: string) {
  mkdirSync(visualDir, { recursive: true });
  await page.locator(".case4-page").screenshot({
    path: resolve(visualDir, name),
  });
}

test.describe("case4 mainline (frontend-isolated)", () => {
  test("进入、38/30 完成、不等长吞吐、完成画面与重置", async ({ page }) => {
    await mockCase4(page);
    await openCase4(page);
    const start = page.getByRole("button", { name: "开始" });
    const reset = page.getByRole("button", { name: "重置" });
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await expect(reset).toBeDisabled();
    await expect(page.locator(".c4-nlos-value")).toHaveText("--");
    await expect(page.locator(".c4-pin")).toHaveCount(38);
    await shot(page, "01-initial.png");

    await start.click();
    await expect(page.locator(".c4-ctrl-status")).toHaveText("测试中...");
    await expect(start).toBeDisabled();
    await expect(page.locator(".c4-pin.is-lit")).toHaveCount(30, {
      timeout: 10_000,
    });
    await shot(page, "02-running.png");

    await expect(page.locator(".case4-page")).toHaveAttribute(
      "data-state",
      "completed",
      { timeout: 15_000 },
    );
    await expect(page.locator(".c4-nlos-value")).toHaveText("89.7");
    await expect(page.locator(".c4-ctrl-status")).toHaveText("已完成");
    await shot(page, "03-completed.png");

    await expect(reset).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("button", { name: "现场环境 >" }).click();
    await expect(page.locator("[data-site-env-overlay]")).toBeVisible();
    await shot(page, "04-site-env.png");
    await page.locator("[data-site-env-close]").click();

    await reset.click();
    await expect(start).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator(".case4-page")).toHaveAttribute(
      "data-state",
      "initial",
    );
  });

  test("execute fail 后只能再 Start", async ({ page }) => {
    await mockCase4(page, { failStart: true });
    await openCase4(page);
    await page.getByRole("button", { name: "开始" }).click();
    await expect(page.locator(".c4-ctrl-status")).toHaveText("执行命令失败", {
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "开始" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "重置" })).toBeDisabled();
  });

  test("刷新 completed 回到 initial", async ({ page }) => {
    await mockCase4(page, { expectedCount: 3, completeCount: 3 });
    await openCase4(page);
    await page.getByRole("button", { name: "开始" }).click();
    await expect(page.locator(".case4-page")).toHaveAttribute(
      "data-state",
      "completed",
      { timeout: 15_000 },
    );
    await page.reload();
    await page.getByRole("button", { name: "DT for positioning" }).click();
    await expect(page.locator(".c4-ctrl-status")).toHaveText("未开始", {
      timeout: 10_000,
    });
    await expect(page.locator(".c4-nlos-value")).toHaveText("--");
  });
});
