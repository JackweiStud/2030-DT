/**
 * Case3 V2 初始页：动态路线、真实 BA 基线、空 Cost/Throughput、按钮权限。
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Case3V2Page } from "../../src/cases/case3-v2/Case3V2Page";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import {
  useCase3Controller,
  type Case3Controller,
} from "../../src/cases/case3/hooks/useCase3Controller";
import { createInitialCase3State } from "../../src/cases/case3/state/case3Reducer";
import { selectCase3Presentation } from "../../src/cases/case3/presentation/selectCase3Presentation";
import { SiteEnvWindowContext } from "../../src/shell/siteEnvWindowContext";
import type { BaseRoutePoint } from "../../src/cases/case3/types";

vi.mock("../../src/cases/case3/hooks/useCase3Controller", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/cases/case3/hooks/useCase3Controller")
  >("../../src/cases/case3/hooks/useCase3Controller");
  return { ...actual, useCase3Controller: vi.fn() };
});

const config: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
  v2MapOriginX: 905,
  v2MapOriginY: 445,
  v2MapUnitsPerPx: 0.11,
  v2MapImageScale: 1,
  v2MapImageRotationDeg: 0,
  v2MapImageOffsetX: 0,
  v2MapImageOffsetY: 0,
  v2DebugShow: true,
};

const L_ROUTE: BaseRoutePoint[] = [
  { no: 1, x: 1, y: 15, z: 0 },
  { no: 2, x: 1, y: 9, z: 0 },
  { no: 3, x: 1, y: 2, z: 0 },
  { no: 4, x: 9, y: 2, z: 0 },
  { no: 5, x: 18, y: 2, z: 0 },
];

function controllerFromState(
  state: Case3Controller["state"],
  overrides: Partial<Case3Controller> = {},
): Case3Controller {
  const presentation = selectCase3Presentation(state);
  return {
    state,
    visible: presentation.visible,
    busy: presentation.busy,
    startWithoutEnabled: presentation.startWithoutEnabled,
    startWithEnabled: presentation.startWithEnabled,
    reinitWithoutEnabled: presentation.reinitWithoutEnabled,
    reinitWithEnabled: presentation.reinitWithEnabled,
    withoutBadge: presentation.withoutBadge,
    withBadge: presentation.withBadge,
    withoutBadgeError: presentation.withoutBadgeError,
    withBadgeError: presentation.withBadgeError,
    withoutRetryHint: presentation.withoutRetryHint,
    withRetryHint: presentation.withRetryHint,
    onStartWithout: vi.fn(),
    onStartWith: vi.fn(),
    onReinitWithout: vi.fn(),
    onReinitWith: vi.fn(),
    ...overrides,
  };
}

function renderPage(ctrl: Case3Controller) {
  vi.mocked(useCase3Controller).mockImplementation(() => ctrl);
  const open = vi.fn();
  const view = render(
    <SiteEnvWindowContext.Provider value={{ open, close: vi.fn() }}>
      <Case3V2Page
        config={config}
        stageElementRef={{ current: document.createElement("main") }}
      />
    </SiteEnvWindowContext.Provider>,
  );
  return { view, open, ctrl };
}

function readyState(route = L_ROUTE, baseline: { success: number; total: number } | null = { success: 222, total: 235 }) {
  return {
    ...createInitialCase3State(),
    initStatus: "ready" as const,
    baseRoute: route,
    baseline,
  };
}

afterEach(() => {
  vi.mocked(useCase3Controller).mockReset();
});

describe("Case3V2Page initial", () => {
  it("渲染动态 routeNos 点数、真实 BA 基线、空 Cost/Throughput", () => {
    const { view } = renderPage(controllerFromState(readyState()));

    const pins = view.container.querySelectorAll(".case3v2-pin");
    expect(pins).toHaveLength(5);
    expect(
      [...pins].map((el) => el.getAttribute("data-route-no")),
    ).toEqual(["1", "2", "3", "4", "5"]);

    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");
    expect(view.container.querySelector("[data-ba-bad]")?.textContent).toBe("13");
    expect(view.container.querySelector("[data-ba-pct]")?.textContent).toBe("94.5");
    expect(view.container.textContent).not.toContain("75.0");

    expect(view.container.querySelector("[data-cost-wo]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-cost-delta]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-thr-yline]")).not.toBeNull();
    expect(view.container.querySelector("[data-thr-xline]")).not.toBeNull();
    expect(
      view.container.querySelector("[data-thr-wo]")?.getAttribute("d"),
    ).toBeNull();
    expect(
      view.container.querySelector("[data-thr-w]")?.getAttribute("d"),
    ).toBeNull();

    expect(view.container.querySelectorAll("[data-replay-without] .case3v2-replay-cell")).toHaveLength(19);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("--");
    expect(view.container.querySelectorAll(".case3v2-beam-cell")).toHaveLength(256);
    expect(view.container.querySelector("[data-beam-crosshair]")).toBeNull();
  });

  it("baseline 未就绪时 BA 为 --", () => {
    const { view } = renderPage(controllerFromState(readyState(L_ROUTE, null)));
    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-ba-bad]")?.textContent).toBe("--");
    const pct = view.container.querySelector("[data-ba-pct]");
    expect(pct?.textContent).toBe("--");
    expect(pct?.closest("[data-ba-overlay]")).not.toBeNull();
    expect(pct?.closest(".case3v2-ba-fill--ok")).toBeNull();
  });

  it("31 点路线吞吐空坐标系保留首末 X 刻度与网格，曲线为空", () => {
    const route: BaseRoutePoint[] = Array.from({ length: 31 }, (_, i) => ({
      no: i + 1,
      x: i,
      y: 0,
      z: 0,
    }));
    const { view } = renderPage(controllerFromState(readyState(route)));

    const xTicks = [...view.container.querySelectorAll("[data-thr-x-tick]")].map(
      (el) => el.textContent,
    );
    expect(xTicks[0]).toBe("1");
    expect(xTicks[xTicks.length - 1]).toBe("31");
    expect(xTicks.length).toBeGreaterThan(2);
    expect(xTicks.length).toBeLessThan(31);

    const yTicks = [...view.container.querySelectorAll("[data-thr-y-tick]")].map(
      (el) => el.textContent,
    );
    expect(yTicks[0]).toBe("3.2");
    expect(yTicks[yTicks.length - 1]).toBe("0.0");
    expect(yTicks).toEqual([
      "3.2",
      "2.8",
      "2.4",
      "2.0",
      "1.6",
      "1.2",
      "0.8",
      "0.4",
      "0.0",
    ]);

    expect(view.container.querySelectorAll("[data-thr-yline]").length).toBe(
      yTicks.length,
    );
    expect(view.container.querySelectorAll("[data-thr-xline]").length).toBe(
      xTicks.length,
    );
    expect(
      view.container.querySelector("[data-thr-wo]")?.getAttribute("d"),
    ).toBeNull();
    expect(
      view.container.querySelector("[data-thr-w]")?.getAttribute("d"),
    ).toBeNull();
    expect(view.container.querySelector("[data-thr-dots]")?.childElementCount).toBe(
      0,
    );
  });

  it("2D 选中、3D 禁用；现场环境只回调 Shell", () => {
    const { view, open } = renderPage(controllerFromState(readyState()));
    expect(view.getByText("2D视图").getAttribute("aria-current")).toBe("true");
    expect(view.getByText("3D视图").getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "现场环境 >" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector(".case3v2-overlay")).toBeNull();
  });

  it("Without Start 可点，With Start 与两侧 Reset 禁用", () => {
    const onStartWithout = vi.fn();
    const { view } = renderPage(
      controllerFromState(readyState(), { onStartWithout }),
    );
    const startWo = view.getByTitle("启动无 DT") as HTMLButtonElement;
    const startW = view.getByTitle("启动有 DT") as HTMLButtonElement;
    const resetWo = view.getByTitle("重置无 DT") as HTMLButtonElement;
    const resetW = view.getByTitle("重置有 DT") as HTMLButtonElement;
    expect(startWo.disabled).toBe(false);
    expect(startW.disabled).toBe(true);
    expect(resetWo.disabled).toBe(true);
    expect(resetW.disabled).toBe(true);
    expect(view.container.querySelector('[data-status="without"]')?.textContent).toBe(
      "未开始",
    );
    expect(view.container.querySelector('[data-status="with"]')?.textContent).toBe(
      "未开始",
    );
    fireEvent.click(startWo);
    expect(onStartWithout).toHaveBeenCalledTimes(1);
  });
});
