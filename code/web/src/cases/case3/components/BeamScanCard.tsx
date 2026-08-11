/**
 * Case3 波束扫描卡：16×16 DOM 网格（对齐静态 `.case3-scan-row/.case3-scan-dot`）。
 * 初始态 With 侧图例隐藏；点位标签仅在有当前点时显示。
 */

import iconBs from "../../../../assets/case3/icon-bs-beam.png";
import iconPoint from "../../../../assets/case3/icon-point.png";
import iconOk from "../../../../assets/case3/icon-ok.png";
import iconErr from "../../../../assets/case3/icon-err.png";
import type { Case3Point, Case3Side } from "../types";

type Props = {
  side: Case3Side;
  point: Case3Point | null;
  peerPoint?: Case3Point | null;
};

/**
 * BS 波束浮层卡片。
 */
export function BeamScanCard(props: Props) {
  const { side, point, peerPoint } = props;
  const scan = new Set(point?.scanBeamIds ?? []);
  const selected = point?.selectedBeamId;

  const rows = Array.from({ length: 16 }, (_, r) =>
    Array.from({ length: 16 }, (_, c) => {
      const id = r * 16 + c;
      let cls = "case3-scan-dot";
      if (side === "without") {
        if (selected === id) cls += " is-best";
        else if (scan.has(id)) cls += " is-scan";
      } else if (selected === id) {
        cls += " is-predict";
      }
      return { id, cls };
    }),
  );

  let legend: { ok: boolean; text: string } | null = null;
  if (side === "with" && point && peerPoint) {
    const ok = point.selectedBeamId === peerPoint.selectedBeamId;
    legend = {
      ok,
      text: ok
        ? `波束预测成功,BeamId:${point.selectedBeamId}`
        : `波束预测失败,BeamId: ${point.selectedBeamId}`,
    };
  }

  return (
    <div
      className={`case3-beam-card case3-beam-card--scan${side === "with" ? " case3-beam-card--with" : ""}`}
      data-beam={side}
    >
      <div className="case3-beam-card__head">
        <div className="case3-beam-card__title-group">
          <img src={iconBs} width={20} height={20} alt="" />
          <span>BS波束</span>
        </div>
        {point ? (
          <div className="case3-beam-card__point">
            <img src={iconPoint} width={12} height={12} alt="" />
            <span>点位{point.no}</span>
          </div>
        ) : null}
      </div>
      <div className="case3-scan-grid-bg">
        <div className="case3-scan-grid">
          {rows.map((row, r) => (
            <div key={r} className="case3-scan-row">
              {row.map((cell) => (
                <span
                  key={cell.id}
                  className={cell.cls}
                  data-beam-index={cell.id}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {side === "without" ? (
        <div className="case3-beam-legend">
          <span className="case3-beam-legend__item case3-beam-legend__item--best">
            最优波束
          </span>
          <span className="case3-beam-legend__item case3-beam-legend__item--scan">
            扫描波束
          </span>
        </div>
      ) : legend ? (
        <div className="case3-beam-legend">
          <span className="case3-beam-legend__item case3-beam-legend__item--predict">
            <img
              className="case3-beam-legend__icon"
              src={legend.ok ? iconOk : iconErr}
              width={14}
              height={14}
              alt=""
            />
            <span>{legend.text}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
