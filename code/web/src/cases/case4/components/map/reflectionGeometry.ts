/**
 * Case4 当前 Pi 反射路径几何：独立 UE→Ri→BS，不串跳。
 * kind=los：UE→BS 直达；kind=hop：UE→反射点 Ri→BS。
 */

import type { ReflectionPayload, XYZ } from "../../types";

export type ReflectionDrawnPath = {
  id: string;
  kind: "los" | "hop";
  points: XYZ[];
};

export function buildReflectionPaths(
  ue: XYZ,
  bs: XYZ,
  reflection: ReflectionPayload | undefined,
): ReflectionDrawnPath[] {
  if (!reflection || reflection.state !== "ready") return [];
  const paths: ReflectionDrawnPath[] = [];
  // 直达：仅 LOS 为 true 时画 UE→BS
  if (reflection.los === true) {
    paths.push({ id: "los", kind: "los", points: [ue, bs] });
  }
  // 每条反射独立 hop，不把 R1、R2 串成一条折线
  for (const ri of reflection.points) {
    paths.push({
      id: `r${ri.id}`,
      kind: "hop",
      points: [ue, { x: ri.x, y: ri.y, z: ri.z }, bs],
    });
  }
  return paths;
}

export function reflectionContentKey(
  pi: number | undefined,
  reflection: ReflectionPayload | undefined,
): string {
  return JSON.stringify({
    pi: pi ?? null,
    state: reflection?.state ?? null,
    los: reflection?.los ?? null,
    points: reflection?.points ?? [],
  });
}

export type ReflectionImagePoint = { imageX: number; imageY: number };

/** 方案5：贴附正弦波纹。单位为底图像素，不表示场强或时延。 */
export const REFLECTION_WAVE = {
  amplitudePx: 4,
  wavelengthPx: 32,
  stepPx: 4,
  fadePx: 14,
  phaseStep: (2 * Math.PI) / 3,
} as const;

/** 各路径错开相位，避免波浪叠成同一形状。 */
export function reflectionWavePhase(pathIndex: number): number {
  return pathIndex * REFLECTION_WAVE.phaseStep;
}

/** 反射点标签：NLOS R1、NLOS R2。直达 LOS 不打 Ri 标。 */
export function reflectionRiLabel(id: number): string {
  return `NLOS R${id}`;
}

/** LOS 字相对 UE→BS 中点的法向偏移，避开波纹与描边。 */
export const REFLECTION_LOS_LABEL_OFFSET_PX = 18;

/**
 * UE→BS 中点沿法向偏移。优先偏向上/左，避免字压在绿线上。
 */
export function losLabelPosition(
  ue: ReflectionImagePoint,
  bs: ReflectionImagePoint,
  offsetPx: number = REFLECTION_LOS_LABEL_OFFSET_PX,
): ReflectionImagePoint {
  const midX = (ue.imageX + bs.imageX) / 2;
  const midY = (ue.imageY + bs.imageY) / 2;
  const dx = bs.imageX - ue.imageX;
  const dy = bs.imageY - ue.imageY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return { imageX: midX, imageY: midY - offsetPx };
  }
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  return { imageX: midX + nx * offsetPx, imageY: midY + ny * offsetPx };
}

function imageDist(a: ReflectionImagePoint, b: ReflectionImagePoint): number {
  return Math.hypot(b.imageX - a.imageX, b.imageY - a.imageY);
}

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * 沿折线采样并做垂直正弦偏移。端点与拐角振幅收束到 0，骨架拐角保持可读。
 * 相位固定，不扭动底线；白色亮段沿同一条波纹循环。
 */
export function offsetPolylineSine(
  points: ReflectionImagePoint[],
  options: {
    amplitudePx?: number;
    wavelengthPx?: number;
    stepPx?: number;
    fadePx?: number;
    phase?: number;
  } = {},
): ReflectionImagePoint[] {
  const amplitudePx = options.amplitudePx ?? REFLECTION_WAVE.amplitudePx;
  const wavelengthPx = options.wavelengthPx ?? REFLECTION_WAVE.wavelengthPx;
  const stepPx = options.stepPx ?? REFLECTION_WAVE.stepPx;
  const fadePx = options.fadePx ?? REFLECTION_WAVE.fadePx;
  const phase = options.phase ?? 0;
  if (points.length < 2) return points.map((point) => ({ ...point }));

  const segLens: number[] = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = imageDist(points[index], points[index + 1]);
    segLens.push(length);
    total += length;
  }
  if (total < 1e-6) return points.map((point) => ({ ...point }));

  const vertexS: number[] = [0];
  let acc = 0;
  for (const length of segLens) {
    acc += length;
    vertexS.push(acc);
  }

  const taperAt = (s: number): number => {
    let nearest = Infinity;
    for (const vertex of vertexS) {
      nearest = Math.min(nearest, Math.abs(s - vertex));
    }
    return smooth01(nearest / fadePx);
  };

  const out: ReflectionImagePoint[] = [];
  let s = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = segLens[index];
    if (length < 1e-6) continue;
    const tx = (end.imageX - start.imageX) / length;
    const ty = (end.imageY - start.imageY) / length;
    const nx = -ty;
    const ny = tx;
    const samples = Math.max(1, Math.ceil(length / stepPx));
    for (let k = 0; k < samples; k += 1) {
      const local = (k / samples) * length;
      const along = s + local;
      const t = local / length;
      const amp = amplitudePx * taperAt(along);
      const off =
        amp * Math.sin((2 * Math.PI * along) / wavelengthPx + phase);
      out.push({
        imageX: start.imageX + (end.imageX - start.imageX) * t + nx * off,
        imageY: start.imageY + (end.imageY - start.imageY) * t + ny * off,
      });
    }
    s += length;
  }
  const last = points[points.length - 1];
  out.push({ imageX: last.imageX, imageY: last.imageY });
  return out;
}
