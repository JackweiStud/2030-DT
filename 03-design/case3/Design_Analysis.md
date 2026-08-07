# Design Analysis — case3 Gate 1

## 执行模式

- 模式：标准重建。
- 执行授权：用户要求将 `03-design/case2/case3-dt-com.pen` **先复制**到 `03-design/case3/case3-dt-com.pen` 后再改；禁止继续污染 `03-design/case2/`。
- 可直接用于生产开发：否；本轮目标为 `REVIEW_READY`，最终冻结需用户视觉审阅。

## 页面目标与用户任务

- 页面目标：在 1920×1080 内部演示舞台讲清 Without DT 基线 → With DT 辅助通信 → Cost / Throughput / Beam Accuracy 对比。
- 用户任务：先跑 Without，再跑 With；两侧互斥；可单侧重置；失败可手动重试。
- 视觉优先级：当前侧运行/完成状态与操作 > 双侧地图/波束/点位进度 > 下半 KPI 对比结论 > 装饰背景。

## 页面状态（8 frames）

| Frame | 语义 |
|---|---|
| `case3.initial` | 双侧空运行态；预置路线；Beam Accuracy 仅文件基线；With Start 因 Without 未完成而禁用 |
| `case3.without-running` | Without 逐点更新；With 不运行；点位进度最新 12 窗口 |
| `case3.without-completed` | Without 结果保留；With Start 可用 |
| `case3.with-running` | Without 保留；With 逐点 + reflection/LOS；Beam Accuracy 仍基线 |
| `case3.with-completed` | 双侧完成；KPI 全量对比；Beam Accuracy = 基线 + 同 `no` beamId 增量 |
| `case3.resetting-without` | Without 等待重置清空；With 历史可保留；Beam Accuracy 回基线 |
| `case3.resetting-with` | With 等待重置清空；Without 历史可保留；Beam Accuracy 回基线 |
| `case3.failed` | 对应侧 `execute fail` 反馈 + 手动重试；不拼接旧数据 |

另保留 `case3.site-env-modal`（现场环境视频弹窗）作为 Shell 共用能力视觉参考，不计入业务 8 态。

## UX 输入

| 输入 | 用途 | 边界 |
|---|---|---|
| `02-ux/case3/case3整体.png` | 整页完成/运行混合参考 | 非最终视觉契约 |
| `02-ux/case3/上部分/` | 双侧地图、控制、波束、点位进度 | P1–P12 仅为窗口样例 |
| `02-ux/case3/下部分/` | Cost / Throughput / Beam Accuracy | Cost 文案必须改为 `Cost (%)` |
| `02-ux/case3/上部分/元素/ue_comm_map.png` 等 | 地图与图标素材 | Pencil 设计输入；正式运行落 `04-runtime-assets/case3/` |

## 信息架构

```text
ShellHeader（品牌 + 四 Tab，激活 DT for Comm）
└── Case3Page
    ├── TestComparePanel（测试对比）
    │   ├── PanelHeader（标题 + 现场环境）
    │   └── SidePair
    │       ├── WithoutSidePanel
    │       │   ├── SideHeader（标签/状态徽标/Start/ReInit）
    │       │   ├── MapViewport（底图 + UE 路线/轨迹 + BS）
    │       │   ├── BeamOverlay（扫描集合 + selected）
    │       │   └── PointProgressWindow（最新 12）
    │       └── WithSidePanel
    │           ├── SideHeader
    │           ├── MapViewport（+ reflection/LOS 示意层）
    │           ├── BeamPredictOverlay
    │           └── PointProgressWindow
    └── KpiComparePanel（KPI对比）
        ├── CostCard（Cost (%) 双柱/双表盘代表态）
        ├── ThroughputCard（按点位 no 的双曲线代表态）
        └── BeamAccuracyCard（基线/增量环 + 正确/错误次数）
```

## 大布局 / 小布局

| 区域 | 规则 |
|---|---|
| Page | 固定 1920×1080；Header 固定高；内容纵向「上测试对比 / 下 KPI」 |
| SidePair | 横向二等分；两侧对称骨架，状态差异只改徽标/控件/动态层 |
| MapViewport | 底图 fit；动态层（轨迹、波束、反射）前端实现，Pencil 画代表态 |
| PointProgress | 固定 12 槽窗口；超过 N>12 时滚动到最新；标注「窗口≠上限」 |
| KPI 三列 | 等宽；Cost 文案固定 `Cost (%)`；数值均为运行时占位 |

## 资产来源决策

| Asset | Decision | 正式落点 |
|---|---|---|
| 地图 `ue_comm_map.png` | 用户 UX PNG 嵌入设计源 | `04-runtime-assets/case3/` |
| UE / BS / 状态图标 | 用户切图 | 同上 |
| 波束扇区、轨迹、反射折线、吞吐曲线、Cost 弧/柱、准确率环 | 前端 SVG/canvas；Pencil 仅代表态 | 不冻结样例数为契约 |
| Shell 品牌/导航背景 | 复用 case2/Shell 视觉基线 | Shell 运行资源 |

## 动态数据边界

- 点位数动态 `N`；进度只显示最新 12。
- Cost：侧级 `costPct`，文案 `Cost (%)`，禁止 dB。
- Throughput：`points[].throughputGbps` 按 `no` 入曲线。
- Beam Accuracy：文件基线 + With 完成后同 `no` 的 `selectedBeamId` 对比；任意重置回基线。
- 不得把 UX 样例 89%、18/2、P1–P12 上限写进契约。

## 不确定项（需用户视觉确认）

1. 点位进度 >12 时滚动条/渐隐边缘的具体视觉。
2. With Start 在 Without 未完成时的禁用样式文案（「需先完成 Without」是否展示）。
3. failed 徽标挂左侧/右侧/双侧的默认示意帧选取（本轮用 Without 失败为代表态）。
4. Cost 代表态用双半圆表盘还是双柱（本轮按 UX 双表盘骨架，单位改为 %）。
5. 现场环境弹窗是否与 case2 完全同款（本轮保留复制文件中的弹窗 frame）。
