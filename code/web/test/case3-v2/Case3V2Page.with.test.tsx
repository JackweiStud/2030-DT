/**
 * Case3 V2 With 主链：清地图、同 no 矩阵、实时 KPI、完成后 delta/BA。
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
import type {
  BaseRoutePoint,
  Case3Point,
  SideSnapshot,
  ThroughputSnapshot,
} from "../../src/cases/case3/types";

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

function withBeam(no: number): number {
  return no === 2 ? 21 : no * 10;
}

function pointOf(
  side: "without" | "with",
  no: number,
  beam: number,
): Case3Point {
  return {
    no,
    ue: { x: no === 1 ? 1 : no, y: no === 1 ? 15 : 2, z: 0 },
    selectedBeamId: beam,
    throughputGbps: 8 + no,
    ...(side === "without"
      ? { scanBeamIds: [0, beam] }
      : { reflection: { x: 0, y: 0, z: 0, los: true } }),
  };
}

function thrpFromSnapshot(snapshot: SideSnapshot): ThroughputSnapshot {
  return {
    samples: snapshot.points
      .slice(0, snapshot.completeCount)
      .map((p) => ({ no: p.no, gbps: p.throughputGbps })),
    pendingTail: snapshot.pendingTail,
  };
}

function snap(
  side: "without" | "with",
  count: number,
  extraPoints = 0,
  cost: number | null = side === "without" ? 25 : 12.5,
): SideSnapshot {
  const total = count + extraPoints;
  return {
    side,
    points: Array.from({ length: total }, (_, index) => {
      const no = index + 1;
      const beam = side === "with" ? withBeam(no) : no * 10;
      return pointOf(side, no, beam);
    }),
    completeCount: count,
    pendingTail: extraPoints > 0,
    costPct: cost,
  };
}

function controllerFromState(state: Case3Controller["state"]): Case3Controller {
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

function readyState(route: BaseRoutePoint[] = L_ROUTE) {
  return {
    ...createInitialCase3State(),
    initStatus: "ready" as const,
    baseRoute: route,
    baseline: { success: 222, total: 235 },
  };
}

function withoutClosed(count = 3, route: BaseRoutePoint[] = L_ROUTE) {
  let state = case3Reducer(readyState(route), {
    type: "ACTION_BEGIN",
    kind: "start",
    side: "without",
    generation: 1,
  });
  state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
  state = case3Reducer(state, {
    type: "START_COMPLETE",
    side: "without",
    snapshot: snap("without", count, 0, 25),
    throughput: thrpFromSnapshot(snap("without", count, 0, 25)),
  });
  return case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
}

function withRunning(count: number, extraPoints = 0, cost: number | null = 12.5) {
  let state = case3Reducer(withoutClosed(), {
    type: "ACTION_BEGIN",
    kind: "start",
    side: "with",
    generation: 2,
  });
  state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
  const snapshot = snap("with", count, extraPoints, cost);
  state = case3Reducer(state, {
    type: "LIVE_SNAPSHOT",
    side: "with",
    snapshot,
  });
  return case3Reducer(state, {
    type: "LIVE_THROUGHPUT",
    side: "with",
    snapshot: thrpFromSnapshot(snapshot),
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

describe("Case3V2Page with flow", () => {
  it("With Start 清空单地图和矩阵，保留 Without 底栏和预置路线", () => {
    const started = case3Reducer(withoutClosed(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    const { view } = renderPage(started);
    expect(view.container.querySelector("[data-testid='case3-v2-page']")?.getAttribute("data-state")).toBe(
      "with-running",
    );
    expect(view.container.querySelector("[data-map-cleared]")?.getAttribute("data-map-cleared")).toBe(
      "1",
    );
    expect(view.container.querySelector("[data-map-side]")?.getAttribute("data-map-side")).toBe(
      "without",
    );
    expect(view.container.querySelector("[data-map-source-side]")?.getAttribute("data-map-source-side")).toBe(
      "with",
    );
    expect(view.container.querySelectorAll(".case3v2-pin")).toHaveLength(5);
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(0);
    expect(view.container.querySelector("[data-ue]")).toBeNull();
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-beam-crosshair]")).toBeNull();
    expect(view.container.querySelector("[data-legend-scan]")?.textContent).toBe("扫描波");
    expect(view.container.querySelector("[data-legend-best]")?.textContent).toBe("最优波");
    expect(view.container.querySelector("[data-legend-pred]")).toBeNull();
    const wo = [...view.container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(wo.slice(0, 3)).toEqual(["10", "20", "30"]);
    expect(view.container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe("--");
    expect(view.getByTitle("启动有 DT")).toHaveProperty("disabled", true);
    expect(view.getByTitle("启动无 DT")).toHaveProperty("disabled", true);
    expect(view.container.querySelector('[data-status="with"]')?.textContent).toContain(
      "测试中",
    );
  });

  it("实时点亮本轮 With；P1 成功、P2 失败；Cost/Throughput 增长；BA 随可比对点更新", () => {
    const { view } = renderPage(withRunning(1, 0, 12.5));
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(1);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P1");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("10");
    expect(view.container.querySelector("[data-beam-badge]")?.textContent).toBe("预测成功");
    expect(view.container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone")).toBe(
      "success",
    );
    expect(view.container.querySelector('[data-rc="0,10"]')?.getAttribute("data-beam-role")).toBe(
      "pred",
    );
    expect(view.container.querySelectorAll(".is-scan")).toHaveLength(0);
    expect(view.container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(view.container.querySelector("[data-cost-w]")?.textContent).toBe("12.5");
    expect(view.container.querySelector("[data-cost-delta]")?.textContent).toBe("--");
    expect(view.container.querySelectorAll("[data-thr-dot-w]")).toHaveLength(1);
    expect(view.container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(3);
    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("223");
    expect(view.container.querySelector("[data-ba-pct]")?.textContent).toBe("94.5");
    view.unmount();

    const next = renderPage(withRunning(2, 0, 12.5));
    expect(next.view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(2);
    expect(next.view.container.querySelector("[data-point-value]")?.textContent).toBe("P2");
    expect(next.view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("21");
    expect(next.view.container.querySelector("[data-beam-badge]")?.textContent).toBe(
      "预测失败",
    );
    expect(
      next.view.container.querySelector("[data-beam-crosshair]")?.getAttribute("data-tone"),
    ).toBe("fail");
    expect(
      next.view.container.querySelector("[data-beam-crosshair]")?.getAttribute("data-beam-id"),
    ).toBe("21");
    expect(next.view.container.querySelector('[data-rc="1,5"]')?.classList.contains("is-pred")).toBe(
      true,
    );
    expect(next.view.container.querySelector('[data-rc="1,4"]')?.classList.contains("is-best")).toBe(
      true,
    );
    const replayW = [...next.view.container.querySelectorAll("[data-replay-w-value]")].map(
      (el) => el.textContent,
    );
    expect(replayW.slice(0, 2)).toEqual(["10", "21"]);
    expect(
      next.view.container.querySelectorAll("[data-replay-w-tone]")[1]?.getAttribute(
        "data-replay-w-tone",
      ),
    ).toBe("fail");
    expect(next.view.container.querySelectorAll("[data-thr-dot-w]")).toHaveLength(2);
    expect(next.view.container.querySelector("[data-ba-ok]")?.textContent).toBe("223");
  });

  it("缺同 no peer 时矩阵无徽标无准星，回溯 idle", () => {
    let state = case3Reducer(withoutClosed(1), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "with",
      snapshot: {
        side: "with",
        points: [pointOf("with", 4, 40)],
        completeCount: 1,
        pendingTail: false,
        costPct: 12.5,
      },
    });
    const { view } = renderPage(state);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P4");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("40");
    expect(view.container.querySelector("[data-beam-badge]")).toBeNull();
    expect(view.container.querySelector("[data-beam-crosshair]")).toBeNull();
    expect(view.container.textContent).not.toContain("待比对");
  });

  it("完成后 delta/BA 同拍，roundClosing 锁按钮，关闭后解锁 Reset", () => {
    let state = withRunning(3, 0, 12.5);
    state = case3Reducer(state, {
      type: "START_COMPLETE",
      side: "with",
      snapshot: snap("with", 3, 0, 12.5),
      throughput: thrpFromSnapshot(snap("with", 3, 0, 12.5)),
    });
    const closing = renderPage(state);
    expect(
      closing.view.container
        .querySelector("[data-testid='case3-v2-page']")
        ?.getAttribute("data-state"),
    ).toBe("with-completed");
    expect(closing.view.container.querySelector("[data-point-value]")?.textContent).toBe("P3");
    expect(closing.view.container.querySelector("[data-beam-badge]")?.textContent).toBe(
      "预测成功",
    );
    expect(closing.view.container.querySelector("[data-cost-delta]")?.textContent).toBe("-50.0");
    expect(closing.view.container.querySelector("[data-cost-delta-label]")?.textContent).toBe(
      "开销减少",
    );
    expect(closing.view.container.querySelector("[data-ba-ok]")?.textContent).toBe("224");
    expect(closing.view.container.querySelector("[data-ba-bad]")?.textContent).toBe("14");
    expect(closing.view.container.querySelector("[data-ba-pct]")?.textContent).toBe("94.1");
    expect(closing.ctrl.busy).toBe(true);
    expect(closing.view.getByTitle("启动有 DT")).toHaveProperty("disabled", true);
    expect(closing.view.getByTitle("重置有 DT")).toHaveProperty("disabled", true);
    expect(closing.view.getByTitle("重置无 DT")).toHaveProperty("disabled", true);
    closing.view.unmount();

    const closed = renderPage(case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" }));
    expect(closed.ctrl.busy).toBe(false);
    expect(closed.view.getByTitle("重置有 DT")).toHaveProperty("disabled", false);
    expect(closed.view.getByTitle("重置无 DT")).toHaveProperty("disabled", false);
    expect(closed.view.getByTitle("启动有 DT")).toHaveProperty("disabled", true);
    expect(closed.view.container.querySelector("[data-cost-delta]")?.textContent).toBe("-50.0");
    expect(closed.view.container.querySelector("[data-ba-ok]")?.textContent).toBe("224");
  });

  it("With 前窗显示 P1..P20，矩阵仍跟最新 With 点", () => {
    const route = Array.from({ length: 22 }, (_, i) => ({
      no: i + 1,
      x: i + 1,
      y: 2,
      z: 0,
    }));
    let state = withoutClosed(22, route);
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "with",
      snapshot: snap("with", 2, 0, 12.5),
    });
    const { view } = renderPage(state);
    const headers = [...view.container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")];
    expect(headers.map((el) => el.textContent).slice(0, 20)).toEqual(
      Array.from({ length: 20 }, (_, i) => `P${i + 1}`),
    );
    expect(headers.filter((el) => el.classList.contains("is-done"))).toHaveLength(2);
    expect(view.container.querySelector("[data-replay-done]")?.getAttribute("data-replay-done")).toBe(
      "2",
    );
    const wo = [...view.container.querySelectorAll("[data-replay-wo-value]")].map(
      (el) => el.textContent,
    );
    expect(wo.slice(0, 2)).toEqual(["10", "20"]);
    const w = [...view.container.querySelectorAll("[data-replay-w-value]")].map(
      (el) => el.textContent,
    );
    expect(w.slice(0, 3)).toEqual(["10", "21", "--"]);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P2");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("21");
  });

  it("With>20 时回溯窗口跟随最新 20 点，矩阵跟最后点", () => {
    const route = Array.from({ length: 31 }, (_, i) => ({
      no: i + 1,
      x: i + 1,
      y: 2,
      z: 0,
    }));
    let state = withoutClosed(31, route);
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "with",
      snapshot: snap("with", 22, 0, 12.5),
    });
    const { view } = renderPage(state);
    const headers = [...view.container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headers[0]).toBe("P3");
    expect(headers[19]).toBe("P22");
    expect(view.container.querySelector("[data-replay-done]")?.getAttribute("data-replay-done")).toBe(
      "20",
    );
    expect(view.container.querySelector("[data-replay-wo-value]")?.textContent).toBe("30");
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P22");
    expect(view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("220");
  });
});
