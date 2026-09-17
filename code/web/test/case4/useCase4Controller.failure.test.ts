/**
 * Case4 失败路径：归属、CONTROL_BUSY、耗尽、清零失败、ReInit init 失败。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { toPng } from "html-to-image";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Case4ApiError,
  type Case4Api,
} from "../../src/cases/case4/api/case4Api";
import { useCase4Controller } from "../../src/cases/case4/hooks/useCase4Controller";
import type { ControlSnapshot } from "../../src/cases/case4/types";
import {
  CASE4_TEST_CONFIG,
  deferred,
  idleControl,
  reinitControl,
  sampleResult,
  startControl,
  stubApi,
} from "./fixtures";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

afterEach(() => {
  vi.mocked(toPng).mockReset();
});

function stageRef() {
  return { current: document.createElement("div") };
}

describe("useCase4Controller failure", () => {
  it("归属不匹配的 control 不登记截图、不失败本轮", async () => {
    let started = false;
    const api = stubApi({
      getControl: vi.fn(async () => {
        if (!started) return idleControl();
        return {
          case: "case2",
          command: "start",
          dt_type: "all",
          status: "execute fail",
          save_picture_flag: 1,
        };
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          started = true;
          return startControl("");
        }
        return idleControl();
      }),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() => expect(hook.result.current.busy).toBe(true));
    await new Promise((r) => setTimeout(r, 30));
    expect(hook.result.current.state.ui).toBe("running");
    expect(hook.result.current.state.activeAction).not.toBeNull();
    hook.unmount();
  });

  it("CONTROL_BUSY 不置 adapterError，可再 Start", async () => {
    const api = stubApi({
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          throw new Case4ApiError("CONTROL_BUSY", "busy", 409);
        }
        return idleControl();
      }),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(hook.result.current.state.adapterError).toBe(false);
    expect(hook.result.current.startEnabled).toBe(true);
    hook.unmount();
  });

  it("Start POST 不确定时补读 control，不二次 POST", async () => {
    let startPosts = 0;
    const api = stubApi({
      getControl: vi.fn(async () => {
        if (startPosts === 0) return idleControl();
        return startControl("execute success");
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          startPosts += 1;
          throw new Case4ApiError("REQUEST_TIMEOUT", "timeout", 0);
        }
        return idleControl();
      }),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() =>
      expect(hook.result.current.state.activeAction?.seenExecuteSuccess).toBe(
        true,
      ),
    );
    expect(startPosts).toBe(1);
    hook.unmount();
  });

  it("result 10 次失败保持 busy 直到 POST init 返回", async () => {
    const completionInit = deferred<ControlSnapshot>();
    let phase: "idle" | "start" | "success" | "complete" = "idle";
    let initPosts = 0;
    const api: Case4Api = stubApi({
      getControl: vi.fn(async () => {
        if (phase === "idle") return idleControl();
        if (phase === "start") {
          phase = "success";
          return startControl("execute success");
        }
        return startControl("case complete");
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase = "start";
          return startControl("");
        }
        if ("command" in payload && payload.command === "init") {
          initPosts += 1;
          if (initPosts === 1) return idleControl();
          return completionInit.promise;
        }
        return idleControl();
      }),
      getResult: vi.fn(async () => {
        throw new Case4ApiError("RESULT_NOT_READY", "not ready", 409);
      }),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() => expect(hook.result.current.state.ui).toBe("failed-start"));
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.startEnabled).toBe(false);
    await waitFor(() => expect(initPosts).toBe(2));
    await act(async () => {
      completionInit.resolve(idleControl());
    });
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(hook.result.current.startEnabled).toBe(true);
    expect(vi.mocked(api.getResult).mock.calls.length).toBe(10);
    hook.unmount();
  });

  it("放弃清零失败：不 POST init、adapterError、busy=false、保留 completed", async () => {
    let phase: "idle" | "start" | "success" | "complete" = "idle";
    let initPosts = 0;
    vi.mocked(toPng).mockRejectedValue(new Error("png fail"));
    const api = stubApi({
      getControl: vi.fn(async () => {
        if (phase === "idle") return idleControl();
        if (phase === "start") {
          phase = "success";
          return startControl("execute success");
        }
        return startControl("case complete", { save_picture_flag: 1 });
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase = "start";
          return startControl("");
        }
        if ("command" in payload && payload.command === "init") {
          initPosts += 1;
          return idleControl();
        }
        if ("save_picture_flag" in payload) {
          throw new Case4ApiError("REQUEST_TIMEOUT", "timeout", 0);
        }
        return idleControl();
      }),
      getResult: vi.fn(async () => sampleResult(2)),
      postScreenshot: vi.fn(async () => {
        throw new Case4ApiError("SCREENSHOT_WRITE_FAILED", "fail", 500);
      }),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
        waitForPaint: async () => undefined,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() => expect(hook.result.current.state.ui).toBe("completed"));
    await waitFor(() => expect(hook.result.current.state.adapterError).toBe(true));
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.statistics?.nlosRatio).toBe(0.897);
    expect(initPosts).toBe(1);
    hook.unmount();
  });

  it("ReInit complete 后 init 失败保留空画面且不可 Start", async () => {
    let phase:
      | "idle"
      | "start"
      | "success"
      | "complete"
      | "reinit"
      | "reinit-success"
      | "reinit-complete" = "idle";
    let initPosts = 0;
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,AAA");
    const api = stubApi({
      getControl: vi.fn(async () => {
        if (phase === "idle") return idleControl();
        if (phase === "start") {
          phase = "success";
          return startControl("execute success");
        }
        if (phase === "success") {
          phase = "complete";
          return startControl("case complete");
        }
        if (phase === "complete") return startControl("case complete");
        if (phase === "reinit") {
          phase = "reinit-success";
          return reinitControl("execute success");
        }
        if (phase === "reinit-success") {
          phase = "reinit-complete";
          return reinitControl("reinit complete");
        }
        return reinitControl("reinit complete");
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase = "start";
          return startControl("");
        }
        if ("command" in payload && payload.command === "reinit") {
          phase = "reinit";
          return reinitControl("");
        }
        if ("command" in payload && payload.command === "init") {
          initPosts += 1;
          if (initPosts <= 2) return idleControl();
          throw new Case4ApiError("REQUEST_TIMEOUT", "timeout", 0);
        }
        return idleControl();
      }),
      getResult: vi.fn(async () => sampleResult(2)),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
        waitForPaint: async () => undefined,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() => expect(hook.result.current.resetEnabled).toBe(true));
    expect(hook.result.current.state.ui).toBe("completed");
    act(() => hook.result.current.onReinit());
    await waitFor(() => expect(hook.result.current.state.adapterError).toBe(true));
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.startEnabled).toBe(false);
    expect(hook.result.current.resetEnabled).toBe(false);
    expect(hook.result.current.statistics).toBeNull();
    hook.unmount();
  });

  it("execute fail 后只能再 Start", async () => {
    let started = false;
    const api = stubApi({
      getControl: vi.fn(async () => {
        if (!started) return idleControl();
        return startControl("execute fail");
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          started = true;
          return startControl("");
        }
        return idleControl();
      }),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    act(() => hook.result.current.onStart());
    await waitFor(() => expect(hook.result.current.state.ui).toBe("failed-start"));
    expect(hook.result.current.startEnabled).toBe(true);
    expect(hook.result.current.resetEnabled).toBe(false);
    expect(hook.result.current.banner).toBe("执行命令失败");
    hook.unmount();
  });
});
