/**
 * V2 吞吐折线：按 baseRoute 顺序索引分段。
 * 相邻 route 点才用 L 连接；缺口新开 M，不补 0，不跨缺口画线。
 */

export type ThroughputPathPoint = {
  no: number;
  x: number;
  y: number;
};

/**
 * 相邻判定只用 routeNos 的顺序下标，不用数值 no+1。
 */
export function segmentedThroughputPath(
  routeNos: ReadonlyArray<number>,
  points: ReadonlyArray<ThroughputPathPoint>,
): string | undefined {
  if (points.length === 0) return undefined;
  const routeIndex = new Map<number, number>();
  for (let i = 0; i < routeNos.length; i += 1) {
    const no = routeNos[i];
    if (no === undefined || routeIndex.has(no)) continue;
    routeIndex.set(no, i);
  }
  const parts: string[] = [];
  let prevIndex: number | undefined;
  for (const point of points) {
    const index = routeIndex.get(point.no);
    const connected =
      prevIndex !== undefined &&
      index !== undefined &&
      index === prevIndex + 1;
    parts.push(`${connected ? "L" : "M"}${point.x} ${point.y}`);
    prevIndex = index;
  }
  return parts.join(" ");
}
