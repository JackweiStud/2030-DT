/**
 * 最优波准星叠层：跟随 BeamID 格子，tone 控制颜色供 With 复用。
 * 截图关键色必须写在 SVG 属性上的字面量；html-to-image 深拷贝 SVG 时不固化 CSS var。
 */

import { useId } from "react";
import {
  CASE3V2_BEAM_CELL_PX,
  CASE3V2_BEAM_CROSSHAIR_ARM_PX,
  CASE3V2_BEAM_CROSSHAIR_BAR_PX,
  CASE3V2_BEAM_CROSSHAIR_OPACITY,
  CASE3V2_BEAM_GRID_HEIGHT_PX,
  CASE3V2_BEAM_GRID_LEFT_PX,
  CASE3V2_BEAM_GRID_TOP_PX,
  CASE3V2_BEAM_GRID_WIDTH_PX,
  beamCellOriginPx,
  beamIdToRowCol,
  isLegalBeamId,
} from "../v2BeamGrid";

export type BeamCrosshairTone = "neutral" | "success" | "fail";
export type BeamCrosshairMarker = "best" | "pred" | "none";

type Props = {
  beamId: number;
  tone?: BeamCrosshairTone;
  marker?: BeamCrosshairMarker;
};

type CrosshairPalette = {
  fill: string;
  stroke: string;
  glow: string;
  glowCore: string;
};

/** 与截图自包含绑定的 tone 色表（字面量 rgba，禁止 CSS var）。 */
export const BEAM_CROSSHAIR_PALETTE: Record<BeamCrosshairTone, CrosshairPalette> = {
  neutral: {
    fill: "rgba(255, 255, 255, 0.1)",
    stroke: "rgba(255, 255, 255, 0.92)",
    glow: "rgba(255, 255, 255, 0.28)",
    glowCore: "rgba(255, 255, 255, 0.55)",
  },
  success: {
    fill: "rgba(61, 220, 151, 0.12)",
    stroke: "rgba(176, 255, 214, 0.92)",
    glow: "rgba(61, 220, 151, 0.32)",
    glowCore: "rgba(168, 255, 214, 0.6)",
  },
  fail: {
    fill: "rgba(220, 64, 72, 0.12)",
    stroke: "rgba(255, 176, 176, 0.9)",
    glow: "rgba(220, 64, 72, 0.3)",
    glowCore: "rgba(255, 148, 148, 0.55)",
  },
};

const GLOW_R = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function FadeStops(props: { color: string; peak?: number }) {
  const peak = props.peak ?? 1;
  return (
    <>
      <stop offset="0" stopColor={props.color} stopOpacity="0" />
      <stop offset="0.16" stopColor={props.color} stopOpacity={peak * 0.2} />
      <stop offset="0.38" stopColor={props.color} stopOpacity={peak} />
      <stop offset="0.62" stopColor={props.color} stopOpacity={peak} />
      <stop offset="0.84" stopColor={props.color} stopOpacity={peak * 0.2} />
      <stop offset="1" stopColor={props.color} stopOpacity="0" />
    </>
  );
}

/**
 * 十字准星 + 交点光晕；非法 BeamID 不渲染。
 */
export function BeamCrosshair(props: Props) {
  const tone = props.tone ?? "neutral";
  const marker = props.marker ?? "best";
  const uid = `bxh${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!isLegalBeamId(props.beamId)) return null;

  const { row, col } = beamIdToRowCol(props.beamId);
  const origin = beamCellOriginPx(row, col);
  const cx = origin.x + CASE3V2_BEAM_CELL_PX / 2;
  const cy = origin.y + CASE3V2_BEAM_CELL_PX / 2;
  const gridRight = CASE3V2_BEAM_GRID_LEFT_PX + CASE3V2_BEAM_GRID_WIDTH_PX;
  const gridBottom = CASE3V2_BEAM_GRID_TOP_PX + CASE3V2_BEAM_GRID_HEIGHT_PX;
  const x0 = clamp(cx - CASE3V2_BEAM_CROSSHAIR_ARM_PX, CASE3V2_BEAM_GRID_LEFT_PX, gridRight);
  const y0 = clamp(cy - CASE3V2_BEAM_CROSSHAIR_ARM_PX, CASE3V2_BEAM_GRID_TOP_PX, gridBottom);
  const x1 = clamp(cx + CASE3V2_BEAM_CROSSHAIR_ARM_PX, CASE3V2_BEAM_GRID_LEFT_PX, gridRight);
  const y1 = clamp(cy + CASE3V2_BEAM_CROSSHAIR_ARM_PX, CASE3V2_BEAM_GRID_TOP_PX, gridBottom);
  const barW = Math.max(0, x1 - x0);
  const barH = Math.max(0, y1 - y0);
  const hY = cy - CASE3V2_BEAM_CROSSHAIR_BAR_PX / 2;
  const vX = cx - CASE3V2_BEAM_CROSSHAIR_BAR_PX / 2;
  const { fill, stroke, glow, glowCore } = BEAM_CROSSHAIR_PALETTE[tone];

  return (
    <div
      className="case3v2-beam-crosshair"
      data-beam-crosshair
      data-tone={tone}
      data-beam-id={String(props.beamId)}
      aria-hidden
    >
      <svg
        className="case3v2-beam-crosshair__svg"
        style={{ opacity: CASE3V2_BEAM_CROSSHAIR_OPACITY }}
      >
        <defs>
          <linearGradient
            id={`${uid}-hf`}
            gradientUnits="userSpaceOnUse"
            x1={x0}
            y1={cy}
            x2={x1}
            y2={cy}
          >
            <FadeStops color={fill} peak={1} />
          </linearGradient>
          <linearGradient
            id={`${uid}-hs`}
            gradientUnits="userSpaceOnUse"
            x1={x0}
            y1={cy}
            x2={x1}
            y2={cy}
          >
            <FadeStops color={stroke} />
          </linearGradient>
          <linearGradient
            id={`${uid}-vf`}
            gradientUnits="userSpaceOnUse"
            x1={cx}
            y1={y0}
            x2={cx}
            y2={y1}
          >
            <FadeStops color={fill} peak={1} />
          </linearGradient>
          <linearGradient
            id={`${uid}-vs`}
            gradientUnits="userSpaceOnUse"
            x1={cx}
            y1={y0}
            x2={cx}
            y2={y1}
          >
            <FadeStops color={stroke} />
          </linearGradient>
          <radialGradient id={`${uid}-g`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={glowCore} stopOpacity="0.7" />
            <stop offset="0.35" stopColor={glow} stopOpacity="0.28" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
          <filter
            id={`${uid}-bloom`}
            x="-0.25"
            y="-1.6"
            width="1.5"
            height="4.2"
            filterUnits="objectBoundingBox"
          >
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        <g className="case3v2-beam-crosshair__glow" style={{ mixBlendMode: "screen" }}>
          <ellipse cx={cx} cy={cy} rx={GLOW_R} ry={GLOW_R} fill={`url(#${uid}-g)`} />
          <rect
            x={x0}
            y={hY}
            width={barW}
            height={CASE3V2_BEAM_CROSSHAIR_BAR_PX}
            rx="1.5"
            fill={`url(#${uid}-hs)`}
            filter={`url(#${uid}-bloom)`}
            opacity="0.28"
          />
          <rect
            x={vX}
            y={y0}
            width={CASE3V2_BEAM_CROSSHAIR_BAR_PX}
            height={barH}
            rx="1.5"
            fill={`url(#${uid}-vs)`}
            filter={`url(#${uid}-bloom)`}
            opacity="0.28"
          />
        </g>
        <rect
          x={x0}
          y={hY}
          width={barW}
          height={CASE3V2_BEAM_CROSSHAIR_BAR_PX}
          rx="1.5"
          fill={`url(#${uid}-hf)`}
          stroke={`url(#${uid}-hs)`}
          strokeWidth="1"
        />
        <rect
          x={vX}
          y={y0}
          width={CASE3V2_BEAM_CROSSHAIR_BAR_PX}
          height={barH}
          rx="1.5"
          fill={`url(#${uid}-vf)`}
          stroke={`url(#${uid}-vs)`}
          strokeWidth="1"
        />
      </svg>
      {marker === "none" ? null : (
        <span
          className={`case3v2-beam-crosshair__mark case3v2-beam-crosshair__mark--${marker}`}
          data-crosshair-mark={marker}
          style={{ left: origin.x, top: origin.y }}
        />
      )}
    </div>
  );
}
