# 设计工具决策

## 决定

- Gate 1 采用 Pencil 作为 case2 可编辑、可冻结的设计源。
- 当前模式：标准重建。目标是设计评审与后续前端交接，不是一次性 PNG 像素描摹。
- 现有 PNG UX 是视觉输入；它们不构成最终视觉契约。

## 冻结结果

- 设计源：`03-design/case2/case2-dt-calibration.pen`。
- 画布：1920×1080；三个 Pencil frame：initial、calibrating、completed；failed 是 Gate 1.5 HTML 视觉派生态。
- 结构/视觉证据：`03-design/case2/Visual_Diff.md`、`Frontend_Spec.md`。
- 用户已于 2026-07-30 审阅并确认设计效果符合预期；冻结状态为 `APPROVED`。
- initial、calibrating 是基于完成态结构补建的 Pencil frame；failed 作为 HTML 派生态已获用户人工检查接受。

## 后续规则

- 任何修改 `.pen` 的状态、布局、品牌/标题文案、资产或动态层语义，均需新的用户视觉确认后重新冻结。
- Gate 1.5 静态 HTML 已验收，Gate 2 API 契约 v1 已批准；当前 Gate 3 两份 SPEC 未获用户批准前不得进入实现。

## 不做

- 不将热力图、CDF、柱图或运行时降幅烘焙为静态业务事实。
- 不自造品牌、业务关键图标或热力地图资产。
- 不把 UX PNG 直接作为正式运行资源。
