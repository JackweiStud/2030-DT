/**
 * 左上波束矩阵卡：初始为空网格，P-- / BeamID --。
 */

const AXIS = Array.from({ length: 16 }, (_, i) => i);

type Props = {
  pointLabel?: string;
  beamId?: string;
};

/**
 * 16×16 空波束矩阵。
 */
export function BeamMatrixCard(props: Props) {
  const pointLabel = props.pointLabel ?? "P--";
  const beamId = props.beamId ?? "--";

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
                {AXIS.map((col) => (
                  <div
                    className="case3v2-beam-cell"
                    data-rc={`${row},${col}`}
                    key={`c-${row}-${col}`}
                  />
                ))}
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
