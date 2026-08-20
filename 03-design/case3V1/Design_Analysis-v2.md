# Design Analysis — case3 Gate 1 v2

## 执行模式

- 模式：标准重建。
- 连续执行授权：是（用户已确认计划；无 DT 完成矩阵改为扫描+最优都保留）。
- 目标 `.pen`：`03-design/case3V1/case3V1-dt-com.pen`。旧 Gate 1 不覆盖。
- 可直接用于生产开发：否。本文件只理解页面，不替代冻结后的 `Frontend_Spec-v2.md`。
- 冻结状态：未开始。旧 Gate 1 `Design_Analysis.md` / `case3-dt-com.pen` 只归档，禁止覆盖。

## 页面目标

在 1920×1080 内部演示舞台上，讲清 **Without DT 基线 → With DT 辅助通信 → 底栏对比**。

新皮相对旧皮的核心变化：不再左右双地图，改成 **一张共享等轴测场地图 + 底栏钉底**。地图、预置路线、UE 车、实时点位只有一份。

## 用户任务

1. 先 Start Without，看本轮轨迹 / 当前点波束 / 底栏最优波。
2. Without 完成后，再 Start With。开新轮时 **地图先回初始**，底栏 Without 历史保留。
3. With 过程中对照同一 `no` 的最优波 vs 预测波、开销 / 吞吐 / 准确率。
4. 单侧重置、失败重试仍是现网逻辑；本轮 Pencil **不画** 重置中 / 失败帧。

## 视觉优先级

1. 当前谁在跑、①② 能不能点（互斥禁用）。
2. 共享地图上的本轮路线 / 点亮 / UE。
3. 左上波束矩阵（跟当前点，不可回看）。
4. 底栏 BeamID 表 + 三 KPI。
5. 导航、2D|3D、现场环境、三杠等 chrome。

## 页面状态（本轮 5 frames）

| Frame | 语义 | 整页切图 |
|---|---|---|
| `case3v2.initial` | 未跑。地图只有预置路线/未跑点标识；Without Start 可用；With Start 禁用（启动禁止） | 无整页，用底图 + 初始 KPI/格子拼 |
| `case3v2.without-running` | Without 测到代表点 P4；With 播放键启动禁止；矩阵画扫描波+最优波 | `02-ux/case3-V1/无DT测试整体效果图.png` |
| `case3v2.without-completed` | Without 已结束，地图 **保留** 本轮终态；With Start 可用 | 无整页，按规则补画 |
| `case3v2.with-running` | 开 With 前地图已清回初始，再跑到代表点 P4；Without 行历史保留；矩阵叠最优+预测、无扫描点 | `02-ux/case3-V1/有DT整体测试效果图.png`（地图按「本轮重跑」理解，不叠 Without 车辙） |
| `case3v2.with-completed` | 双侧已结束；地图只留 **With 本轮** 终态；KPI 全量 | 无整页，按规则补画 |

本轮明确不做：`resetting-*`、`failed`、`site-env-modal`。现场环境入口仍画在右上，点开效果后续再画。

## UX 输入

| 输入 | 用途 | 边界 |
|---|---|---|
| `02-ux/case3-V1/` | 新 UX 权威源 | PNG 不是视觉契约；样例数字不是数据契约 |
| `无DT测试整体效果图.png` / `有DT整体测试效果图.png` | 运行中整页 | 有 DT 切图轴 1–16、格子里的 `x() y()`、with 播放键看起来可点：均不跟 |
| `导航栏/` | 全站新顶栏 | 开发期加第五 Tab `DT for Comm new` 并高亮 |
| `主页面--层0/元素/场地2D.png` | 等轴测场地图 | 「2D」= 这张图 + 轨迹叠加，不是俯视平面图 |
| `波束面板-层1/` | 矩阵卡片 | 轴统一 0–15；有 DT 无扫描点 |
| `KPI面板-层1/` | 底栏表、按钮、三 KPI | 回溯只显示 BeamID |

旧 UX `02-ux/case3/` 与旧 `.pen` 只作对照，不当本轮源。

## 信息架构

```text
ShellHeader（全站共用；开发期五 Tab，高亮 DT for Comm new）
└── Case3V2Page
    ├── MapStage（场地2D + 预置路线 + 本轮轨迹 + UE）
    └── MapHud（不跟地图 transform）
        ├── CompareTitle「测试对比」
        ├── ViewModeToggle 2D|3D（2D 选中，3D 灰禁）
        ├── SiteEnvLink「现场环境 >」
        └── BeamMatrixCard
    └── BottomDock
        ├── PointBeamReplay（一张表：列头 + ①② 行 + BeamID 格）
        └── KpiRow（开销 / 吞吐 / 准确率）
```

## 核心组件

| 组件 | 作用 | 是否复用 | 输入数据 | 备注 |
|---|---|---|---|---|
| ShellHeader | 全站顶栏 | 全站一份 | 当前 Tab | 三杠装饰不可点 |
| MapStage | 共享地图舞台 | case-local | `baseRoute` + 本轮 `points[].ue` | 开新轮清轨迹/车/点亮 |
| ViewModeToggle | 2D\|3D | case-local | 固定 2D | 3D 可见灰禁 |
| BeamMatrixCard | 当前点 16×16 | case-local | 当前 `no` 的 beamId | 不可点列回看 |
| PointBeamReplay | 窗口最近 20 的 BeamID 表 | case-local | 两侧 `selectedBeamId` | 一张表，勿拆三块 |
| SideControls | ①② 播放/重置 | case-local | `canStart*` / `canReinit` | 互斥用「启动禁止」 |
| CostCompareCard | 开销梯形 | case-local | `costPct` | 变化公式 `(with-without)/without` |
| ThroughputCompareCard | 双折线 | case-local | `throughputGbps` | 缺点不补 0 |
| BeamAccuracyCard | 横条+次数 | case-local | 基线+同 `no` 增量 | 切图 75%/3/1 是代表态 |

## 设计语言

| 类别 | 观察 | 置信度 | 待确认 |
|---|---|---|---|
| 颜色 | 深色舞台；Without 行/当前列偏蓝；With / 成功偏青绿；失败红 | 中（来自整页 PNG） | 生成时从切图吸色，不把目测 HEX 当精确值 |
| 字体 | 无衬线；标题白、次文灰、数字大号 | 中 | Pencil 用系统无衬线近似，不发明新品牌字体 |
| 间距 | 顶栏一条；底栏圆角浮层；HUD 四角留边 | 中 | 用 fill/hug/gap，不写死截图像素 |
| 圆角 | 底栏、矩阵卡、格子均为大圆角胶囊/卡片 | 高 | |
| 阴影/透明度 | 底栏与矩阵半透明深色玻璃；地图为实景底图 | 高 | |

## UX 层次

| 层级 | 识别结果 | 说明 | 风险 |
|---|---|---|---|
| 页面层 | 开发期入口 `DT for Comm new` | 主操作在底栏 ①② | 五 Tab 比切图挤 |
| 区域层 | Header + 地图铺满 + 底栏钉底 | 不再左右分栏 | 底栏变高会挤地图 |
| 组件层 | 见信息架构 | 20 格必须组件化 | 禁止手摆 20/256 |
| 内容层 | P{n}、BeamID、%、Gbps、次数 | 切图数字是代表态 | 禁止写进契约 |
| 装饰层 | 导航弧底、场地照片、格子半圆指示 | 必须挂在所属组件下 | 三杠不要做成按钮 |

## 大布局

| 区域 | 父容器 | 布局规则 | 自适应规则 | 溢出规则 |
|---|---|---|---|---|
| Page | Stage | 固定 1920×1080 纵向：Header + 剩余 | 窗口只走 Shell 缩放 | 不滚 |
| ShellHeader | Page | 宽 1920，高 hug/固定（以导航切图为准） | 五 Tab 不换行 | 文案过长时略收 gap，不省略 Tab |
| MapStage | Case3V2Page | 宽 1920，高 = 剩余 − Dock | 底图 cover/fit 一种，生成时选定 | hidden |
| MapHud | MapStage 叠加 | 绝对钉四角/顶中，hug | 不跟地图缩放 | 不得压住底栏 |
| BottomDock | Case3V2Page | 宽 1920，钉底，高 hug | 内部纵向：表 + KPI | 内部裁切，不撑出舞台 |
| PointBeamReplay | Dock | 列均分 20 槽 | N>20 窗口滑动 | 不增第 21 列 |
| KpiRow | Dock | 三列 fill，等分 | 卡内绘图区固定比例 | 卡内裁切 |

主轴：上地图舞台 / 下钉底栏。地图是唯一 transform 层。

## 小布局

| 组件 | 内部结构 | 对齐 | padding/gap | 文本变化规则 |
|---|---|---|---|---|
| BeamMatrixCard | 顶：点位图标 + P{n}/当前点位；中：标题+徽章+BeamID；网格；图例 | 顶栏左右 spread | 卡内统一 padding | 无当前点：P--、BeamID `--`、空网格 |
| Grid16x16 | 16×16 Auto Layout，轴 0–15 | 原点左上 (0,0) | 格间距 token | 禁止 256 个手摆椭圆 |
| PointBeamReplay | 标题 \| 列头 P1…；两行：行头 hug + 20 格 fill | 行头左对齐 | 格圆角 | 空格 `--`；禁止 X/Y |
| SideControls | 序号+侧名 / 状态 / 播放 / 重置 | 左文右钮 | 两行对齐 | 禁用必须用切图「启动禁止」「重置禁止」 |
| CostCompareCard | 标题；左梯形；中轴 0–100%；右梯形；角上开销变化 | 左右对称 | 绘图区 fill | 缺值 `--` |
| ThroughputCompareCard | 标题+图例；Gbps × 点位 | 左下原点 | 绘图区 fill | 缺点断开，不补 0 |
| BeamAccuracyCard | 大号 % + 标签；横条；正确/错误次数 | 左数值右次数 | 横条拉满 | 无增量时次数可空 |

## 单地图规则（业务组已对齐）

| 时机 | 地图 |
|---|---|
| initial | 场地 + 预置路线 + 未跑点标识；无本轮轨迹 |
| without-running | 本轮轨迹 + UE 跟当前点；点标识随本轮点亮 |
| without-completed | **保留** 本轮终态；矩阵 **扫描波+最优波都保留** |
| 点 With Start | **先清** 轨迹/车/点亮回未跑，再开始 With 轮 |
| with-running / with-completed | 只画 **这一轮**；不叠 Without 车辙 |

底栏 Without 格子在 With 开跑后仍保留。清的是地图可视层，不是业务结果。

## 波束矩阵规则

| 侧 | 网格画什么 | 轴 |
|---|---|---|
| 无 DT | 扫描波灰点 + 最优波高亮（可带十字准星） | 0–15，左上为 (0,0) |
| 有 DT | **无扫描点**；同一 `no` 叠无 DT 最优波 + 有 DT 预测波 | 同样 0–15（不跟有 DT 切图的 1–16） |

映射：`BeamID = row * 16 + col`，范围 0–255。切图 BeamID 122 → 约 (row 7, col 10)，作代表态。

列头不可点。矩阵只跟当前点，不跟用户点选的历史列。

## 前端可实现性风险

| 风险 | 影响 | 建议 |
|---|---|---|
| 场地2D.png 约 53MB | Pencil 嵌入/前端加载都重 | 设计源可嵌入；运行时另出压缩资源，不把 53MB 当生产资产 |
| 16×16 手摆 | 图层爆炸、无法绑数据 | 程序化网格 / 组件实例 |
| 把切图 X/Y 画进格子 | 和已拍板冲突 | Pencil 格子只放「最优波/预测波 + BeamID」 |
| 五 Tab 挤导航 | 切图只有四 Tab | 右组：`DT for Comm` \| `DT for Comm new` \| `DT for positioning`；略收 gap，不换行 |
| 开新轮清图 vs 有 DT 整页切图 | 切图地图仍像同一条已跑路线 | Pencil 的 with-running 按「清图后再跑到 P4」画，看起来会像 without-running 的地图，差异在矩阵/底栏 |
| 栏高不再 78px | case2 内容区被挤 | 量导航切图高度；实现时做 case2 一眼回归 |

## Asset Source Plan

| Asset/Layer | Type | Decision | Reason | Owner | Fallback | Freeze requirement |
|---|---|---|---|---|---|---|
| 场地2D.png | 复杂静态底图 | 用户 PNG | 等轴测实景，禁止 AI 重绘 | UX | 无 | 运行时需压缩版，设计源可引用原图 |
| 导航栏背景/LOGO/外场图标/三杠/华为标 | 品牌 | 用户 PNG | 禁止 AI 自造品牌 | UX | 无 | 必须用户切图 |
| UE 图标 2D、位置气泡 | 业务图标 | 用户 PNG | 车辆/点位识别 | UX | Pencil 圆点占位并标记 | 冻结前要有 UE 资产 |
| 预置路线/实时轨迹 | 动态图形 | 前端 SVG；Pencil 代表态 | 随点位变化 | 前端 | Pencil 描一条 20 点折线 | 不冻结样条为契约 |
| 点编号 1…20 | 动态图形 | Pencil 基础图形 + 组件 | 代表态 20 点 | 前端 | — | 实现跟 `baseRoute` 全长 |
| 波束 16×16 | 动态图形 | Pencil 程序化网格；前端同参数 | 随当前点变化 | 前端 | 禁止 256 手摆 | 轴 0–15 |
| 扫描点/最优波/预测波样式 | 用户切图 + 基础图形 | 切图作样式参考 | `波束面板-层1/元素/` | UX | Pencil 方点近似 | |
| 播放/重置/禁止/执行中 | 用户切图 | 按钮态必须用切图 | 互斥语义靠「启动禁止」 | UX | 无 | 禁用不得画成可点白播放键 |
| 开销梯形、吞吐折线、BA 横条 | 数据可视化 | 前端 SVG；Pencil 代表态 | 随运行变化 | 前端 | Pencil 画当前代表数字 | 50%/75% 等不是契约 |
| 底栏圆角蒙版、上蒙版 | 装饰 | 用户 PNG 或 Pencil 形状 | 非业务数据 | 设计 | Pencil 圆角矩形 | |

## Dynamic / Static Layer Split

| Diagram | Static base | Dynamic layers | Frontend parameters | Pencil role |
|---|---|---|---|---|
| 地图 | 场地2D.png | 预置路线、点亮、本轮轨迹、UE | `baseRoute`、本轮 points、当前 no | 各帧画一个代表进度 |
| 波束矩阵 | 卡壳/轴/图例 | 扫描点、最优、预测、徽章 | beamId、scanBeamIds、match | 无 DT 一帧扫描态；有 DT 一帧叠态 |
| 回溯表 | 表壳/列头结构 | 当前列高亮、小车光标、格内容、按钮态 | 窗口 20、两侧 selectedBeamId | 组件实例 ×20 |
| 开销 | 卡壳/中轴 | 左右填充面积与数字 | costPct、delta | 空 / 单侧 / 双侧 三档代表 |
| 吞吐 | 卡壳/坐标 | 双折线 | 点列 Gbps | 代表曲线，不写死点值契约 |
| BA | 卡壳 | %、横条、次数 | 基线+增量 | 有 DT 完成才出次数代表态 |

## 数据与文案

- 正式文案：`without DT` / `with DT`、`测试中…` / `未开始` / `已结束`、`波束矩阵`、`点位波束回溯`、`开销对比`、`吞吐率对比`、`波束预测准确率`、`现场环境 >`、`IMT-2030 DT测试`。
- 开发期 Tab：`DT for Comm new`（高亮）。旧 Tab `DT for Comm` 仍在，指向旧皮。
- 格子：**只显示**「最优波|预测波」+ BeamID。切图 `x(12) y(12)` 作废。
- 空值：`--`。
- 样例：P4、BeamID 122、50%、15%、75%、正确 3 / 错误 1 → 仅代表态。
- 开销变化：`(with-without)/without*100`；文案「减少/增加」随符号。

## 与切图的明确偏差（已拍板，生成时不要「修正回切图」）

1. 顶栏五个 Tab，高亮 `DT for Comm new`，不是切图里的 `DT for Comm`。
2. 无 DT 跑时 with 播放键用「启动禁止」，不用切图里看起来可点的白播放键。
3. 回溯格子不画 X/Y。
4. 有 DT 矩阵轴 0–15，不画扫描点。
5. 列头不可点；不要加「点列回看」热区。
6. 3D 可见但灰，不要隐藏。
7. 三杠不可点。
8. with-running 地图按开新轮清图后再跑，不叠上一轮车辙。

## 不确定项

| 问题 | 影响 | 建议确认方式 |
|---|---|---|
| 五 Tab 是否接受更挤的右组 | 导航观感 | 见 Pen_Plan 提案；确认计划即视为同意 |
| initial 的 UE 是藏起还是停在起点未出发 | 初始帧 | 计划：画在起点、未点亮、无实时拖尾 |
| without-completed / with-completed 无整页切图 | 补帧相似度 | 用运行中整页改控件/进度到终态；确认计划后按此补 |
| 场地图在 Pencil 中的 fit（cover vs contain） | 左右裁切 | 计划：cover，保持切图构图，溢出 hidden |

计划已确认。无 DT 完成矩阵按 `无DT.png` 同时保留扫描波与最优波。
