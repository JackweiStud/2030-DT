/**
 * V2 波束矩阵：BeamID = row * 16 + col，合法范围 0-255。
 */

export const CASE3V2_BEAM_GRID_SIZE = 16;
export const CASE3V2_BEAM_COUNT =
  CASE3V2_BEAM_GRID_SIZE * CASE3V2_BEAM_GRID_SIZE;

/** 整数且落在 0-255。 */
export function isLegalBeamId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < CASE3V2_BEAM_COUNT;
}

export type BeamCellRole = "best" | "scan" | null;

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

/** 合法 selectedBeamId；非法返回 null，展示 `--`。 */
export function legalSelectedBeamId(
  selectedBeamId: number | undefined,
): number | null {
  if (selectedBeamId === undefined || !isLegalBeamId(selectedBeamId)) return null;
  return selectedBeamId;
}
