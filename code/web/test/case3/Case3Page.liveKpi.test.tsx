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
  SidePanel: ({ side }: { side: Case3Side }) => (
    <div data-testid={`side-${side}`} />
  ),
}));

const config: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
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
    badgeError: false,
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
});
