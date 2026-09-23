/** Case4 路径业务规则；显示用的波纹几何在 cases/shared 中复用。 */

import type { ReflectionPayload, XYZ } from "../../types";

export {
  REFLECTION_WAVE,
  losLabelPosition,
  offsetPolylineSine,
  reflectionWavePhase,
  type ReflectionImagePoint,
} from "../../../shared/reflectionGeometry";

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
  if (reflection.los === true) {
    paths.push({ id: "los", kind: "los", points: [ue, bs] });
  }
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

export function reflectionRiLabel(id: number): string {
  return `NLOS R${id}`;
}
