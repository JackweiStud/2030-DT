/**
 * Case3 V2 吞吐 Y 轴：与 case4 同机制。
 */

import { describe, expect, it } from "vitest";
import {
  CASE3V2_THRP_Y_IDLE,
  formatThrYTick,
  niceCeilThroughputV2,
  throughputYTicksV2,
} from "../../src/cases/case3-v2/v2ThroughputY";

describe("niceCeilThroughputV2 / resolveThroughputYMax", () => {
  it("空 / 常态峰值锁 3.2", () => {
    expect(niceCeilThroughputV2(0)).toBe(CASE3V2_THRP_Y_IDLE);
    expect(niceCeilThroughputV2(2.5)).toBe(3.2);
    expect(niceCeilThroughputV2(2.72)).toBe(3.2);
  });

  it("超 85% 阶梯抬轴并对齐到 step 0.1 整数倍", () => {
    expect(niceCeilThroughputV2(2.8)).toBe(4);
    expect(niceCeilThroughputV2(8.4)).toBe(11.2);
    expect(niceCeilThroughputV2(19)).toBe(24.8);
    expect(niceCeilThroughputV2(20)).toBe(24.8);
  });
});

describe("throughputYTicksV2", () => {
  it("空闲档 3.2…0，8 格", () => {
    expect(throughputYTicksV2(3.2)).toEqual([
      3.2, 2.8, 2.4, 2.0, 1.6, 1.2, 0.8, 0.4, 0,
    ]);
  });

  it("抬轴后仍 8 格，步长为 0.1 整数倍", () => {
    expect(throughputYTicksV2(4)).toEqual([
      4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0,
    ]);
    expect(throughputYTicksV2(24.8)).toEqual([
      24.8, 21.7, 18.6, 15.5, 12.4, 9.3, 6.2, 3.1, 0,
    ]);
  });
});

describe("formatThrYTick", () => {
  it("始终一位小数", () => {
    expect(formatThrYTick(3.2)).toBe("3.2");
    expect(formatThrYTick(0)).toBe("0.0");
    expect(formatThrYTick(1.5)).toBe("1.5");
  });
});
