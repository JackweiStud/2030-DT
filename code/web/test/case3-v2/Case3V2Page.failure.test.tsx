/**
 * Case3 V2 失败 / 连接异常 / 清图：错误样式、四动作清图、失败不回闪。
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Case3V2Page } from "../../src/cases/case3-v2/Case3V2Page";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import {
  useCase3Controller,
  type Case3Controller,
} from "../../src/cases/case3/hooks/useCase3Controller";
import {
  CASE3_ADAPTER_ERROR_BADGE,
  CASE3_ADAPTER_RETRY_HINT,
  case3Reducer,
  createInitialCase3State,
} from "../../src/cases/case3/state/case3Reducer";
import { selectCase3Presentation } from "../../src/cases/case3/presentation/selectCase3Presentation";
import { SiteEnvWindowContext } from "../../src/shell/siteEnvWindowContext";
import type { BaseRoutePoint, Case3Point, SideSnapshot } from "../../src/cases/case3/types";

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

function pointOf(side: "without" | "with", no: number, beam: number): Case3Point {
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

function thrpFromSnapshot(snapshot: SideSnapshot) {
  return {
    samples: snapshot.points
      .slice(0, snapshot.completeCount)
      .map((p) => ({ no: p.no, gbps: p.throughputGbps })),
    pendingTail: snapshot.pendingTail,
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
  const withoutSnap = snap("without", count, 0, 25);
  state = case3Reducer(state, {
    type: "START_COMPLETE",
    side: "without",
    snapshot: withoutSnap,
    throughput: thrpFromSnapshot(withoutSnap),
  });
  return case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
}

function bothClosed(count = 3, route: BaseRoutePoint[] = L_ROUTE) {
  let state = case3Reducer(withoutClosed(count, route), {
    type: "ACTION_BEGIN",
    kind: "start",
    side: "with",
    generation: 2,
  });
  state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
  const withSnap = snap("with", count, 0, 12.5);
  state = case3Reducer(state, {
    type: "START_COMPLETE",
    side: "with",
    snapshot: withSnap,
    throughput: thrpFromSnapshot(withSnap),
  });
  return case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
}

function withRunning(count: number) {
  let state = case3Reducer(withoutClosed(), {
    type: "ACTION_BEGIN",
    kind: "start",
    side: "with",
    generation: 2,
  });
  state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
  return case3Reducer(state, {
    type: "LIVE_SNAPSHOT",
    side: "with",
    snapshot: snap("with", count, 0, 12.5),
  });
}

function renderPage(state: Case3Controller["state"]) {
  let ctrl = controllerFromState(state);
  vi.mocked(useCase3Controller).mockImplementation(() => ctrl);
  const view = render(
    <SiteEnvWindowContext.Provider value={{ open: vi.fn(), close: vi.fn() }}>
      <Case3V2Page
        config={config}
        stageElementRef={{ current: document.createElement("main") }}
      />
    </SiteEnvWindowContext.Provider>,
  );
  function update(next: Case3Controller["state"]) {
    ctrl = controllerFromState(next);
    vi.mocked(useCase3Controller).mockImplementation(() => ctrl);
    view.rerender(
      <SiteEnvWindowContext.Provider value={{ open: vi.fn(), close: vi.fn() }}>
        <Case3V2Page
          config={config}
          stageElementRef={{ current: document.createElement("main") }}
        />
      </SiteEnvWindowContext.Provider>,
    );
    return ctrl;
  }
  return { view, get ctrl() { return ctrl; }, update };
}

function assertInitialBeamShell(container: HTMLElement) {
  expect(container.querySelector("[data-map-side]")?.getAttribute("data-map-side")).toBe(
    "without",
  );
  expect(container.querySelector("[data-beam-mode]")?.getAttribute("data-beam-mode")).toBe(
    "without",
  );
  expect(container.querySelector("[data-legend-scan]")?.textContent).toBe("扫描波");
  expect(container.querySelector("[data-legend-best]")?.textContent).toBe("最优波");
  expect(container.querySelector("[data-legend-pred]")).toBeNull();
  expect(container.querySelector("[data-point-value]")?.textContent).toBe("P--");
  expect(container.querySelector("[data-beam-id-value]")?.textContent).toBe("--");
}

function assertMapEmpty(container: HTMLElement) {
  expect(container.querySelector("[data-map-cleared]")?.getAttribute("data-map-cleared")).toBe(
    "1",
  );
  expect(container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(0);
  expect(container.querySelector("[data-ue]")).toBeNull();
  expect(container.querySelector("[data-beam-crosshair]")).toBeNull();
  assertInitialBeamShell(container);
}

function statusOf(container: HTMLElement, side: "without" | "with") {
  return container.querySelector(`[data-status="${side}"]`);
}

afterEach(() => {
  vi.mocked(useCase3Controller).mockReset();
});

describe("Case3V2Page failure map hold and status", () => {
  it("四个动作点击都立即清主地图和矩阵", () => {
    const startWo = renderPage(readyState());
    fireEvent.click(startWo.view.getByTitle("启动无 DT"));
    expect(startWo.ctrl.onStartWithout).toHaveBeenCalledTimes(1);
    assertMapEmpty(startWo.view.container);
    startWo.view.unmount();

    const startW = renderPage(withoutClosed());
    expect(startW.view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(3);
    fireEvent.click(startW.view.getByTitle("启动有 DT"));
    expect(startW.ctrl.onStartWith).toHaveBeenCalledTimes(1);
    assertMapEmpty(startW.view.container);
    expect(startW.view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    startW.view.unmount();

    const reinitW = renderPage(bothClosed());
    fireEvent.click(reinitW.view.getByTitle("重置有 DT"));
    expect(reinitW.ctrl.onReinitWith).toHaveBeenCalledTimes(1);
    assertMapEmpty(reinitW.view.container);
    reinitW.view.unmount();

    const reinitWo = renderPage(bothClosed());
    fireEvent.click(reinitWo.view.getByTitle("重置无 DT"));
    expect(reinitWo.ctrl.onReinitWithout).toHaveBeenCalledTimes(1);
    assertMapEmpty(reinitWo.view.container);
  });

  it("Start execute fail 保持 Initial，底栏另一侧历史仍在，只开放同侧 Start", () => {
    const { view, update } = renderPage(withoutClosed());
    fireEvent.click(view.getByTitle("启动有 DT"));
    let state = case3Reducer(withoutClosed(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    update(state);
    assertMapEmpty(view.container);
    expect(statusOf(view.container, "with")?.textContent).toContain("执行失败");
    expect(statusOf(view.container, "with")?.classList.contains("is-error")).toBe(true);
    expect(statusOf(view.container, "without")?.textContent).toContain("已结束");
    expect(statusOf(view.container, "without")?.classList.contains("is-error")).toBe(false);
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    expect(view.container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe(
      "--",
    );
    expect(view.container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(view.getByTitle("启动有 DT")).toHaveProperty("disabled", false);
    expect(view.getByTitle("启动无 DT")).toHaveProperty("disabled", true);
    expect(view.getByTitle("重置有 DT")).toHaveProperty("disabled", true);
  });

  it("ReInit execute fail 显示红色重置失败，主地图保持空，只开放同侧 ReInit", () => {
    const { view, update } = renderPage(bothClosed());
    fireEvent.click(view.getByTitle("重置有 DT"));
    let state = case3Reducer(bothClosed(), {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "with",
      generation: 3,
    });
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    update(state);
    assertMapEmpty(view.container);
    expect(statusOf(view.container, "with")?.textContent).toContain("重置失败");
    expect(statusOf(view.container, "with")?.classList.contains("is-error")).toBe(true);
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    expect(view.getByTitle("重置有 DT")).toHaveProperty("disabled", false);
    expect(view.getByTitle("启动有 DT")).toHaveProperty("disabled", true);
  });

  it("POST 失败显示连接异常，不伪装成 execute fail，地图不回闪", () => {
    const { view, update } = renderPage(withoutClosed());
    fireEvent.click(view.getByTitle("启动有 DT"));
    let state = case3Reducer(withoutClosed(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "ACTION_POST_FAILED" });
    update(state);
    assertMapEmpty(view.container);
    expect(statusOf(view.container, "with")?.textContent).toContain(CASE3_ADAPTER_ERROR_BADGE);
    expect(statusOf(view.container, "without")?.textContent).toContain(
      CASE3_ADAPTER_ERROR_BADGE,
    );
    expect(statusOf(view.container, "with")?.classList.contains("is-error")).toBe(true);
    expect(view.container.textContent).not.toContain("执行失败");
    expect(view.container.textContent).not.toContain("重置失败");
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
  });

  it("结果不完整保持 Initial，失败侧红色回退文案，另一侧历史保留", () => {
    const { view, update } = renderPage(withoutClosed());
    fireEvent.click(view.getByTitle("启动有 DT"));
    let state = case3Reducer(withoutClosed(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, {
      type: "EXECUTE_FAIL",
      reason: "result-incomplete",
    });
    update(state);
    assertMapEmpty(view.container);
    expect(statusOf(view.container, "with")?.textContent).toContain(
      "结果不完整已自动回退",
    );
    expect(statusOf(view.container, "with")?.classList.contains("is-error")).toBe(true);
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    expect(view.getByTitle("启动有 DT")).toHaveProperty("disabled", false);
  });

  it("CONTROL_BUSY 保持 Initial，不显示连接异常，不新增 busy UI", () => {
    const { view, update } = renderPage(withoutClosed());
    fireEvent.click(view.getByTitle("启动有 DT"));
    let state = case3Reducer(withoutClosed(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "CLEAR_ACTIVE" });
    update(state);
    assertMapEmpty(view.container);
    expect(view.container.textContent).not.toContain(CASE3_ADAPTER_ERROR_BADGE);
    expect(view.container.textContent).not.toContain("执行失败");
    expect(statusOf(view.container, "without")?.textContent).toContain("已结束");
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    expect(view.container.querySelector("[data-status-retry-text]")).toBeNull();
  });

  it("同侧重试开始新轮，首个完整点到达后才恢复地图和矩阵", () => {
    let state = case3Reducer(withoutClosed(), {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 2,
    });
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    const { view, update } = renderPage(state);
    assertMapEmpty(view.container);

    fireEvent.click(view.getByTitle("启动有 DT"));
    assertMapEmpty(view.container);
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 3,
    });
    update(state);
    assertMapEmpty(view.container);
    expect(view.container.querySelector("[data-map-source-side]")?.getAttribute("data-map-source-side")).toBe(
      "with",
    );

    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "with",
      snapshot: snap("with", 1, 0, 12.5),
    });
    update(state);
    expect(view.container.querySelector("[data-map-cleared]")?.getAttribute("data-map-cleared")).toBe(
      "0",
    );
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(1);
    expect(view.container.querySelector("[data-map-side]")?.getAttribute("data-map-side")).toBe(
      "with",
    );
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P1");
  });

  it("首点后的短暂轮询异常保留当前绘制，主状态仍为测试中并出现重试中", () => {
    let state = withRunning(2);
    const { view, update } = renderPage(state);
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(2);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P2");

    state = case3Reducer(state, { type: "ADAPTER_ERROR", value: true });
    update(state);
    expect(view.container.querySelector("[data-map-cleared]")?.getAttribute("data-map-cleared")).toBe(
      "0",
    );
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(2);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P2");
    expect(statusOf(view.container, "with")?.textContent).toContain("测试中");
    expect(statusOf(view.container, "with")?.textContent).toContain(CASE3_ADAPTER_RETRY_HINT);
    expect(statusOf(view.container, "with")?.classList.contains("is-running")).toBe(true);
    expect(statusOf(view.container, "with")?.classList.contains("is-error")).toBe(false);
    expect(view.container.querySelector("[data-status-ellipsis]")).not.toBeNull();
  });

  it("已出首点后 execute fail 清回 Initial，不回闪另一侧历史地图", () => {
    let state = withRunning(2);
    const { view, update } = renderPage(state);
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(2);

    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    update(state);
    assertMapEmpty(view.container);
    expect(statusOf(view.container, "with")?.textContent).toContain("执行失败");
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
  });
});
