/**
 * 左上波束矩阵卡：跟随最新完整点；初始为空。
 */

import type { Case3Point } from "../../case3/types";
import {
  CASE3V2_BEAM_GRID_SIZE,
  beamCellRole,
  legalSelectedBeamId,
} from "../v2BeamGrid";

const AXIS = Array.from({ length: CASE3V2_BEAM_GRID_SIZE }, (_, i) => i);

type Props = {
  point?: Case3Point | null;
};

/**
 * 16×16 波束矩阵。非法 BeamID 不进 DOM class。
 */
export function BeamMatrixCard(props: Props) {
  const point = props.point ?? null;
  const legalBest = legalSelectedBeamId(point?.selectedBeamId);
  const pointLabel = point ? `P${point.no}` : "P--";
  const beamId = legalBest == null ? "--" : String(legalBest);

  return (
    <article className="case3v2-beam-card" data-region="BeamMatrixCard">
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
          <div className="case3v2-beam-card__beamid">
            <span className="case3v2-beam-card__beamid-label">BeamID</span>
            <span className="case3v2-beam-card__beamid-value" data-beam-id>
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
                  const role = beamCellRole(
                    row,
                    col,
                    point?.scanBeamIds,
                    point?.selectedBeamId,
                  );
                  const roleClass =
                    role === "best"
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
        </div>
        <div className="case3v2-beam-legend">
          <span className="case3v2-beam-legend__item case3v2-beam-legend__item--scan">
            <i
              className="case3v2-beam-legend__swatch case3v2-beam-legend__swatch--scan"
              aria-hidden
            />
            <span className="case3v2-beam-legend__text">扫描波</span>
          </span>
          <span className="case3v2-beam-legend__item">
            <i
              className="case3v2-beam-legend__swatch case3v2-beam-legend__swatch--best"
              aria-hidden
            />
            <span className="case3v2-beam-legend__text">最优波</span>
          </span>
        </div>
      </div>
    </article>
  );
}
