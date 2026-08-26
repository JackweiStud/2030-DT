/**
 * Case3 V2 Without 主链：live 逐点更新与完成态。
 */

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Case3V2Page } from "../../src/cases/case3-v2/Case3V2Page";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import {
  useCase3Controller,
  type Case3Controller,
} from "../../src/cases/case3/hooks/useCase3Controller";
import {
  case3Reducer,
  createInitialCase3State,
} from "../../src/cases/case3/state/case3Reducer";
import { selectCase3Presentation } from "../../src/cases/case3/presentation/selectCase3Presentation";
import { SiteEnvWindowContext } from "../../src/shell/siteEnvWindowContext";
import type { BaseRoutePoint, SideSnapshot } from "../../src/cases/case3/types";

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

function snap(count: number, extraPoints = 0, cost: number | null = 25): SideSnapshot {
  const total = count + extraPoints;
  return {
    side: "without",
    points: Array.from({ length: total }, (_, index) => {
      const no = index + 1;
      return {
        no,
        ue: { x: no === 1 ? 1 : no, y: no === 1 ? 15 : 2, z: 0 },
        selectedBeamId: no * 10,
        throughputGbps: 8 + no,
        scanBeamIds: [0, no * 10],
      };
    }),
    completeCount: count,
    pendingTail: extraPoints > 0,
    costPct: cost,
  };
}

function controllerFromState(
  state: Case3Controller["state"],
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
  };
}

function readyState() {
  return {
    ...createInitialCase3State(),
    initStatus: "ready" as const,
    baseRoute: L_ROUTE,
    baseline: { success: 222, total: 235 },
  };
}

function running(count: number, extraPoints = 0, cost: number | null = 25) {
  let state = case3Reducer(readyState(), {
    type: "ACTION_BEGIN",
    kind: "start",
    side: "without",
    generation: 1,
  });
  state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
  return case3Reducer(state, {
    type: "LIVE_SNAPSHOT",
    side: "without",
    snapshot: snap(count, extraPoints, cost),
  });
}

function renderPage(state: Case3Controller["state"]) {
  const ctrl = controllerFromState(state);
  vi.mocked(useCase3Controller).mockImplementation(() => ctrl);
  const view = render(
    <SiteEnvWindowContext.Provider value={{ open: vi.fn(), close: vi.fn() }}>
      <Case3V2Page
        config={config}
        stageElementRef={{ current: document.createElement("main") }}
      />
    </SiteEnvWindowContext.Provider>,
  );
  return { view, ctrl };
}

afterEach(() => {
  vi.mocked(useCase3Controller).mockReset();
});

describe("Case3V2Page without flow", () => {
  it("Start 后动态层回初始，预置路线仍在", () => {
    const started = case3Reducer(readyState(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "without",
      generation: 1,
    });
    const { view } = renderPage(started);
    expect(view.container.querySelector("[data-testid='case3-v2-page']")?.getAttribute("data-state")).toBe(
      "without-running",
    );
    expect(view.container.querySelectorAll(".case3v2-pin")).toHaveLength(5);
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(0);
    expect(view.container.querySelector("[data-ue]")).toBeNull();
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(view.container.querySelector("[data-beam-crosshair]")).toBeNull();
    expect(view.getByTitle("启动无 DT")).toHaveProperty("disabled", true);
    expect(view.getByTitle("启动有 DT")).toHaveProperty("disabled", true);
    expect(view.container.querySelector('[data-status="without"]')?.textContent).toContain(
      "测试中",
    );
    expect(view.container.querySelector("[data-status-ellipsis]")).not.toBeNull();
  });

  it("pendingTail 尾点不点亮、不进矩阵", () => {
    const { view } = renderPage(running(1, 1, null));
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(1);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P1");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("10");
    const values = [...view.container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(values[0]).toBe("10");
    expect(values[1]).toBe("--");
  });

  it("1→N 点更新地图、矩阵、回溯、Cost、Throughput；BA 仍为基线", () => {
    const { view } = renderPage(running(1, 0, 25));
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(1);
    expect(view.container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(view.container.querySelector("[data-cost-fill-wo]")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(view.container.querySelector("[data-thr-wo]")?.getAttribute("d")).toContain("M");
    expect(view.container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(1);
    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");
    expect(view.container.querySelector("[data-ba-pct]")?.textContent).toBe("94.5");

    view.unmount();
    const next = renderPage(running(3, 0, 25));
    expect(next.view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(3);
    expect(next.view.container.querySelector("[data-point-value]")?.textContent).toBe("P3");
    expect(next.view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("30");
    expect(
      next.view.container.querySelector("[data-beam-crosshair]")?.getAttribute("data-beam-id"),
    ).toBe("30");
    expect(
      next.view.container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone"),
    ).toBe("neutral");
    expect(next.view.container.querySelector("[data-walked-inner]")?.getAttribute("points")?.trim().split(/\s+/)).toHaveLength(3);
    const replay = [...next.view.container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(replay.slice(0, 3)).toEqual(["10", "20", "30"]);
    expect(next.view.container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(3);
    expect(next.view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");
    expect(next.view.container.querySelector("[data-thr-w]")?.getAttribute("d")).toBeNull();
  });

  it("完成后保留最后完整点，roundClosing 仍锁按钮，关闭后解锁 With", () => {
    let state = running(3, 0, 25);
    state = case3Reducer(state, {
      type: "START_COMPLETE",
      side: "without",
      snapshot: snap(3, 0, 25),
    });
    const closing = renderPage(state);
    expect(
      closing.view.container
        .querySelector("[data-testid='case3-v2-page']")
        ?.getAttribute("data-state"),
    ).toBe("without-completed");
    expect(closing.view.container.querySelector("[data-point-value]")?.textContent).toBe("P3");
    expect(closing.view.container.querySelectorAll(".is-best")).toHaveLength(1);
    expect(
      closing.view.container.querySelector("[data-beam-crosshair]")?.getAttribute("data-beam-id"),
    ).toBe("30");
    expect(closing.ctrl.busy).toBe(true);
    expect(closing.view.getByTitle("启动有 DT")).toHaveProperty("disabled", true);
    expect(closing.view.getByTitle("重置无 DT")).toHaveProperty("disabled", true);
    expect(closing.view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");
    closing.view.unmount();

    const closed = renderPage(case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" }));
    expect(closed.ctrl.busy).toBe(false);
    expect(closed.view.getByTitle("启动有 DT")).toHaveProperty("disabled", false);
    expect(closed.view.getByTitle("重置无 DT")).toHaveProperty("disabled", false);
    expect(closed.view.getByTitle("启动无 DT")).toHaveProperty("disabled", true);
    expect(closed.view.container.querySelector('[data-status="without"]')?.textContent).toBe(
      "已结束",
    );
    expect(closed.view.container.querySelector("[data-status-ellipsis]")).toBeNull();
  });
});
