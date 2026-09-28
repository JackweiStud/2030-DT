import { describe, expect, it } from "vitest";
import { businessToModel, formatThreeEnv, loadCase3ThreeConfig } from "../../src/cases/case3/config/case3ThreeConfig";
describe("case3 independent 3D coordinates/config", () => {
  it("preserves metre distances and maps business Z up to model Y up", () => {
    expect(businessToModel({ x: 10, y: 20, z: 1.5 })).toEqual([10, 1.5, -20]);
    const a = businessToModel({ x: -4, y: 3, z: 12 });
    expect(Math.hypot(...a)).toBe(13);
  });
  it("isolates invalid 3D settings from the 2D configuration", () => {
    for (const env of [{ VITE_CASE3_3D_CAMERA_POSITION: "1,2,3" }, { VITE_CASE3_3D_CAMERA_ZOOM: "0" }, { VITE_CASE3_3D_DEBUG_INFO: "yes" }]) expect(loadCase3ThreeConfig(env).error).toBeTruthy();
    expect(loadCase3ThreeConfig({}).error).toBeUndefined();
  });
  it("roundtrips a user camera including pan and distance zoom without case1 parameters", () => {
    const config = loadCase3ThreeConfig({ VITE_CASE3_3D_DEBUG_INFO: "1" });
    const text = formatThreeEnv(config, [10.123456789, 20, -30], [4, 5, 6], 1.2);
    const env = Object.fromEntries(text.split("\n").map(s => s.split("=")));
    const result = loadCase3ThreeConfig(env);
    expect(result.position).toEqual([10.123456789, 20, -30]);
    expect(result.target).toEqual([4, 5, 6]); expect(result.zoom).toBe(1.2); expect(result.debug).toBe(true);
    expect(result.background).toBe("#202832");
    expect(text).toContain('VITE_CASE3_3D_BACKGROUND_COLOR="#202832"');
    expect(text).not.toContain("CASE1");
  });
  it("reads the 3D background colour from env and falls back to #202832", () => {
    expect(loadCase3ThreeConfig({}).background).toBe("#202832");
    expect(loadCase3ThreeConfig({ VITE_CASE3_3D_BACKGROUND_COLOR: "#FFFFFF" }).background).toBe("#ffffff");
    expect(loadCase3ThreeConfig({ VITE_CASE3_3D_BACKGROUND_COLOR: '"#87CEEB"' }).background).toBe("#87ceeb");
    expect(loadCase3ThreeConfig({ VITE_CASE3_3D_BACKGROUND_COLOR: "'#87CEEB'" }).background).toBe("#87ceeb");
    for (const bad of ["white", "#fff", "202832", "#20283"]) {
      const c = loadCase3ThreeConfig({ VITE_CASE3_3D_BACKGROUND_COLOR: bad });
      expect(c.background).toBe("#202832"); expect(c.error).toBeUndefined();
    }
    expect(loadCase3ThreeConfig({ VITE_CASE3_3D_BACKGROUND_COLOR: "#112233", VITE_CASE3_3D_CAMERA_ZOOM: "0" }).background).toBe("#112233");
  });
});
