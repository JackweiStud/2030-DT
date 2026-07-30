# case2 DT Calibration — Visual Diff（Gate 1）

> **状态：`APPROVED / frozen`**（用户于 2026-07-30 完成视觉审阅）
> **设计源：** `03-design/case2/case2-dt-calibration.pen`
> **验证时间：** 2026-07-30（对照左右 UX 高保真，重做层次/Flex）

## 0. 验证摘要

| 检查项 | 结果 |
|---|---|
| Pencil MCP | 通过 |
| 四 frame 1920×1080 | 通过（`x23mKG` / `n1oqlQ` / `M7TZR` / `rdP2e`） |
| 可复用组件 | 通过：`StatusFeedback` / `MetricHeatmapPair` / `KpiComparisonRow` |
| 左栏 vs `左侧界面整体.png` | 层次对齐（§4） |
| 右栏 vs `右侧整体效果.png` | 层次对齐（§4） |
| `problemsOnly`（`EM3U1`/`XNGat`） | 无问题 |
| Pencil 截图 vs UX | completed 结构已对齐；细节仍为代表态 |

---

## 1. 本轮层次 / Flex 修正（对照 UX）

### 左栏（`左侧界面整体.png`）

| UX 要求 | 修正前 | 修正后 |
|---|---|---|
| 指标标签叠在每张热力卡左上 | 侧栏 `Wya3U` 独立标签列 | 已删侧栏；`MetricTag` absolute 于 Initial/Calibrated 卡内 |
| 列头两列等宽对齐热力卡 | Initial 带 `padding-left:100` 对齐旧侧栏 | `InitialLabel fill` + `Calibrated列头 fill (space-between)` |
| 启动/清除靠 Calibrated 列右侧 | 与两列并列第三段 | 收入 `Calibrated列头` |
| 面板标题青竖条 | 无 | 与右栏一致加装饰条 |
| 3×2 热力均分 | 部分态行丢失 | 四态均补齐 3 行 `MetricHeatmapPair` |

### 右栏（`右侧整体效果.png`）

| UX 要求 | 修正前 | 修正后 |
|---|---|---|
| 指标标题在上、整行宽 | 左侧竖条标题列 `width:120` | `layout:vertical` → `MetricHeader` 整行 |
| 下排 CDF \| 柱图 | 与标题三栏横排 | `图表行` horizontal：CDF `fill` + 柱图 ~260px |

**组件树（completed）：**

```
EM3U1 CalibrationComparisonPanel (column)
  PanelHeader / 列头行 / Hz0N4 热力图行组 (column fill)
    MetricHeatmapPair (row: Initial fill | Calibrated fill)

XNGat KpiComparisonPanel (column)
  KPI标题行 / dHh6h KPI对比行组 (column fill)
    KpiComparisonRow (column: 标题 | 图表行)
      图表行 (row: CDF fill | 柱图 fixed)
```

---

## 2. 布局快照（top-level）

| Frame | ID | 尺寸 |
|---|---|---|
| `case2.initial` | `x23mKG` | 1920×1080 |
| `case2.calibrating` | `n1oqlQ` | 1920×1080 |
| `case2.failed` | `M7TZR` | 1920×1080 |
| `case2.completed` | `rdP2e` | 1920×1080 |

| 可复用组件 | ID | 结构 |
|---|---|---|
| `StatusFeedback` | `V5nR3F` | hug |
| `MetricHeatmapPair` | `wwZ1i` | 两卡横排，标签叠卡 |
| `KpiComparisonRow` | `m3I4rD` | 上标题 + 下图表行 |

---

## 3. 组件 / 资产抽查

**动态契约（未烘焙业务数）：** `{initialMean}` / `{calibratedMean}` / `↓ {reductionPct}%`

| 资产 | 用途 |
|---|---|
| `左侧/RSS整体效果.png` | Initial/Calibrated 热力底图代表态 |
| `左侧/左侧面板背景图.png` | 左栏底纹 |
| `右侧/右侧面板背景图.png` | 右栏底纹 |
| `右侧/子左/元素/*图标.png` | KPI 指标图标 |

---

## 4. Pencil 截图 vs UX 对照（`rdP2e`）

| 对比 | UX 参考 | Pencil | 判定 |
|---|---|---|---|
| 左层次/Flex | `左侧界面整体.png` | 无侧栏；标签叠卡；两列等宽；控制在 Calibrated 列 | **结构对齐** |
| 右层次/Flex | `右侧整体效果.png` | 上标题下双图；CDF fill / 柱图固定 | **结构对齐** |
| 热力色差 | UX Initial 红热 / Calibrated 绿冷 | Calibrated 用绿罩代表改善 | 代表态；缺独立 Calibrated 切图 |
| CDF/柱图 | 阶梯线+ghost+降幅 | 结构在；细节密度弱于 UX | 代表态；数值不写死 |

---

## 5. 偏差清单

| ID | 严重度 | 描述 | 需拍板 |
|---|---|---|---|
| V-001 | important | initial / calibrating / failed 无 UX 整页，按语义补建 | 用户已审阅并接受 |
| V-002 | minor | Header 使用当前设计源中的文案 | 用户已审阅并接受；后续改名需重新冻结 |
| V-003 | minor | CDF/柱图刻度密度与 ghost 精度弱于 UX | 可选 |
| V-004 | important | Calibrated 热力无独立 UX 切图，当前同底图+绿罩 | 用户已审阅并接受；运行时仍须以动态数据层实现 |
| V-005 | minor | token（间距/字号）仍以 `.pen` 为实现测量源 | Gate 1.5 前读取 `.pen`，不改变视觉结论 |

---

## 6. 结论

- **状态：`APPROVED / frozen`**
- **blocking：无**（相对左右 UX，层次与 Flex 已对齐；补建态和代表态已获用户批准）
- 下一步：经授权进入 Gate 1.5 静态 HTML 验收；不接共享目录或实际状态机。
