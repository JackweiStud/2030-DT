/**
 * 左上波束矩阵卡：跟随最新完整点；初始为空。
 * Without：扫描波 + 最优波。With：同 no 叠加预测波/最优波，无扫描波。
 */

import type { Case3Point } from "../../case3/types";
import {
  CASE3V2_BEAM_GRID_SIZE,
  beamCellRole,
  legalSelectedBeamId,
  withBeamCellRole,
} from "../v2BeamGrid";
import { withBeamVerdict } from "../v2WithCompare";
import {
  BeamCrosshair,
  type BeamCrosshairMarker,
  type BeamCrosshairTone,
} from "./BeamCrosshair";
import { isAbnormalBeamPoint } from "../../case3/metrics/case3Metrics";

export type { BeamCrosshairMarker, BeamCrosshairTone };

const AXIS = Array.from({ length: CASE3V2_BEAM_GRID_SIZE }, (_, i) => i);

type Props = {
  point?: Case3Point | null;
  peerPoint?: Case3Point | null;
  mode?: "without" | "with";
  crosshairTone?: BeamCrosshairTone;
  crosshairMarker?: BeamCrosshairMarker;
};

/**
 * 16×16 波束矩阵。非法 BeamID 不进 DOM class。
 */
export function BeamMatrixCard(props: Props) {
  const mode = props.mode ?? "without";
  const point = props.point ?? null;
  const peerPoint =
    point && props.peerPoint && props.peerPoint.no === point.no
      ? props.peerPoint
      : null;
  const legalPred = legalSelectedBeamId(point?.selectedBeamId);
  const legalBest = isAbnormalBeamPoint(peerPoint)
    ? null
    : legalSelectedBeamId(peerPoint?.selectedBeamId);
  const pointAbnormal = isAbnormalBeamPoint(point);
  const verdict = mode === "with" ? withBeamVerdict(point, peerPoint) : "empty";
  const pointLabel = point ? `P${point.no}` : "P--";
  const beamId = pointAbnormal ? "NA" : legalPred == null ? "--" : String(legalPred);
  const showBadge = verdict === "match" || verdict === "mismatch";
  const derivedTone: BeamCrosshairTone =
    verdict === "match" ? "success" : verdict === "mismatch" ? "fail" : "neutral";
  const crosshairTone = mode === "with" ? derivedTone : (props.crosshairTone ?? "neutral");
  const crosshairMarker: BeamCrosshairMarker =
    mode === "with" ? "pred" : (props.crosshairMarker ?? "best");
  const showCrosshair = legalPred != null && !pointAbnormal;

  return (
    <article
      className="case3v2-beam-card"
      data-region="BeamMatrixCard"
      data-beam-mode={mode}
    >
      <div className="case3v2-beam-card__head">
        <span className="case3v2-beam-card__pin" aria-hidden />
        <div className="case3v2-beam-card__point">
          <span className="case3v2-beam-card__point-label">当前点位</span>
          <span className="case3v2-beam-card__point-value" data-point-value>
            {pointLabel}
          </span>
        </div>
      </div>
      <div className="case3v2-beam-card__body">
        <div className="case3v2-beam-card__title-row">
          <span className="case3v2-beam-card__title">波束矩阵</span>
          {showBadge ? (
            <span
              className={`case3v2-beam-badge is-${verdict === "match" ? "success" : "fail"}`}
              data-beam-badge
            >
              {verdict === "match" ? "预测成功" : "预测失败"}
            </span>
          ) : null}
          <div className="case3v2-beam-card__beamid">
            <span className="case3v2-beam-card__beamid-label">BeamID</span>
            <span className="case3v2-beam-card__beamid-value" data-beam-id-value>
              {beamId}
            </span>
          </div>
        </div>
        <div className="case3v2-beam-card__grid-wrap">
          <div className="case3v2-beam-y" data-beam-y>
            {AXIS.map((n) => (
              <span key={`y-${n}`}>{n}</span>
            ))}
          </div>
          <div className="case3v2-beam-grid" data-beam-grid>
            {AXIS.map((row) => (
              <div className="case3v2-beam-grid__row" key={`row-${row}`}>
                {AXIS.map((col) => {
                  const role = pointAbnormal
                    ? null
                    : mode === "with"
                      ? withBeamCellRole(row, col, legalPred, legalBest)
                      : beamCellRole(
                          row,
                          col,
                          point?.scanBeamIds,
                          point?.selectedBeamId,
                        );
                  const roleClass =
                    role === "pred"
                      ? " is-pred"
                      : role === "best"
                        ? " is-best"
                        : role === "scan"
                          ? " is-scan"
                          : "";
                  return (
                    <div
                      className={`case3v2-beam-cell${roleClass}`}
                      data-rc={`${row},${col}`}
                      data-beam-role={role ?? undefined}
                      key={`c-${row}-${col}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="case3v2-beam-x" data-beam-x>
            {AXIS.map((n) => (
              <span key={`x-${n}`}>{n}</span>
            ))}
          </div>
          {showCrosshair && legalPred != null ? (
            <BeamCrosshair
              beamId={legalPred}
              tone={crosshairTone}
              marker={crosshairMarker}
            />
          ) : null}
        </div>
        <div className="case3v2-beam-legend">
          {mode === "with" ? (
            <span className="case3v2-beam-legend__item">
              <i
                className="case3v2-beam-legend__swatch case3v2-beam-legend__swatch--pred"
                aria-hidden
              />
              <span className="case3v2-beam-legend__text" data-legend-pred>
                预测波
              </span>
            </span>
          ) : (
            <span className="case3v2-beam-legend__item case3v2-beam-legend__item--scan">
              <i
                className="case3v2-beam-legend__swatch case3v2-beam-legend__swatch--scan"
                aria-hidden
              />
              <span className="case3v2-beam-legend__text" data-legend-scan>
                扫描波
              </span>
            </span>
          )}
          <span className="case3v2-beam-legend__item">
            <i
              className="case3v2-beam-legend__swatch case3v2-beam-legend__swatch--best"
              aria-hidden
            />
            <span className="case3v2-beam-legend__text" data-legend-best>
              最优波
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
