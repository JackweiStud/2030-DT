# Pencil Plan

## Target

- Output `.pen`：`03-design/case2/case2-dt-calibration.pen`，已冻结。
- Canvas size：1920×1080。
- Quality bar：标准重建；结构可评审、可迭代、可冻结，并为 Gate 1.5 前端静态验收提供目标。
- Existing `.pen` handling：新建；未发现可覆盖的既有 `.pen`。

## Approval Record

- 目标文件已创建：`03-design/case2/case2-dt-calibration.pen`。
- 用户于 2026-07-30 审阅三个 Pencil frame，并在 Gate 1.5 人工检查四个 HTML 视觉状态后确认符合预期。
- 状态：`APPROVED / frozen`。后续修改需要重新审阅；下一阶段经授权进入 Gate 2。

## 修改基线与变更集

| 类别 | 节点/区域 | 处理 | 验证方式 |
|---|---|---|---|
| 保留 | 用户提供品牌、导航/面板视觉、热力地图、指标图标 | 作为真实资产或视觉参考 | 资产路径与 Pencil 截图比对 |
| 新增 | 三个 Pencil frame + failed HTML 派生态 | 统一组件树；failed 复用布局并切换 error token | Pencil `snapshot_layout` + Gate 1.5 人工检查 |
| 新增 | `MetricHeatmapPair`、`KpiComparisonRow`、`StatusFeedback` | 建为可读组件/语义分组 | `batch_get` 检查命名与复用 |
| 更新 | 完成态中的固定数值/50% 标记 | 改为动态数据占位与绑定说明 | UX 状态映射核对 |
| 禁止触碰 | 未启动 case 的业务画面与共享 Shell 业务状态 | 不在 case2 `.pen` 中猜测 | 范围复扫 |

## Frames

| Frame | 状态 | Source image | 说明 |
|---|---|---|---|
| `case2.initial` | Initial 就绪 | 现有完成态拆图 + 主线语义 | Calibrated/右侧对比为空态或等待态 |
| `case2.calibrating` | 校准中 | 现有完成态布局 | 保留 Initial；显示进行中；不显示旧结果 |
| `case2.failed` | 校准失败 | 现有完成态布局 | Gate 1.5 HTML 派生态；保留 Initial、失败反馈与重试动作 |
| `case2.completed` | 校准完成 | `02-ux/case2/case2整体效果图.png` | 结构化复刻完成态，数值为动态占位 |

## Component Tree

```text
Case2Frame
├── ShellHeader (共享视觉引用)
│   ├── Brand
│   ├── Title
│   └── CaseNav
├── CalibrationComparisonPanel
│   ├── PanelHeader
│   │   ├── InitialLabel
│   │   ├── CalibratedLabel + StatusBadge
│   │   └── CalibrationControls
│   └── MetricHeatmapPair × 3
│       ├── InitialHeatmapCard
│       └── CalibratedHeatmapCard
├── KpiComparisonPanel
│   └── KpiComparisonRow × 3
│       ├── CdfChartArea
│       └── AverageComparisonArea
└── StatusFeedback
```

## Reusable Components

| Component | Props | Usage | Notes |
|---|---|---|---|
| `MetricHeatmapPair` | metric, initialState, calibratedState | RSS、有效路径数、首径时延 | 底图固定，热力色场前端渲染 |
| `KpiComparisonRow` | metric, initialValue, calibratedValue, delta | 三组 KPI | delta 为计算结果，不是设计常量 |
| `StatusFeedback` | state, message, action | initial/calibrating/failed/completed | 完成状态可弱化，不能抢结论层级 |
| `CaseNav` | tabs, activeTab | Shell 视觉引用 | 不合并 case2 业务逻辑 |

## Diagram Decomposition

| Diagram | Static assets | Frontend-rendered layers | Parameters | Reference frames |
|---|---|---|---|---|
| 热力图 | `heatmap_map.png`、标题底图 | 插值色场、马赛克网格、透明叠加 | matrix, valueRange, status | initial/completed |
| CDF 图 | 网格/坐标轴视觉样式 | Initial/Calibrated 阶梯线、图例 | initialSamples, calibratedSamples | completed |
| 均值柱图 | 标题/分割线/指标图标 | 两根柱、数值、降幅标签 | initialMean, calibratedMean, reduction | completed |

## Layout Contract

### Page

- Layout type：固定 1920×1080 舞台内的 Header + 双面板仪表盘。
- Primary axis：内容区横向；各面板内纵向三行指标。
- Breakpoints：不做 case-local reflow；由 Shell 整体等比缩放。
- Scroll behavior：目标画布内不滚动；小窗口保持完整缩放可见。

### Regions

| Region | Parent | Sizing | Grid/Flex/Stack Rule | Gap | Padding | Overflow |
|---|---|---|---|---|---|---|
| Header | Case2Frame | 固定高度 | 品牌/标题左，Tab 右 | token 待测量 | token 待测量 | clip 仅限装饰背景 |
| 左侧对比区 | ContentRow | 主面板比例固定 | 标题区 + 三行 HeatmapPair | 行间距 token | 面板内边距 token | 卡片裁切圆角 |
| 右侧 KPI 区 | ContentRow | 主面板比例固定 | 三行 KpiComparisonRow | 行间距 token | 面板内边距 token | 图表裁切按绘图区 |
| HeatmapPair | 左侧对比区 | 两列等宽 | Initial/Calibrated 横向 pair | 列间距 token | 卡片 padding token | 地图 fit，不拉伸 |

## Tokens Draft

| Token | Value | Usage | Confidence |
|---|---|---|---|
| `color.surface` | 深色面板，精确值待提取 | 主面板/卡片 | 中 |
| `color.initial` | 灰色 | Initial 图例/柱 | 高 |
| `color.calibrated` | 青蓝色 | Calibrated 图例/柱/状态 | 高 |
| `color.metric-rss/path/delay` | 蓝/紫/黄系 | 三项指标区分 | 中 |
| `radius.panel` | 待测量 | 面板和热力卡片 | 中 |
| `space.panel/row/column` | 待测量 | 主布局与重复行 | 低 |

## Missing States To Add

| State | Reason | Visual treatment | Needs approval |
|---|---|---|---|
| initial | 现有 UX 仅完成态 | Calibrated 与 KPI 对比为清晰空态/等待态 | 是 |
| calibrating | 防止用户误以为旧结果是新结果 | 状态徽章、按钮禁用、结果区等待反馈 | 是 |
| failed | 演示不能只覆盖成功路径 | Initial 保留、错误说明、重试动作 | 是 |
| execute-success-waiting | `execute success` 不等于完成 | 可并入 calibrating，文字区分等待结果 | 是 |

## Approval Decisions

| 项目 | 决议 | 约束 |
|---|---|---|
| `.pen` 输出路径 | 已使用 `03-design/case2/case2-dt-calibration.pen` | 后续修改不得覆盖冻结基线而不重新审阅 |
| 设计状态 | Pencil：initial / calibrating / completed；HTML 派生：failed | 变更 Pencil frame 须重新冻结；变更 failed HTML 态须重新验收 |
| Header 标题 | 当前设计源文案已获接受 | 改名属于视觉变更，需重新冻结 |
| 未提供状态的视觉方向 | 已按完成态结构，以状态徽章/空态/失败反馈补建 | 后续真实 UX 输入可触发重新评审 |
