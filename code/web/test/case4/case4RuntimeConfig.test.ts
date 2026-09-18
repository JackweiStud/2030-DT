/**
 * Case4 Vite env 解析。
 */
import { describe, expect, it } from "vitest";
import {
  Case4ConfigError,
  loadCase4RuntimeConfig,
} from "../../src/cases/case4/config/case4RuntimeConfig";

describe("loadCase4RuntimeConfig", () => {
  it("缺省使用 916/608/0.11 与显示 2/(205,-670)", () => {
    const c = loadCase4RuntimeConfig({});
    expect(c.pollMs).toBe(500);
    expect(c.mapOriginX).toBe(916);
    expect(c.mapOriginY).toBe(608);
    expect(c.mapUnitsPerPx).toBe(0.11);
    expect(c.mapImageScale).toBe(2);
    expect(c.mapImageOffsetX).toBe(205);
    expect(c.mapImageOffsetY).toBe(-670);
    expect(c.mapDebugShow).toBe(true);
    expect(c.reflectionEnable).toBe(false);
    expect(c.bsXyz).toEqual({ x: 1, y: 5, z: 7 });
  });

  it("Vite 注入空字符串视为未配置，不抛错", () => {
    const c = loadCase4RuntimeConfig({
      CASE4_REFLECTION_ENABLE: "",
      CASE4_BS_XYZ: "",
    });
    expect(c.reflectionEnable).toBe(false);
    expect(c.bsXyz).toEqual({ x: 1, y: 5, z: 7 });
  });

  it("接受合法覆盖", () => {
    const c = loadCase4RuntimeConfig({
      VITE_CASE4_POLL_MS: "250",
      VITE_CASE4_MAP_ORIGIN_X: "900",
      VITE_CASE4_MAP_IMAGE_SCALE: "1.2",
    });
    expect(c.pollMs).toBe(250);
    expect(c.mapOriginX).toBe(900);
    expect(c.mapImageScale).toBe(1.2);
  });

  it("VITE_CASE4_MAP_DEBUG_SHOW 仅接受 0/1", () => {
    expect(
      loadCase4RuntimeConfig({ VITE_CASE4_MAP_DEBUG_SHOW: "0" }).mapDebugShow,
    ).toBe(false);
    expect(() =>
      loadCase4RuntimeConfig({ VITE_CASE4_MAP_DEBUG_SHOW: "true" }),
    ).toThrow(/VITE_CASE4_MAP_DEBUG_SHOW/);
  });

  it("非法值抛键名，不静默 fallback", () => {
    expect(() => loadCase4RuntimeConfig({ VITE_CASE4_POLL_MS: "0" })).toThrow(
      Case4ConfigError,
    );
    expect(() =>
      loadCase4RuntimeConfig({ VITE_CASE4_MAP_UNITS_PER_PX: "-1" }),
    ).toThrow(/VITE_CASE4_MAP_UNITS_PER_PX/);
    expect(() =>
      loadCase4RuntimeConfig({ VITE_CASE4_MAP_IMAGE_SCALE: "abc" }),
    ).toThrow(/VITE_CASE4_MAP_IMAGE_SCALE/);
  });

  it("开启 Reflection 时要求合法 BS，示例坐标仅作模拟", () => {
    const c = loadCase4RuntimeConfig({
      CASE4_REFLECTION_ENABLE: "true",
      CASE4_BS_XYZ: "(1.0,5.0,7.0)",
    });
    expect(c.reflectionEnable).toBe(true);
    expect(c.bsXyz).toEqual({ x: 1, y: 5, z: 7 });
    expect(() =>
      loadCase4RuntimeConfig({ CASE4_REFLECTION_ENABLE: "1" }),
    ).toThrow(/CASE4_BS_XYZ/);
    expect(() =>
      loadCase4RuntimeConfig({
        CASE4_REFLECTION_ENABLE: "true",
        CASE4_BS_XYZ: "1,65535,7",
      }),
    ).toThrow(/CASE4_BS_XYZ/);
  });
});
