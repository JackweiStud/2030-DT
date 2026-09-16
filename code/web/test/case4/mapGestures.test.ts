/**
 * 地图手势：指针中心缩放、旋转/平移 clamp、Shell 非 1:1 逻辑位移。
 */
import { describe, expect, it } from "vitest";
import { clientDeltaToStageLogical } from "../../src/cases/case3/metrics/mapProjection";
import {
  dragPan,
  dragRotate,
  sameImageTransform,
  wheelZoomAtPointer,
} from "../../src/cases/case4/components/map/mapGestures";
import { CASE4_TEST_CONFIG } from "./fixtures";

const base = {
  scale: CASE4_TEST_CONFIG.mapImageScale,
  rotationDeg: CASE4_TEST_CONFIG.mapImageRotationDeg,
  offsetX: CASE4_TEST_CONFIG.mapImageOffsetX,
  offsetY: CASE4_TEST_CONFIG.mapImageOffsetY,
};

describe("mapGestures", () => {
  it("滚轮以指针为中心且 scale clamp 0.5～5", () => {
    let view = { ...base, scale: 1 };
    for (let i = 0; i < 40; i += 1) {
      view = wheelZoomAtPointer(view, 10, 20, true);
    }
    expect(view.scale).toBe(5);
    for (let i = 0; i < 40; i += 1) {
      view = wheelZoomAtPointer(view, 10, 20, false);
    }
    expect(view.scale).toBe(0.5);
  });

  it("左键旋转 clamp ±90°", () => {
    let view = { ...base, rotationDeg: 0 };
    view = dragRotate(view, 10_000, 1920);
    expect(Math.abs(view.rotationDeg)).toBeLessThanOrEqual(90);
  });

  it("右键平移改变 offset", () => {
    const next = dragPan(base, 12, -8);
    expect(next.offsetX).toBe(base.offsetX + 12);
    expect(next.offsetY).toBe(base.offsetY - 8);
  });

  it("clientDeltaToStageLogical 在非 1:1 缩放下换算", () => {
    expect(clientDeltaToStageLogical(960, 960)).toBe(1920);
  });

  it("复位比较的是 config baseView 而不是单位变换", () => {
    expect(sameImageTransform(base, { ...base })).toBe(true);
    expect(
      sameImageTransform(base, {
        scale: 1,
        rotationDeg: 0,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toBe(false);
  });
});
