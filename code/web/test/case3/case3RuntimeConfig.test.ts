/**
 * Case3 runtime config 解析测试。
 */
import { describe, expect, it } from "vitest";
import {
  Case3ConfigError,
  loadCase3RuntimeConfig,
} from "../../src/cases/case3/config/case3RuntimeConfig";

describe("case3RuntimeConfig", () => {
  it("缺省使用默认值", () => {
    const c = loadCase3RuntimeConfig({});
    expect(c.pollMs).toBe(500);
    expect(c.mapOriginX).toBe(905);
    expect(c.mapOriginY).toBe(445);
    expect(c.mapUnitsPerPx).toBe(0.11);
  });

  it("接受合法覆盖", () => {
    const c = loadCase3RuntimeConfig({
      VITE_CASE3_POLL_MS: "250",
      VITE_CASE3_MAP_ORIGIN_X: "100",
      VITE_CASE3_MAP_ORIGIN_Y: "200",
      VITE_CASE3_MAP_UNITS_PER_PX: "0.2",
    });
    expect(c.pollMs).toBe(250);
    expect(c.mapOriginX).toBe(100);
    expect(c.mapUnitsPerPx).toBe(0.2);
  });

  it("非法 poll 抛错", () => {
    expect(() =>
      loadCase3RuntimeConfig({ VITE_CASE3_POLL_MS: "0" }),
    ).toThrow(Case3ConfigError);
  });

  it("非法 units 抛错", () => {
    expect(() =>
      loadCase3RuntimeConfig({ VITE_CASE3_MAP_UNITS_PER_PX: "-1" }),
    ).toThrow(Case3ConfigError);
  });
});
