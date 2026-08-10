# Freeze Note — case3 Gate 1

```text
status: APPROVED
version: v1.0-frozen
date: 2026-08-09
source: 02-ux/case3/* + 03-design/case3/case3-dt-com.pen
known gaps accepted:
  - Gate 1.5 静态 HTML 只覆盖 initial、without-running、without-completed、with-running、with-completed 和现场环境弹窗；reset/failed 留到后续正式 Web/SPEC 继续细化。
  - 点位进度 >12 滚动边缘视觉、With 禁用 tooltip 文案允许在静态 HTML 中用代表态表达。
  - 地图/波束为 UX 资产 + 代表态，非像素级 3D 复刻
handoff: Pencil frames ×8 + Design_Analysis / Pen_Plan / Visual_Diff / Frontend_Spec
```

## 冻结规则

- 2026-08-09 用户确认 case3 Pencil 文件已全部完成，并授权 Gate 1 冻结。
- 任何改动 `case3-dt-com.pen` 主结构后需重新审阅。

## 范围声明

- 本 Gate 1 冻结后进入 Gate 1.5 静态 HTML；Gate 1.5 **不接** `/api/case3/*`、**不读**共享目录、**不实现**正式状态机、**不启动** Node。
- 不修改 `03-design/case2/case2-dt-calibration.pen`。
- 设计工作目录仅为 `03-design/case3/`。
