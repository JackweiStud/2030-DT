/**
 * Case4 地图调参面板：输出可写回 .env 的显示参数行。
 */

import type { Case3V2MapImageTransform } from "../../../case3-v2/mapProjectionV2";

function formatEnvNumber(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function formatCase4MapEnv(transform: Case3V2MapImageTransform): string {
  return [
    `VITE_CASE4_MAP_IMAGE_SCALE=${formatEnvNumber(transform.scale, 4)}`,
    `VITE_CASE4_MAP_IMAGE_ROTATION_DEG=${formatEnvNumber(transform.rotationDeg, 2)}`,
    `VITE_CASE4_MAP_IMAGE_OFFSET_X=${formatEnvNumber(transform.offsetX, 1)}`,
    `VITE_CASE4_MAP_IMAGE_OFFSET_Y=${formatEnvNumber(transform.offsetY, 1)}`,
  ].join("\n");
}
