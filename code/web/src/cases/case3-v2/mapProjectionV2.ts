/**
 * Case3 V2 2D 地图坐标映射。
 *
 * 客户物理世界坐标约定：UE(x,y,z) 中 x 指向图片向下，y 指向图片向右，
 * z 不参与 2D 平面定位。origin/units 始终相对 site-2d.jpg 原图
 * naturalWidth/naturalHeight 像素坐标；显示 scale/rotation/offset 只作用于
 * “底图 + 路线 + 点位 + UE”整体图层，不改写原图标定语义。
 */

import type { Case3RuntimeConfig } from "../case3/config/case3RuntimeConfig";

export const CASE3V2_MAP_STAGE = {
  width: 1920,
  height: 782,
  top: 60,
} as const;

export const CASE3V2_PIN_SIZE = {
  width: 35,
  height: 42,
} as const;

export const CASE3V2_UE_SIZE = {
  width: 36,
  height: 38,
} as const;

export type Case3V2ImagePoint = {
  imageX: number;
  imageY: number;
};

export type Case3V2MapImageTransform = {
  scale: number;
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
};

export function mapImageTransformFromConfig(
  config: Pick<
    Case3RuntimeConfig,
    | "v2MapImageOffsetX"
    | "v2MapImageOffsetY"
    | "v2MapImageRotationDeg"
    | "v2MapImageScale"
  >,
): Case3V2MapImageTransform {
  return {
    scale: config.v2MapImageScale,
    rotationDeg: config.v2MapImageRotationDeg,
    offsetX: config.v2MapImageOffsetX,
    offsetY: config.v2MapImageOffsetY,
  };
}

/**
 * 业务坐标 -> site-2d.jpg 原图自然像素坐标。
 */
export function projectBusinessToImage(
  x: number,
  y: number,
  config: Pick<
    Case3RuntimeConfig,
    "v2MapOriginX" | "v2MapOriginY" | "v2MapUnitsPerPx"
  >,
): Case3V2ImagePoint {
  return {
    imageX: config.v2MapOriginX + y / config.v2MapUnitsPerPx,
    imageY: config.v2MapOriginY + x / config.v2MapUnitsPerPx,
  };
}

export function mapImageLayerToCssTransform(
  transform: Case3V2MapImageTransform,
): string {
  return `translate(${transform.offsetX}px, ${transform.offsetY}px) rotate(${transform.rotationDeg}deg) scale(${transform.scale})`;
}

export function formatCase3V2MapEnv(
  transform: Case3V2MapImageTransform,
): string {
  return [
    `VITE_CASE3_V2_MAP_IMAGE_SCALE=${formatEnvNumber(transform.scale, 4)}`,
    `VITE_CASE3_V2_MAP_IMAGE_ROTATION_DEG=${formatEnvNumber(transform.rotationDeg, 2)}`,
    `VITE_CASE3_V2_MAP_IMAGE_OFFSET_X=${formatEnvNumber(transform.offsetX, 1)}`,
    `VITE_CASE3_V2_MAP_IMAGE_OFFSET_Y=${formatEnvNumber(transform.offsetY, 1)}`,
  ].join("\n");
}

function formatEnvNumber(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function groundBoxFromImagePoint(
  point: Case3V2ImagePoint,
  size: { width: number; height: number },
): { left: number; top: number } {
  return {
    left: point.imageX - size.width / 2,
    top: point.imageY - size.height,
  };
}

/** 点位图标以投影点为地面锚点（底边中心）。 */
export function pinBoxFromImagePoint(point: Case3V2ImagePoint): {
  left: number;
  top: number;
} {
  return groundBoxFromImagePoint(point, CASE3V2_PIN_SIZE);
}

/** UE 图标以投影点为地面锚点（底边中心）。 */
export function ueBoxFromImagePoint(point: Case3V2ImagePoint): {
  left: number;
  top: number;
} {
  return groundBoxFromImagePoint(point, CASE3V2_UE_SIZE);
}

/** 投影点是否落在 site-2d.jpg 原图自然像素范围内。 */
export function isImagePointInNaturalBounds(
  point: Case3V2ImagePoint,
  naturalWidth: number,
  naturalHeight: number,
): boolean {
  return (
    point.imageX >= 0 &&
    point.imageX <= naturalWidth &&
    point.imageY >= 0 &&
    point.imageY <= naturalHeight
  );
}
