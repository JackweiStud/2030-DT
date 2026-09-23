/**
 * Case3 V2 ReInit：主地图清图与底栏历史分离，地图实例不重建。
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
  case3Reducer,
  createInitialCase3State,
} from "../../src/cases/case3/state/case3Reducer";
import { selectCase3Presentation } from "../../src/cases/case3/presentation/selectCase3Presentation";
import { SiteEnvWindowContext } from "../../src/shell/siteEnvWindowContext";
import type { BaseRoutePoint, Case3Point, SideSnapshot } from "../../src/cases/case3/types";

if (typeof PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(
      type: string,
      init: MouseEventInit & {
        pointerId?: number;
        pointerType?: string;
        isPrimary?: boolean;
      } = {},
    ) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    writable: true,
    value: PointerEventPolyfill,
  });
}

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

function nRoute(n: number): BaseRoutePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    no: i + 1,
    x: i + 1,
    y: 2,
    z: 0,
  }));
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

afterEach(() => {
  vi.mocked(useCase3Controller).mockReset();
});

describe("Case3V2Page reinit map vs dock history", () => {
  it("Reset With 点击即清图且不重建地图；完成后不回填 Without", () => {
    const { view, ctrl, update } = renderPage(bothClosed());
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(3);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P3");
    expect(view.container.querySelector("[data-cost-delta]")?.textContent).toBe("-50.0");

    const interact = view.container.querySelector(".case3v2-map-interact");
    fireEvent.wheel(interact as HTMLElement, {
      deltaY: -100,
      clientX: 200,
      clientY: 200,
    });
    const layer = view.container.querySelector(".case3v2-map-transform") as HTMLDivElement;
    const zoomed = layer.style.transform;
    expect(zoomed).not.toBe("translate(0px, 0px) rotate(0deg) scale(1)");

    fireEvent.click(view.getByTitle("重置有 DT"));
    expect(ctrl.onReinitWith).toHaveBeenCalledTimes(1);
    assertMapEmpty(view.container);
    expect(view.container.querySelector("[data-map-source-side]")?.getAttribute("data-map-source-side")).toBe(
      "with",
    );
    expect(view.container.querySelector(".case3v2-map-interact")).toBe(interact);
    expect(layer.style.transform).toBe(zoomed);
    expect(view.container.querySelectorAll(".case3v2-pin")).toHaveLength(5);

    let state = case3Reducer(bothClosed(), {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "with",
      generation: 3,
    });
    update(state);
    assertMapEmpty(view.container);
    expect(view.container.querySelector(".case3v2-map-interact")).toBe(interact);
    expect(layer.style.transform).toBe(zoomed);
    expect(view.container.querySelector("[data-map-source-side]")?.getAttribute("data-map-source-side")).toBe(
      "with",
    );
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    expect(view.container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe(
      "--",
    );
    expect(view.container.querySelector("[data-cost-wo]")?.textContent).toBe("25.0");
    expect(view.container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-cost-delta]")?.textContent).toBe("--");
    expect(view.container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(3);
    expect(view.container.querySelectorAll("[data-thr-dot-w]")).toHaveLength(0);
    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");
    expect(view.container.querySelector("[data-replay-check]")).toBeNull();

    state = case3Reducer(state, { type: "REINIT_COMPLETE", side: "with" });
    state = case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
    update(state);
    assertMapEmpty(view.container);
    expect(view.container.querySelector(".case3v2-map-interact")).toBe(interact);
    expect(layer.style.transform).toBe(zoomed);
    expect(view.container.querySelector("[data-replay-progress-side]")?.getAttribute("data-replay-progress-side")).toBe(
      "without",
    );
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[2]?.textContent).toBe(
      "30",
    );
    expect(view.container.querySelectorAll("[data-replay-w-tone]")[0]?.getAttribute("data-replay-w-tone")).toBe(
      "idle",
    );
  });

  it("Reset With 后点击 Start 不回填历史，首个完整点才绘制本轮 With", () => {
    let state = bothClosed();
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "with",
      generation: 3,
    });
    state = case3Reducer(state, { type: "REINIT_COMPLETE", side: "with" });
    state = case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
    const harness = renderPage(bothClosed());
    fireEvent.click(harness.view.getByTitle("重置有 DT"));
    harness.update(state);
    assertMapEmpty(harness.view.container);
    expect(harness.view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );

    expect(harness.view.getByTitle("启动有 DT")).toHaveProperty("disabled", false);
    fireEvent.click(harness.view.getByTitle("启动有 DT"));
    expect(harness.ctrl.onStartWith).toHaveBeenCalledTimes(1);
    assertMapEmpty(harness.view.container);
    expect(harness.view.container.querySelectorAll("[data-pin-lit='1']")).toHaveLength(0);

    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "start",
      side: "with",
      generation: 4,
    });
    harness.update(state);
    assertMapEmpty(harness.view.container);
    expect(harness.view.container.querySelector("[data-map-source-side]")?.getAttribute("data-map-source-side")).toBe(
      "with",
    );

    state = case3Reducer(state, { type: "SEEN_EXECUTE_SUCCESS" });
    state = case3Reducer(state, {
      type: "LIVE_SNAPSHOT",
      side: "with",
      snapshot: snap("with", 1, 0, 12.5),
    });
    harness.update(state);
    expect(harness.view.container.querySelector("[data-map-cleared]")?.getAttribute("data-map-cleared")).toBe(
      "0",
    );
    expect(harness.view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(1);
    expect(harness.view.container.querySelector("[data-point-value]")?.textContent).toBe("P1");
    expect(harness.view.container.querySelector("[data-beam-id-value]")?.textContent).toBe("10");
    expect(harness.view.container.querySelector("[data-map-side]")?.getAttribute("data-map-side")).toBe(
      "with",
    );
    expect(harness.view.container.querySelector("[data-beam-mode]")?.getAttribute("data-beam-mode")).toBe(
      "with",
    );
    expect(harness.view.container.querySelector("[data-legend-pred]")?.textContent).toBe("预测波");
    expect(harness.view.container.querySelector("[data-legend-scan]")).toBeNull();
  });

  it("Reset Without 主地图保持空，底栏保留 With 历史为中性态，单侧 KPI", () => {
    const route = nRoute(31);
    let state = bothClosed(31, route);
    const { view, update } = renderPage(state);
    expect(view.container.querySelector("[data-replay-headers] .case3v2-replay-col")?.textContent).toBe(
      "P12",
    );
    expect(view.container.querySelector("[data-cost-delta]")?.textContent).not.toBe("--");

    fireEvent.click(view.getByTitle("重置无 DT"));
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "without",
      generation: 3,
    });
    update(state);
    assertMapEmpty(view.container);
    expect(view.container.querySelector("[data-replay-progress-side]")?.getAttribute("data-replay-progress-side")).toBe(
      "with",
    );
    const headers = [...view.container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headers[0]).toBe("P12");
    expect(headers[19]).toBe("P31");
    expect(view.container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe(
      "120",
    );
    expect(view.container.querySelectorAll("[data-replay-w-tone]")[0]?.getAttribute("data-replay-w-tone")).toBe(
      "idle",
    );
    expect(view.container.querySelector("[data-replay-check]")).toBeNull();
    expect(view.container.querySelector("[data-cost-wo]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-cost-w]")?.textContent).toBe("12.5");
    expect(view.container.querySelector("[data-cost-delta]")?.textContent).toBe("--");
    expect(view.container.querySelectorAll("[data-thr-dot-wo]")).toHaveLength(0);
    expect(view.container.querySelectorAll("[data-thr-dot-w]")).toHaveLength(31);
    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");

    state = case3Reducer(state, { type: "REINIT_COMPLETE", side: "without" });
    state = case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
    update(state);
    assertMapEmpty(view.container);
    const headersAfter = [...view.container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headersAfter[0]).toBe("P12");
    expect(headersAfter[19]).toBe("P31");
    expect(view.container.querySelector("[data-replay-check]")).toBeNull();
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P--");
  });

  it("Reset With 对称保留 Without 最新 20 槽，列头点击不改当前点", () => {
    const route = nRoute(31);
    let state = bothClosed(31, route);
    const { view, update } = renderPage(state);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P31");
    const surface = view.container.querySelector("[data-replay-surface]") as HTMLElement;
    Object.defineProperty(surface, "offsetWidth", { configurable: true, value: 1702 });
    surface.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 1702,
        height: 140,
        right: 1702,
        bottom: 140,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.pointerDown(surface, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 800,
      clientY: 20,
    });
    fireEvent.pointerMove(surface, {
      pointerId: 1,
      buttons: 1,
      clientX: 800 + 85 * 11,
      clientY: 20,
    });
    fireEvent.pointerUp(surface, {
      pointerId: 1,
      button: 0,
      clientX: 800 + 85 * 11,
      clientY: 20,
    });
    expect(view.container.querySelector("[data-replay-headers] .case3v2-replay-col")?.textContent).toBe(
      "P1",
    );
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P31");
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(31);

    fireEvent.click(view.getByTitle("重置有 DT"));
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "with",
      generation: 3,
    });
    state = case3Reducer(state, { type: "REINIT_COMPLETE", side: "with" });
    state = case3Reducer(state, { type: "ROUND_CLOSE_COMPLETE" });
    update(state);
    assertMapEmpty(view.container);
    const headers = [...view.container.querySelectorAll("[data-replay-headers] .case3v2-replay-col")].map(
      (el) => el.textContent,
    );
    expect(headers[0]).toBe("P12");
    expect(headers[19]).toBe("P31");
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "120",
    );
    expect(view.container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe(
      "--",
    );
    expect(view.container.querySelector("[data-replay-check]")).toBeNull();

    fireEvent.click(view.container.querySelector("[data-replay-headers] .case3v2-replay-col") as HTMLElement);
    expect(view.container.querySelector("[data-point-value]")?.textContent).toBe("P--");
    expect(view.container.querySelectorAll('[data-pin-lit="1"]')).toHaveLength(0);
  });

  it("ReInit execute fail 不恢复目标侧旧结果，主地图保持空", () => {
    let state = bothClosed();
    const { view, update } = renderPage(state);
    fireEvent.click(view.getByTitle("重置有 DT"));
    state = case3Reducer(state, {
      type: "ACTION_BEGIN",
      kind: "reinit",
      side: "with",
      generation: 3,
    });
    state = case3Reducer(state, { type: "EXECUTE_FAIL" });
    update(state);
    assertMapEmpty(view.container);
    expect(view.container.querySelectorAll("[data-replay-w-value]")[0]?.textContent).toBe(
      "--",
    );
    expect(view.container.querySelectorAll("[data-replay-wo-value]")[0]?.textContent).toBe(
      "10",
    );
    expect(view.container.querySelector("[data-cost-w]")?.textContent).toBe("--");
    expect(view.container.querySelector("[data-ba-ok]")?.textContent).toBe("222");
  });
});
