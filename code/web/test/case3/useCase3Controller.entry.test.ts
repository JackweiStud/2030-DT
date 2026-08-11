/**
 * Case3 进页握手与 generation 门闩（注入 fake API）。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Case3ApiError,
  type Case3Api,
} from "../../src/cases/case3/api/case3Api";
import { useCase3Controller } from "../../src/cases/case3/hooks/useCase3Controller";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import type { ControlSnapshot } from "../../src/cases/case3/types";

const config: Case3RuntimeConfig = {
  pollMs: 20,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
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

function stageRef() {
  return { current: document.createElement("div") };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCase3Controller entry", () => {
  it("StrictMode 双挂载只完成一组握手", async () => {
    let initPosts = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => control()),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "init") initPosts += 1;
        return control(payload as Partial<ControlSnapshot>);
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 1, total: 2 },
      })),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const { unmount } = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    // simulate strict remount
    unmount();
    const second = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );

    await waitFor(() => {
      expect(second.result.current.state.initStatus).toBe("ready");
    });
    expect(initPosts).toBeGreaterThanOrEqual(1);
    // 第二次挂载的成功握手应占主导；允许 cleanup abort 导致额外尝试，但 ready 只能来自未中止那次
    expect(second.result.current.startWithoutEnabled).toBe(true);
    second.unmount();
  });

  it("Start POST 成功后轮询看到 fail 进入失败态", async () => {
    let poll = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (poll === 0) {
          poll += 1;
          return control();
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: poll++ === 1 ? "execute success" : "execute fail",
          save_picture_flag: 0,
        });
      }),
      postControl: vi.fn(async () =>
        control({ command: "start", dt_type: "without dt", status: "" }),
      ),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 1, total: 2 },
      })),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const { result, unmount } = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    await waitFor(() => expect(result.current.state.initStatus).toBe("ready"));

    await act(async () => {
      result.current.onStartWithout();
    });

    await waitFor(() => {
      expect(result.current.visible).toBe("failed-start-without");
    });
    unmount();
  });

  it("init-data 语义错误进入 error，停止恢复探测", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api: Case3Api = {
      getControl: vi.fn(async () => control()),
      postControl: vi.fn(async () => control()),
      getInitData: vi.fn(async () => {
        throw new Case3ApiError(
          "INIT_DATA_INVALID",
          "baseline invalid",
          422,
        );
      }),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    await waitFor(() =>
      expect(hook.result.current.state.initStatus).toBe("error"),
    );
    expect(api.getControl).toHaveBeenCalledTimes(1);
    expect(hook.result.current.startWithoutEnabled).toBe(false);
    expect(errorLog).toHaveBeenCalledWith(
      "case3 init-data failed",
      expect.objectContaining({ code: "INIT_DATA_INVALID" }),
    );
    hook.unmount();
    errorLog.mockRestore();
  });

  it("非法 control 成功响应按控制链路错误处理，不误标 init-data", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        throw new Case3ApiError(
          "CASE3_INVALID_RESPONSE",
          "control.case",
          200,
        );
      }),
      postControl: vi.fn(),
      getInitData: vi.fn(),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );

    await waitFor(() =>
      expect(hook.result.current.state.adapterError).toBe(true),
    );
    expect(hook.result.current.state.initStatus).toBe("loading");
    expect(errorLog).toHaveBeenCalledWith(
      "[case3] adapter unreachable",
      expect.objectContaining({
        endpoint: "/api/case3/control-file",
        code: "CASE3_INVALID_RESPONSE",
      }),
    );
    hook.unmount();
    errorLog.mockRestore();
  });

  it("控制元组漂移时忽略其他轮终态，等待当前轮 complete", async () => {
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
        if (controlReads === 3) {
          return control({
            case: "case2",
            command: "start",
            dt_type: "with dt",
            status: "execute fail",
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "case complete",
        });
      }),
      postControl: vi.fn(async () => control()),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 1, total: 2 },
      })),
      getSide: vi.fn(async () => ({
        side: "without" as const,
        points: [
          {
            no: 1,
            ue: { x: 1, y: 2, z: 0 },
            selectedBeamId: 1,
            throughputGbps: 2,
            scanBeamIds: Array.from({ length: 16 }, (_, index) => index),
          },
        ],
        completeCount: 1,
        pendingTail: false,
        costPct: 25,
      })),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());

    await waitFor(() =>
      expect(hook.result.current.visible).toBe("without-completed"),
    );
    expect(controlReads).toBeGreaterThanOrEqual(4);
    hook.unmount();
  });

  it("卸载会取消仍在途的 Start POST，且不会启动旧轮轮询", async () => {
    let actionSignal: AbortSignal | undefined;
    let controlReads = 0;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        controlReads += 1;
        return control();
      }),
      postControl: vi.fn(async (payload, signal) => {
        if ("command" in payload && payload.command === "start") {
          actionSignal = signal;
          await new Promise<never>((_, reject) => {
            signal?.addEventListener(
              "abort",
              () =>
                reject(
                  new DOMException("The operation was aborted", "AbortError"),
                ),
              { once: true },
            );
          });
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 1, total: 2 },
      })),
      getSide: vi.fn(),
      postScreenshot: vi.fn(),
    };

    const hook = renderHook(() =>
      useCase3Controller({ config, stageElementRef: stageRef(), api }),
    );
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));
    const readsBeforeStart = controlReads;

    act(() => hook.result.current.onStartWithout());
    await waitFor(() => expect(actionSignal).toBeDefined());
    hook.unmount();

    expect(actionSignal?.aborted).toBe(true);
    await new Promise((resolve) => window.setTimeout(resolve, config.pollMs * 2));
    expect(controlReads).toBe(readsBeforeStart);
  });
});
