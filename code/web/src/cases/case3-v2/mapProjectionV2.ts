/**
 * Case3 V2 专属纯仿射投影：业务坐标 -> 地图舞台坐标。
 * 不修改旧 Case3 RuntimeConfig / mapProjection。
 */

export const CASE3V2_MAP_STAGE = {
  width: 1920,
  height: 782,
  top: 60,
} as const;

export const CASE3V2_MAP_IMAGE_CROP = {
  left: -447,
  top: -874,
  width: 3466,
  height: 1783,
} as const;

/** 预置路线起点：业务 (x=1, y=15) -> 舞台 (669, 463)。 */
export const CASE3V2_MAP_ANCHOR_START = {
  business: { x: 1, y: 15 },
  stage: { x: 669, y: 463 },
} as const;

/** y 从 15 降到 2 对应舞台 (+526, -171)。 */
export const CASE3V2_MAP_Y_BASIS = {
  businessDeltaY: 2 - 15,
  stageDelta: { x: 526, y: -171 },
} as const;

/** x 从 1 增到 18 对应舞台 (+253, +173)。 */
export const CASE3V2_MAP_X_BASIS = {
  businessDeltaX: 18 - 1,
  stageDelta: { x: 253, y: 173 },
} as const;

export const CASE3V2_PIN_SIZE = {
  width: 35,
  height: 42,
} as const;

export const CASE3V2_UE_SIZE = {
  width: 36,
  height: 38,
} as const;

export type Case3V2StagePoint = {
  stageX: number;
  stageY: number;
};

/**
 * 将业务 (x, y) 映射为 MapStage 舞台像素。
 */
export function projectBusinessToStage(
  x: number,
  y: number,
): Case3V2StagePoint {
  const start = CASE3V2_MAP_ANCHOR_START;
  const tX =
    (x - start.business.x) / CASE3V2_MAP_X_BASIS.businessDeltaX;
  const tY =
    (y - start.business.y) / CASE3V2_MAP_Y_BASIS.businessDeltaY;
  return {
    stageX:
      start.stage.x +
      tX * CASE3V2_MAP_X_BASIS.stageDelta.x +
      tY * CASE3V2_MAP_Y_BASIS.stageDelta.x,
    stageY:
      start.stage.y +
      tX * CASE3V2_MAP_X_BASIS.stageDelta.y +
      tY * CASE3V2_MAP_Y_BASIS.stageDelta.y,
  };
}

function groundBoxFromStagePoint(
  point: Case3V2StagePoint,
  size: { width: number; height: number },
): { left: number; top: number } {
  return {
    left: point.stageX - size.width / 2,
    top: point.stageY - size.height,
  };
}

/** 点位图标以投影点为地面锚点（底边中心）。 */
export function pinBoxFromStagePoint(point: Case3V2StagePoint): {
  left: number;
  top: number;
} {
  return groundBoxFromStagePoint(point, CASE3V2_PIN_SIZE);
}

/** UE 图标以投影点为地面锚点（底边中心）。 */
export function ueBoxFromStagePoint(point: Case3V2StagePoint): {
  left: number;
  top: number;
} {
  return groundBoxFromStagePoint(point, CASE3V2_UE_SIZE);
}

/** 投影点是否落在 V2 地图舞台可视范围内。 */
export function isStagePointInMapView(point: Case3V2StagePoint): boolean {
  return (
    point.stageX >= 0 &&
    point.stageX <= CASE3V2_MAP_STAGE.width &&
    point.stageY >= 0 &&
    point.stageY <= CASE3V2_MAP_STAGE.height
  );
}
