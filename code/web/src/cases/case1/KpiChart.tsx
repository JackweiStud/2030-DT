import { kpiComparison, type Kpi, type Layer } from "./data";

const BUBBLE_W = 115;
const BUBBLE_BODY = 48;
const ARROW_LEFT = 18;
const ARROW_WIDTH = 15;
const LABEL_GAP = 8;
const DIGIT_WIDTH: Record<string, number> = {
  "0": 14.1,
  "1": 9.77,
  "2": 13.77,
  "3": 13.88,
  "4": 14.04,
  "5": 13.84,
  "6": 14.08,
  "7": 12.8,
  "8": 14.01,
  "9": 14.08,
  ".": 6.47,
};

function bubbleLabelWidth(label: string) {
  let width = 12.25;
  for (const char of label) width += DIGIT_WIDTH[char] ?? 14.1;
  return width;
}
const BASELINE = 216;
const SCALE = 203;
const BAR_W = 72;

function kpiAxisTop(off: number, on: number) {
  const raw = Math.max(off, on) * 1.2;
  return Math.max(0.5, Math.ceil(raw * 2 - 1e-9) / 2);
}

function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
) {
  if (h <= 0.5 || w <= 0) return "";
  const maxR = Math.min(w / 2, h / 2);
  tl = Math.min(tl, maxR);
  tr = Math.min(tr, maxR);
  br = Math.min(br, maxR);
  bl = Math.min(bl, maxR);
  return [
    `M ${x + tl} ${y}`,
    `H ${x + w - tr}`,
    `A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr}`,
    `V ${y + h - br}`,
    `A ${br} ${br} 0 0 1 ${x + w - br} ${y + h}`,
    `H ${x + bl}`,
    `A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl}`,
    `V ${y + tl}`,
    `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}`,
    "Z",
  ].join(" ");
}

export function KpiChart({
  item,
  error,
  layer,
}: {
  item?: Kpi;
  error?: string;
  layer: Layer;
}) {
  if (!item)
    return (
      <div className="c1-chart" role={error ? "alert" : "status"}>
        {error || "正在读取离线指标…"}
      </div>
    );
  const { delta } = kpiComparison(item, layer !== "rf");
  const axisTop = kpiAxisTop(item.off, item.on);
  const offH = Math.min(SCALE, (item.off / axisTop) * SCALE);
  const onH = Math.min(SCALE, (item.on / axisTop) * SCALE);
  const improved = layer === "rf" ? item.on < item.off : item.on > item.off;
  const width = layer === "rf" ? 786 : 380;
  const plotLeft = 41;
  const plotRight = width - 6;
  const plotW = plotRight - plotLeft;
  const offX = plotLeft + plotW / 4;
  const onX = plotLeft + (plotW * 3) / 4;
  const offTop = BASELINE - offH;
  const onTop = BASELINE - onH;
  const gain = Math.max(0, onH - offH);
  const orangeH = onH > offH ? offH : onH;
  const orangeTop = BASELINE - orangeH;
  const gainId = `c1-gain-${layer}-${item.id}`;
  const bubbleFill = improved ? "#09aa7126" : "#f59e0b26";
  const ink = improved ? "#36c18d" : "#f59e0b";
  const bubbleW = BUBBLE_W;
  const bubbleBody = BUBBLE_BODY;
  const bubbleTail = 14;
  const dashY = Math.max(offTop, onTop);
  const label = delta === null ? "" : Math.abs(delta).toFixed(1);
  const contentW = ARROW_WIDTH + LABEL_GAP + bubbleLabelWidth(label);
  const contentX = (bubbleW - contentW) / 2;
  const bubbleX = onX - bubbleW / 2;
  const bubbleY = Math.max(0, onTop - 2 - 29 - 4 - (bubbleBody + bubbleTail));
  const numY = (topY: number) => topY - 2 - 14.5;

  return (
    <svg
      className="c1-kpi-svg"
      viewBox={`0 0 ${width} 250`}
      role="img"
      aria-label={`RF off ${item.off.toFixed(2)}，RF on ${item.on.toFixed(2)}${delta === null ? "" : `，变化 ${delta.toFixed(1)}%`}`}
    >
      <defs>
        <linearGradient id={gainId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <text
          key={i}
          x="31"
          y={BASELINE - (SCALE * i) / 5}
          textAnchor="end"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="14"
          fontWeight="600"
        >
          {((axisTop * i) / 5).toFixed(1)}
        </text>
      ))}
      <line
        x1={plotLeft}
        x2={plotRight}
        y1={BASELINE}
        y2={BASELINE}
        stroke="#ffffff40"
      />
      <line
        x1={plotLeft}
        x2={plotRight}
        y1={dashY}
        y2={dashY}
        stroke="#ffffffc2"
        strokeDasharray="5 5"
      />
      <path
        d={barPath(offX - BAR_W / 2, offTop, BAR_W, offH, 8, 8, 10, 10)}
        fill="#6b7280"
      />
      <path
        d={barPath(
          onX - BAR_W / 2,
          orangeTop,
          BAR_W,
          orangeH,
          gain > 0 ? 0 : 8,
          gain > 0 ? 0 : 8,
          10,
          10,
        )}
        fill="#f59e0b"
      />
      {gain > 0 && (
        <path
          d={barPath(onX - BAR_W / 2, onTop, BAR_W, gain, 8, 8, 0, 0)}
          fill={`url(#${gainId})`}
        />
      )}
      <text
        x={offX}
        y={numY(offTop)}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="24"
        fontWeight="600"
      >
        {item.off.toFixed(2)}
      </text>
      <text
        x={onX}
        y={numY(onTop)}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="24"
        fontWeight="600"
      >
        {item.on.toFixed(2)}
      </text>
      {delta !== null && (
        <g transform={`translate(${bubbleX},${bubbleY})`} fill={ink}>
          <rect width={bubbleW} height="48" rx="24" fill={bubbleFill} />
          <path d={`M${bubbleW / 2 - 8} 48h16l-8 14z`} fill={bubbleFill} />
          <g transform={`translate(${contentX - ARROW_LEFT} 0)`}>
            <g transform={delta < 0 ? "translate(25.5 24) scale(1 -1) translate(-25.5 -24)" : undefined}>
              <path d="M25.5 13 L33 25 H28.3 V35 H22.7 V25 H18 Z" />
            </g>
          </g>
          <text
            x={contentX + ARROW_WIDTH + LABEL_GAP}
            y="24"
            dominantBaseline="central"
            fontSize="22"
            fontWeight="700"
          >
            {label}
            <tspan fontSize="12" fontWeight="600" dominantBaseline="central">
              %
            </tspan>
          </text>
        </g>
      )}
      <text
        x={offX}
        y="232"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="20"
      >
        RF off
      </text>
      <text
        x={onX}
        y="232"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="20"
      >
        RF on
      </text>
    </svg>
  );
}
