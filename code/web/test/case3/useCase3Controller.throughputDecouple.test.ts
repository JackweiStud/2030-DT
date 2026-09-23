/**
 * Issue #6 评审：/side 与 /throughput 独立轮询与终态封存。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Case3ApiError,
  type Case3Api,
} from "../../src/cases/case3/api/case3Api";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import { useCase3Controller } from "../../src/cases/case3/hooks/useCase3Controller";
import type { ControlSnapshot, SideSnapshot } from "../../src/cases/case3/types";

const config: Case3RuntimeConfig = {
  pollMs: 1,
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

function control(partial: Partial<ControlSnapshot> = {}): ControlSnapshot {
  return {
    case: "case3",
    command: "init",
    dt_type: "",
    status: "",
    save_picture_flag: 0,
    ...partial,
  };
}

function liveWithout(): SideSnapshot {
  return {
    side: "without",
    points: [
      {
        no: 1,
        ue: { x: 1, y: 2, z: 0 },
        selectedBeamId: 1,
        throughputGbps: 99,
        scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
      },
    ],
    completeCount: 1,
    pendingTail: false,
    costPct: 25,
  };
}

function finalWithout(): SideSnapshot {
  return liveWithout();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCase3Controller throughput decouple", () => {
  it("side 失败时仍更新 liveThrp", async () => {
    let startPosted = false;
    const api: Case3Api = {
      getControl: vi.fn(async () =>
        startPosted
          ? control({
              command: "start",
              dt_type: "without dt",
              status: "execute success",
            })
          : control(),
      ),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          startPosted = true;
          return control({ command: "start", dt_type: "without dt" });
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => {
        throw new Case3ApiError("SIDE_DATA_INVALID", "side unavailable", 422);
      }),
      getThroughput: vi.fn(async () => ({
        samples: [
          { no: 1, gbps: 8.5 },
          { no: 2, gbps: 8.6 },
        ],
        pendingTail: false,
      })),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: {
          without: { current: null },
          with: { current: null },
        },
        api,
      }),
    );

    await waitFor(() =>
      expect(hook.result.current.startWithoutEnabled).toBe(true),
    );
    act(() => hook.result.current.onStartWithout());

    await waitFor(() =>
      expect(hook.result.current.state.liveThrp.without?.samples).toHaveLength(
        2,
      ),
    );
    expect(hook.result.current.state.live.without).toBeNull();
    expect(api.getThroughput).toHaveBeenCalled();
    expect(api.getSide).toHaveBeenCalled();
  });

  it("case complete 并行拉取 final throughput 并封存，不用 points 回填", async () => {
    let controlReads = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        controlReads += 1;
        if (controlReads === 1) return control();
        if (controlReads === 2) {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "execute success",
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "case complete",
        });
      }),
      postControl: vi.fn(async () =>
        control({ command: "start", dt_type: "without dt" }),
      ),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      getThroughput: vi.fn(async () => ({
        samples: [{ no: 1, gbps: 7.7 }],
        pendingTail: false,
      })),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: {
          without: { current: null },
          with: { current: null },
        },
        api,
      }),
    );

    await waitFor(() =>
      expect(hook.result.current.startWithoutEnabled).toBe(true),
    );
    act(() => hook.result.current.onStartWithout());

    await waitFor(() =>
      expect(hook.result.current.state.results.without).not.toBeNull(),
    );
    expect(api.getThroughput).toHaveBeenCalled();
    expect(hook.result.current.state.resultThrp.without).toEqual({
      samples: [{ no: 1, gbps: 7.7 }],
      pendingTail: false,
    });
    expect(
      hook.result.current.state.resultThrp.without?.samples[0]?.gbps,
    ).not.toBe(99);
  });
});
