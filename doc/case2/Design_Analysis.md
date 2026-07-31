# Design Analysis

## 执行模式

- 模式：标准重建。
- 执行授权：用户已确认 `Pen_Plan.md` 并授权创建新 `.pen`；设计源于 2026-07-30 完成并冻结。
- 可直接用于生产开发：否；需要 Pencil 结构/视觉验证、前端规格和人工冻结后才可交接。

## 页面目标与用户任务

- 页面目标：在单一 1920×1080 内部演示舞台，讲清 Initial DT 与 Calibrated DT 的误差改善。
- 用户任务：查看基线，启动 `with dt` 校准，等待结果，比较三项误差并重置回初始状态。
- 视觉优先级：当前状态/启动操作 > Initial/Calibrated 空间对比 > KPI 分布与均值结论 > 装饰背景。

## 页面状态

- `initial`：Initial 已加载；Calibrated/右侧对比处于等待态。
- `calibrating`：按钮反馈、动态等待态，不显示旧结果。
- `execute-success-waiting`：后端命令成功但结果未完整发布；视觉上仍不可误判为完成。
- `completed`：六张热力图与三组 KPI 对比可见。
- `failed`：Initial 保留，Calibrated 清空，显示错误与重试。
- `resetting`：等待 `status="reinit complete"` 后过渡到 `initial`；若收到 `execute fail` 则显示执行命令失败；无需独立最终 frame。

## UX 层次与信息架构

| 层级 | 识别结果 | 说明 | 风险 |
|---|---|---|---|
| 页面层 | DT Calibration 演示页 | 证明校准降低误差 | 完成态被误作首屏 |
| 区域层 | Header、左对比区、右 KPI 区、反馈层 | 左右两块主面板并列 | 小窗口下不可各自再缩放 |
| 组件层 | Tab、状态徽章、操作按钮、热力卡片、CDF 图、柱图 | 三项指标重复呈现 | 重复组件若不抽象会形成魔法坐标 |
| 内容层 | 指标名、Initial/Calibrated、数值、单位、下降比例 | 数字来自当前样本 | 不能冻结 PNG 数字 |
| 装饰层 | 暗色背景、面板底纹、边框、图标、热力底图 | 服务于信息分区 | 品牌/底图不可 AI 自造 |

## 大布局与小布局

| 区域/组件 | 布局规则 | 适配/实现约束 |
|---|---|---|
| Page/Stage | 固定 1920×1080 画布，Header + 内容区 | 由共享 Shell 整体等比缩放，不做业务页面二次缩放 |
| Header | 品牌/标题在左，四 Tab 在右 | Shell 组件；Tab 文本/激活态不进入 case2 业务状态 |
| 内容区 | 左侧测试对比与右侧 KPI 面板横向并列 | 两面板保持比例；较小窗口随 Stage 整体缩放 |
| 热力图行 | 指标标签 + Initial/Calibrated 两张等尺寸地图卡 | 使用可复用 `MetricHeatmapPair`，卡片内底图和动态层分开 |
| KPI 行 | 指标标题 + 左 CDF + 右均值对比 | 使用可复用 `KpiComparisonRow`；数值/降幅动态绑定 |

## 核心组件

| 组件 | 作用 | 是否复用 | 输入数据 | 备注 |
|---|---|---|---|---|
| `CaseNav` | 顶部 Tab 与激活态 | Shell 复用 | active case | 不持有业务文件状态 |
| `CalibrationControls` | 启动/重置/反馈 | case2 独立 | UI 状态、命令结果 | 不展示未确认的后端细节 |
| `MetricHeatmapPair` | 一项指标的 Initial/Calibrated 配对图 | case2 内复用三次 | 两个矩阵、显示状态 | 底图 PNG + 前端动态热力层 |
| `KpiComparisonRow` | CDF 与均值/降幅对比 | case2 内复用三次 | 两组 KPI 样本 | CDF/柱图由前端渲染 |
| `StatusFeedback` | 等待、失败、截图保存反馈 | case2 内复用 | UI 状态 | 当前 UX 需补建 |

## 设计语言（观察值）

| 类别 | 观察 | 置信度 | 待确认 |
|---|---|---|---|
| 颜色 | 深色背景；蓝/青为激活与 Calibrated；灰为 Initial；紫/黄区分指标 | 高 | 精确 token 从 Pencil 测量/人工确认 |
| 字体 | 白色标题与数字，辅助文本减弱 | 中 | 字体家族、字号层级、数字格式 |
| 间距 | 面板内统一留白，三行指标等节奏堆叠 | 中 | token 化尺寸 |
| 圆角/边框 | 深灰面板、细边框、圆角卡片 | 高 | 精确半径与透明度 |

## Asset Source Plan

| Asset/Layer | Type | Decision | Reason | Owner | Fallback | Freeze requirement |
|---|---|---|---|---|---|---|
| 云上外场图标 | 品牌资产 | 使用用户 PNG | 品牌不可 AI 自造 | 用户提供 | 占位框 | 必须保留或获替换批准 |
| 导航栏/面板背景 | 静态视觉资产 | 使用用户 PNG 作参考或嵌入 | 细节复杂、当前已提供 | 用户提供 | Pencil 近似 shape | 冻结时确认 |
| `heatmap_map.png` | 复杂固定底图 | 使用用户 PNG | 地图细节不应重绘 | 用户提供 | 当前 UX 裁切 | 必须复用 |
| 热力色场 | 数据动态图层 | 前端 canvas/SVG | 随矩阵和状态变化 | 前端 | Pencil 代表态 | 前端规格必需 |
| CDF/柱图 | 数据可视化 | 前端 SVG/canvas | 依赖 KPI 数据与运行时数值 | 前端 | Pencil 代表态 | 前端规格必需 |
| 指标图标 | 业务 UI 图标 | 使用用户 PNG | 已提供且视觉一致 | 用户提供 | 标记缺失 | 冻结时确认 |

## 不确定项与风险

| 问题 | 影响 | 建议确认方式 |
|---|---|---|
| `.pen` 目标路径 | 已解决 | 已冻结为 `03-design/case2/case2-dt-calibration.pen` |
| 初始/校准中/失败态没有原始 UX | 已接受 | 已按 `UX-STATE-MAP.md` 补建，用户于 2026-07-30 审阅批准 |
| Header 当前文案 | 已接受 | 以冻结设计源为准；后续改名需要重新冻结 |
| 精确颜色、字体、间距未提取 | 影响像素级一致性 | 在 Pencil 中测量/变量化后截图比对 |
| 结果发布与截图输出路径未冻结 | 不阻塞视觉设计 | 留到 Gate 2/3，不写成 UI 事实 |
