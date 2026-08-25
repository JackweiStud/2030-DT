/**
 * 旧 Case3 徽标文案 -> V2 冻结稿文案。
 * 不改 reducer / presentation。
 */

const IDLE_BADGES = new Set(["等待启动测试", "等待无DT测试完成"]);

export function toCase3V2SideStatus(badge: string): string {
  if (IDLE_BADGES.has(badge)) return "未开始";
  if (badge === "测试中") return "测试中…";
  if (badge === "已完成") return "已结束";
  return badge;
}

export function case3V2StatusClass(status: string): string {
  if (status === "测试中…") return "is-running";
  if (status === "已结束") return "is-done";
  return "";
}
