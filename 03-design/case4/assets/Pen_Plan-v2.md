# Pen Plan — case3 Gate 1 v2

## Target

- Output `.pen`：`03-design/case3V1/case3V1-dt-com.pen`
- Canvas：1920×1080，每态一帧
- Quality：标准重建
- Existing `.pen` handling：用户指定本文件为唯一新设计源；**禁止** 修改 `03-design/case3/case3-dt-com.pen`
- 连续执行授权：是（2026-08-19 用户已确认计划，并改了无 DT 完成矩阵规则）

## 修改基线与变更集

| 类别 | 节点/区域 | 处理 | 验证方式 |
|---|---|---|---|
| 保留 | 旧 `case3-dt-com.pen` 全文 | 不打开、不改 | 文件仍在原路径 |
| 新增 | 五业务帧内容 + 可复用组件 + 新 token | 在指定 `.pen` 内重建新皮 | `snapshot_layout` + 截图对照 |
| 更新 | 已有空壳帧（旧四 Tab / 78px 顶栏） | 换成新导航与单地图布局 | Get 后替换 |
| 删除 | `case3.点击现场环境` | 本轮不画弹窗帧 | Delete |
| 禁止触碰 | 旧 case3 `.pen`、case2 `.pen`、正式 Web/Node | 不写 | git status |

## Pencil MCP 执行规则（确认后才执行）

- Schema：`get_editor_state(include_schema: true)`
- 新建前：`batch_get` 或 `snapshot_layout(maxDepth: 0)` 看画布空位
- 按区域小批次 `batch_design`：Header → MapStage 底图 → Hud → Dock 表 → KPI → 复到其余帧改差异
- 每完成一区用 `batch_get` / `snapshot_layout` 验证；失败先读现状，不整批重放
- `.pen` 加密：禁止 Read/Grep/自行解析
- 图片只作参考，不得推翻本计划已写死的偏差（五 Tab、启动禁止、无 X/Y、轴 0–15、清图规则）

## Frames

| Frame | State | 源图 | 差异要点 |
|---|---|---|---|
| `case3v2.initial` | 初始 | 场地2D + 开销初始 + 回溯空格 + 启动禁止(with) | 预置路线未跑；无实时轨迹；矩阵空；KPI `--`；Without 播放可用，With 启动禁止，双侧重置禁止 |
| `case3v2.without-running` | 无 DT 运行 | `无DT测试整体效果图.png` | 代表 P4；扫描+最优；Without 执行中图标（不表示 pause）；With **启动禁止**；当前列高亮+小车 |
| `case3v2.without-completed` | 无 DT 完成 | 无整页；由运行中改到终态 | 地图保留 Without 终态（20 点点亮、UE 在终点）；Without 已结束+重置可用；With 未开始但播放 **可用**；开销左侧有值、右侧 `--` |
| `case3v2.with-running` | 有 DT 运行 | `有DT整体测试效果图.png`（地图按清图后重跑） | 地图像「新一轮跑到 P4」，不叠上一轮车辙；Without 行 BeamID 仍在；With 执行中；矩阵叠最优+预测、无扫描、轴 0–15 |
| `case3v2.with-completed` | 有 DT 完成 | 无整页；由有 DT 运行改到终态 | 地图只留 With 本轮终态；双侧已结束+重置可用；KPI 双侧+BA 次数 |

不画：resetting、failed、现场环境弹窗。

## Component Tree

```text
Case3V2Frame
├── ShellHeader                              # 全站 chrome，不要做成 case 私有件
│   ├── MenuGlyph                            # 三杠，装饰，无点击态
│   ├── Brand「云上外场」
│   ├── TabsLeft  DT Construction | DT Calibration
│   ├── Title「IMT-2030 DT测试」
│   ├── TabsRight DT for Comm | DT for Comm new | DT for positioning
│   └── CornerMark
└── Case3V2Page
    ├── MapStage
    │   └── MapTransformLayer
    │       ├── SiteImage                    # 场地2D.png
    │       ├── BaseRouteLayer               # 预置折线
    │       ├── RouteMarkers[1..20]          # 组件；未跑/已跑/当前
    │       ├── LiveTrackLayer               # 本轮拖尾；initial 隐藏
    │       └── UeMarker
    ├── MapHud
    │   ├── CompareTitle
    │   ├── ViewModeToggle                   # 2D 选中；3D 灰禁可见
    │   ├── SiteEnvLink
    │   └── BeamMatrixCard
    │       ├── CardHeader
    │       ├── TitleRow                     # 徽章仅有 DT 出现
    │       ├── Grid16x16                    # 程序化，轴 0–15
    │       └── Legend
    └── BottomDock
        ├── PointBeamReplay
        │   ├── TableTitle
        │   ├── ColHeaderRow                 # 不可点；当前列高亮+小车光标
        │   ├── WithoutRow
        │   │   ├── SideControls
        │   │   └── ReplayCell × 20
        │   └── WithRow
        │       ├── SideControls
        │       └── ReplayCell × 20
        └── KpiRow
            ├── CostCompareCard
            ├── ThroughputCompareCard
            └── BeamAccuracyCard
```

图层树必须能映射到这棵组件树。禁止把 20 格、256 格摊成散图层。

## Reusable Components

| Component | Props | Usage | Notes |
|---|---|---|---|
| `TabItem` | label, active, muted | 五 Tab | 仅 `DT for Comm new` 在本文件五帧中 active |
| `ViewModeToggle` | mode=2D, threeDEnabled=false | 所有帧相同 | 3D 不隐藏 |
| `RouteMarker` | index, state=idle\|done\|current | 地图 20 点 | 代表态；实现跟全长 |
| `UeMarker` | visible | 运行/完成可见；initial 停起点无拖尾 | 用用户 UE PNG |
| `BeamCell` | kind=empty\|scan\|best\|pred\|both | 网格 | 有 DT 只用 best/pred/both |
| `SideControls` | side, statusText, play=idle\|busy\|disabled, reset=on\|disabled | 每行一个 | disabled 播放必须实例化「启动禁止」 |
| `ReplayCell` | kind=empty\|best\|pred, beamId, match=none\|ok\|bad | ×20×2 | 只显示标签+ID，禁止 X/Y |
| `ColHeader` | label, current | ×20 | 无点击/无 hover 热区 |

## Asset Source Plan

与 `Design_Analysis-v2.md` 同一张表。生成时优先嵌入：

- `02-ux/case3-V1/主页面--层0/元素/场地2D.png`
- `02-ux/case3-V1/导航栏/元素/*`
- `02-ux/case3-V1/主页面--层0/元素/2D/UE图标2D.png`
- `02-ux/case3-V1/KPI面板-层1/测试按钮/元素/启动可执行.png` `启动禁止.png` `启动执行中.png` `重置禁止.png` 及可用重置切图
- 波束图例点：`波束面板-层1/元素/`

禁止 AI 重绘场地、华为标、LOGO。动态层只画代表态。

## Diagram Decomposition

| Diagram | Static assets | Frontend-rendered layers | Parameters | Reference frames |
|---|---|---|---|---|
| 等轴测地图 | 场地2D | 路线、编号、拖尾、UE | baseRoute、本轮 ue、当前 no | 五帧进度不同 |
| 波束矩阵 | 卡片壳 | 16×16 格状态 | beamId、scan 集合、match | without-running / with-running |
| 回溯表 | 表壳 | 列高亮、格内容、按钮 | 窗口、两侧 ID | 全部帧 |
| 开销梯形 | 卡壳、中轴 | 填充面积、数字、增减箭头 | costPct、delta | initial / without-completed / with-* |
| 吞吐折线 | 卡壳 | 双系列 path | 点列 | running/completed |
| BA 横条 | 卡壳 | 占比、次数 | 准确率、correct、wrong | with-* |

## Layer Naming Rules

- Frame：`case3v2.{state}`
- 区域：`header` / `mapStage` / `mapHud` / `bottomDock`
- 组件实例：`replayCell/without/p{n}` 这种可读路径
- 装饰挂在组件下，例如 `bottomDock/scrim`，禁止顶层 `Rectangle 128`

## Layout Contract

### Page

- Layout type：固定演示画布，纵向堆叠
- Primary axis：vertical（Header → 地图 fill → Dock hug 钉底）
- Breakpoints：无。窗口变化由 Shell 等比缩放，业务不重排
- Scroll behavior：页面不滚；仅回溯表在 N>20 时允许横向滑（本轮代表态 N=20，不画滚动条）

### Regions

| Region | Parent | Sizing | Grid/Flex/Stack | Gap | Padding | Overflow |
|---|---|---|---|---|---|---|
| ShellHeader | Frame | w=1920, h hug（按导航 PNG） | 横向：左簇 \| 标题居中 \| 右簇+标 | token | 左右边 inset | 不换行 |
| Case3V2Page | Frame | fill 剩余高 | 绝对：地图 fill + Dock 钉底 | 0 | 0 | hidden |
| MapStage | Page | w=1920, h=fill | 底图 cover + 叠加 | 0 | 0 | hidden |
| MapHud | MapStage | hug，四角/顶中钉住 | 不进 transform | 与边缘 token | — | 不得压 Dock |
| BottomDock | Page | w=1920, h hug | 纵向：Replay / KpiRow | token | 内边距 token | 内部裁切 |
| PointBeamReplay | Dock | w fill, h hug | 行：行头 hug + 20 列 fill | 列 gap 小 | — | 20 槽固定 |
| KpiRow | Dock | w fill | 三列 1fr | token | — | 卡内裁切 |

### Components

| Component | Width | Height | Internal layout | Text overflow | Reuse |
|---|---|---|---|---|---|
| BeamMatrixCard | hug，约左上卡片比例 | hug | 纵向 Header → Title → Grid → Legend | BeamID 不换行 | 五帧同一组件改内容 |
| Grid16x16 | 固定格数，格均分 | 正方形格 | 16×16 auto | 无文本 | 程序化 |
| SideControls | hug | 两行对齐 | 左文右钮 | 状态文案一行 | 两实例 |
| ReplayCell | fill 列宽 | hug | 上标签下 ID | ID 不换行；空为 `--` | 40 实例 |
| CostCompareCard | 1fr | hug | 左右梯形+中轴 | `--` 或数字 | |
| ThroughputCompareCard | 1fr | hug | 标题+绘图区 | | |
| BeamAccuracyCard | 1fr | hug | 左 % 右次数，下横条 | | |

固定像素只用于：图标盒、格点大小、hairline、品牌图。主区域用 fill/hug。

## 五帧控件 / 地图 / KPI 对照

| 状态 | Without 控件 | With 控件 | 地图 | 矩阵 | 回溯表 | KPI |
|---|---|---|---|---|---|---|
| initial | 播放可用 / 重置禁止 | **启动禁止** / 重置禁止 | 预置路线，点全未跑；UE 在起点无拖尾 | 空网格，P-- | 格全 `--`，无当前列光标或光标不亮 | 全 `--`；BA 可空白或基线占位 |
| without-running | 执行中图标 / 重置禁止 | **启动禁止** / 重置禁止 | 本轮到 P4，1–4 点亮，UE 在 4 | 扫描+最优，轴 0–15，P4，BeamID 122 | P4 当前列；without 已填代表 ID；with 全 `--` | 左侧开销有值；右侧 `--`；吞吐 only without；BA 无次数 |
| without-completed | 已结束 / 重置可用 | **播放可用** / 重置禁止 | **保留** Without 终态，20 点亮，UE 在 20 | **扫描波 + 最优波都保留**（样式对齐 `波束面板-层1/无DT.png`，点位改到 P20） | without 行填满；with `--`；当前列可停在 P20 | 同 running 但进度满 |
| with-running | 已结束 / 重置禁止（互斥忙） | 执行中 / 重置禁止 | **清图后** 新一轮到 P4 | 最优+预测叠图，无扫描，轴 0–15；预测成功徽章 | without 历史仍在；with 填到 P4；对绿错红代表 | 双侧开销开始有值；双折线；BA 可出代表 % |
| with-completed | 已结束 / 重置可用 | 已结束 / 重置可用 | 只留 With 本轮终态 | 最后点叠图 + 成功/失败徽章 | 两行填满 | 全量对比；BA 75% + 正确 3 / 错误 1 代表态 |

## Tokens Draft

| Token | Value | Usage | Confidence |
|---|---|---|---|
| `canvas-w` / `canvas-h` | 1920 / 1080 | 画布 | 高（项目约束） |
| `color-without` | 从无 DT 当前列蓝吸色 | Without 强调 | 中 |
| `color-with` | 从青绿吸色 | With / 成功 | 中 |
| `color-error` | 从错格红吸色 | 预测失败 | 中 |
| `color-disabled` | 启动禁止按钮灰 | 禁用 | 高（有切图） |
| `space-hud-inset` | 近似 24–32 | HUD 离边缘 | 低，生成时量 |
| `radius-dock` | 大切图圆角 | 底栏 | 中 |
| `font-title` / `font-metric` | 无衬线 | 标题 / 大号数字 | 中 |

生成时从 PNG 吸色写入变量，不在本计划锁死 HEX。

## 导航五 Tab 排法（提案，确认计划即同意）

切图右组只有 `DT for Comm`、`DT for positioning`。开发期插入：

```text
左：DT Construction | DT Calibration
中：IMT-2030 DT测试
右：DT for Comm | DT for Comm new（下划线激活） | DT for positioning
```

不换行、不藏 Tab、不把新入口画进汉堡菜单。P5 合回后仍四 Tab，本 `.pen` 只服务开发期。

## 需要补画的缺失状态

本轮补：`initial`、`without-completed`、`with-completed`（无整页切图，按上表拼）。

后续另开一轮：resetting、failed、现场环境弹窗、3D 真开、N>20 抽稀。

## 需要用户拍板的结构问题

下列已有默认，**回复 YES 即按默认生成**；若要改，只改带编号的那条。

1. **五 Tab 右组插入 `DT for Comm new` 并高亮** — 默认同意。
2. **initial UE 停在起点、无拖尾** — 默认同意。
3. **without-completed 矩阵：扫描波 + 最优波都保留** — 用户已改，对齐 `02-ux/case3-V1/波束面板-层1/无DT.png`。
4. **场地图 cover + hidden** — 已同意。
5. **with-running 地图按清图后重跑到 P4** — 已同意。

计划已确认，本轮按此生成。

## 生成后必做（仍在 P2，不写正式 Web）

1. 五帧 `snapshot_layout`，至少一次 `problemsOnly: true`
2. 抽查：20 格是组件、网格不是 256 散层、3D 仍可见、三杠无点击、格子无 X/Y
3. 与两张整页 UX PNG 做 `Visual_Diff-v2.md`（并记录已拍板偏差，避免被当成缺陷）
4. 再写 `Frontend_Spec-v2.md` 后才能说可开发

## 停在这里

已确认。目标文件：`03-design/case3V1/case3V1-dt-com.pen`。
