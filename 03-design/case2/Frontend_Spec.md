# case2 DT Calibration — Frontend Spec（Gate 1 草案）

> **状态：`APPROVED / frozen`**（用户于 2026-07-30 完成视觉审阅）
> **设计源：** `03-design/case2/case2-dt-calibration.pen`（2026-07-29 重建 + 视觉迭代 + 布局重验）
> **验证：** 见 `Visual_Diff.md`（snapshot_layout / problemsOnly / batch_get / 截图）
> Gate 1 视觉已冻结；Gate 1.5 前仍不得进入真实文件交互、Node 适配服务或业务实现。
> **已确认：** 面板 PNG 底纹已嵌入；降幅为 `{reductionPct}%`；CDF/热力为代表态非烘焙业务数据。

## 1. 设计源与范围

| 项 | 值 |
|---|---|
| 目标设计源 | `03-design/case2/case2-dt-calibration.pen` |
| 画布 | 1920×1080 固定舞台；由共享 Shell 整体等比缩放 |
| 活跃 case | case2（DT Calibration Tab） |
| 业务状态 frame | `case2.initial` / `case2.calibrating` / `case2.failed` / `case2.completed` |
| 模式 | 标准重建；Gate 1 视觉与结构交接，不含 API/Node 实现 |

### 1.1 状态与外部条件映射

| Frame | UI 语义 | 外部条件 | Calibrated / KPI 区 |
|---|---|---|---|
| `case2.initial` | 初始就绪 | `command=init`，`status=""` | 空态/等待态；不展示对比结论 |
| `case2.calibrating` | 校准中（含 execute-success-waiting） | 已写 `start+with dt`，未 `case complete` | 进行中反馈；禁用复用旧结果 |
| `case2.failed` | 校准失败 | `status="execute fail"` | 失败说明；Calibrated 清空 |
| `case2.completed` | 校准完成 | `status="case complete"` 且结果批次完整 | 六热力图 + 三组 CDF/均值 |

**禁止口径：** `execute success` 不得呈现为 completed；现有参考 Calibrated 文件不等于本次真实采集。

---

## 2. 页面组件树

```text
.case2-page (1920×1080)
├── ShellHeader [CaseNav — Shell 共享视觉，不含 case2 业务状态]
│   ├── BrandLogo          → 02-ux/case2/云上外场.png
│   ├── BrandLabel         → "云上外场"
│   ├── PageTitle          → "IMT-2030 DT测试"（待确认文案）
│   ├── NavBackground      → 02-ux/case2/导航栏背景图.png
│   └── CaseNav            → DT Construction | DT Calibration* | DT for Comm | DT for positioning
├── ContentRow (horizontal, fill)
│   ├── CalibrationComparisonPanel (left, ~58% 视觉比例，Pencil 测量后冻结)
│   │   ├── PanelHeader: 青竖条 + "测试对比" | "现场环境 >"
│   │   ├── 列头行 (horizontal, 两列等宽)
│   │   │   ├── InitialLabel (fill)
│   │   │   └── Calibrated列头 (fill, space-between)
│   │   │       ├── CalibratedLabel + StatusFeedback
│   │   │       └── CalibrationControls: 启动 | 清除
│   │   └── MetricHeatmapPair × 3 (vertical fill 均分)
│   │       ├── InitialHeatmapCard (fill) + MetricTag absolute 左上
│   │       └── CalibratedHeatmapCard (fill) + MetricTag absolute 左上
│   └── KpiComparisonPanel (right, fill)
│       ├── PanelTitle 青竖条 + "KPI对比"
│       └── KpiComparisonRow × 3 (vertical fill 均分)
│           ├── MetricHeader 整行 (icon + 中英文)
│           └── 图表行 (horizontal)
│               ├── CdfChartArea (~60% fill)
│               └── AverageComparisonArea (~40% / 固定宽)
└── StatusFeedback (per-frame variant; 可与列头徽章联动)
```

### 2.1 复用组件 API（设计/实现契约）

#### `MetricHeatmapPair`

| Prop | 类型 | 说明 |
|---|---|---|
| `metric` | `'rss' \| 'effectivePathNum' \| 'firstPathDelay'` | 指标键 |
| `metricLabel` | `string` | 显示名（RSS / Effective Path Num / First Path Delay） |
| `metricTagColor` | `token` | 蓝 / 紫 / 黄系 |
| `initialState` | `'ready' \| 'empty' \| 'loading' \| 'hidden'` | Initial 卡状态 |
| `calibratedState` | `'empty' \| 'loading' \| 'ready' \| 'error'` | Calibrated 卡状态 |
| `initialMatrix` | `number[][] \| null` | 20×20，运行时 |
| `calibratedMatrix` | `number[][] \| null` | 20×20，运行时 |

**静态资产：** `02-ux/case2/左侧/元素/heatmap_map.png`（1974×1100）
**动态层：** 插值色场 + 3×3 马赛克掩膜（α=0.38），前端 canvas/SVG 渲染

#### `KpiComparisonRow`

| Prop | 类型 | 说明 |
|---|---|---|
| `metric` | 同上 | |
| `initialSamples` | `number[] \| null` | KPI 矩阵展平（典型 20 值） |
| `calibratedSamples` | `number[] \| null` | 同上 |
| `displayState` | `'waiting' \| 'loading' \| 'ready' \| 'error'` | 控制空态/占位 |

**派生（运行时，禁止写死）：**

- `initialMean = avg(initialSamples)`
- `calibratedMean = avg(calibratedSamples)`
- `reductionPct = (initialMean - calibratedMean) / initialMean * 100`（initialMean=0 时隐藏或显示 `--`）
- CDF：经验 CDF，51 采样点

**UX 占位修正：** 不得冻结 PNG 中的 `↓50%`；降幅标签文案模板为 `↓ {reductionPct}%`（一位小数，四舍五入策略 Gate 2 定）

#### `StatusFeedback`

| Prop | 类型 | 说明 |
|---|---|---|
| `state` | `'initial' \| 'calibrating' \| 'failed' \| 'completed'` | |
| `message` | `string?` | 失败/等待副文案 |
| `badgeVisible` | `boolean` | 是否显示「已完成」等徽章 |

| state | 徽章/反馈 | 启动 | 清除 |
|---|---|---|---|
| initial | 无或「等待校准」 | 可用 | 禁用/无效 |
| calibrating | 「校准中…」 | 禁用 | 可用 |
| failed | 错误色 + 重试提示 | 可重试 | 可用 |
| completed | 「已完成」（绿） | 禁用或需先清除 | 可用 |

#### `CaseNav`

Shell 级；仅 `activeTab='case2'` 视觉，不读取 case 控制文件。

---

## 3. 布局契约

| 区域 | 父 | 主轴 | 尺寸规则 | Gap/Padding | Overflow |
|---|---|---|---|---|---|
| Page | Shell viewport | — | fixed 1920×1080 | — | hidden（Shell 缩放） |
| ShellHeader | Page | row, space-between | fixed height ~72px（待 Pencil 测量） | 品牌左 / Tab 右 | clip 装饰背景 |
| ContentRow | Page | row | fill 剩余高度 | 列间距 ~24px（待测） | hidden |
| CalibrationComparisonPanel | ContentRow | column | flex ~1.4 | 行间距 ~16px | clip 圆角 |
| KpiComparisonPanel | ContentRow | column | flex ~1 | 行间距 ~16px | clip 圆角 |
| MetricHeatmapPair | 左面板 | row | 两卡 equal fill（无侧栏标签列） | 列 gap ~12px | 地图 fill；标签 absolute |
| HeatmapCard | Pair | none/相对 | equal flex 1 | — | border-radius ~8；MetricTag 叠左上 |
| KpiComparisonRow | 右面板 | column | 上标题 hug + 下图表行 fill | 行内 gap ~8–12px | 图表区 clip |
| 图表行 | KpiComparisonRow | row | CDF fill ~60% + 柱图 ~260–280px | gap ~12px | — |

**响应式：** case2 页面内不做 reflow；小窗口仅随 Shell 等比缩放。

---

## 4. 设计 Token（草案，Pencil 测量后更新）

| Token | 观察值 | 用途 | 置信度 |
|---|---|---|---|
| `color.bg.page` | #0a0e14 附近深黑 | 页面底 | 中 |
| `color.bg.panel` | #121820 附近 | 面板 | 中 |
| `color.text.primary` | #ffffff | 标题/数值 | 高 |
| `color.text.secondary` | #8b949e 附近 | 辅助/图例 | 中 |
| `color.initial` | #6b7280 灰 | Initial 图例/柱/CDF | 高 |
| `color.calibrated` | #22d3ee / #06b6d4 青 | Calibrated 图例/柱/CDF | 高 |
| `color.status.success` | #22c55e 绿 | 已完成徽章 | 高 |
| `color.status.error` | #ef4444 红 | 失败反馈 | 中（待设计确认） |
| `color.metric.rss` | 蓝 #3b82f6 | RSS 标签 | 中 |
| `color.metric.path` | 紫 #a855f7 | 有效路径数 | 中 |
| `color.metric.delay` | 黄 #eab308 | 首径时延 | 中 |
| `radius.panel` | 8–12px | 面板/卡片 | 中 |
| `space.panel.padding` | 16–24px | 面板内边距 | 低 |
| `font.family` | 系统 sans（待确认） | 全局 | 低 |

---

## 5. 资产清单

| 资产 | 路径 | 用途 | 来源 | Pencil 处理 |
|---|---|---|---|---|
| 品牌图标 | `02-ux/case2/云上外场.png` | Header 品牌 | 用户提供 | 嵌入 |
| 导航背景 | `02-ux/case2/导航栏背景图.png` | Header 底 | 用户提供 | 嵌入/参考 |
| 页面背景 | `02-ux/case2/背景图.png` | 可选全页底 | 用户提供 | 参考 |
| 左面板背景 | `02-ux/case2/左侧/左侧面板背景图.png` | 左面板 | 用户提供 | 嵌入/参考 |
| 右面板背景 | `02-ux/case2/右侧/右侧面板背景图.png` | 右面板 | 用户提供 | 嵌入/参考 |
| 热力底图 | `02-ux/case2/左侧/元素/heatmap_map.png` | 六卡共用底图 | 用户提供 | 嵌入（每卡裁剪视口） |
| RSS 图标 | `02-ux/case2/左侧/元素/RSS图标底图.png` | KPI 行 | 用户提供 | 嵌入 |
| 路径数图标 | `02-ux/case2/左侧/元素/pathNum图标底图.png` | KPI 行 | 用户提供 | 嵌入 |
| 时延图标 | `02-ux/case2/左侧/元素/FirstDelay图标底图.png` | KPI 行 | 用户提供 | 嵌入 |
| Initial/Calibrated 列图标 | `图标1.png` / `图标2.png` | 列头 | 用户提供 | 嵌入 |
| 热力色场 | — | 动态 | 前端 | Pencil 代表态占位 |
| CDF 曲线 | — | 动态 | 前端 | Pencil 代表态占位 |
| 均值柱/降幅 | — | 动态 | 前端 | 占位 `{runtime}` |

---

## 6. 动态图形实现契约

### 6.1 热力图（参考 `case2--热力图叠加 1.md`）

```
输入: matrix[20][20], heatmap_map.png
常量:
  MAP 1974×1100
  锚定区 (750,400)-(1200,700) → 450×300
  CELL=3, GAP=1, PERIOD=4, ALPHA=0.38
流程:
  matrix → 双线性插值 450×300 色场 → 伪彩 colormap → 马赛克掩膜 → 与底图 alpha 合成
显示:
  卡片内 object-fit contain；热力层与底图同 transform
状态:
  initial: 仅 Initial 三卡有数据层
  calibrating/failed: Calibrated 卡显示 loading/empty，不渲染旧 cali 矩阵
  completed: 六卡均渲染
```

### 6.2 CDF（参考 `case2-CDF曲线 1.md`）

```
输入: heatmap_{init|cali}_kpi_{metric}.txt → 4×5 → flatten 20 samples
算法: 排序 → F(x_{(k)})=k/n → 51 点均匀采样
渲染: SVG path 阶梯线；Initial 灰 / Calibrated 青
坐标: Y 0–1；X 随样本自适应（UX 参考 1–16）
判读: Calibrated 曲线整体左移 = 误差改善
```

### 6.3 均值对比

```
initialMean, calibratedMean 来自样本均值
柱: Initial 实灰柱；Calibrated 实青柱 + 半透明灰「ghost」至 Initial 高度
降幅徽章: 仅 displayState=ready 且 initialMean>0 时显示
禁止: 写死 50% 或 UX 截图数值
```

---

## 7. 各 Frame 可见性矩阵

| 元素 | initial | calibrating | failed | completed |
|---|---|---|---|---|
| Initial 热力三卡 | 有数据 | 有数据 | 有数据 | 有数据 |
| Calibrated 热力三卡 | 空态文案 | loading | 空态+错误提示 | 有数据 |
| KPI CDF/柱 | 等待态 | 进行中 | 失败/空 | 完整对比 |
| StatusBadge | 隐藏/等待 | 校准中 | 失败 | 已完成 |
| 启动按钮 | enabled | disabled | enabled | disabled* |
| 清除按钮 | disabled | enabled | enabled | enabled |

\* completed 态启动禁用，或 UX 确认需先清除再启动。

---

## 8. 前端验收条件（Gate 1.5 前置）

- [ ] 四个 frame 在 Pencil 中结构完整且命名可读
- [ ] 1920×1080 无 case-local 滚动条
- [ ] 用户 PNG 资产路径与 `.pen` 引用一致
- [ ] 动态区使用占位/代表态，无烘焙业务数据
- [ ] 降幅、均值、CDF 绑定运行时计算说明已写入本文档
- [ ] `Visual_Diff.md` 无 blocking 项

## 9. 明确禁止

- 裸跨 case 类名（如全局 `.metric-card`）
- 将 UX PNG 数值（5.0/3.0/50%）冻结为常量
- 在 `execute success` 或文件已存在时展示 completed
- 隐藏 Tab 继续轮询共享文件
- 无 Pencil 结构证据即进入 Gate 1.5 编码

---

## 10. Frame 节点对照（Pencil）

| Frame | 节点 ID | 说明 |
|---|---|---|
| `case2.initial` | `x23mKG` | Initial 就绪；KPI 等待态 |
| `case2.calibrating` | `n1oqlQ` | 校准中；启动禁用 |
| `case2.failed` | `M7TZR` | 失败反馈；可重试 |
| `case2.completed` | `rdP2e` | 六热力图 + 三 KPI 行 |

| 组件 | 节点 ID |
|---|---|
| `StatusFeedback` | `V5nR3F` |
| `MetricHeatmapPair` | `wwZ1i` |
| `KpiComparisonRow` | `m3I4rD` |

## 11. 冻结决议与后续边界

- 四个 frame、当前 Header 文案、面板 PNG 底纹与补建状态均已由用户审阅批准；变更须重新冻结。
- 精确尺寸/token 以冻结 `.pen` 的测量值为准，Gate 1.5 只能还原，不得自行改视觉方向。
- 下一阶段为静态 HTML 验收；不读取共享目录、不实现控制文件交互、不启动 Node 适配服务。
