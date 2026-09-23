/**
 * V2 吞吐折线：按独立吞吐样点序号分段。
 * 连续样点用 L 连接；缺口新开 M，不补 0，不跨缺口画线。
 */

export type ThroughputPathPoint = {
  no: number;
  x: number;
  y: number;
};

/**
 * 吞吐样点不依赖结构 route；只有真实连续的 no 才连接。
 */
export function segmentedThroughputPath(
  points: ReadonlyArray<ThroughputPathPoint>,
): string | undefined {
  if (points.length === 0) return undefined;
  const parts: string[] = [];
  let prevNo: number | undefined;
  for (const point of [...points].sort((a, b) => a.no - b.no)) {
    const connected = prevNo !== undefined && point.no === prevNo + 1;
    parts.push(`${connected ? "L" : "M"}${point.x} ${point.y}`);
    prevNo = point.no;
  }
  return parts.join(" ");
}
