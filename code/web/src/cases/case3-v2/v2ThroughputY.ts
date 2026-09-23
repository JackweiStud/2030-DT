/**
 * Case3 V2 吞吐图 Y 轴：与 case4 共用 shared/throughputAxis。
 * 不改 case3（非 v2）共享 metrics，避免牵动旧 ThroughputChart。
 */

import {
  THRP_Y_IDLE,
  formatThroughputYTick,
  resolveThroughputYMax,
  throughputYTicks,
} from "../shared/throughputAxis";

export const CASE3V2_THRP_Y_IDLE = THRP_Y_IDLE;

export const niceCeilThroughputV2 = resolveThroughputYMax;
export const throughputYTicksV2 = throughputYTicks;
export const formatThrYTick = formatThroughputYTick;
