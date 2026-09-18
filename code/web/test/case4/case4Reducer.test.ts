/**
 * Case4 reducer 与按钮矩阵。
 */
import { describe, expect, it } from "vitest";
import {
  canReinit,
  canStart,
  case4Reducer,
  createInitialCase4State,
  isRoundBusy,
} from "../../src/cases/case4/state/case4Reducer";
import { liveTrajectory, sampleBaseRoute, sampleResult } from "./fixtures";

function ready() {
  return case4Reducer(createInitialCase4State(), {
    type: "INIT_READY",
    baseRoute: sampleBaseRoute(),
  });
}

describe("case4Reducer 按钮", () => {
  it("就绪后可 Start，不可 ReInit", () => {
    const s = ready();
    expect(canStart(s)).toBe(true);
    expect(canReinit(s)).toBe(false);
    expect(isRoundBusy(s)).toBe(false);
  });

  it("Start 后 busy，双按钮禁用", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    expect(s.ui).toBe("running");
    expect(isRoundBusy(s)).toBe(true);
    expect(canStart(s)).toBe(false);
    expect(canReinit(s)).toBe(false);
  });

  it("completed 且仍 busy 时不可重置", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    const result = sampleResult();
    s = case4Reducer(s, {
      type: "RESULT_SUBMITTED",
      ...result,
    });
    expect(s.ui).toBe("completed");
    expect(isRoundBusy(s)).toBe(true);
    expect(canReinit(s)).toBe(false);
    s = case4Reducer(s, { type: "ROUND_CLOSE_COMPLETE", ui: "completed" });
    expect(isRoundBusy(s)).toBe(false);
    expect(canReinit(s)).toBe(true);
    expect(canStart(s)).toBe(false);
  });

  it("RESULT_EXHAUSTED 保持 activeAction，直到 ROUND_CLOSE", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "RESULT_EXHAUSTED" });
    expect(s.ui).toBe("failed-start");
    expect(s.liveReadHint).toBe("result-exhausted");
    expect(s.activeAction).not.toBeNull();
    expect(canStart(s)).toBe(false);
    s = case4Reducer(s, { type: "ROUND_CLOSE_COMPLETE", ui: "failed-start" });
    expect(canStart(s)).toBe(true);
  });

  it("execute fail 后 Start 可再点；ReInit fail 只能再重置", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "EXECUTE_FAIL" });
    expect(s.ui).toBe("failed-start");
    expect(canStart(s)).toBe(true);
    expect(canReinit(s)).toBe(false);

    s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "reinit", generation: 2 });
    s = case4Reducer(s, { type: "EXECUTE_FAIL" });
    expect(s.ui).toBe("failed-reinit");
    expect(canStart(s)).toBe(false);
    expect(canReinit(s)).toBe(true);
  });

  it("adapterError 禁用业务按钮", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ADAPTER_ERROR", value: true });
    expect(canStart(s)).toBe(false);
    expect(canReinit(s)).toBe(false);
  });

  it("init 数据异常不可开始", () => {
    let s = createInitialCase4State();
    s = case4Reducer(s, { type: "INIT_ERROR" });
    expect(canStart(s)).toBe(false);
  });

  it("live 前缀缩短时保留已展示点", () => {
    let s = ready();
    s = case4Reducer(s, {
      type: "LIVE_TRAJECTORY",
      snapshot: liveTrajectory(3),
    });
    s = case4Reducer(s, {
      type: "LIVE_TRAJECTORY",
      snapshot: liveTrajectory(1),
    });
    expect(s.liveTrajectory?.completeCount).toBe(3);
    expect(s.liveReadHint).toBe("轨迹暂时不可读，保留上次结果");
  });
});
