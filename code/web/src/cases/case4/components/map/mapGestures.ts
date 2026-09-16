/**
 * Case4 地图手势：对照 case3-v2，只做缩放/旋转/平移，不写 JSX。
 */

import {
  clientDeltaToStageLogical,
  panMapView,
  rotateMapViewByDrag,
  zoomMapViewAtPointer,
  type MapView,
} from "../../../case3/metrics/mapProjection";
import type { Case3V2MapImageTransform } from "../../../case3-v2/mapProjectionV2";

export function toMapView(v: Case3V2MapImageTransform): MapView {
  return {
    scale: v.scale,
    rotation: v.rotationDeg,
    offsetX: v.offsetX,
    offsetY: v.offsetY,
  };
}

export function fromMapView(v: MapView): Case3V2MapImageTransform {
  return {
    scale: v.scale,
    rotationDeg: v.rotation,
    offsetX: v.offsetX,
    offsetY: v.offsetY,
  };
}

/** 滚轮缩放，指针为中心。 */
export function wheelZoomAtPointer(
  view: Case3V2MapImageTransform,
  localX: number,
  localY: number,
  zoomIn: boolean,
): Case3V2MapImageTransform {
  return fromMapView(zoomMapViewAtPointer(toMapView(view), localX, localY, zoomIn));
}

/** 左键水平拖动旋转。 */
export function dragRotate(
  view: Case3V2MapImageTransform,
  deltaXLogical: number,
  stageWidth: number,
): Case3V2MapImageTransform {
  const next = rotateMapViewByDrag(toMapView(view), deltaXLogical, stageWidth);
  return { ...view, rotationDeg: next.rotation };
}

/** 右键平移。 */
export function dragPan(
  view: Case3V2MapImageTransform,
  dx: number,
  dy: number,
): Case3V2MapImageTransform {
  const next = panMapView(toMapView(view), dx, dy);
  return { ...view, offsetX: next.offsetX, offsetY: next.offsetY };
}

export { clientDeltaToStageLogical };

export function sameImageTransform(
  a: Case3V2MapImageTransform,
  b: Case3V2MapImageTransform,
): boolean {
  return (
    a.scale === b.scale &&
    a.rotationDeg === b.rotationDeg &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY
  );
}
