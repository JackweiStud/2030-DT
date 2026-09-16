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
});
