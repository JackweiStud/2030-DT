/**
 * V2 波束矩阵：BeamID = row * 16 + col，合法范围 0-255。
 */

export const CASE3V2_BEAM_GRID_SIZE = 16;
export const CASE3V2_BEAM_COUNT =
  CASE3V2_BEAM_GRID_SIZE * CASE3V2_BEAM_GRID_SIZE;

/** 与 `case3v2.css` 波束网格几何对齐，改 CSS 时必须同步。 */
export const CASE3V2_BEAM_CELL_PX = 16;
export const CASE3V2_BEAM_GAP_X_PX = 34 / 15;
export const CASE3V2_BEAM_GAP_Y_PX = 3;
export const CASE3V2_BEAM_GRID_LEFT_PX = 26;
export const CASE3V2_BEAM_GRID_TOP_PX = 4.5;
export const CASE3V2_BEAM_GRID_WIDTH_PX = 290;
export const CASE3V2_BEAM_GRID_HEIGHT_PX = 301;
/** 准星单侧臂长：中心起约 6 格，避免拉满矩阵挡住扫描波。 */
export const CASE3V2_BEAM_CROSSHAIR_ARM_PX =
  CASE3V2_BEAM_CELL_PX / 2 + 6 * (CASE3V2_BEAM_CELL_PX + CASE3V2_BEAM_GAP_Y_PX);
/** 准星槽宽。 */
export const CASE3V2_BEAM_CROSSHAIR_BAR_PX = 17;
/** 准星叠层整体透明度 0–1，不含最优波标记。越小越透。 */
export const CASE3V2_BEAM_CROSSHAIR_OPACITY = 0.5;

/** 整数且落在 0-255。 */
export function isLegalBeamId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < CASE3V2_BEAM_COUNT;
}

export type BeamCellRole = "best" | "scan" | null;
export type WithBeamCellRole = "pred" | "best" | null;

/**
 * 同格最优波优先于扫描波；非法 id 不进格子。
 */
export function beamCellRole(
  row: number,
  col: number,
  scanBeamIds: ReadonlyArray<number> | undefined,
  selectedBeamId: number | undefined,
): BeamCellRole {
  const id = row * CASE3V2_BEAM_GRID_SIZE + col;
  if (selectedBeamId !== undefined && isLegalBeamId(selectedBeamId) && id === selectedBeamId) {
    return "best";
  }
  if (scanBeamIds?.some((scanId) => isLegalBeamId(scanId) && scanId === id)) {
    return "scan";
  }
  return null;
}

/**
 * With 格子：无扫描波。同格时预测波覆盖最优波；非法 id 不进格子。
 */
export function withBeamCellRole(
  row: number,
  col: number,
  predId: number | null,
  bestId: number | null,
): WithBeamCellRole {
  const id = row * CASE3V2_BEAM_GRID_SIZE + col;
  if (predId != null && isLegalBeamId(predId) && id === predId) return "pred";
  if (bestId != null && isLegalBeamId(bestId) && id === bestId) return "best";
  return null;
}

/** 合法 selectedBeamId；非法返回 null，展示 `--`。 */
export function legalSelectedBeamId(
  selectedBeamId: number | undefined,
): number | null {
  if (selectedBeamId === undefined || !isLegalBeamId(selectedBeamId)) return null;
  return selectedBeamId;
}

/** BeamID → 行/列；调用方保证合法。 */
export function beamIdToRowCol(id: number): { row: number; col: number } {
  return {
    row: Math.floor(id / CASE3V2_BEAM_GRID_SIZE),
    col: id % CASE3V2_BEAM_GRID_SIZE,
  };
}

/** 格子左上角，相对 `.case3v2-beam-card__grid-wrap`。 */
export function beamCellOriginPx(
  row: number,
  col: number,
): { x: number; y: number } {
  return {
    x: CASE3V2_BEAM_GRID_LEFT_PX + col * (CASE3V2_BEAM_CELL_PX + CASE3V2_BEAM_GAP_X_PX),
    y: CASE3V2_BEAM_GRID_TOP_PX + row * (CASE3V2_BEAM_CELL_PX + CASE3V2_BEAM_GAP_Y_PX),
  };
}
