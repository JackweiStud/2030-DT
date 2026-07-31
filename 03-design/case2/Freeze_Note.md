# Freeze Note

status: APPROVED
version: v1.0 frozen
date: 2026-07-30

## Source Files

- `02-ux/case2/case2整体效果图.png`
- `02-ux/case2/左侧/左侧界面整体.png`
- `02-ux/case2/右侧/右侧整体效果.png`
- 用户提供的导航、品牌、面板、图标和热力底图资产。

## Final Pencil File

`03-design/case2/case2-dt-calibration.pen`

## Approved Frames

- `case2.initial`
- `case2.calibrating`
- `case2.completed`

## Known Gaps Accepted for This Freeze

- initial、calibrating 为在完成态结构上补建的 Pencil frame；用户已审阅批准。
- failed 不在 `.pen` 中单列 frame；其 error-token HTML 视觉派生态已在 Gate 1.5 由用户人工检查接受。
- Calibrated 热力图的代表态使用固定底图与改善色层；正式运行必须由前端动态热力层替代。
- CDF、均值、降幅均为运行时数据；设计中使用代表态或占位符，禁止写死 PNG 数值和 50%。

## Handoff

- Visual validation: `Visual_Diff.md`
- Frontend design specification: `Frontend_Spec.md`
- Gate 1.5：四态静态 HTML 已由用户人工检查接受；下一步经授权进入 Gate 2 API 契约，不接真实文件交互或 Node 适配服务。

## Approval

- Approved by: Jack
- Approval note: 已检查完成，符合预期效果。
