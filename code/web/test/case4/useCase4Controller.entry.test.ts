/**
 * Case4 进页握手与晚到响应门闩。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCase4Controller } from "../../src/cases/case4/hooks/useCase4Controller";
import {
  CASE4_TEST_CONFIG,
  deferred,
  idleControl,
  liveTrajectory,
  sampleBaseRoute,
  stubApi,
  thrpSnapshot,
} from "./fixtures";

function stageRef() {
  return { current: document.createElement("div") };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCase4Controller entry", () => {
  it("StrictMode 双挂载后仍能握手成功，且 success 前不读轨迹/吞吐", async () => {
    const order: string[] = [];
    const api = stubApi({
      getControl: vi.fn(async () => {
        order.push("getControl");
        return idleControl();
      }),
      postControl: vi.fn(async (payload) => {
        order.push(`post:${"command" in payload ? payload.command : "?"}`);
        return idleControl();
      }),
      getInitData: vi.fn(async () => {
        order.push("init-data");
        return { baseRoute: sampleBaseRoute() };
      }),
      getTrajectory: vi.fn(async () => liveTrajectory(1)),
      getThroughput: vi.fn(async () => thrpSnapshot([])),
    });

    const first = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    first.unmount();
    const second = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => {
      expect(second.result.current.startEnabled).toBe(true);
    });
    expect(api.getTrajectory).not.toHaveBeenCalled();
    expect(api.getThroughput).not.toHaveBeenCalled();
    expect(order.filter((s) => s === "post:init").length).toBeGreaterThanOrEqual(
      1,
    );
    second.unmount();
  });

  it("刷新卸载后晚到 live 不写新实例", async () => {
    const traj = deferred<ReturnType<typeof liveTrajectory>>();
    const api = stubApi({
      getTrajectory: vi.fn(async () => traj.promise),
    });
    const hook = renderHook(() =>
      useCase4Controller({
        config: CASE4_TEST_CONFIG,
        stageElementRef: stageRef(),
        api,
      }),
    );
    await waitFor(() => expect(hook.result.current.startEnabled).toBe(true));
    hook.unmount();
    await act(async () => {
      traj.resolve(liveTrajectory(2));
    });
    expect(hook.result.current.state.liveTrajectory).toBeNull();
  });
});
