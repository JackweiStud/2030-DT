# Frontend Spec — case3 Gate 1 交接

> 设计源：`03-design/case3/case3-dt-com.pen`（`APPROVED`，2026-08-09 用户确认冻结）  
> 契约草案：`doc/case3/API-CONTRACT.md`  
> 目标 viewport：1920×1080（Shell 等比缩放）

## 1. Frame / 状态映射

| Pencil Frame | Web 可见态 | 控制/本地条件（摘要） |
|---|---|---|
| `case3.initial` | initial | 进 Tab；无本轮有效结果 |
| `case3.without-running` | without-running | 本轮 `dt_type=without dt` 且已见 `execute success`，未 complete/fail |
| `case3.without-completed` | without-completed | without 本轮 `execute success → case complete` 且 side 快照有效 |
| `case3.with-running` | with-running | with 侧同上运行中；without 历史可保留 |
| `case3.with-completed` | with-completed | with 本轮 complete；可算 BA 增量 |
| `case3.resetting-without` | resetting-without | reinit + without；等 `reinit complete` |
| `case3.resetting-with` | resetting-with | reinit + with；等 `reinit complete` |
| `case3.failed` | failed-* | 本轮 `execute fail`；对应侧可手动重试 |
| `case3.site-env-modal` | Shell 弹窗 | 非业务态 |

## 2. 组件树（实现应对齐）

```text
Case3Page (.case3-page)
├── ShellHeader（Shell；activeTab=DT for Comm）
├── TestComparePanel
│   ├── PanelHeader（测试对比 / 现场环境）
│   └── SidePair
│       ├── SidePanel side="without"
│       │   ├── SideHeader（icon, label, StatusBadge, StartBtn, ResetBtn）
│       │   ├── MapStage
│       │   │   ├── MapImage（静态）
│       │   │   ├── BaseRouteLayer（init-data）
│       │   │   ├── LiveTrackLayer（points[].ue）
│       │   │   ├── BsMarker / UeMarker
│       │   │   └── （with only）ReflectionLosLayer（points[].reflection）
│       │   ├── BeamCard（without: scanBeamIds+selected；with: selected 预测）
│       │   └── PointProgressWindow（latest 12 of N）
│       └── SidePanel side="with" …
└── KpiComparePanel
    ├── CostCard（costPct 无DT/有DT，文案 `开销(%)`）
    ├── ThroughputCard（throughputGbps by no，图例 `无 DT` / `有 DT`）
    └── BeamAccuracyCard（baseline + 增量派生）
```

CSS 必须以 `.case3-page` 根作用域或 CSS Modules 隔离。

## 3. 数据绑定

| UI | 绑定 | 空/异常 |
|---|---|---|
| 预置路线 | `GET /api/case3/init-data` → baseRoute | 缺则空路线 |
| Without/With 点 | `GET /api/case3/side?side=` → `points` 全量替换 | `ok:false` 不更新 |
| Cost | 同包 `costPct` | `null` → 空，不沿用旧值 |
| Throughput 曲线 | `points[].throughputGbps` 按 `no` | 缺点不补 0 |
| Beam Accuracy | 基线文件 + 同 `no` 的 `selectedBeamId` 对比 | 任意重置回基线；无 without 有效结果不算增量 |
| 点位进度窗口 | `completeCount`；显示 `points.slice(-20)` | 文案标明窗口≠上限 |
| 状态徽标/按钮 | 本地 UI 态 + control snapshot | 互斥：一侧 running/resetting 时另一侧禁用 |
| With Start 启用 | 仅当 without 本轮有效完成 | initial/未完成时 disabled |

## 4. 动态图形实现契约

| 图层 | 技术 | 参数 | Pencil 角色 |
|---|---|---|---|
| 地图底图 | `<img>` / CSS | runtime asset URL | 设计嵌入 UX PNG |
| UE 轨迹 | canvas/SVG | points[].ue | 代表态圆点折线 |
| Without 扫描波束 | SVG/canvas | scanBeamIds, selectedBeamId | 16 点阵代表态 |
| With 预测波束 | SVG/canvas | selectedBeamId | 点阵高亮 |
| Reflection/LOS | SVG path | reflection.{x,y,z,los} | 折线+LOS 标注 |
| 点位进度 | DOM | window of 20, N | 20 槽 |
| Cost | SVG gauge/bar | costPct | 双环代表态 |
| Throughput | chart lib/SVG | series by no | 双曲线代表态 |
| Beam Accuracy 环 | SVG | accPct, ok, er | 环+两侧计数 |

禁止：把 UX 样例百分比/次数写死；禁止用坐标相等匹配 BA；禁止 Cost 使用 dB。

## 5. 禁用与互斥

- 任一侧 running 或 resetting：两侧 Start/ReInit 均不可点（除失败后的手动重试规则）。
- With Start：Without 无有效完成 → disabled（可 tooltip「需先完成 Without」）。
- `execute fail`：显示失败；该侧允许手动重试；不自动重试；不拼接旧半轮 points。
- 刷新/切离 Tab：回 initial 语义；停轮询。

## 6. 资产落点

| 设计输入 | 正式运行 |
|---|---|
| `03-design/case3/assets/*`（来自 `02-ux/case3/`） | 复制到 `04-runtime-assets/case3/` 后再由 Web 引用 |
| 禁止正式 React 直接读 `02-ux/` | — |

## 7. 验收条件（前端）

- [ ] 8 业务态视觉与设计源一致（允许动态层运行时差异）
- [ ] Cost 文案仅为 `开销(%)`；对比标签全中文 `无 DT` / `有 DT` / `开销变化`
- [ ] 点位进度为最新 20 窗口，N 动态
- [ ] BA 仅同 `no` 比 `selectedBeamId`；重置回基线
- [ ] With 完整点缺 reflection 时不渲染半点（Node 不返回）
- [ ] 无 case2 指标语义泄漏；CSS case-local

## 8. 波束卡片图层契约（Gate 1 增量）

设计源节点：`波束扫描卡片`（如 `Igvil`）、`波束预测卡片`（如 `esZ1A`）。  
**禁止** 1:1 复制 Pencil 内 256/16 个 ellipse DOM；运行时须 **程序化渲染**。

### 8.1 扫描波束卡片（Without / `scanBeamIds`）

| 项 | 规格 |
|---|---|
| 卡片尺寸 | **238×331**（8 业务帧已对齐） |
| 网格 | **16×16**，行优先（`扫描行-01`…`扫描行-16`） |
| 单元格 | **8×8 px**，gap **4.8**（行内）/ **2**（行间） |
| 图层命名 | `扫描点-行{R两位}-列{C两位}`，`R∈[1,16]`, `C∈[1,16]` |
| 索引换算 | `index = (R-1)*16 + (C-1)`（0-based，与 API `beamId` 对齐方式见 API 契约） |
| 点位文案 | `点位{no}`（占位符，无空格） |
| 标题文案 | 固定 `BS波束` |

**三色状态 token（运行时按数据驱动，勿读 Pencil 静态 fill 当终态）：**

| 状态 | fill | stroke | 说明 |
|---|---|---|---|
| 空闲 | `#d0d4db33` | `#d0d4dc80` 1px inner | 默认格 |
| 扫描 | `#FFFFFF` | 无 | `scanBeamIds` 命中 |
| 最优 | `#2D7CF6` | 无 | `selectedBeamId` 命中 |

图例：`最优波束` / `扫描波束`（底部 `图例行`）。

### 8.2 预测波束卡片（With / `selectedBeamId`）

| 项 | 规格 |
|---|---|
| 卡片尺寸 | **210×150**（小于扫描卡，浮层 overlay，勿与扫描卡互换尺寸） |
| 网格 | **4×4**，列优先（`预测列-01`…`预测列-04`） |
| 单元格 | **10×10 px**（设计稿样例；实现可 scale，保持 4×4 语义） |
| 图层命名 | `预测点-列{C两位}-行{R两位}`，`C,R∈[1,4]` |
| 索引换算 | `beamId = (C-1)*4 + R`（1-based，列优先） |
| 点位文案 | `点位{no}`（与扫描卡统一占位符） |
| 标题文案 | 固定 `BS波束预测` |
| 结果说明 | `预测成功: 点位{no}, 波束{beamId}` |

预测卡 **无** 扫描/空闲两态；仅高亮 `selectedBeamId` 对应格。

### 8.3 两卡职责边界

| | 扫描卡 | 预测卡 |
|---|---|---|
| 侧 | Without | With |
| 矩阵 | 16×16 | 4×4 |
| 数据字段 | `scanBeamIds[]`, `selectedBeamId` | `selectedBeamId` |
| 组织 | 行容器 `扫描行-NN` | 列容器 `预测列-NN` |
| 标题结构 | `卡片标题行`（左图标+标题，右点位） | 扁平 `卡片标题文案` + `点位文案` |

实现时两卡 **独立组件**（如 `BeamScanCard` / `BeamPredictCard`），不可共用同一 grid 组件而不传维度。

### 8.4 父级定位

两卡均位于 `地图舞台`（`layout: none`）浮层，**非文档流**。前端用绝对定位 overlay；勿照抄 Pencil 全局 x/y 跨帧硬编码，按 MapStage 容器比例定位。

### 8.5 点位进度窗口图层契约

设计源节点：`点位进度窗口（浮层）`（如 `DpfgS`；历史帧可能仍名 `点位进度窗口`）。  
**必须** 嵌套于 `地图舞台（Overlay容器）`；`进度槽行（20窗）` **不得** 与窗口同级并列。

| 项 | 规格 |
|---|---|
| 窗口尺寸 | 代表态约 **591×66**（`case3.with-completed` Without）；实现按 MapStage 比例定位，勿硬编码全局 x/y |
| 窗口样式 | fill `#0F172ACC`，stroke `#334155` 1px，cornerRadius 8，layout vertical |
| 标题 | `进度标题`：`点位进度（最新 20 / 总 N={total}）`；`{total}` = `completeCount` 或 `points.length` |
| 槽行 | `进度槽行（20窗）`：**20 槽**，width fill_container，height **36**，layout horizontal |
| 单槽 | `进度槽-0N`（N=1…20），layout vertical，gap 2 |

**槽内三态（运行时按 `points.slice(-20)` 驱动）：**

| 图层 | 类型 | 说明 |
|---|---|---|
| `槽位标签` | text | 固定 `P1`…`P20`（窗口内序号，非全局 `no`）；代表态白字 12px |
| `槽位数值` | text | 有数据时显示业务值；代表态可用蓝字 `#2D7CF6` 12px |
| `槽位空态` | ellipse 8×8 `#1E293B` | 该窗暂无数据（与数值/完成态互斥） |
| `槽位完成态` | rectangle 6×6 圆角 3 | fill 成功色；该点已完成（与空态/数值互斥） |

数据语义：`points.slice(-20)` 为**最新 20 个完成点**滑动窗口；N 可大于 20。禁止第 21 槽。  
参考结构：`点位进度窗口（浮层）` > `进度标题` + `进度槽行（20窗）` > `进度槽-0N` > 子图层。  
同侧 `地图舞台` 内另有 `UE路线层` → `路线折线` + `路线点-01`…`20`（绿点白描边 + 折线串联；供 canvas/SVG 代表态，非 DOM 一一绑定）。

**Without / With 槽值差异（代表态）：**

| 侧 | 槽内主内容 | 说明 |
|---|---|---|
| Without | `槽位数值` 蓝字 `#2D7CF6` | 点序号/业务值样例 |
| With | `槽位预测正确`=`assets/icon-ok.png`；`槽位预测错误`=`assets/icon-err.png` | 与 BA 同 `no` 的 `selectedBeamId` 对比结果；勿与扫描卡三色混淆 |

With 预测卡选中格（`selectedBeamId`）代表态为 **绿色点** `#22C55E`（如 `muukI`），非扫描卡蓝色最优。

### 8.6 吞吐曲线绘图槽图层契约

设计源节点：`吞吐曲线绘图区`（如 `KMsHE`），对齐 case2 `CDF绘图槽` 的 **Overlay 叠层** 模式。  
父卡 `吞吐卡片`：`吞吐标题行` → `吞吐曲线绘图区` → `吞吐图例`（卡级 vertical；**绘图区内勿再 Flex 化**）。

| 叠层 | layout | 说明 |
|---|---|---|
| `网格层` | none | `Y网格-0…10`、`X网格-1…20`；代表态 stroke/fill `#ffffff14`（弱网格） |
| `Y轴刻度组` | none | `Y轴刻度-0…10`（Gbps 0–10）；统一色 `#939393`；贴近绘图区左缘微调 |
| `X轴刻度组` | none | `X轴刻度-1…20`（点序 `no` 窗口）；色 `#939393` 9px |
| `曲线层` | none | `曲线无DT` `#6B7280`（次） / `曲线有DT` `#22D3EE`（主，略粗）；`点无DT-*` / `点有DT-*` 各 20 |
| 图例 | — | `无 DT` / `有 DT`（全中文） |

数据：`points[].throughputGbps` 按 `no` 绘制双系列；缺点不补 0；X 轴长度随样本动态，代表态为 20。  
**禁止** 1:1 复制 Pencil 内 path/ellipse 为 React 叶子；**禁止** 照抄绘图槽内绝对 x/y；运行时用 chart lib / SVG / canvas。

### 8.7 波束准确率卡片图层契约

设计源节点：`波束准确率卡片`（如 `iQwHm`）。  
父卡 vertical：`准确率标题行` → `准确率内容区（Overlay）`。

| 项 | 规格 |
|---|---|
| 卡片尺寸 | 代表态约 **600×303** |
| 标题行 | `准确率图标` + `准确率标题`（固定文案 `波束预测准确率`） |
| 内容区 | horizontal Flex：`正确次数卡` \| `准确率中区` \| `错误次数卡`；`凹槽底图` 为 absolute 装饰底 |
| 中区 | `layout: none`：`圆圈背景` + `准确率环组件`（底环/值环 path、值、%、文案、`状态徽章`） |
| 次数卡 | vertical：值 + `(次)` + 标签行（图标 +「正确次数」/「错误次数」；标签文案次级灰） |
| 状态徽章 | 代表态可弱化常驻；非正常态再强化 |
| 样例自洽 | 代表态次数与环 % 一致（如 18/20 → 90%） |

数据：基线/增量由同 `no` 的 `selectedBeamId` 对比累计；环 % 与正确/错误次数为运行时派生，勿写死样例。  
**禁止** 1:1 复制环 path 为 React 叶子；环可用 SVG/canvas；**禁止** 用坐标相等匹配 BA。

## 9. 明确禁止

- 继承 case2 热力图/CDF/误差降幅语义
- 双 cursor `/points`+`/kpis` 作为演示期主路径
- 浏览器直读写共享目录
- 将 JSONL 调试快照当正式后端输入
- 把 Pencil 256 个 `扫描点-*` ellipse 逐层绑定为 React 叶子节点
