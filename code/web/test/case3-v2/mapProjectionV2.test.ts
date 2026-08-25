/**
 * Case3 V2 舞台仿射投影。
 */

import { describe, expect, it } from "vitest";
import {
  CASE3V2_MAP_IMAGE_CROP,
  CASE3V2_MAP_STAGE,
  isStagePointInMapView,
  pinBoxFromStagePoint,
  projectBusinessToStage,
  ueBoxFromStagePoint,
} from "../../src/cases/case3-v2/mapProjectionV2";
import type { BaseRoutePoint } from "../../src/cases/case3/types";

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

describe("projectBusinessToStage", () => {
  it("冻结舞台与底图裁切几何", () => {
    expect(CASE3V2_MAP_STAGE).toEqual({ width: 1920, height: 782, top: 60 });
    expect(CASE3V2_MAP_IMAGE_CROP).toEqual({
      left: -447,
      top: -874,
      width: 3466,
      height: 1783,
    });
  });
  it("校准起点、转折点、终点", () => {
    const start = projectBusinessToStage(1, 15);
    const turn = projectBusinessToStage(1, 2);
    const end = projectBusinessToStage(18, 2);
    expect(start.stageX).toBeCloseTo(669);
    expect(start.stageY).toBeCloseTo(463);
    expect(turn.stageX).toBeCloseTo(1195);
    expect(turn.stageY).toBeCloseTo(292);
    expect(end.stageX).toBeCloseTo(1448);
    expect(end.stageY).toBeCloseTo(465);
  });

  it("动态 N 条 L 形路线全部落在舞台可视范围", () => {
    const route = sampleLRoute();
    expect(route.length).toBeGreaterThan(20);
    const projected = route.map((p) => projectBusinessToStage(p.x, p.y));
    expect(projected).toHaveLength(route.length);
    for (const point of projected) {
      expect(Number.isFinite(point.stageX)).toBe(true);
      expect(Number.isFinite(point.stageY)).toBe(true);
      expect(isStagePointInMapView(point)).toBe(true);
    }
    expect(projected[0]?.stageX).toBeGreaterThan(0);
    expect(projected[0]?.stageX).toBeLessThan(CASE3V2_MAP_STAGE.width);
    expect(projected.at(-1)?.stageY).toBeLessThan(CASE3V2_MAP_STAGE.height);
  });

  it("点位以投影点为地面锚点", () => {
    const box = pinBoxFromStagePoint({ stageX: 669, stageY: 463 });
    expect(box.left).toBeCloseTo(651.5);
    expect(box.top).toBeCloseTo(421);
  });

  it("UE 以投影点为地面锚点", () => {
    const box = ueBoxFromStagePoint({ stageX: 669, stageY: 463 });
    expect(box.left).toBeCloseTo(651);
    expect(box.top).toBeCloseTo(425);
  });
});
