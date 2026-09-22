/**
 * Case3 控制器失败分类：POST / CONTROL_BUSY / 连续轮询失败 / 新 generation 隔离。
 * 1 次与 3 次轮询失败恢复见 useCase3Controller.lifecycle.test.ts。
 */

import { act, renderHook, waitFor } from "@testing-library/react";
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

function commandPosts(api: Case3Api, command: string) {
  return vi.mocked(api.postControl).mock.calls.filter((call) => {
    const payload = call[0];
    return (
      typeof payload === "object" &&
      payload !== null &&
      "command" in payload &&
      payload.command === command
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCase3Controller failure classification", () => {
  it("Start POST 普通失败置 adapterError，不自动重发，不伪装 CONTROL_BUSY", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api: Case3Api = {
      getControl: vi.fn(async () => control()),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          throw new Case3ApiError("REQUEST_TIMEOUT", "timeout", 0);
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(),
      getThroughput: vi.fn(async () => ({ samples: [], pendingTail: false })),
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
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());
    await waitFor(() => expect(hook.result.current.state.adapterError).toBe(true));
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.state.activeAction).toBeNull();
    expect(hook.result.current.withoutBadge).toBe("case3文件服务器连接异常");
    expect(hook.result.current.withoutBadgeError).toBe(true);
    expect(hook.result.current.visible).not.toBe("failed-start-without");
    expect(commandPosts(api, "start")).toHaveLength(1);

    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(commandPosts(api, "start")).toHaveLength(1);

    hook.unmount();
    errorLog.mockRestore();
    warnLog.mockRestore();
  });

  it("Start CONTROL_BUSY 不置 adapterError，不自动重发，可再点 Start", async () => {
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const api: Case3Api = {
      getControl: vi.fn(async () => control()),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          throw new Case3ApiError("CONTROL_BUSY", "busy", 409);
        }
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(),
      getThroughput: vi.fn(async () => ({ samples: [], pendingTail: false })),
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
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());
    await waitFor(() => expect(hook.result.current.state.activeAction).toBeNull());
    expect(hook.result.current.state.adapterError).toBe(false);
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.withoutBadge).not.toBe("case3文件服务器连接异常");
    expect(hook.result.current.withoutBadgeError).toBe(false);
    expect(hook.result.current.startWithoutEnabled).toBe(true);
    expect(commandPosts(api, "start")).toHaveLength(1);

    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(commandPosts(api, "start")).toHaveLength(1);

    hook.unmount();
    warnLog.mockRestore();
  });

  it("动作中连续 2 次 control GET 失败不置 adapterError，也不亮重试中", async () => {
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let startPosted = false;
    let failLeft = 2;
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (!startPosted) return control();
        if (failLeft > 0) {
          failLeft -= 1;
          throw new Case3ApiError("REQUEST_TIMEOUT", "timeout", 0);
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "execute success",
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
        return control();
      }),
      getInitData: vi.fn(async () => ({
        baseRoute: [{ no: 1, x: 1, y: 2, z: 0 }],
        baseline: { success: 80, total: 100 },
      })),
      getSide: vi.fn(async () => liveWithout(1)),
      getThroughput: vi.fn(async () => ({ samples: [], pendingTail: false })),
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
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());
    await waitFor(() => expect(failLeft).toBe(0));
    expect(hook.result.current.state.adapterError).toBe(false);
    expect(hook.result.current.withoutRetryHint).toBe(false);
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.state.activeAction).not.toBeNull();

    await waitFor(() =>
      expect(hook.result.current.state.live.without?.completeCount).toBe(1),
    );
    expect(hook.result.current.withoutRetryHint).toBe(false);
    expect(hook.result.current.busy).toBe(true);

    hook.unmount();
    warnLog.mockRestore();
  });

  it("失败后重试使用新 generation，只提交新轮 live", async () => {
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let startPosts = 0;
    const freshLive = liveWithout(1);
    const api: Case3Api = {
      getControl: vi.fn(async () => {
        if (startPosts === 0) return control();
        if (startPosts === 1) {
          return control({
            command: "start",
            dt_type: "without dt",
            status: "execute fail",
          });
        }
        return control({
          command: "start",
          dt_type: "without dt",
          status: "execute success",
        });
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          startPosts += 1;
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
      getSide: vi.fn(async () => freshLive),
      getThroughput: vi.fn(async () => ({ samples: [], pendingTail: false })),
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
    await waitFor(() => expect(hook.result.current.startWithoutEnabled).toBe(true));

    act(() => hook.result.current.onStartWithout());
    await waitFor(() =>
      expect(hook.result.current.visible).toBe("failed-start-without"),
    );
    const failedGeneration = hook.result.current.state.generation;
    expect(hook.result.current.state.live.without).toBeNull();
    expect(hook.result.current.state.results.without).toBeNull();
    expect(hook.result.current.startWithoutEnabled).toBe(true);
    expect(api.getSide).not.toHaveBeenCalled();

    act(() => hook.result.current.onStartWithout());
    await waitFor(() =>
      expect(hook.result.current.state.generation).toBeGreaterThan(failedGeneration),
    );
    await waitFor(() =>
      expect(hook.result.current.state.live.without?.completeCount).toBe(1),
    );
    expect(hook.result.current.state.live.without?.points).toHaveLength(1);
    expect(hook.result.current.state.live.without?.points[0]?.no).toBe(1);
    expect(hook.result.current.visible).toBe("without-running");
    expect(hook.result.current.busy).toBe(true);
    expect(commandPosts(api, "start")).toHaveLength(2);
    expect(api.getSide).toHaveBeenCalled();

    hook.unmount();
    warnLog.mockRestore();
    errorLog.mockRestore();
  });
});
