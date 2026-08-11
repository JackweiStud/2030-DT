# Design Analysis — case3 Gate 1

## 执行模式

- 模式：标准重建。
- 执行授权：用户要求将 `03-design/case2/case3-dt-com.pen` **先复制**到 `03-design/case3/case3-dt-com.pen` 后再改；禁止继续污染 `03-design/case2/`。
- 冻结状态：`APPROVED`；2026-08-09 已经用户视觉审阅，可作为 Gate 3 正式 Web 的视觉输入，但不得替代 Gate 2 API 契约和 Gate 3 SPEC。

## 页面目标与用户任务

- 页面目标：在 1920×1080 内部演示舞台讲清 Without DT 基线 → With DT 辅助通信 → Cost / Throughput / Beam Accuracy 对比。
- 用户任务：先跑 Without，再跑 With；两侧互斥；可单侧重置；失败可手动重试。
- 视觉优先级：当前侧运行/完成状态与操作 > 双侧地图/波束/点位进度 > 下半 KPI 对比结论 > 装饰背景。

## 页面状态（8 frames）

| Frame | 语义 |
|---|---|
| `case3.initial` | 双侧空运行态；预置路线；Beam Accuracy 仅文件基线；With Start 因 Without 未完成而禁用 |
| `case3.without-running` | Without 逐点更新；With 不运行；点位进度显示最近 20 条窗口 |
| `case3.without-completed` | Without 结果保留；With Start 可用 |
| `case3.with-running` | Without 保留；With 逐点更新；`reflection` 参与完整点校验但 v1 不渲染 Reflection/LOS；Beam Accuracy 仍为基线 |
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
| `02-ux/case3/下部分/` | Cost / Throughput / Beam Accuracy | 正式 UI 文案固定为 `开销(%)`，字段语义仍为 `costPct` |
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
    │       │   └── PointProgressWindow（最近 20 条）
    │       └── WithSidePanel
    │           ├── SideHeader
    │           ├── MapViewport（v1 不渲染 reflection/LOS）
    │           ├── BeamPredictOverlay
    │           └── PointProgressWindow
    └── KpiComparePanel（KPI对比）
        ├── CostCard（开销(%) 双表盘代表态）
        ├── ThroughputCard（按点位 no 的双曲线代表态）
        └── BeamAccuracyCard（基线/增量环 + 正确/错误次数）
```

## 大布局 / 小布局

| 区域 | 规则 |
|---|---|
| Page | 固定 1920×1080；Header 固定高；内容纵向「上测试对比 / 下 KPI」 |
| SidePair | 横向二等分；两侧对称骨架，状态差异只改徽标/控件/动态层 |
| MapViewport | 底图 fit；v1 动态层只含轨迹与波束；Reflection/LOS 后续单独实现 |
| PointProgress | 固定 20 槽窗口；N>20 时显示最近 20 条；20 不是总点位上限 |
| KPI 三列 | 等宽；正式 UI 文案固定 `开销(%)`；数值均为运行时占位 |

## 资产来源决策

| Asset | Decision | 正式落点 |
|---|---|---|
| 地图 `ue_comm_map.png` | 用户 UX PNG 嵌入设计源 | `04-runtime-assets/case3/` |
| UE / BS / 状态图标 | 用户切图 | 同上 |
| 波束扇区、轨迹、吞吐曲线、Cost 弧/柱、准确率环 | 前端 SVG/canvas；Pencil 仅代表态 | 不冻结样例数为契约 |
| Reflection/LOS | v1 不渲染；`reflection` 仅参与 With 完整点校验 | 后续独立能力 |
| Shell 品牌/导航背景 | 复用 case2/Shell 视觉基线 | Shell 运行资源 |

## 动态数据边界

- 点位数动态 `N`；进度固定显示最近 20 条，20 不是总点位上限。
- Cost：侧级 `costPct`，正式 UI 文案 `开销(%)`，禁止 dB。
- Throughput：`points[].throughputGbps` 按 `no` 入曲线。
- Beam Accuracy：文件基线 + With 完成后同 `no` 的 `selectedBeamId` 对比；任意重置回基线。
- 不得把 UX 样例 89%、18/2、P1–P12 上限写进契约。

## 已冻结结论

1. 点位进度固定为 20 槽最近窗口，不增加第 21 槽；N 可大于 20。
2. With Start 在 Without 未完成时禁用；具体 tooltip 文案可在 Gate 3 选择，不改变状态语义。
3. `case3.failed` 用单侧失败代表态表达；正式 Web 根据本轮动作和侧别显示。
4. 开销采用冻结设计中的双表盘结构，单位为 `%`，标题为 `开销(%)`。
5. 现场环境弹窗复用 Shell 共用能力，不进入 case3 业务状态。
6. Reflection/LOS 可视化不进入 v1 正式 Web；`reflection` 字段仍是 With 完整点必需输入。
