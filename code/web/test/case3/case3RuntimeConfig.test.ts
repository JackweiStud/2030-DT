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
    expect(c.v2MapOriginX).toBe(905);
    expect(c.v2MapOriginY).toBe(445);
    expect(c.v2MapUnitsPerPx).toBe(0.11);
    expect(c.v2MapImageScale).toBe(1);
    expect(c.v2MapImageRotationDeg).toBe(0);
    expect(c.v2MapImageOffsetX).toBe(0);
    expect(c.v2MapImageOffsetY).toBe(0);
    expect(c.v2DebugShow).toBe(true);
  });

  it("接受合法覆盖", () => {
    const c = loadCase3RuntimeConfig({
      VITE_CASE3_POLL_MS: "250",
      VITE_CASE3_MAP_ORIGIN_X: "100",
      VITE_CASE3_MAP_ORIGIN_Y: "200",
      VITE_CASE3_MAP_UNITS_PER_PX: "0.2",
      VITE_CASE3_V2_MAP_ORIGIN_X: "300",
      VITE_CASE3_V2_MAP_ORIGIN_Y: "400",
      VITE_CASE3_V2_MAP_UNITS_PER_PX: "0.3",
      VITE_CASE3_V2_MAP_IMAGE_SCALE: "1.2",
      VITE_CASE3_V2_MAP_IMAGE_ROTATION_DEG: "-3",
      VITE_CASE3_V2_MAP_IMAGE_OFFSET_X: "20",
      VITE_CASE3_V2_MAP_IMAGE_OFFSET_Y: "-30",
      VITE_CASE3_V2_DEGUB_SHOW: "0",
    });
    expect(c.pollMs).toBe(250);
    expect(c.mapOriginX).toBe(100);
    expect(c.mapUnitsPerPx).toBe(0.2);
    expect(c.v2MapOriginX).toBe(300);
    expect(c.v2MapOriginY).toBe(400);
    expect(c.v2MapUnitsPerPx).toBe(0.3);
    expect(c.v2MapImageScale).toBe(1.2);
    expect(c.v2MapImageRotationDeg).toBe(-3);
    expect(c.v2MapImageOffsetX).toBe(20);
    expect(c.v2MapImageOffsetY).toBe(-30);
    expect(c.v2DebugShow).toBe(false);
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

  it("非法 v2 scale 抛错", () => {
    expect(() =>
      loadCase3RuntimeConfig({ VITE_CASE3_V2_MAP_IMAGE_SCALE: "0" }),
    ).toThrow(Case3ConfigError);
  });

  it("非法 v2 debug show 抛错", () => {
    expect(() =>
      loadCase3RuntimeConfig({ VITE_CASE3_V2_DEGUB_SHOW: "true" }),
    ).toThrow(Case3ConfigError);
  });
});
