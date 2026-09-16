/**
 * Case4 展示模型：从 reducer 派生按钮、锁、data-state 和画面数据。
 * 画面 completed ≠ 解锁：busy 看 activeAction。
 */

import {
  canReinit,
  canStart,
  isRoundBusy,
  type Case4State,
} from "../state/case4Reducer";
import type {
  BasePoint,
  Case4DataState,
  Case4UiState,
  Statistics,
  ThroughputSnapshot,
  TrajectorySnapshot,
} from "../types";

/** 控制列 `c4-ctrl-status`：异常场景统一短文案；详情走横幅。 */
export const CASE4_CTRL_ABNORMAL_STATUS = "异常请重试";

function isControlAbnormal(state: Case4State): boolean {
  if (state.adapterError) return true;
  return state.ui === "failed-start" || state.ui === "failed-reinit";
}

export type Case4Presentation = {
  ui: Case4UiState;
  dataState: Case4DataState;
  busy: boolean;
  navigationLocked: boolean;
  startEnabled: boolean;
  resetEnabled: boolean;
  statusText: string;
  banner: string | null;
  liveHint: string | null;
  baseRoute: BasePoint[];
  trajectory: TrajectorySnapshot | null;
  thrpWithout: ThroughputSnapshot | null;
  thrpWith: ThroughputSnapshot | null;
  statistics: Statistics | null;
};

function dataStateOf(ui: Case4UiState): Case4DataState {
  if (ui === "finalizing") return "running";
  return ui;
}

function statusText(state: Case4State): string {
  if (state.adapterError) return "适配异常";
  if (state.ui === "failed-start" && !state.activeAction && state.result === null) {
    if (state.initStatus === "ready") {
      // 可能是 execute fail 或耗尽；耗尽文案由 banner 区分，控制列：
    }
  }
  switch (state.ui) {
    case "initial":
      return "未开始";
    case "running":
    case "finalizing":
      return "测试中";
    case "completed":
      return "已完成";
    case "resetting":
      return "重置中";
    case "failed-start":
      return state.liveReadHint === "result-exhausted"
        ? "结果不完整已自动回退"
        : "执行命令失败";
    case "failed-reinit":
      return "执行命令失败";
    default:
      return "未开始";
  }
}

/**
 * 派生页面输入。
 */
export function selectCase4Presentation(state: Case4State): Case4Presentation {
  const busy = isRoundBusy(state);
  const exhausted =
    state.ui === "failed-start" && state.liveReadHint === "result-exhausted";
  let banner: string | null = null;
  if (state.adapterError) banner = "适配服务异常";
  else if (state.initStatus === "error") banner = "case4初始化数据异常";
  else if (exhausted) banner = "结果不完整已自动回退";
  else if (state.ui === "failed-start" || state.ui === "failed-reinit") {
    banner = "执行命令失败";
  }

  const useResult = state.ui === "completed" && state.result;
  const trajectory = useResult
    ? state.result!.trajectory
    : state.liveTrajectory;
  const thrpWithout = useResult
    ? state.result!.throughput.without
    : state.liveThrp.without;
  const thrpWith = useResult
    ? state.result!.throughput.with
    : state.liveThrp.with;

  let status = statusText(state);
  if (isControlAbnormal(state)) {
    status = CASE4_CTRL_ABNORMAL_STATUS;
  }

  return {
    ui: state.ui,
    dataState: dataStateOf(state.ui),
    busy,
    navigationLocked: busy,
    startEnabled: canStart(state),
    resetEnabled: canReinit(state),
    statusText: status,
    banner,
    liveHint: state.adapterError ? null : state.liveReadHint,
    baseRoute: state.baseRoute,
    trajectory,
    thrpWithout,
    thrpWith,
    statistics: useResult ? state.result!.statistics : null,
  };
}
