/**
 * Case3 V2 原图自然像素坐标映射。
 */

import { describe, expect, it } from "vitest";
import {
  CASE3V2_MAP_STAGE,
  formatBusinessCoordinateRows,
  isImagePointInNaturalBounds,
  mapImageLayerToCssTransform,
  mapStagePointToImagePoint,
  pinBoxFromImagePoint,
  projectBusinessToImage,
  projectImageToBusiness,
  sampleImagePolylineByDistance,
  ueBoxFromImagePoint,
} from "../../src/cases/case3-v2/mapProjectionV2";
import type { Case3RuntimeConfig } from "../../src/cases/case3/config/case3RuntimeConfig";
import type { BaseRoutePoint } from "../../src/cases/case3/types";

const config: Case3RuntimeConfig = {
  pollMs: 500,
  mapOriginX: 905,
  mapOriginY: 445,
  mapUnitsPerPx: 0.11,
  v2MapOriginX: 905,
  v2MapOriginY: 445,
  v2MapUnitsPerPx: 0.11,
  v2MapImageScale: 1,
  v2MapImageRotationDeg: 0,
  v2MapImageOffsetX: 0,
  v2MapImageOffsetY: 0,
  v2DebugShow: true,
};

function sampleLRoute(): BaseRoutePoint[] {
  const points: BaseRoutePoint[] = [];
  let no = 1;
  for (let y = 15; y >= 2; y -= 1) {
    points.push({ no, x: 1, y, z: 0 });
    no += 1;
  }
  for (let x = 2; x <= 18; x += 1) {
    points.push({ no, x, y: 2, z: 0 });
    no += 1;
  }
  return points;
}

describe("projectBusinessToImage", () => {
  it("保留固定 V2 舞台，但不再冻结底图裁切几何", () => {
    expect(CASE3V2_MAP_STAGE).toEqual({ width: 1920, height: 782, top: 60 });
  });

  it("按客户坐标约定映射到 site-2d.jpg 原图自然像素", () => {
    const start = projectBusinessToImage(1, 15, config);
    const turn = projectBusinessToImage(1, 2, config);
    const end = projectBusinessToImage(18, 2, config);

    expect(start.imageX).toBeCloseTo(1041.36);
    expect(start.imageY).toBeCloseTo(454.09);
    expect(turn.imageX).toBeCloseTo(923.18);
    expect(turn.imageY).toBeCloseTo(454.09);
    expect(end.imageX).toBeCloseTo(923.18);
    expect(end.imageY).toBeCloseTo(608.64);
  });

  it("site-2d.jpg 原图自然像素可反算为客户 UE 物理坐标", () => {
    expect(projectImageToBusiness({ imageX: 905, imageY: 445 }, config)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    const point = projectImageToBusiness({ imageX: 915, imageY: 465 }, config);
    expect(point.x).toBeCloseTo(2.2);
    expect(point.y).toBeCloseTo(1.1);
    expect(point.z).toBe(0);
  });

  it("撤销显示平移/旋转/缩放后得到原图自然像素点", () => {
    expect(
      mapStagePointToImagePoint(
        { stageX: 970, stageY: 494 },
        { w: 1920, h: 988 },
        { scale: 2, rotationDeg: 0, offsetX: 10, offsetY: -20 },
      ),
    ).toEqual({ imageX: 960, imageY: 504 });
  });

  it("按折线欧式距离等距采样 N 个点，包含首尾", () => {
    expect(
      sampleImagePolylineByDistance(
        [
          { imageX: 0, imageY: 0 },
          { imageX: 3, imageY: 4 },
        ],
        3,
      ),
    ).toEqual([
      { imageX: 0, imageY: 0 },
      { imageX: 1.5, imageY: 2 },
      { imageX: 3, imageY: 4 },
    ]);
  });

  it("格式化采样结果为 X,Y,Z 行文本", () => {
    expect(
      formatBusinessCoordinateRows([
        { x: 0, y: -0, z: 0 },
        { x: 1.234, y: 5.678, z: 0 },
      ]),
    ).toBe("0,0,0\n1.23,5.68,0");
  });

  it("动态 N 条 L 形路线全部落在当前 site-2d.jpg 原图范围", () => {
    const route = sampleLRoute();
    expect(route.length).toBeGreaterThan(20);
    const projected = route.map((p) => projectBusinessToImage(p.x, p.y, config));
    expect(projected).toHaveLength(route.length);
    for (const point of projected) {
      expect(Number.isFinite(point.imageX)).toBe(true);
      expect(Number.isFinite(point.imageY)).toBe(true);
      expect(isImagePointInNaturalBounds(point, 1920, 988)).toBe(true);
    }
  });

  it("点位以投影点为地面锚点", () => {
    const box = pinBoxFromImagePoint({ imageX: 1041.36, imageY: 454.09 });
    expect(box.left).toBeCloseTo(1023.86);
    expect(box.top).toBeCloseTo(412.09);
  });

  it("UE 以投影点为地面锚点", () => {
    const box = ueBoxFromImagePoint({ imageX: 1041.36, imageY: 454.09 });
    expect(box.left).toBeCloseTo(1023.36);
    expect(box.top).toBeCloseTo(416.09);
  });

  it("显示变换只作用于整体图层，不改变原图标定", () => {
    expect(
      mapImageLayerToCssTransform({
        offsetX: 10,
        offsetY: -20,
        rotationDeg: 3,
        scale: 1.2,
      }),
    ).toBe("translate(10px, -20px) rotate(3deg) scale(1.2)");
  });
});
