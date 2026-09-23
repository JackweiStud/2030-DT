export type ReflectionImagePoint = { imageX: number; imageY: number };

export const REFLECTION_WAVE = {
  amplitudePx: 4,
  wavelengthPx: 32,
  stepPx: 4,
  fadePx: 14,
  phaseStep: (2 * Math.PI) / 3,
} as const;

export function reflectionWavePhase(pathIndex: number): number {
  return pathIndex * REFLECTION_WAVE.phaseStep;
}

export function losLabelPosition(
  ue: ReflectionImagePoint,
  bs: ReflectionImagePoint,
  offsetPx = 18,
): ReflectionImagePoint {
  const midX = (ue.imageX + bs.imageX) / 2;
  const midY = (ue.imageY + bs.imageY) / 2;
  const dx = bs.imageX - ue.imageX;
  const dy = bs.imageY - ue.imageY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { imageX: midX, imageY: midY - offsetPx };
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

function smooth01(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

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
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) {
    return points.map((point) => ({ ...point }));
  }

  const segments: { start: ReflectionImagePoint; end: ReflectionImagePoint; length: number }[] = [];
  let total = 0;
  let start = first;
  for (const end of points.slice(1)) {
    const length = imageDist(start, end);
    segments.push({ start, end, length });
    total += length;
    start = end;
  }
  if (total < 1e-6) return points.map((point) => ({ ...point }));

  const vertexS: number[] = [0];
  let acc = 0;
  for (const { length } of segments) {
    acc += length;
    vertexS.push(acc);
  }
  const taperAt = (s: number) => {
    let nearest = Infinity;
    for (const vertex of vertexS) nearest = Math.min(nearest, Math.abs(s - vertex));
    return smooth01(nearest / fadePx);
  };

  const out: ReflectionImagePoint[] = [];
  let s = 0;
  for (const { start: segmentStart, end, length } of segments) {
    if (length < 1e-6) continue;
    const tx = (end.imageX - segmentStart.imageX) / length;
    const ty = (end.imageY - segmentStart.imageY) / length;
    const samples = Math.max(1, Math.ceil(length / stepPx));
    for (let k = 0; k < samples; k += 1) {
      const local = (k / samples) * length;
      const along = s + local;
      const t = local / length;
      const amplitude = amplitudePx * taperAt(along);
      const offset = amplitude * Math.sin((2 * Math.PI * along) / wavelengthPx + phase);
      out.push({
        imageX: segmentStart.imageX + (end.imageX - segmentStart.imageX) * t - ty * offset,
        imageY: segmentStart.imageY + (end.imageY - segmentStart.imageY) * t + tx * offset,
      });
    }
    s += length;
  }
  out.push({ imageX: last.imageX, imageY: last.imageY });
  return out;
}
