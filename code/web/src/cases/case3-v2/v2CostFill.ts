/**
 * V2 Cost 中间亮带：aux/edge 固定，只移动 fill，不拉伸 PNG。
 * 冻结 50% 带顶 = 94px；100%→42px，0%→146px。
 */

export const CASE3V2_COST_FILL = {
  topAt100: 42,
  topAt0: 146,
  width: 183,
  height: 25,
} as const;

export type CostFillStyle = {
  display: "none" | "block";
  top?: string;
  transform?: string;
  transformOrigin?: string;
};

/**
 * 空值隐藏 fill。有值时按百分比上下移动，并用 scaleX/translateX 适配透视。
 */
export function costFillStyle(
  value: number | null | undefined,
  side: "without" | "with",
): CostFillStyle {
  if (value == null || !Number.isFinite(value)) {
    return { display: "none" };
  }
  const pct = Math.max(0, Math.min(100, value));
  const t = 1 - pct / 100;
  const top =
    CASE3V2_COST_FILL.topAt100 +
    t * (CASE3V2_COST_FILL.topAt0 - CASE3V2_COST_FILL.topAt100);
  const scaleX = 0.82 + t * 0.36;
  const shift = (side === "without" ? 1 : -1) * ((pct - 50) / 50) * 10;
  return {
    display: "block",
    top: `${top}px`,
    transform: `translateX(${shift}px) scaleX(${scaleX})`,
    transformOrigin: "center center",
  };
}
