/**
 * NLOS 开口弧。几何复用静态 path；动态 dash 同时写 attribute 和 style。
 * nlosRatio===0 显示 0.0，不是 --。
 */

import { nlosPercentLabel } from "../metrics/case4Metrics";

const ARC =
  "M71.84567 147.15433a78 78 0 1 1 110.30866 0";

/** Pencil TboIS/j3WrA：256×173 内侧 0/25/50/75/100，与静态同构。 */
const TICK_LABELS = [
  { v: "0", left: "32.28%", top: "73.91%" },
  { v: "25", left: "27.33%", top: "37.06%" },
  { v: "50", left: "47.27%", top: "16.76%" },
  { v: "75", left: "67.60%", top: "36.48%" },
  { v: "100", left: "59.91%", top: "74.49%" },
] as const;

type Props = {
  nlosRatio: number | null;
};

/**
 * NLOS 仪表。
 */
export function NlosGauge(props: Props) {
  const has = props.nlosRatio !== null && Number.isFinite(props.nlosRatio);
  const dash = has ? Math.max(0, Math.min(100, props.nlosRatio! * 100)) : 0;
  const dashArray = `${dash} 100`;
  return (
    <article className="c4-kpi c4-kpi--nlos" data-region="NLOS">
      <div className="c4-kpi__title c4-kpi__title--nlos">NLOS占比(%)</div>
      <div className="c4-nlos-gauge">
        <div className="c4-nlos-gauge-art">
          <svg className="c4-nlos-svg" viewBox="38 3 178 178" aria-hidden>
            <path
              className="c4-nlos-ring"
              d={ARC}
              fill="none"
              stroke="#FFFFFF33"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <path
              className={`c4-nlos-arc${has ? "" : " is-off"}`}
              d={ARC}
              pathLength={100}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              strokeDashoffset={0}
              style={{ strokeDasharray: dashArray, strokeDashoffset: 0 }}
            />
          </svg>
          <svg className="c4-nlos-tick-marks" viewBox="0 0 256 173" aria-hidden>
            <g stroke="#8B93A7" strokeWidth="1.5" strokeLinecap="round" fill="none">
              <path d="M77.14897 141.85103l4.24264-4.24264" />
              <path d="M61.86649 65.02082l5.54328 2.2961" />
              <path d="M127 21.5l0 6" />
              <path d="M192.13351 65.02082l-5.54328 2.2961" />
              <path d="M176.85103 141.85103l-4.24264-4.24264" />
            </g>
          </svg>
          <div className="c4-nlos-center">
            <div className="c4-nlos-value">
              {has ? nlosPercentLabel(props.nlosRatio) : "--"}
            </div>
            <div className="c4-nlos-caption">平均NLOS径占比</div>
          </div>
          <div className="c4-nlos-ticks" aria-hidden>
            {TICK_LABELS.map((t) => (
              <span key={t.v} style={{ left: t.left, top: t.top }}>
                {t.v}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
