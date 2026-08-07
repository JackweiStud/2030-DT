# Pen Plan — case3 Gate 1

## Target

- Output：`03-design/case3/case3-dt-com.pen`
- Source copy：`03-design/case2/case3-dt-com.pen` → 复制后只改 case3 副本
- Canvas：1920×1080
- Quality：标准重建 → `REVIEW_READY`（非 APPROVED）

## 变更集

| 类别 | 处理 |
|---|---|
| 保留 | ShellHeader 骨架、现场环境弹窗、部分 color/space token |
| 重建 | `主内容行`：双侧地图测试对比 + 三列 KPI（替换 case2 Calibrated/CDF 残留） |
| 新增 | 8 个业务 frame + 语义化图层命名 |
| 更新 | Tab 激活为 DT for Comm；Cost 文案 `Cost (%)`；动态占位符 |
| 禁止 | 修改 `03-design/case2/case2-dt-calibration.pen`；继续写 `03-design/case2/case3-dt-com.pen` |

## Frames

| Frame name | 差异要点 |
|---|---|
| `case3.initial` | 双侧空态；Without Start 可用；With Start 禁用；BA 基线 |
| `case3.without-running` | Without「测试中」+ 扫描波束 + 进度窗口；With 空/保留禁用 |
| `case3.without-completed` | Without「已完成」；With Start 启用 |
| `case3.with-running` | Without 保留完成；With「测试中」+ reflection；BA 仍基线 |
| `case3.with-completed` | 双侧「已完成」；KPI 全量；BA 含增量占位 |
| `case3.resetting-without` | Without「重置中」等待；With 可保留历史；BA 回基线 |
| `case3.resetting-with` | With「重置中」；Without 保留；BA 回基线 |
| `case3.failed` | Without「执行命令失败」+ 重试；不拼接旧运行数据 |
| `case3.site-env-modal` | 非业务态；现场环境弹窗 |

## 组件树

```text
Case3Frame
├── ShellHeader
│   ├── Brand
│   └── CaseNav (active: DT for Comm)
├── TestComparePanel
│   ├── PanelHeader
│   └── SidePair
│       ├── WithoutSidePanel / WithSidePanel
│       │   ├── SideHeader (icon, label, StatusBadge, StartBtn, ResetBtn)
│       │   ├── MapStage (map image, route, UE, BS, optional reflection)
│       │   ├── BeamCard
│       │   └── PointProgressWindow (12 slots + windowHint)
└── KpiComparePanel
    ├── CostCard
    ├── ThroughputCard
    └── BeamAccuracyCard
```

## 布局规则

- Header h≈78；上方面板约 540；下方 KPI 约 390；左右边距约 20。
- SidePair gap≈12–16；两侧等宽 fill。
- 点位进度：12 槽横排；`windowHint` 文案「显示最新 12 / 总 N」。
- 小窗口：不做 case-local reflow，由 Shell 等比缩放。

## 每个状态差异（控件 / 动态层）

| 状态 | Without 控件 | With 控件 | 地图动态层 | KPI |
|---|---|---|---|---|
| initial | Start on / Reset on | Start **disabled** / Reset on | 仅预置路线 | Cost/Thrp 空；BA 基线 |
| without-running | Start disabled / Reset disabled | 全 disabled | scan+sel+progress | without Cost/Thrp 更新中 |
| without-completed | Start on / Reset on | Start **on** | without 终态保留 | without 值保留 |
| with-running | 全 disabled（互斥） | Start disabled / Reset disabled | with + reflection | with 更新中；BA 基线 |
| with-completed | Start on / Reset on | Start on / Reset on | 双侧保留 | 全量对比 + BA 增量 |
| resetting-without | 等待态 | 可保留历史，控件禁用 | without 清空等待 | BA 回基线 |
| resetting-with | 可保留历史，控件禁用 | 等待态 | with 清空等待 | BA 回基线 |
| failed | 失败徽标 + 可重试 Start | 按规则保留/禁用 | 不拼旧半轮 | 不重算增量 |

## Token 草案（增量）

| Token | 用途 |
|---|---|
| `color-with` / `color-without` | 双侧强调 |
| 既有 `color-success` / `color-error` / `color-panel` | 徽标与失败 |
| `radius-card` / `space-gap-*` | 沿用 |

## 复用策略

- 先建 `case3.with-completed` 主视觉，再 Copy 出其余 7 态，只改状态差异节点。
- 现场环境弹窗保留独立 frame，不嵌入每个业务态。
