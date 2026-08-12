/**
 * 进页串行门闩与 generation 去重。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCase2Controller } from "../src/cases/case2/hooks/useCase2Controller";
import type { Case2Api } from "../src/cases/case2/api/case2Api";
import type { Case2RuntimeConfig } from "../src/cases/case2/metrics/heatmapConfig";
import type { ControlSnapshot, MetricsBundle } from "../src/cases/case2/types";

function metrics(): MetricsBundle {
  return {
    rss: { heatmap: [[1, 2], [3, 4]], kpi: [1, 2, 3] },
    effective_path_num: { heatmap: [[1]], kpi: [1] },
    first_path_delay: { heatmap: [[1]], kpi: [1] },
  };
}

function control(partial: Partial<ControlSnapshot> = {}): ControlSnapshot {
  return {
    case: "case2",
    command: "start",
    dt_type: "with dt",
    status: "case complete",
    save_picture_flag: 0,
    ...partial,
  };
}

const config: Case2RuntimeConfig = {
  pollMs: 1000,
  x0: 0,
  y0: 0,
  x1: 10,
  y1: 10,
  rangeWidth: 10,
  rangeHeight: 10,
  cell: 8,
  gap: 0,
  period: 8,
  alpha: 0.8,
  cdfPointCap: 64,
};

function stageRef() {
  return { current: document.createElement("div") };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useCase2Controller entry gate", () => {
  it("先 control 成功再写回 init，然后拉 initial；历史 complete 不改相", async () => {
    const order: string[] = [];
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        return control({ status: "case complete" });
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config,
        stageElementRef: stageRef(),
        api,
      }),
    );

    await waitFor(() => {
      expect(result.current.state.initialData).not.toBeNull();
    });

    expect(order[0]).toBe("control");
    expect(order[1]).toBe("post:init");
    expect(order).toContain("data:initial");
    expect(order.indexOf("post:init")).toBeLessThan(
      order.indexOf("data:initial"),
    );
    expect(result.current.state.case2UiState).toBe("initial");
    expect(result.current.state.adapterError).toBe(false);
    expect(result.current.startEnabled).toBe(true);
    expect(result.current.state.calibratedData).toBeNull();
  });

  it("control 失败时不拉 initial，并置 adapterError", async () => {
    const order: string[] = [];
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        throw new Error("adapter down");
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config,
        stageElementRef: stageRef(),
        api,
      }),
    );

    await waitFor(() => {
      expect(result.current.state.adapterError).toBe(true);
    });

    // 给一点时间，确保没有迟到的 initial 调用
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(order).toEqual(["control"]);
    expect(result.current.state.initialData).toBeNull();
    expect(result.current.startEnabled).toBe(false);
    expect(result.current.state.case2UiState).toBe("initial");
  });

  it("adapterError 时每 5s 探活，恢复后清 error 并拉 initial", async () => {
    vi.useFakeTimers();
    let failControl = true;
    const order: string[] = [];
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        if (failControl) throw new Error("adapter down");
        return control({ command: "init", status: "", dt_type: "" });
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config,
        stageElementRef: stageRef(),
        api,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.state.adapterError).toBe(true);
    expect(order).toEqual(["control"]);

    failControl = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await Promise.resolve();
    });

    expect(result.current.state.adapterError).toBe(false);
    expect(result.current.state.initialData).not.toBeNull();
    expect(order.filter((x) => x === "control").length).toBeGreaterThanOrEqual(2);
    expect(order).toContain("post:init");
    expect(order).toContain("data:initial");
    expect(result.current.state.case2UiState).toBe("initial");
    expect(result.current.startEnabled).toBe(true);
  });

  it("control 成功但 init 写回失败时不拉 initial，并置 adapterError", async () => {
    const order: string[] = [];
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        return control({ status: "case complete" });
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        throw new Error("control write denied");
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config,
        stageElementRef: stageRef(),
        api,
      }),
    );

    await waitFor(() => {
      expect(result.current.state.adapterError).toBe(true);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(order).toEqual(["control", "post:init"]);
    expect(result.current.state.initialData).toBeNull();
    expect(result.current.startEnabled).toBe(false);
    expect(result.current.state.case2UiState).toBe("initial");
  });

  it("启动轮 Calibrated 成功且截图空闲后，再写回 init", async () => {
    const order: string[] = [];
    let started = false;
    let pollCount = 0;
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        if (!started) return control({ command: "init", status: "", dt_type: "" });
        pollCount += 1;
        if (pollCount === 1) {
          return control({ command: "start", status: "execute success" });
        }
        return control({ command: "start", status: "case complete" });
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        if ("command" in payload && payload.command === "start") {
          started = true;
          return control({ command: "start", status: "" });
        }
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config: { ...config, pollMs: 1 },
        stageElementRef: stageRef(),
        api,
      }),
    );

    await waitFor(() => {
      expect(result.current.startEnabled).toBe(true);
    });

    act(() => {
      result.current.onStart();
    });

    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("completed");
      expect(order.filter((x) => x === "post:init")).toHaveLength(2);
    });

    expect(result.current.state.lastControl?.command).toBe("init");
    expect(result.current.state.lastControl?.status).toBe("");
    expect(order.indexOf("data:calibrated")).toBeLessThan(
      order.lastIndexOf("post:init"),
    );
  });

  it("重置完成 UI 回 initial 后，再写回 init", async () => {
    const order: string[] = [];
    let mode: "entry" | "start" | "reset" = "entry";
    let pollCount = 0;
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        if (mode === "start") {
          pollCount += 1;
          if (pollCount === 1) {
            return control({ command: "start", status: "execute success" });
          }
          return control({ command: "start", status: "case complete" });
        }
        if (mode === "reset") {
          pollCount += 1;
          if (pollCount === 1) {
            return control({ command: "reinit", status: "execute success" });
          }
          return control({ command: "reinit", status: "reinit complete" });
        }
        return control({ command: "init", status: "", dt_type: "" });
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        if ("command" in payload && payload.command === "start") {
          mode = "start";
          pollCount = 0;
          return control({ command: "start", status: "" });
        }
        if ("command" in payload && payload.command === "reinit") {
          mode = "reset";
          pollCount = 0;
          return control({ command: "reinit", status: "" });
        }
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config: { ...config, pollMs: 1 },
        stageElementRef: stageRef(),
        api,
      }),
    );

    await waitFor(() => {
      expect(result.current.startEnabled).toBe(true);
    });
    act(() => {
      result.current.onStart();
    });
    await waitFor(() => {
      expect(result.current.resetEnabled).toBe(true);
      expect(order.filter((x) => x === "post:init")).toHaveLength(2);
    });

    act(() => {
      result.current.onReset();
    });

    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("initial");
      expect(order.filter((x) => x === "post:init")).toHaveLength(3);
    });

    expect(result.current.state.lastControl?.command).toBe("init");
    expect(result.current.state.lastControl?.status).toBe("");
    expect(order.indexOf("post:reinit")).toBeLessThan(order.lastIndexOf("post:init"));
  });

  it("case complete 后 Calibrated 连续 10 次失败 → 结果不完整已自动回退并 POST init", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let startPosted = false;
    let seenSuccess = false;
    let initAfterFail = 0;
    const api: Case2Api = {
      async getControl() {
        if (!startPosted) {
          return control({ command: "init", status: "", dt_type: "" });
        }
        if (!seenSuccess) {
          seenSuccess = true;
          return control({ status: "execute success" });
        }
        return control({ status: "case complete" });
      },
      async getDataFiles(phase) {
        if (phase === "initial") return metrics();
        throw new Error("RESULT_BATCH_INCOMPLETE");
      },
      async postControl(payload) {
        if ("command" in payload && payload.command === "start") {
          startPosted = true;
          return control({ status: "" });
        }
        if ("command" in payload && payload.command === "init") {
          if (startPosted) initAfterFail += 1;
          return control({ command: "init", status: "", dt_type: "" });
        }
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        throw new Error("not used");
      },
    };

    const { result } = renderHook(() =>
      useCase2Controller({
        config: { ...config, pollMs: 1 },
        stageElementRef: stageRef(),
        api,
      }),
    );

    await waitFor(() => expect(result.current.startEnabled).toBe(true));
    act(() => {
      result.current.onStart();
    });

    await waitFor(() =>
      expect(result.current.state.case2UiState).toBe("failed-start"),
    );
    expect(result.current.state.resultIncomplete).toBe(true);
    expect(result.current.statusText).toBe("结果不完整已自动回退");
    expect(result.current.startEnabled).toBe(true);
    expect(initAfterFail).toBeGreaterThanOrEqual(1);
    expect(errorLog).toHaveBeenCalledWith(
      "[case2] 启动测试结果不完整：case complete 后 Calibrated 六文件连续10次未通过门槛，已退出测试中并撤权",
      expect.objectContaining({
        attempts: 10,
        maxAttempts: 10,
      }),
    );

    errorLog.mockRestore();
  });
});
