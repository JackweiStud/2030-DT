/**
 * Case4 展示派生：文案、data-state、completed≠解锁。
 */
import { describe, expect, it } from "vitest";
import { selectCase4Presentation } from "../../src/cases/case4/presentation/selectCase4Presentation";
import {
  case4Reducer,
  createInitialCase4State,
} from "../../src/cases/case4/state/case4Reducer";
import { sampleBaseRoute, sampleResult } from "./fixtures";

function ready() {
  return case4Reducer(createInitialCase4State(), {
    type: "INIT_READY",
    baseRoute: sampleBaseRoute(),
  });
}

describe("selectCase4Presentation", () => {
  it("initial 文案未开始，NLOS 空", () => {
    const view = selectCase4Presentation(ready());
    expect(view.dataState).toBe("initial");
    expect(view.statusText).toBe("未开始");
    expect(view.banner).toBeNull();
    expect(view.statistics).toBeNull();
    expect(view.startEnabled).toBe(true);
  });

  it("finalizing 的 data-state 仍是 running", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "ENTER_FINALIZING" });
    const view = selectCase4Presentation(s);
    expect(view.ui).toBe("finalizing");
    expect(view.dataState).toBe("running");
    expect(view.statusText).toBe("测试中");
    expect(view.busy).toBe(true);
    expect(view.statistics).toBeNull();
  });

  it("resetting 文案为重置中且 busy", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "reinit", generation: 1 });
    const view = selectCase4Presentation(s);
    expect(view.dataState).toBe("resetting");
    expect(view.statusText).toBe("重置中");
    expect(view.busy).toBe(true);
  });

  it("completed 展示统计但仍 busy 时重置禁用", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "RESULT_SUBMITTED", ...sampleResult() });
    const view = selectCase4Presentation(s);
    expect(view.dataState).toBe("completed");
    expect(view.statusText).toBe("已完成");
    expect(view.statistics?.nlosRatio).toBe(0.897);
    expect(view.busy).toBe(true);
    expect(view.resetEnabled).toBe(false);
  });

  it("result 耗尽：控制列异常请重试，横幅保留详情", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ACTION_BEGIN", kind: "start", generation: 1 });
    s = case4Reducer(s, { type: "RESULT_EXHAUSTED" });
    const view = selectCase4Presentation(s);
    expect(view.statusText).toBe("异常请重试");
    expect(view.banner).toBe("结果不完整已自动回退");
  });

  it("adapterError：控制列异常请重试，横幅保留详情", () => {
    let s = ready();
    s = case4Reducer(s, { type: "ADAPTER_ERROR", value: true });
    const view = selectCase4Presentation(s);
    expect(view.statusText).toBe("异常请重试");
    expect(view.banner).toBe("适配服务异常");
  });
});
