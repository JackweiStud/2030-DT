/**
 * V2 Cost 梯形体积：SVG 与 aux 同框同 viewBox，100% 贴 aux 上边缘。
 * 用 aux 切图 alpha 作 mask，填充不会画出 aux 外。
 */

export const CASE3V2_COST_AUX = {
  width: 506,
  height: 188,
} as const;

export const CASE3V2_COST_AUX_RANGE = {
  // 跳过切图远端淡出尖角（约 4px），100% 落在可见上边缘。
  without: { yFar: 43, yNear: 187 },
  with: { yFar: 40, yNear: 187 },
} as const;

type Pt = readonly [number, number];

type SideEdges = {
  left: readonly Pt[];
  right: readonly Pt[];
};

/** aux 像素坐标，y 从远端到近端。 */
const LEFT_EDGES: SideEdges = {
  left: [
    [323, 29],
    [300, 40],
    [275, 52],
    [251, 64],
    [226, 76],
    [202, 88],
    [177, 100],
    [153, 112],
    [128, 124],
    [104, 136],
    [80, 148],
    [55, 160],
    [31, 172],
    [0, 187],
  ],
  right: [
    [326, 29],
    [382, 40],
    [422, 48],
    [467, 52],
    [456, 68],
    [445, 84],
    [434, 100],
    [422, 116],
    [411, 132],
    [399, 148],
    [388, 164],
    [377, 180],
    [372, 187],
  ],
};

const RIGHT_EDGES: SideEdges = {
  left: [
    [161, 21],
    [127, 32],
    [91, 44],
    [41, 56],
    [52, 72],
    [63, 88],
    [74, 104],
    [86, 120],
    [97, 136],
    [108, 152],
    [120, 168],
    [133, 187],
  ],
  right: [
    [166, 21],
    [189, 32],
    [213, 44],
    [238, 56],
    [271, 72],
    [303, 88],
    [336, 104],
    [369, 120],
    [401, 136],
    [434, 152],
    [466, 168],
    [505, 187],
  ],
};

export type CostFillVolume = {
  yCut: number;
  clipHeight: number;
  yFar: number;
  yNear: number;
  surfaceX1: number;
  surfaceX2: number;
  gradient: { x1: number; y1: number; x2: number; y2: number };
};

function xAtY(edge: readonly Pt[], y: number): number {
  if (edge.length === 0) return 0;
  const first = edge[0]!;
  const last = edge[edge.length - 1]!;
  if (y <= first[1]) return first[0];
  if (y >= last[1]) return last[0];
  for (let i = 1; i < edge.length; i += 1) {
    const [x0, y0] = edge[i - 1]!;
    const [x1, y1] = edge[i]!;
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      return x0 + t * (x1 - x0);
    }
  }
  return last[0];
}

/**
 * 空值不画。100% 的 yCut 等于该侧 aux 上边缘。
 */
export function costFillVolume(
  value: number | null | undefined,
  side: "without" | "with",
): CostFillVolume | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.max(0, Math.min(100, value));
  const { yFar, yNear } = CASE3V2_COST_AUX_RANGE[side];
  const t = pct / 100;
  const yCut = yNear + (yFar - yNear) * t;
  const edges = side === "without" ? LEFT_EDGES : RIGHT_EDGES;
  const leftEdge = edges.left;
  const leftFirst = leftEdge[0]!;
  const leftLast = leftEdge[leftEdge.length - 1]!;
  return {
    yCut,
    clipHeight: yNear - yCut,
    yFar,
    yNear,
    surfaceX1: xAtY(edges.left, yCut),
    surfaceX2: xAtY(edges.right, yCut),
    gradient: {
      x1: leftLast[0],
      y1: yNear,
      x2: leftFirst[0],
      y2: yFar,
    },
  };
}
