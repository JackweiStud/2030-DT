import type { Case3RuntimeConfig } from "../../../case3/config/case3RuntimeConfig";
import type { Case3Point } from "../../../case3/types";
import { projectBusinessToImage } from "../../mapProjectionV2";
import {
  losLabelPosition,
  offsetPolylineSine,
} from "../../../shared/reflectionGeometry";

type Props = {
  config: Case3RuntimeConfig;
  point: Case3Point | null;
  viewBox: { w: number; h: number };
  playback: "running" | "static";
};

function pointsAttr(points: Array<{ imageX: number; imageY: number }>): string {
  return points.map((point) => `${point.imageX},${point.imageY}`).join(" ");
}

export function ReflectionOverlay({ config, point, viewBox, playback }: Props) {
  const reflection = point?.reflection;
  if (!config.reflectionEnable || !config.bsXyz || !point || !reflection) return null;

  const projection = {
    v2MapOriginX: config.v2MapOriginX,
    v2MapOriginY: config.v2MapOriginY,
    v2MapUnitsPerPx: config.v2MapUnitsPerPx,
  };
  const ue = projectBusinessToImage(point.ue.x, point.ue.y, projection);
  const bs = projectBusinessToImage(config.bsXyz.x, config.bsXyz.y, projection);
  const path = reflection.los
    ? [ue, bs]
    : [
        ue,
        projectBusinessToImage(reflection.x, reflection.y, projection),
        bs,
      ];
  const wave = pointsAttr(offsetPolylineSine(path));
  const label = reflection.los
    ? losLabelPosition(ue, bs)
    : path[1]!;

  return (
    <svg
      className={`case3v2-reflection${playback === "static" ? " is-static" : ""}`}
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="none"
      aria-hidden
      data-reflection
      data-reflection-pi={point.no}
      data-reflection-los={String(reflection.los)}
      data-reflection-beam={playback === "running" ? "running" : "static"}
    >
      <defs>
        <linearGradient id="case3v2-reflection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <polyline
        className={`case3v2-reflection__wave ${reflection.los ? "is-los" : "is-hop"}`}
        points={wave}
        fill="none"
        stroke={reflection.los ? "#22c55e" : "url(#case3v2-reflection-gradient)"}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {playback === "running" ? (
        <polyline
          className="case3v2-reflection__beam"
          points={wave}
          fill="none"
          pathLength={1}
          stroke="#f8fafc"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="0.13 0.93"
          style={{ strokeDasharray: "0.13 0.93" }}
        />
      ) : null}
      <polygon
        points={`${bs.imageX},${bs.imageY - 7} ${bs.imageX + 7},${bs.imageY} ${bs.imageX},${bs.imageY + 7} ${bs.imageX - 7},${bs.imageY}`}
        fill="#38bdf8"
        stroke="#e0f2fe"
        strokeWidth={1.2}
      />
      <text x={bs.imageX + 10} y={bs.imageY - 8} className="case3v2-reflection__label">BS</text>
      <text
        x={reflection.los ? label.imageX : label.imageX + 8}
        y={reflection.los ? label.imageY : label.imageY - 8}
        textAnchor={reflection.los ? "middle" : undefined}
        dominantBaseline={reflection.los ? "middle" : undefined}
        className="case3v2-reflection__label"
      >
        {reflection.los ? "LOS" : "NLOS R1"}
      </text>
      {!reflection.los ? (
        <circle
          cx={label.imageX}
          cy={label.imageY}
          r={5}
          fill="#c084fc"
          stroke="#f5d0fe"
          strokeWidth={1.2}
        />
      ) : null}
    </svg>
  );
}
