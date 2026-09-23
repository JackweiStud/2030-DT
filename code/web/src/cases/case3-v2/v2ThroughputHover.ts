/** Case3 V2 吞吐图绘图区；与 ThroughputCompareCard 内坐标一致。 */
export const CASE3V2_THR_PLOT = {
  artW: 602,
  artH: 176,
  left: 29.264,
  right: 593.639,
  top: 4.591,
  bottom: 159.165,
} as const;

function plotWidth(): number {
  return CASE3V2_THR_PLOT.right - CASE3V2_THR_PLOT.left;
}

/** 绘图区 X → 最近整数样点号；落在轴外返回 null。 */
export function thrHoverNoFromLocalX(
  localX: number,
  minNo: number,
  maxNo: number,
): number | null {
  const width = plotWidth();
  if (localX < CASE3V2_THR_PLOT.left || localX > CASE3V2_THR_PLOT.right) {
    return null;
  }
  const slots = maxNo - minNo + 1;
  if (slots <= 1) return minNo;
  const t = (localX - CASE3V2_THR_PLOT.left) / width;
  const no = Math.round(minNo + t * (slots - 1));
  if (no < minNo || no > maxNo) return null;
  return no;
}

function boardScale(el: HTMLElement): number {
  const cssWidth = el.getBoundingClientRect().width;
  const layoutWidth = el.offsetWidth;
  return cssWidth > 0 && layoutWidth > 0 ? cssWidth / layoutWidth : 1;
}

export function localXFromClient(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  const scale = boardScale(el);
  return (clientX - rect.left) / scale;
}
