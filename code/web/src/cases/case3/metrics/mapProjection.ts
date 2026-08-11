/**
 * Case3 2D 地图坐标映射与视图变换纯函数。
 * 业务坐标 (x,y) 到地图像素时交换轴；标定来自 runtime config，禁止写死默认值。
 */

import {
  CASE3_MAP_ROTATION_MAX_DEG,
  CASE3_MAP_SCALE_MAX,
  CASE3_MAP_SCALE_MIN,
  CASE3_MAP_ZOOM_STEP,
  type Case3RuntimeConfig,
} from "../config/case3RuntimeConfig";

export type MapView = {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

export const IDENTITY_MAP_VIEW: MapView = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
};

/**
 * 文件坐标 → 地图原图像素。
 * mapPixelX = ORIGIN_X + y / UNITS；mapPixelY = ORIGIN_Y + x / UNITS。
 */
export function projectPointToMap2D(
  x: number,
  y: number,
  config: Pick<
    Case3RuntimeConfig,
    "mapOriginX" | "mapOriginY" | "mapUnitsPerPx"
  >,
): { mapPixelX: number; mapPixelY: number } {
  return {
    mapPixelX: config.mapOriginX + y / config.mapUnitsPerPx,
    mapPixelY: config.mapOriginY + x / config.mapUnitsPerPx,
  };
}

/** 校验标定原点落在已解码地图范围内。 */
export function assertMapCalibrationInBounds(
  config: Pick<Case3RuntimeConfig, "mapOriginX" | "mapOriginY">,
  naturalWidth: number,
  naturalHeight: number,
): void {
  const { mapOriginX, mapOriginY } = config;
  if (
    !(
      Number.isFinite(naturalWidth) &&
      Number.isFinite(naturalHeight) &&
      naturalWidth > 0 &&
      naturalHeight > 0 &&
      mapOriginX >= 0 &&
      mapOriginY >= 0 &&
      mapOriginX <= naturalWidth &&
      mapOriginY <= naturalHeight
    )
  ) {
    throw new Error(
      `map calibration (${mapOriginX},${mapOriginY}) out of image ${naturalWidth}x${naturalHeight}`,
    );
  }
}

export function clampMapScale(scale: number): number {
  return Math.min(CASE3_MAP_SCALE_MAX, Math.max(CASE3_MAP_SCALE_MIN, scale));
}

export function clampMapRotation(deg: number): number {
  return Math.min(
    CASE3_MAP_ROTATION_MAX_DEG,
    Math.max(-CASE3_MAP_ROTATION_MAX_DEG, deg),
  );
}

/**
 * 以指针为中心缩放：先算新 scale，再修正 offset，使指针下地图点不动。
 * pointerX/Y 须为相对变换原点（center）的逻辑像素，与 Case2 热力图一致；
 * 调用方在 transform-origin:center 下应传入 (localX - w/2, localY - h/2)。
 */
export function zoomMapViewAtPointer(
  view: MapView,
  pointerX: number,
  pointerY: number,
  zoomIn: boolean,
): MapView {
  const factor = zoomIn ? CASE3_MAP_ZOOM_STEP : 1 / CASE3_MAP_ZOOM_STEP;
  const nextScale = clampMapScale(view.scale * factor);
  if (nextScale === view.scale) return view;
  const ratio = nextScale / view.scale;
  return {
    scale: nextScale,
    rotation: view.rotation,
    offsetX: pointerX - (pointerX - view.offsetX) * ratio,
    offsetY: pointerY - (pointerY - view.offsetY) * ratio,
  };
}

/**
 * 左键水平拖动转角度：拖过 stageWidth 对应约 90°。
 */
export function rotateMapViewByDrag(
  view: MapView,
  deltaXLogical: number,
  stageWidth: number,
): MapView {
  if (!(stageWidth > 0)) return view;
  const deltaDeg = (deltaXLogical / stageWidth) * CASE3_MAP_ROTATION_MAX_DEG;
  return {
    ...view,
    rotation: clampMapRotation(view.rotation + deltaDeg),
  };
}

/** 右键平移（逻辑像素）。 */
export function panMapView(view: MapView, dx: number, dy: number): MapView {
  return {
    ...view,
    offsetX: view.offsetX + dx,
    offsetY: view.offsetY + dy,
  };
}

/**
 * 将浏览器 client delta 换算回 1920 舞台逻辑像素。
 * shellScaleApprox = getBoundingClientRect().width / 1920。
 */
export function clientDeltaToStageLogical(
  clientDelta: number,
  stageCssWidth: number,
  stageLogicalWidth = 1920,
): number {
  if (!(stageCssWidth > 0)) return clientDelta;
  return clientDelta / (stageCssWidth / stageLogicalWidth);
}

/** CSS transform：translate → rotate → scale。 */
export function mapViewToCssTransform(view: MapView): string {
  return `translate(${view.offsetX}px, ${view.offsetY}px) rotate(${view.rotation}deg) scale(${view.scale})`;
}

export function isIdentityMapView(view: MapView): boolean {
  return (
    view.scale === 1 &&
    view.rotation === 0 &&
    view.offsetX === 0 &&
    view.offsetY === 0
  );
}
