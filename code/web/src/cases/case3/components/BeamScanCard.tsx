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

const BEAM_GRID_SIZE = 16;
const BEAM_COUNT = BEAM_GRID_SIZE * BEAM_GRID_SIZE;
const BEAM_DOT_RADIUS = 4;
const BEAM_GRID_WIDTH = 215;
const BEAM_GRID_HEIGHT = 252;
const BEAM_X_START = 11.5;
const BEAM_X_STEP = 12.8;
const BEAM_Y_START = 4;
const BEAM_Y_STEP =
  (BEAM_GRID_HEIGHT - BEAM_DOT_RADIUS * 2) / (BEAM_GRID_SIZE - 1);
const ALL_BEAM_IDS = Array.from({ length: BEAM_COUNT }, (_, id) => id);

function isBeamId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < BEAM_COUNT;
}

/**
 * 多个圆点合并成一条 SVG path，避免 256 个 React 叶子节点。
 */
function beamPath(ids: Iterable<number>): string {
  const commands: string[] = [];
  for (const id of ids) {
    if (!isBeamId(id)) continue;
    const row = Math.floor(id / BEAM_GRID_SIZE);
    const col = id % BEAM_GRID_SIZE;
    const cx = BEAM_X_START + col * BEAM_X_STEP;
    const cy = BEAM_Y_START + row * BEAM_Y_STEP;
    commands.push(
      `M ${cx - BEAM_DOT_RADIUS} ${cy}`,
      `a ${BEAM_DOT_RADIUS} ${BEAM_DOT_RADIUS} 0 1 0 ${BEAM_DOT_RADIUS * 2} 0`,
      `a ${BEAM_DOT_RADIUS} ${BEAM_DOT_RADIUS} 0 1 0 ${-BEAM_DOT_RADIUS * 2} 0`,
    );
  }
  return commands.join(" ");
}

const ALL_BEAMS_PATH = beamPath(ALL_BEAM_IDS);

/**
 * BS 波束浮层卡片。
 */
export function BeamScanCard(props: Props) {
  const { side, point, peerPoint } = props;
  const scan = new Set(point?.scanBeamIds ?? []);
  const selected = point?.selectedBeamId;
  const scanPath =
    side === "without"
      ? beamPath([...scan].filter((id) => id !== selected))
      : "";
  const selectedPath =
    selected === undefined ? "" : beamPath([selected]);

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

  const selectedClass =
    side === "without"
      ? "case3-scan-path--best"
      : legend && !legend.ok
        ? "case3-scan-path--predict-fail"
        : "case3-scan-path--predict";

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
            <span className="case3-beam-card__point-label">
              点位
              <span className="case3-beam-card__point-no">{point.no}</span>
            </span>
          </div>
        ) : null}
      </div>
      <div className="case3-scan-grid-bg">
        <svg
          className="case3-scan-grid"
          viewBox={`0 0 ${BEAM_GRID_WIDTH} ${BEAM_GRID_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path
            className="case3-scan-path case3-scan-path--base"
            d={ALL_BEAMS_PATH}
          />
          {scanPath ? (
            <path
              className="case3-scan-path case3-scan-path--scan"
              d={scanPath}
            />
          ) : null}
          {selectedPath ? (
            <path
              className={`case3-scan-path ${selectedClass}`}
              d={selectedPath}
            />
          ) : null}
        </svg>
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
          <span
            className={`case3-beam-legend__item case3-beam-legend__item--predict ${
              legend.ok ? "is-ok" : "is-fail"
            }`}
          >
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
