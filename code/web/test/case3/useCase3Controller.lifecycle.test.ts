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
  return liveWithout(1);
}

function liveWithout(count: number): SideSnapshot {
  return {
    side: "without",
    points: Array.from({ length: count }, (_, index) => ({
      no: index + 1,
      ue: { x: index + 1, y: index + 2, z: 0 },
      selectedBeamId: index + 1,
      throughputGbps: 8.5 + index / 10,
      scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
    })),
    completeCount: count,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.mocked(toPng).mockReset();
  vi.unstubAllGlobals();
});

describe("useCase3Controller lifecycle", () => {
  it("case complete 前按 1→2 点替换 live snapshot，不提前写 result", async () => {
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const secondSnapshot = deferred<SideSnapshot>();
    let startPosted = false;
    let sideReads = 0;
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
          return control({
            command: "start",
            dt_type: "without dt",
          });
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => {
        sideReads += 1;
        return sideReads === 1 ? liveWithout(1) : secondSnapshot.promise;
      }),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: mapRefs(),
        api,
      }),
    );
    await waitFor(() =>
      expect(hook.result.current.startWithoutEnabled).toBe(true),
    );

    act(() => hook.result.current.onStartWithout());
    await waitFor(() =>
      expect(hook.result.current.state.live.without?.points).toHaveLength(1),
    );
    expect(hook.result.current.state.results.without).toBeNull();

    await act(async () => {
      secondSnapshot.resolve(liveWithout(2));
      await secondSnapshot.promise;
    });
    await waitFor(() =>
      expect(hook.result.current.state.live.without?.points).toHaveLength(2),
    );
    expect(hook.result.current.state.results.without).toBeNull();
    expect(hook.result.current.visible).toBe("without-running");
    expect(infoLog).toHaveBeenCalledWith(
      "[case3] side.live_progress",
      expect.objectContaining({
        roundGeneration: 1,
        side: "without",
        completeCount: 1,
        lastPointNo: 1,
      }),
    );
    expect(infoLog).toHaveBeenCalledWith(
      "[case3] side.live_progress",
      expect.objectContaining({
        roundGeneration: 1,
        side: "without",
        completeCount: 2,
        lastPointNo: 2,
      }),
    );
    expect(infoLog).not.toHaveBeenCalledWith(
      "[case3] side.live_progress",
      expect.objectContaining({ completeCount: 0 }),
    );
    hook.unmount();
    infoLog.mockRestore();
  });

  it("重复控制快照不重复输出 status 边沿日志", async () => {
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    let startPosted = false;
    let sideReads = 0;
    const secondSideRead = deferred<SideSnapshot>();
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
          return control({
            command: "start",
            dt_type: "without dt",
            status: "",
          });
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => {
        sideReads += 1;
        return sideReads === 1 ? liveWithout(1) : secondSideRead.promise;
      }),
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
    await waitFor(() => expect(api.getSide).toHaveBeenCalledTimes(2));

    const statusEdges = infoLog.mock.calls.filter(
      ([event]) => event === "[case3] poll.status_edge",
    );
    expect(statusEdges).toHaveLength(1);
    expect(statusEdges[0]?.[1]).toEqual(
      expect.objectContaining({
        side: "without",
        from: "",
        to: "execute success",
      }),
    );

    hook.unmount();
    infoLog.mockRestore();
  });

  it("截图成功日志包含侧别、轮次、路径、序号和耗时", async () => {
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    vi.mocked(toPng).mockResolvedValue(
      "data:image/png;base64,OBSERVABLE_FRAME",
    );
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
          save_picture_flag: 1,
        });
      }),
      postControl: vi.fn(async () => control()),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      postScreenshot: vi.fn(async () => ({
        path: "out/case3/case3-007.png",
        seq: 7,
      })),
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
    await waitFor(() => expect(api.postScreenshot).toHaveBeenCalledTimes(1));

    expect(infoLog).toHaveBeenCalledWith(
      "[case3] screenshot.upload_ok",
      expect.objectContaining({
        side: "without",
        roundGeneration: 1,
        attempt: 1,
        path: "out/case3/case3-007.png",
        seq: 7,
        uploadMs: expect.any(Number),
        totalMs: expect.any(Number),
      }),
    );

    hook.unmount();
    infoLog.mockRestore();
  });

  it("ReInit 日志标明目标侧和被保留侧", async () => {
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    let operation: "idle" | "start" | "reinit" = "idle";
    let operationPoll = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (operation === "idle") return control();
        operationPoll += 1;
        return control({
          command: operation,
          dt_type: "without dt",
          status:
            operationPoll === 1
              ? "execute success"
              : operation === "start"
                ? "case complete"
                : "reinit complete",
        });
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          operation = "start";
          operationPoll = 0;
          return control({
            command: "start",
            dt_type: "without dt",
          });
        }
        if ("command" in payload && payload.command === "reinit") {
          operation = "reinit";
          operationPoll = 0;
          return control({
            command: "reinit",
            dt_type: "without dt",
          });
        }
        operation = "idle";
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
      expect(hook.result.current.reinitWithoutEnabled).toBe(true),
    );

    act(() => hook.result.current.onReinitWithout());
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("initial"),
    );

    expect(infoLog).toHaveBeenCalledWith(
      "[case3] reinit.ui_applied",
      expect.objectContaining({
        side: "without",
        retainedSide: "with",
        retainedPoints: 0,
      }),
    );
    expect(infoLog).toHaveBeenCalledWith(
      "[case3] completion.init_ok",
      expect.objectContaining({
        kind: "reinit",
        side: "without",
      }),
    );

    hook.unmount();
    infoLog.mockRestore();
  });

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
          });
        }
        if (controlReads === 3) {
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
          save_picture_flag: 1,
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

  it("截图收尾完成前保持按钮禁用，旧轮 init 不会覆盖下一轮", async () => {
    const png = deferred<string>();
    vi.mocked(toPng).mockImplementation(() => png.promise);
    let controlReads = 0;
    let initPosts = 0;
    const busyChanges: boolean[] = [];
    const onBusyChange = vi.fn((busy: boolean) => busyChanges.push(busy));
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
          save_picture_flag: 1,
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
      postScreenshot: vi.fn(async () => ({
        path: "out/case3/case3-000.png",
        seq: 0,
      })),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: mapRefs(),
        api,
        onBusyChange,
      }),
    );
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );

    expect(initPosts).toBe(1);
    expect(hook.result.current.startWithEnabled).toBe(false);
    expect(hook.result.current.reinitWithoutEnabled).toBe(false);
    expect(busyChanges.at(-1)).toBe(true);

    await act(async () => {
      png.resolve("data:image/png;base64,LATE_FRAME");
      await png.promise;
    });

    await waitFor(() => expect(initPosts).toBe(2));
    await waitFor(() => expect(hook.result.current.startWithEnabled).toBe(true));
    expect(hook.result.current.reinitWithoutEnabled).toBe(true);
    expect(busyChanges.at(-1)).toBe(false);
    hook.unmount();
  });

  it("同拍 complete+flag 等最终结果完成渲染后才截图", async () => {
    vi.mocked(toPng).mockResolvedValue(
      "data:image/png;base64,FAST_SCREENSHOT",
    );
    let nextFrame: FrameRequestCallback | null = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        nextFrame = callback;
        return 1;
      }),
    );
    const finalSide = deferred<SideSnapshot>();
    let controlReads = 0;
    let sideReads = 0;
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
          save_picture_flag: controlReads === 3 ? 1 : 0,
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
      getSide: vi.fn(async () => {
        sideReads += 1;
        return sideReads === 1 ? finalWithout() : finalSide.promise;
      }),
      postScreenshot: vi.fn(async () => ({
        path: "out/case3/case3-000.png",
        seq: 0,
      })),
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
    await waitFor(() => expect(sideReads).toBe(2));
    expect(toPng).not.toHaveBeenCalled();
    expect(api.postScreenshot).not.toHaveBeenCalled();

    await act(async () => {
      finalSide.resolve(finalWithout());
      await finalSide.promise;
    });
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    expect(nextFrame).not.toBeNull();
    expect(toPng).not.toHaveBeenCalled();
    expect(api.postScreenshot).not.toHaveBeenCalled();

    act(() => {
      nextFrame?.(0);
    });
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.postScreenshot).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(initPosts).toBe(2));
    expect(hook.result.current.startWithEnabled).toBe(true);
    hook.unmount();
  });

  it("success 左边界 0→1 立刻截图，complete 前不 POST init", async () => {
    vi.mocked(toPng).mockResolvedValue(
      "data:image/png;base64,RUNNING_FRAME",
    );
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    let phase: "idle" | "success" | "complete" = "idle";
    let screenshotPosted = false;
    let initPosts = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (phase === "idle") return control();
        if (phase === "success") {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "execute success",
            save_picture_flag: screenshotPosted ? 0 : 1,
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "case complete",
          save_picture_flag: 0,
        });
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase = "success";
          return control({
            command: "start",
            dt_type: "without dt",
          });
        }
        if ("command" in payload && payload.command === "init") initPosts += 1;
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      postScreenshot: vi.fn(async () => {
        screenshotPosted = true;
        return { path: "out/case3/case3-000.png", seq: 0 };
      }),
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
    await waitFor(() => expect(api.postScreenshot).toHaveBeenCalledTimes(1));
    expect(hook.result.current.visible).toBe("without-running");
    expect(initPosts).toBe(1);
    expect(infoLog).toHaveBeenCalledWith(
      "[case3] screenshot.triggered",
      expect.objectContaining({ boundary: "success" }),
    );

    phase = "complete";
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    await waitFor(() => expect(initPosts).toBe(2));
    expect(api.postScreenshot).toHaveBeenCalledTimes(1);
    hook.unmount();
    infoLog.mockRestore();
  });

  it("success 截图成功后立刻可认 complete 再 0→1，不卡 waitClear，完成态再截一张后才 POST init", async () => {
    vi.mocked(toPng)
      .mockResolvedValueOnce("data:image/png;base64,SUCCESS_FRAME")
      .mockResolvedValueOnce("data:image/png;base64,COMPLETE_FRAME");
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    let phase: "idle" | "success" | "complete" = "idle";
    let screenshots = 0;
    let initPosts = 0;
    const uploadedFrames: string[] = [];
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (phase === "idle") return control();
        if (phase === "success") {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "execute success",
            save_picture_flag: screenshots > 0 ? 0 : 1,
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "case complete",
          save_picture_flag: screenshots >= 2 ? 0 : 1,
        });
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase = "success";
          return control({
            command: "start",
            dt_type: "without dt",
          });
        }
        if ("command" in payload && payload.command === "init") initPosts += 1;
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => finalWithout()),
      postScreenshot: vi.fn(async (base64) => {
        uploadedFrames.push(base64);
        screenshots += 1;
        return { path: `out/case3/case3-00${screenshots - 1}.png`, seq: screenshots - 1 };
      }),
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
    await waitFor(() => expect(api.postScreenshot).toHaveBeenCalledTimes(1));
    expect(hook.result.current.visible).toBe("without-running");
    expect(initPosts).toBe(1);

    phase = "complete";
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    await waitFor(() => expect(api.postScreenshot).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(initPosts).toBe(2));
    expect(toPng).toHaveBeenCalledTimes(2);
    expect(uploadedFrames).toEqual(["SUCCESS_FRAME", "COMPLETE_FRAME"]);
    expect(infoLog).toHaveBeenCalledWith(
      "[case3] screenshot.triggered",
      expect.objectContaining({ boundary: "success" }),
    );
    expect(infoLog).toHaveBeenCalledWith(
      "[case3] screenshot.requested",
      expect.objectContaining({ boundary: "complete" }),
    );
    hook.unmount();
    infoLog.mockRestore();
  });

  it("截图上传响应不确定但 flag 已清零时不重复上传", async () => {
    vi.mocked(toPng).mockResolvedValue(
      "data:image/png;base64,UNCERTAIN_FRAME",
    );
    let controlReads = 0;
    const postScreenshot = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("response lost"));
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
        if (controlReads === 3) {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "case complete",
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
      postControl: vi.fn(async () => control()),
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

    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    expect(postScreenshot).toHaveBeenCalledTimes(1);
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
      "[case3] screenshot.dropped",
      expect.objectContaining({
        side: "without",
        attempts: 3,
      }),
    );
    hook.unmount();
    droppedLog.mockRestore();
  });

  it("case complete 后最终门槛连续 10 次不过关 → 结果不完整并 POST init", async () => {
    const warnLog = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    let startPosted = false;
    let seenSuccess = false;
    let initPosts = 0;
    const incomplete: SideSnapshot = {
      ...liveWithout(1),
      costPct: null,
    };
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (!startPosted) return control();
        if (!seenSuccess) {
          seenSuccess = true;
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
        if ("command" in payload && payload.command === "start") {
          startPosted = true;
          return control({
            command: "start",
            dt_type: "without dt",
          });
        }
        if ("command" in payload && payload.command === "init") {
          initPosts += 1;
          return control();
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => incomplete),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: mapRefs(),
        api,
      }),
    );
    await waitFor(() =>
      expect(hook.result.current.startWithoutEnabled).toBe(true),
    );

    act(() => hook.result.current.onStartWithout());

    await waitFor(() =>
      expect(hook.result.current.visible).toBe("failed-start-without"),
    );
    expect(hook.result.current.withoutBadge).toBe("结果不完整已自动回退");
    expect(hook.result.current.withoutBadgeError).toBe(true);
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.startWithoutEnabled).toBe(true);
    expect(initPosts).toBeGreaterThanOrEqual(1);
    expect(errorLog).toHaveBeenCalledWith(
      "[case3] 无DT启动测试结果不完整：case complete 后最终快照连续10次未通过门槛，已退出测试中并撤权",
      expect.objectContaining({
        side: "without",
        sideLabel: "无DT",
        attempts: 10,
        maxAttempts: 10,
      }),
    );
    expect(warnLog).toHaveBeenCalledWith(
      "[case3] side.final_not_ready",
      expect.objectContaining({
        side: "without",
        sideLabel: "无DT",
        source: "local-gate",
      }),
    );

    hook.unmount();
    warnLog.mockRestore();
    errorLog.mockRestore();
  });

  it("有DT启动同样支持结果不完整出口，并打中文异常日志", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let phase: "boot" | "without-run" | "without-done" | "with-run" = "boot";
    let withoutSeenSuccess = false;
    let withSeenSuccess = false;
    let initPosts = 0;
    const incompleteWith: SideSnapshot = {
      side: "with",
      points: [],
      completeCount: 0,
      pendingTail: false,
      costPct: 10,
    };
    const withoutDone: SideSnapshot = {
      side: "without",
      points: [
        {
          no: 1,
          ue: { x: 1, y: 2, z: 0 },
          selectedBeamId: 1,
          throughputGbps: 8,
          scanBeamIds: Array.from({ length: 16 }, (_, i) => i),
        },
      ],
      completeCount: 1,
      pendingTail: false,
      costPct: 25,
    };

    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (phase === "boot" || phase === "without-done") return control();
        if (phase === "without-run") {
          if (!withoutSeenSuccess) {
            withoutSeenSuccess = true;
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
        }
        // with-run
        if (!withSeenSuccess) {
          withSeenSuccess = true;
          return control({
            command: "start",
            dt_type: "with dt",
            status: "execute success",
          });
        }
        return control({
          command: "start",
          dt_type: "with dt",
          status: "case complete",
        });
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase =
            payload.dt_type === "with dt" ? "with-run" : "without-run";
          return control({
            command: "start",
            dt_type: payload.dt_type === "with dt" ? "with dt" : "without dt",
          });
        }
        if ("command" in payload && payload.command === "init") {
          initPosts += 1;
          if (phase === "without-run") phase = "without-done";
          return control();
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async (side) => {
        if (side === "without") return withoutDone;
        return incompleteWith;
      }),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({
        config,
        stageElementRef: { current: document.createElement("div") },
        mapRendererRefs: mapRefs(),
        api,
      }),
    );
    await waitFor(() =>
      expect(hook.result.current.startWithoutEnabled).toBe(true),
    );

    act(() => hook.result.current.onStartWithout());
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    await waitFor(() =>
      expect(hook.result.current.startWithEnabled).toBe(true),
    );

    initPosts = 0;
    errorLog.mockClear();

    act(() => hook.result.current.onStartWith());
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("failed-start-with"),
    );
    expect(hook.result.current.withBadge).toBe("结果不完整已自动回退");
    expect(hook.result.current.withBadgeError).toBe(true);
    expect(hook.result.current.busy).toBe(false);
    expect(initPosts).toBeGreaterThanOrEqual(1);
    expect(errorLog).toHaveBeenCalledWith(
      "[case3] 有DT启动测试结果不完整：case complete 后最终快照连续10次未通过门槛，已退出测试中并撤权",
      expect.objectContaining({
        side: "with",
        sideLabel: "有DT",
        attempts: 10,
        maxAttempts: 10,
      }),
    );

    hook.unmount();
    errorLog.mockRestore();
  });
});
