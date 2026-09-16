/**
 * Case4 完成门槛、同拍截图与 busy 保持。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { toPng } from "html-to-image";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Case4Api } from "../../src/cases/case4/api/case4Api";
import { useCase4Controller } from "../../src/cases/case4/hooks/useCase4Controller";
import type { ControlSnapshot } from "../../src/cases/case4/types";
import {
  CASE4_TEST_CONFIG,
  deferred,
  idleControl,
  liveTrajectory,
  sampleBaseRoute,
  sampleResult,
  startControl,
  stubApi,
  thrpSnapshot,
  thrpSamples,
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

function mapRef() {
  return {
    current: {
      resetView: vi.fn(),
      prepareCapture: vi.fn(async () => undefined),
    },
  };
}

describe("useCase4Controller lifecycle", () => {
  it("success 前零次轨迹/吞吐；两路吞吐各请求；同拍先截图登记再读 result；完成画面后才 toPng", async () => {
    const infoLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const paint = deferred<void>();
    const completionInit = deferred<ControlSnapshot>();
    let phase: "idle" | "start" | "success" | "complete" = "idle";
    let successReads = 0;
    let initPosts = 0;
    const api: Case4Api = stubApi({
      getControl: vi.fn(async () => {
        if (phase === "idle") return idleControl();
        if (phase === "start" || phase === "success") {
          successReads += 1;
          phase = "success";
          if (successReads >= 2) {
            phase = "complete";
            return startControl("case complete", { save_picture_flag: 1 });
          }
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
          if (initPosts === 1) return idleControl();
          return completionInit.promise;
        }
        return idleControl();
      }),
      getInitData: vi.fn(async () => ({ baseRoute: sampleBaseRoute(3) })),
      getTrajectory: vi.fn(async () => liveTrajectory(2, sampleBaseRoute(3))),
      getThroughput: vi.fn(async (side) =>
        side === "without"
          ? thrpSnapshot(thrpSamples(1))
          : thrpSnapshot(thrpSamples(2)),
      ),
      getResult: vi.fn(async () => sampleResult(2)),
      postScreenshot: vi.fn(async () => ({
        path: "out/case4/case4-000.png",
        seq: 0,
      })),
    });
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,AAA");

    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        mapRendererRef: mapRef(),
        api,
        waitForPaint: () => paint.promise,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    expect(api.getTrajectory).not.toHaveBeenCalled();
    expect(api.getThroughput).not.toHaveBeenCalled();

    act(() => hook.result.current.onStart());
    await waitFor(() =>
      expect(hook.result.current.state.activeAction?.seenExecuteSuccess).toBe(
        true,
      ),
    );
    await waitFor(() => expect(api.getTrajectory).toHaveBeenCalled());
    await waitFor(() => {
      const sides = vi
        .mocked(api.getThroughput)
        .mock.calls.map((c) => c[0])
        .sort();
      expect(sides).toContain("without");
      expect(sides).toContain("with");
    });

    await waitFor(() =>
      expect(hook.result.current.state.ui).toBe("completed"),
    );
    expect(hook.result.current.dataState).toBe("completed");
    expect(hook.result.current.statistics?.nlosRatio).toBe(0.897);
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.resetEnabled).toBe(false);
    expect(toPng).not.toHaveBeenCalled();
    expect(api.postScreenshot).not.toHaveBeenCalled();

    const requestedAt = infoLog.mock.calls.findIndex(
      (c) => c[0] === "[case4] screenshot.requested",
    );
    const fetchAt = infoLog.mock.calls.findIndex(
      (c) => c[0] === "[case4] result.fetch_begin",
    );
    expect(requestedAt).toBeGreaterThanOrEqual(0);
    expect(fetchAt).toBeGreaterThan(requestedAt);

    await act(async () => {
      paint.resolve();
    });
    await waitFor(() => expect(toPng).toHaveBeenCalled());
    await waitFor(() => expect(api.postScreenshot).toHaveBeenCalled());
    await waitFor(() => expect(initPosts).toBe(2));
    expect(hook.result.current.busy).toBe(true);
    await act(async () => {
      completionInit.resolve(idleControl());
    });
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(hook.result.current.resetEnabled).toBe(true);
    hook.unmount();
    infoLog.mockRestore();
  });

  it("未见 success 的 complete 不读 result", async () => {
    let phase: "idle" | "start" | "complete" = "idle";
    const api = stubApi({
      getControl: vi.fn(async () => {
        if (phase === "complete" || phase === "start") {
          phase = "complete";
          return startControl("case complete", { save_picture_flag: 1 });
        }
        return idleControl();
      }),
      postControl: vi.fn(async (payload) => {
        if ("command" in payload && payload.command === "start") {
          phase = "start";
          return startControl("");
        }
        return idleControl();
      }),
      getResult: vi.fn(async () => sampleResult()),
      getTrajectory: vi.fn(async () => liveTrajectory(1)),
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
    await new Promise((r) => setTimeout(r, 40));
    expect(api.getResult).not.toHaveBeenCalled();
    expect(api.getTrajectory).not.toHaveBeenCalled();
    hook.unmount();
  });
});
