# case2 Gate 1 设计冻结

## 决议

用户于 2026-07-30 审阅 `03-design/case2/case2-dt-calibration.pen`，确认其效果符合预期。case2 Gate 1 设计状态正式冻结为 `APPROVED / frozen`。

## 冻结范围

- 三个 1920×1080 Pencil frame：initial、calibrating、completed；failed 是同布局下基于 error token 的 HTML 视觉派生态。
- 共享 Header 视觉引用、左右主面板结构、三项热力图配对、三组 KPI 对比与状态反馈。
- 动态内容的分层边界：热力色场、CDF、均值与降幅由运行时渲染；设计源只表达布局、样式和代表态。

## 证据

- 设计源：`03-design/case2/case2-dt-calibration.pen`
- 结构/视觉差异：`03-design/case2/Visual_Diff.md`
- 前端设计规格：`03-design/case2/Frontend_Spec.md`
- 冻结记录：`03-design/case2/Freeze_Note.md`

## 已接受边界

- 补建的 initial、calibrating 没有原始整页 UX，但已由用户审阅接受；failed 未在 `.pen` 中单列 frame，其 HTML 视觉派生态已于 Gate 1.5 由用户人工检查接受。
- Calibrated 热力图代表态不等于真实运行结果；Gate 1.5/实现必须以数据驱动层替代。
- 当前 Header 文案以冻结设计源为准；任何改名、布局或资产调整都需要重新冻结。

## 下一步

Gate 1.5 静态 HTML 已验收，Gate 2 API 契约 v1 已批准。当前 Gate 3 两份 SPEC 未获用户批准前，不得开始 Node 适配服务或业务实现。
