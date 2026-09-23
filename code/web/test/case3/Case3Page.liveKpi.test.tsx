/**
 * Case3 页面 KPI 实时接线测试。
 * 防止 controller 已有 live 快照，但页面仍只把 complete result 传给图表。
 */

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Case3Page } from "../../src/cases/case3/Case3Page";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import {
  useCase3Controller,
  type Case3Controller,
} from "../../src/cases/case3/hooks/useCase3Controller";
import { createInitialCase3State } from "../../src/cases/case3/state/case3Reducer";
import { SiteEnvWindowContext } from "../../src/shell/siteEnvWindowContext";
import type {
  Case3Side,
  SideSnapshot,
} from "../../src/cases/case3/types";

vi.mock("../../src/cases/case3/hooks/useCase3Controller", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/cases/case3/hooks/useCase3Controller")
  >("../../src/cases/case3/hooks/useCase3Controller");
  return { ...actual, useCase3Controller: vi.fn() };
});

vi.mock("../../src/cases/case3/components/SidePanel", () => ({
  SidePanel: ({
    side,
    points,
  }: {
    side: Case3Side;
    points: Array<unknown>;
  }) => (
    <div data-testid={`side-${side}`} data-point-count={points.length} />
  ),
}));

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

function snapshot(
  side: Case3Side,
  count: number,
  costPct: number,
): SideSnapshot {
  return {
    side,
    points: Array.from({ length: count }, (_, index) => {
      const no = index + 1;
      return {
        no,
        ue: { x: no, y: no, z: 0 },
        selectedBeamId: no,
        throughputGbps: side === "without" ? 8 + no / 10 : 9 + no / 10,
        ...(side === "without"
          ? { scanBeamIds: Array.from({ length: 16 }, (_, beam) => beam) }
          : { reflection: { x: 5, y: 7, z: 0, los: true } }),
      };
    }),
    completeCount: count,
    pendingTail: false,
    costPct,
  };
}

function controller(
  state: Case3Controller["state"],
  visible: Case3Controller["visible"],
): Case3Controller {
  return {
    state,
    visible,
    busy: state.activeAction !== null,
    startWithoutEnabled: false,
    startWithEnabled: false,
    reinitWithoutEnabled: false,
    reinitWithEnabled: false,
    withoutBadge: "测试中",
    withBadge: "测试中",
    withoutBadgeError: false,
    withBadgeError: false,
    withoutRetryHint: false,
    withRetryHint: false,
    onStartWithout: vi.fn(),
    onStartWith: vi.fn(),
    onReinitWithout: vi.fn(),
    onReinitWith: vi.fn(),
  };
}

function pointCount(container: HTMLElement, selector: string): number {
  const points =
    container.querySelector<SVGPolylineElement>(selector)?.getAttribute("points") ??
    "";
  return points.trim() === "" ? 0 : points.trim().split(/\s+/).length;
}

afterEach(() => {
  vi.mocked(useCase3Controller).mockReset();
});

describe("Case3Page live KPI", () => {
  it("complete 前按 1→2 点更新 Without，并在 pairValid=false 时显示 With live 曲线", () => {
    const initial = {
      ...createInitialCase3State(),
      initStatus: "ready" as const,
      baseline: { success: 222, total: 235 },
    };
    let current = controller(
      {
        ...initial,
        live: { without: snapshot("without", 1, 25), with: null },
        liveThrp: {
          without: {
            samples: [{ no: 1, gbps: 8.1 }],
            pendingTail: false,
          },
          with: null,
        },
        activeAction: {
          kind: "start",
          side: "without",
          seenExecuteSuccess: true,
          generation: 1,
        },
      },
      "without-running",
    );
    vi.mocked(useCase3Controller).mockImplementation(() => current);

    const stageElementRef = {
      current: document.createElement("main"),
    };
    const view = render(
      <SiteEnvWindowContext.Provider
        value={{ open: vi.fn(), close: vi.fn() }}
      >
        <Case3Page config={config} stageElementRef={stageElementRef} />
      </SiteEnvWindowContext.Provider>,
    );

    expect(
      view.container.querySelector(
        ".case3-cost-gauge--without .case3-cost-value",
      )?.textContent,
    ).toBe("25.0");
    expect(pointCount(view.container, ".case3-thrp-line--wo")).toBe(1);
    expect(
      view.container.querySelectorAll('.case3-thrp-svg circle[fill="#6B7280"]'),
    ).toHaveLength(1);

    current = controller(
      {
        ...current.state,
        live: { without: snapshot("without", 2, 25), with: null },
        liveThrp: {
          without: {
            samples: [
              { no: 1, gbps: 8.1 },
              { no: 2, gbps: 8.2 },
            ],
            pendingTail: false,
          },
          with: null,
        },
      },
      "without-running",
    );
    view.rerender(
      <SiteEnvWindowContext.Provider
        value={{ open: vi.fn(), close: vi.fn() }}
      >
        <Case3Page config={config} stageElementRef={stageElementRef} />
      </SiteEnvWindowContext.Provider>,
    );
    expect(pointCount(view.container, ".case3-thrp-line--wo")).toBe(2);

    current = controller(
      {
        ...initial,
        results: {
          without: snapshot("without", 2, 25),
          with: null,
        },
        live: {
          without: null,
          with: snapshot("with", 2, 15),
        },
        liveThrp: {
          without: null,
          with: {
            samples: [
              { no: 1, gbps: 9.1 },
              { no: 2, gbps: 9.2 },
            ],
            pendingTail: false,
          },
        },
        resultThrp: {
          without: {
            samples: [
              { no: 1, gbps: 8.1 },
              { no: 2, gbps: 8.2 },
            ],
            pendingTail: false,
          },
          with: null,
        },
        pairValid: false,
        activeAction: {
          kind: "start",
          side: "with",
          seenExecuteSuccess: true,
          generation: 2,
        },
      },
      "with-running",
    );
    view.rerender(
      <SiteEnvWindowContext.Provider
        value={{ open: vi.fn(), close: vi.fn() }}
      >
        <Case3Page config={config} stageElementRef={stageElementRef} />
      </SiteEnvWindowContext.Provider>,
    );

    expect(pointCount(view.container, ".case3-thrp-line--wo")).toBe(2);
    expect(pointCount(view.container, ".case3-thrp-line--w")).toBe(2);
    expect(
      view.container.querySelectorAll('.case3-thrp-svg circle[fill="#22D3EE"]'),
    ).toHaveLength(2);
    expect(
      view.container.querySelector(
        ".case3-cost-gauge--with .case3-cost-value",
      )?.textContent,
    ).toBe("15.0");
    expect(
      view.container.querySelector(".case3-cost-delta__value")?.textContent,
    ).toBe("--");
  });

  it("双侧完成后重置 Without，With 历史地图、Cost 和吞吐仍独立显示", () => {
    const withHistory = snapshot("with", 2, 15);
    const historyState = {
      ...createInitialCase3State(),
      initStatus: "ready" as const,
      baseline: { success: 222, total: 235 },
      results: {
        without: null,
        with: withHistory,
      },
      resultThrp: {
        without: null,
        with: {
          samples: [
            { no: 1, gbps: 9.1 },
            { no: 2, gbps: 9.2 },
          ],
          pendingTail: false,
        },
      },
      pairValid: false,
    };
    let current = controller(
      {
        ...historyState,
        activeAction: {
          kind: "reinit",
          side: "without",
          seenExecuteSuccess: true,
          generation: 3,
        },
      },
      "resetting-without",
    );
    vi.mocked(useCase3Controller).mockImplementation(() => current);

    const stageElementRef = {
      current: document.createElement("main"),
    };
    const view = render(
      <SiteEnvWindowContext.Provider
        value={{ open: vi.fn(), close: vi.fn() }}
      >
        <Case3Page config={config} stageElementRef={stageElementRef} />
      </SiteEnvWindowContext.Provider>,
    );

    expect(
      view.getByTestId("side-with").getAttribute("data-point-count"),
    ).toBe("2");
    expect(
      view.container.querySelector(
        ".case3-cost-gauge--without .case3-cost-value",
      )?.textContent,
    ).toBe("--");
    expect(
      view.container.querySelector(
        ".case3-cost-gauge--with .case3-cost-value",
      )?.textContent,
    ).toBe("15.0");
    expect(
      view.container.querySelector(".case3-cost-delta__value")?.textContent,
    ).toBe("--");
    expect(pointCount(view.container, ".case3-thrp-line--wo")).toBe(0);
    expect(pointCount(view.container, ".case3-thrp-line--w")).toBe(2);

    current = controller(historyState, "with-history-only");
    view.rerender(
      <SiteEnvWindowContext.Provider
        value={{ open: vi.fn(), close: vi.fn() }}
      >
        <Case3Page config={config} stageElementRef={stageElementRef} />
      </SiteEnvWindowContext.Provider>,
    );

    expect(
      view.container.querySelector(
        ".case3-cost-gauge--with .case3-cost-value",
      )?.textContent,
    ).toBe("15.0");
    expect(pointCount(view.container, ".case3-thrp-line--w")).toBe(2);
  });
});
