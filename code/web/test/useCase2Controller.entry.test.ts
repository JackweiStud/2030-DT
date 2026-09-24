/**
 * 进页串行门闩与 generation 去重。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCase2Controller } from "../src/cases/case2/hooks/useCase2Controller";
import { Case2ApiError, type Case2Api } from "../src/cases/case2/api/case2Api";
import type { Case2RuntimeConfig } from "../src/cases/case2/metrics/heatmapConfig";
import type { ControlSnapshot, MetricsBundle } from "../src/cases/case2/types";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,QQ=="),
}));

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
  invalidRgba: { r: 255, g: 255, b: 255, a: 0 },
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

  it("Initial 六文件失败显示初始化数据异常，不置 adapterError、不开探活", async () => {
    const order: string[] = [];
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        return control({ command: "init", status: "", dt_type: "" });
      },
      async getDataFiles(phase) {
        order.push(`data:${phase}`);
        throw new Error("heatmap_init_rss.txt is missing");
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
      expect(result.current.state.initialError).toBe(
        "heatmap_init_rss.txt is missing",
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(order).toEqual(["control", "post:init", "data:initial"]);
    expect(result.current.state.adapterError).toBe(false);
    expect(result.current.statusText).toBe("case2初始化数据异常");
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
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
        throw new Case2ApiError(
          "CALIBRATED_RESTORE_FAILED",
          "failed to restore heatmap_cali_rss.txt: source missing",
          500,
        );
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
    expect(errorSpy).toHaveBeenCalledWith(
      "[case2] entry.control_init_failed",
      expect.objectContaining({
        code: "CALIBRATED_RESTORE_FAILED",
        reason: expect.stringContaining("heatmap_cali_rss.txt"),
      }),
    );
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
    expect(result.current.resetEnabled).toBe(true);
  });

  it("completed 但 init 未写回时重置不可点，onReset 不发出 reinit", async () => {
    const order: string[] = [];
    let started = false;
    let pollCount = 0;
    let releaseInit: () => void = () => undefined;
    const completionInitHold = new Promise<void>((resolve) => {
      releaseInit = resolve;
    });
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
        if ("command" in payload && payload.command === "init" && started) {
          await completionInitHold;
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
    expect(result.current.resetEnabled).toBe(false);
    expect(result.current.state.lastControl?.command).toBe("start");
    expect(result.current.state.lastControl?.status).toBe("case complete");

    act(() => {
      result.current.onReset();
    });
    expect(order.filter((x) => x === "post:reinit")).toHaveLength(0);

    await act(async () => {
      releaseInit();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.resetEnabled).toBe(true);
      expect(result.current.state.lastControl?.command).toBe("init");
    });

    act(() => {
      result.current.onReset();
    });
    await waitFor(() => {
      expect(order).toContain("post:reinit");
    });
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

  it("success 左边界截图成功后立刻 idle，complete 再 0→1 截完成态再 init", async () => {
    const order: string[] = [];
    const initPayloads: Array<{ command: "init"; restore_calibrated?: false }> = [];
    let started = false;
    let phase: "success" | "complete" = "success";
    let screenshots = 0;
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        if (!started) return control({ command: "init", status: "", dt_type: "" });
        if (phase === "success") {
          return control({
            command: "start",
            status: "execute success",
            save_picture_flag: screenshots > 0 ? 0 : 1,
          });
        }
        return control({
          command: "start",
          status: "case complete",
          save_picture_flag: screenshots >= 2 ? 0 : 1,
        });
      },
      async getDataFiles(phaseName) {
        order.push(`data:${phaseName}`);
        return metrics();
      },
      async postControl(payload) {
        order.push(`post:${"command" in payload ? payload.command : "flag"}`);
        if ("command" in payload && payload.command === "init") {
          initPayloads.push(payload);
        }
        if ("command" in payload && payload.command === "start") {
          started = true;
          return control({ command: "start", status: "" });
        }
        return control({ command: "init", status: "", dt_type: "" });
      },
      async postScreenshot() {
        order.push("screenshot");
        screenshots += 1;
        return { ok: true, path: `out/case2/calibrated-00${screenshots - 1}.png`, seq: screenshots - 1 };
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
      expect(screenshots).toBe(1);
      expect(result.current.state.screenshotPhase).toBe("idle");
      expect(result.current.state.screenshotLastFlag).toBe(0);
    });
    expect(result.current.state.case2UiState).toBe("calibrating");
    expect(order.filter((x) => x === "post:init")).toHaveLength(1);

    phase = "complete";
    await waitFor(() => {
      expect(screenshots).toBe(2);
    });
    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("completed");
      expect(result.current.state.lastControl?.command).toBe("init");
      expect(result.current.resetEnabled).toBe(true);
    });
    expect(order.filter((x) => x === "screenshot")).toHaveLength(2);
    expect(order.filter((x) => x === "post:init")).toHaveLength(2);
    expect(initPayloads).toEqual([
      { command: "init" },
      { command: "init", restore_calibrated: false },
    ]);
    expect(order.indexOf("data:calibrated")).toBeGreaterThan(-1);
    const secondShot = order.lastIndexOf("screenshot");
    expect(order.indexOf("data:calibrated")).toBeLessThan(secondShot);
  });

  it("同拍 complete+flag=1 先拉六文件再截图", async () => {
    const order: string[] = [];
    let started = false;
    let seenSuccess = false;
    let screenshotPosted = false;
    const api: Case2Api = {
      async getControl() {
        order.push("control");
        if (!started) return control({ command: "init", status: "", dt_type: "" });
        if (!seenSuccess) {
          seenSuccess = true;
          return control({ command: "start", status: "execute success" });
        }
        return control({
          command: "start",
          status: "case complete",
          save_picture_flag: screenshotPosted ? 0 : 1,
        });
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
        order.push("screenshot");
        screenshotPosted = true;
        return { ok: true, path: "out/case2/calibrated-000.png", seq: 0 };
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
      expect(order).toContain("screenshot");
    });
    expect(order.indexOf("data:calibrated")).toBeGreaterThan(-1);
    expect(order.indexOf("data:calibrated")).toBeLessThan(order.indexOf("screenshot"));
    await waitFor(() => {
      expect(result.current.state.lastControl?.command).toBe("init");
      expect(result.current.resetEnabled).toBe(true);
    });
  });

  it("Start 遇 CONTROL_BUSY：回 initial，不进 adapterError，可再点", async () => {
    const api: Case2Api = {
      async getControl() {
        return control({ command: "init", status: "", dt_type: "" });
      },
      async getDataFiles() {
        return metrics();
      },
      async postControl(payload) {
        if ("command" in payload && payload.command === "start") {
          throw new Case2ApiError("CONTROL_BUSY", "busy", 409);
        }
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
      expect(result.current.startEnabled).toBe(true);
    });
    act(() => {
      result.current.onStart();
    });
    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("initial");
      expect(result.current.state.adapterError).toBe(false);
    });
    expect(result.current.statusText).not.toBe("case2文件服务器连接异常");
    expect(result.current.startEnabled).toBe(true);
  });

  it("Reset 遇 CONTROL_BUSY：回 completed，不进 adapterError", async () => {
    let started = false;
    let pollCount = 0;
    const api: Case2Api = {
      async getControl() {
        if (!started) {
          return control({ command: "init", status: "", dt_type: "" });
        }
        pollCount += 1;
        if (pollCount === 1) {
          return control({ command: "start", status: "execute success" });
        }
        return control({ command: "start", status: "case complete" });
      },
      async getDataFiles() {
        return metrics();
      },
      async postControl(payload) {
        if ("command" in payload && payload.command === "start") {
          started = true;
          return control({ command: "start", status: "" });
        }
        if ("command" in payload && payload.command === "reinit") {
          throw new Case2ApiError("CONTROL_BUSY", "busy", 409);
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
      expect(result.current.resetEnabled).toBe(true);
    });

    act(() => {
      result.current.onReset();
    });
    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("completed");
      expect(result.current.state.adapterError).toBe(false);
    });
    expect(result.current.statusText).not.toBe("case2文件服务器连接异常");
    expect(result.current.state.calibratedData).not.toBeNull();
    expect(result.current.resetEnabled).toBe(true);
  });

  it("重置完成后的 init 收尾跳过二次磁盘恢复", async () => {
    let started = false;
    let resetting = false;
    let startPoll = 0;
    let resetPoll = 0;
    const initPayloads: Array<{ command: "init"; restore_calibrated?: false }> = [];
    const api: Case2Api = {
      async getControl() {
        if (!started) return control({ command: "init", status: "", dt_type: "" });
        if (resetting) {
          resetPoll += 1;
          return control({
            command: "reinit",
            status: resetPoll === 1 ? "execute success" : "reinit complete",
            dt_type: "",
          });
        }
        startPoll += 1;
        return control({
          command: "start",
          status: startPoll === 1 ? "execute success" : "case complete",
        });
      },
      async getDataFiles() {
        return metrics();
      },
      async postControl(payload) {
        if ("command" in payload && payload.command === "init") {
          initPayloads.push(payload);
          return control({ command: "init", status: "", dt_type: "" });
        }
        if ("command" in payload && payload.command === "start") {
          started = true;
          return control({ command: "start", status: "" });
        }
        if ("command" in payload && payload.command === "reinit") {
          resetting = true;
          resetPoll = 0;
          return control({ command: "reinit", status: "", dt_type: "" });
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
    act(() => result.current.onStart());
    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("completed");
      expect(result.current.state.lastControl?.command).toBe("init");
    });

    act(() => result.current.onReset());
    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("initial");
      expect(result.current.state.lastControl?.command).toBe("init");
    });
    expect(initPayloads).toEqual([
      { command: "init" },
      { command: "init", restore_calibrated: false },
      { command: "init", restore_calibrated: false },
    ]);
  });

  it("Reset 恢复基线失败时回滚到点击前相、保留对比并记录 console.error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let started = false;
    let pollCount = 0;
    const api: Case2Api = {
      async getControl() {
        if (!started) return control({ command: "init", status: "", dt_type: "" });
        pollCount += 1;
        return control({
          command: "start",
          status: pollCount === 1 ? "execute success" : "case complete",
        });
      },
      async getDataFiles() {
        return metrics();
      },
      async postControl(payload) {
        if ("command" in payload && payload.command === "start") {
          started = true;
          return control({ command: "start", status: "" });
        }
        if ("command" in payload && payload.command === "reinit") {
          throw new Case2ApiError(
            "CALIBRATED_RESTORE_FAILED",
            "failed to restore heatmap_cali_rss.txt: source missing",
            500,
          );
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
    act(() => result.current.onStart());
    await waitFor(() => expect(result.current.state.case2UiState).toBe("completed"));
    const calibratedBeforeReset = result.current.state.calibratedData;

    act(() => result.current.onReset());
    await waitFor(() => expect(result.current.state.adapterError).toBe(true));
    expect(result.current.state.case2UiState).toBe("completed");
    expect(result.current.state.calibratedData).toBe(calibratedBeforeReset);
    expect(errorSpy).toHaveBeenCalledWith(
      "[case2] command.reset_post_failed",
      expect.objectContaining({
        code: "CALIBRATED_RESTORE_FAILED",
        reason: expect.stringContaining("heatmap_cali_rss.txt"),
      }),
    );
  });

  it("Start POST 真连接失败仍进 adapterError", async () => {
    const api: Case2Api = {
      async getControl() {
        return control({ command: "init", status: "", dt_type: "" });
      },
      async getDataFiles() {
        return metrics();
      },
      async postControl(payload) {
        if ("command" in payload && payload.command === "start") {
          throw new TypeError("adapter down");
        }
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
      expect(result.current.startEnabled).toBe(true);
    });
    act(() => {
      result.current.onStart();
    });
    await waitFor(() => {
      expect(result.current.state.case2UiState).toBe("initial");
      expect(result.current.state.adapterError).toBe(true);
    });
    expect(result.current.statusText).toBe("case2文件服务器连接异常");
    expect(result.current.startEnabled).toBe(false);
  });
});
