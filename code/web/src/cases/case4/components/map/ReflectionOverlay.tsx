/**
 * Case4 当前 Pi 反射覆盖层：贴附正弦波纹 + 运行中沿波纹循环的白色亮段。
 * 不画彩色直线骨架。pointer-events:none，不拦截地图手势。
 * LOS（UE→BS）绿色；反射 hop（UE→Ri→BS）紫青渐变。
 * 绘制属性写在 SVG 元素上：html-to-image 深克隆不固化 SVG 子节点 CSS。
 */

import type { Case3V2MapImageTransform } from "../../../case3-v2/mapProjectionV2";
import { projectBusinessToImage } from "../../../case3-v2/mapProjectionV2";
import type { Case4RuntimeConfig } from "../../config/case4RuntimeConfig";
import type { ReflectionPayload, TrajectoryPoint } from "../../types";
import {
  buildReflectionPaths,
  losLabelPosition,
  offsetPolylineSine,
  reflectionContentKey,
  reflectionRiLabel,
  reflectionWavePhase,
} from "./reflectionGeometry";

const LOS_STROKE = "#22c55e";
const HOP_STROKE = "url(#c4-refl-grad)";
const WAVE_STROKE_WIDTH = 2.2;
const BEAM_STROKE = "#f8fafc";
const BEAM_DASH = "0.13 0.93";
const LABEL_FILL = "#e0f2fe";
const beamDashStyle = { strokeDasharray: BEAM_DASH };

type Props = {
  config: Case4RuntimeConfig;
  viewBox: { w: number; h: number };
  livePoints: TrajectoryPoint[];
  playback: "running" | "static";
  transform: Case3V2MapImageTransform;
};

function polylineAttr(
  points: Array<{ imageX: number; imageY: number }>,
): string {
  return points.map((point) => `${point.imageX},${point.imageY}`).join(" ");
}

/**
 * 当前点反射路径。
 */
export function ReflectionOverlay(props: Props) {
  const { config, viewBox, livePoints, playback } = props;
  void props.transform;
  if (!config.reflectionEnable) return null;
  const current = livePoints.at(-1);
  const reflection: ReflectionPayload | undefined = current?.reflection;
  const paths = current
    ? buildReflectionPaths(current.dt, config.bsXyz, reflection)
    : [];
  const state = reflection?.state ?? "missing";
  const contentKey = reflectionContentKey(current?.no, reflection);
  const cfg = {
    v2MapOriginX: config.mapOriginX,
    v2MapOriginY: config.mapOriginY,
    v2MapUnitsPerPx: config.mapUnitsPerPx,
  };
  const bs = projectBusinessToImage(config.bsXyz.x, config.bsXyz.y, cfg);
  const ue = current
    ? projectBusinessToImage(current.dt.x, current.dt.y, cfg)
    : null;
  const losMid =
    ue && reflection?.los === true ? losLabelPosition(ue, bs) : null;

  return (
    <svg
      className={`c4-reflection${playback === "static" ? " is-static" : ""}`}
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      aria-hidden
      data-reflection
      data-reflection-state={state}
      data-reflection-pi={current?.no ?? ""}
      data-reflection-los={String(reflection?.los ?? "")}
      data-reflection-beam={playback === "running" && paths.length > 0 ? "running" : "static"}
    >
      <defs>
        <linearGradient id="c4-refl-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      {paths.map((path, pathIndex) => {
        const projected = path.points.map((point) =>
          projectBusinessToImage(point.x, point.y, cfg),
        );
        const waveAttr = polylineAttr(
          offsetPolylineSine(projected, {
            phase: reflectionWavePhase(pathIndex),
          }),
        );
        return (
          <g key={`${contentKey}-${path.id}`}>
            <polyline
              className={
                path.kind === "los"
                  ? "c4-reflection__wave c4-reflection__wave--los"
                  : "c4-reflection__wave c4-reflection__wave--hop"
              }
              points={waveAttr}
              fill="none"
              stroke={path.kind === "los" ? LOS_STROKE : HOP_STROKE}
              strokeWidth={WAVE_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {playback === "running" ? (
              <polyline
                className="c4-reflection__beam"
                points={waveAttr}
                fill="none"
                pathLength={1}
                stroke={BEAM_STROKE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={BEAM_DASH}
                style={beamDashStyle}
              />
            ) : null}
          </g>
        );
      })}
      {state === "ready" ? (
        <>
          <polygon
            className="c4-reflection__bs"
            points={`${bs.imageX},${bs.imageY - 7} ${bs.imageX + 7},${bs.imageY} ${bs.imageX},${bs.imageY + 7} ${bs.imageX - 7},${bs.imageY}`}
            fill="#38bdf8"
            stroke={LABEL_FILL}
            strokeWidth={1.2}
          />
          <text
            className="c4-reflection__label"
            x={bs.imageX + 10}
            y={bs.imageY - 8}
            fill={LABEL_FILL}
            fontSize="12"
            fontWeight="700"
          >
            BS
          </text>
          {losMid ? (
            <text
              className="c4-reflection__label"
              x={losMid.imageX}
              y={losMid.imageY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={LABEL_FILL}
              fontSize="12"
              fontWeight="700"
            >
              LOS
            </text>
          ) : null}
          {(reflection?.points ?? []).map((ri) => {
            const pt = projectBusinessToImage(ri.x, ri.y, cfg);
            return (
              <g key={`ri-${ri.id}`}>
                <circle
                  className="c4-reflection__ri"
                  cx={pt.imageX}
                  cy={pt.imageY}
                  r={5}
                  fill="#c084fc"
                  stroke="#f5d0fe"
                  strokeWidth={1.2}
                />
                <text
                  className="c4-reflection__label"
                  x={pt.imageX + 8}
                  y={pt.imageY - 8}
                  fill={LABEL_FILL}
                  fontSize="12"
                  fontWeight="700"
                >
                  {reflectionRiLabel(ri.id)}
                </text>
              </g>
            );
          })}
        </>
      ) : null}
    </svg>
  );
}
