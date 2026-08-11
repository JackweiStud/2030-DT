/**
 * Case3 控制器完成与截图生命周期测试。
 * 覆盖 Base64 复用、completed 渲染门槛和最终 init 写回。
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { toPng } from "html-to-image";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Case3ApiError,
  type Case3Api,
} from "../../src/cases/case3/api/case3Api";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import {
  useCase3Controller,
  type MapRendererHandle,
} from "../../src/cases/case3/hooks/useCase3Controller";
import type {
  ControlSnapshot,
  SideSnapshot,
} from "../../src/cases/case3/types";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

const config: Case3RuntimeConfig = {
  pollMs: 1,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
};

function control(
  partial: Partial<ControlSnapshot> = {},
): ControlSnapshot {
  return {
    case: "case3",
    command: "init",
    dt_type: "",
    status: "",
    save_picture_flag: 0,
    ...partial,
  };
}

function finalWithout(): SideSnapshot {
  return {
    side: "without",
    points: [
      {
        no: 1,
        ue: { x: 1, y: 2, z: 0 },
        selectedBeamId: 1,
        throughputGbps: 8.5,
        scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
      },
    ],
    completeCount: 1,
    pendingTail: false,
    costPct: 25,
  };
}

function mapRefs(): {
  without: React.RefObject<MapRendererHandle | null>;
  with: React.RefObject<MapRendererHandle | null>;
} {
  const handle: MapRendererHandle = {
    resetView: vi.fn(),
    prepareCapture: vi.fn(async () => undefined),
  };
  return {
    without: { current: handle },
    with: { current: handle },
  };
}

afterEach(() => {
  vi.mocked(toPng).mockReset();
  vi.unstubAllGlobals();
});

describe("useCase3Controller lifecycle", () => {
  it("截图上传网络失败时复用同一 Base64，不重新生成", async () => {
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,SAME_FRAME");
    let controlReads = 0;
    const postScreenshot = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("adapter offline"))
      .mockResolvedValue({ path: "out/case3/case3-000.png", seq: 0 });
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        controlReads += 1;
        if (controlReads === 1) return control();
        if (controlReads === 2) {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "execute success",
            save_picture_flag: 1,
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "case complete",
          save_picture_flag: 0,
        });
      }),
      postControl: vi.fn(async (payload) =>
        "command" in payload
          ? control({
              command: payload.command,
              dt_type:
                "dt_type" in payload ? payload.dt_type : "",
            })
          : control(),
      ),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      postScreenshot,
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: mapRefs(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());

    await waitFor(() => expect(postScreenshot).toHaveBeenCalledTimes(2));
    expect(postScreenshot.mock.calls[0]?.[0]).toBe("SAME_FRAME");
    expect(postScreenshot.mock.calls[1]?.[0]).toBe("SAME_FRAME");
    expect(toPng).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    hook.unmount();
  });

  it("completed 已提交渲染机会后才 POST init", async () => {
    let nextFrame: FrameRequestCallback | null = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        nextFrame = callback;
        return 1;
      }),
    );
    let controlReads = 0;
    let initPosts = 0;
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
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "init") initPosts += 1;
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    expect(initPosts).toBe(1);
    expect(nextFrame).not.toBeNull();

    act(() => {
      nextFrame?.(0);
    });
    await waitFor(() => expect(initPosts).toBe(2));
    hook.unmount();
  });

  it("截图连续三次失败后清 flag，但保留完成结果", async () => {
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,DROP_FRAME");
    let controlReads = 0;
    let clearFlagPosts = 0;
    const postScreenshot = vi.fn(async () => {
      throw new Case3ApiError("SCREENSHOT_WRITE_FAILED", "disk error", 500);
    });
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        controlReads += 1;
        if (controlReads === 1) return control();
        if (controlReads === 2) {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "execute success",
            save_picture_flag: 1,
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "case complete",
          save_picture_flag: 1,
        });
      }),
      postControl: vi.fn(async (payload) => {
        if ("save_picture_flag" in payload) clearFlagPosts += 1;
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      postScreenshot,
    };

    const droppedLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: mapRefs(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());

    await waitFor(() => expect(postScreenshot).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(clearFlagPosts).toBe(1));
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    expect(droppedLog).toHaveBeenCalledWith(
      "[case3] SCREENSHOT_DROPPED_AFTER_RETRIES",
      { attempts: 3 },
    );
    hook.unmount();
    droppedLog.mockRestore();
  });
});
