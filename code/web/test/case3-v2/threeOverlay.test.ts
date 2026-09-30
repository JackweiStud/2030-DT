import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { createThreeOverlay } from "../../src/cases/case3-v2/components/map/threeOverlay";
import { loadCase3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";

beforeEach(() => {
  // getContext 有多个重载，vi.spyOn 取最后一个（webgpu），故用 never 让 2D 上下文桩通过类型检查。
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ scale() {}, drawImage() {}, fillText() {}, strokeText() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, fill() {}, stroke() {} } as unknown as never);
});
afterEach(() => vi.restoreAllMocks());
function fixture(running = false) {
  const image = new Image(); Object.defineProperties(image, { naturalWidth: { value: 70 }, naturalHeight: { value: 83 } });
  return createThreeOverlay({
    config: { ...loadCase3RuntimeConfig({}), reflectionEnable: true, bsXyz: { x: 20, y: 10, z: 3 } },
    baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }, { no: 2, x: 10, y: 0, z: 0 }],
    points: [], currentPoint: { no: 1, ue: { x: 0, y: 0, z: 0 }, selectedBeamId: 10, reflection: { x: 10, y: 5, z: 2, los: false } },
    reflectionVisible: true, reflectionPlayback: running ? "running" : "static",
  }, { idle: image, lit: image, ue: image });
}
describe("3D artwork matches 2D without changing business anchors", () => {
  it("keeps a numbered pin 35×30 logical pixels across camera distances", () => {
    const overlay = fixture(); const pin = overlay.group.children.find(n => n instanceof T.Sprite) as T.Sprite;
    const camera = new T.PerspectiveCamera(40, 1920 / 590, .05, 10000);
    for (const distance of [50, 200]) {
      camera.position.set(0, 0, distance); camera.lookAt(0, 0, 0); overlay.update(camera, 1920, 590, 0);
      const projectedHeight = pin.scale.y / distance / Math.tan(T.MathUtils.degToRad(20)) * 590 / 2;
      expect(projectedHeight).toBeCloseTo(30); expect(pin.scale.x / pin.scale.y).toBeCloseTo(35 / 30);
      expect(pin.position.toArray()).toEqual([0, 0, -0]);
    }
  });
  it("uses 14/9 pixel route strokes and anchors the wave to UE and BS", () => {
    const overlay = fixture(); const lines = overlay.group.children.filter(n => n instanceof Line2) as Line2[];
    expect(lines.slice(0, 2).map(l => l.material.linewidth)).toEqual([14, 9]);
    const camera = new T.PerspectiveCamera(40, 1920 / 590, .05, 10000); camera.position.set(50, 50, 50); camera.lookAt(0, 0, 0);
    overlay.update(camera, 1920, 590, 0);
    const wave = lines.find(l => l.renderOrder === 9)!;
    const start = wave.geometry.getAttribute("instanceStart"), end = wave.geometry.getAttribute("instanceEnd");
    expect([start.getX(0), start.getY(0), start.getZ(0)]).toEqual([20, 3, -10]);
    expect([end.getX(end.count-1), end.getY(end.count-1), end.getZ(end.count-1)]).toEqual([0, 0, 0]);
  });
  it("prefers bsXyz3d over bsXyz for 3D Reflection BS", () => {
    const image = new Image(); Object.defineProperties(image, { naturalWidth: { value: 70 }, naturalHeight: { value: 83 } });
    const overlay = createThreeOverlay({
      config: {
        ...loadCase3RuntimeConfig({}),
        reflectionEnable: true,
        bsXyz: { x: 20, y: 10, z: 3 },
        bsXyz3d: { x: -2, y: -29, z: 25 },
      },
      baseRoute: [{ no: 1, x: 0, y: 0, z: 0 }],
      points: [],
      currentPoint: {
        no: 1,
        ue: { x: 0, y: 0, z: 0 },
        selectedBeamId: 10,
        reflection: { x: 10, y: 5, z: 2, los: true },
      },
      reflectionVisible: true,
      reflectionPlayback: "static",
    }, { idle: image, lit: image, ue: image });
    const camera = new T.PerspectiveCamera(40, 1920 / 590, .05, 10000);
    camera.position.set(50, 50, 50); camera.lookAt(0, 0, 0);
    overlay.update(camera, 1920, 590, 0);
    const wave = (overlay.group.children.filter(n => n instanceof Line2) as Line2[]).find(l => l.renderOrder === 9)!;
    const start = wave.geometry.getAttribute("instanceStart");
    // business (-2,-29,25) -> model (-2, 25, 29)
    expect([start.getX(0), start.getY(0), start.getZ(0)]).toEqual([-2, 25, 29]);
  });
  it("runs a white dash only in running mode and handles points behind the camera", () => {
    expect(fixture().animated).toBe(false);
    const overlay = fixture(true); expect(overlay.animated).toBe(true);
    const camera = new T.PerspectiveCamera(40, 1920 / 590, .05, 10000); camera.position.set(0, 0, -1); camera.lookAt(0,0,-10);
    overlay.update(camera, 1920, 590, 300);
    for (const node of overlay.group.children) if (node instanceof Line2) {
      const points = node.geometry.getAttribute("instanceStart");
      for (let i=0;i<points.count;i++) expect([points.getX(i),points.getY(i),points.getZ(i)].every(Number.isFinite)).toBe(true);
    }
  });
});
