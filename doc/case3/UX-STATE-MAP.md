# case3 UX 状态映射

## 输入材料

| 输入 | 用途 | 边界 |
|---|---|---|
| `02-ux/case3/case3整体.png` | case3 完成态/运行态整页参考 | 3840x2160 高保真切图；不是最终设计源。 |
| `02-ux/case3/上部分/上部分整体.png` | 双侧地图、控制、波束和点位进度参考 | 原始 UX 的 P1-P12 只是视觉样例；冻结设计与正式 UI 使用最近 20 条窗口，均不是点位上限。 |
| `02-ux/case3/下部分/下部分整体.png` | Cost、Throughput、Beam Accuracy 参考 | 正式 UI 标题为 `开销(%)`；字段/单位仍为 Cost 百分比，不得沿用 dB。 |
| `02-ux/case3/上部分/元素/ue_comm_map.png` | 地图底图输入 | 正式运行需复制到 `04-runtime-assets/case3/` 后再由 Web 消费。 |
| `01-参考资料/case3/data/c3/` | 多 txt 数据样本 | 参考样本当前主要逐点文件为 32 行；正式点位数动态。 |

## 页面与状态清单

| 状态 | UX 证据 | 必须设计的可见行为 | 当前缺口 |
|---|---|---|---|
| `initial` | 总图 + 拆图 | 双侧地图加载预置路线；两侧 Start/ReInit 初始可见；Beam Accuracy 显示文件基线 | Gate 1 设计已冻结；正式行为由 Gate 3 规格实现。 |
| `without-running` | 上半区左侧运行态 | Without 逐点轨迹、扫描波束、选择波束、点位进度；With 不运行 | 超过 20 点时滚动到最近 20 条窗口。 |
| `without-completed` | 上半区左侧完成标记 | Without 结果保留；With Start 可用 | 按 Frontend Spec 的按钮互斥与完成态实现。 |
| `with-running` | 上半区右侧运行态 | With 逐点轨迹、预测波束、点位进度；Without 保留 | `reflection` 仍是完整点必需字段，v1 不渲染 Reflection/LOS；With Start 仅在 Without 本轮有效完成后可用。 |
| `with-completed` | 总图 | 双侧结果保留；下半区展示 Cost、Throughput、Beam Accuracy 对比 | Beam Accuracy 数字必须由运行时计算，不冻结样例数。 |
| `resetting-without` | Pencil 补建态 | Without 重置等待；With 历史结果保留；Beam Accuracy 回基线 | Gate 1 已冻结；Gate 1.5 不覆盖，正式行为由 Gate 2/3 约束。 |
| `resetting-with` | Pencil 补建态 | With 重置等待；Without 历史结果保留；Beam Accuracy 回基线 | Gate 1 已冻结；Gate 1.5 不覆盖，正式行为由 Gate 2/3 约束。 |
| `failed` | Pencil 补建态 | 对应侧显示执行命令失败；允许手动重试；另一侧历史结果按规则保留 | Gate 1 已冻结；Gate 1.5 不覆盖，正式行为由 Gate 2/3 约束。 |

## 可见数字与契约核对

| UI 区块 | 当前 UX 数字/文案 | 已确认事实 | Gate 1 处理 |
|---|---|---|---|
| 点位进度 | 原始 UX 的 P1-P12 样例 | 点位数动态 N；超出窗口显示最新 20 条 | 设计成可滚动/滑动窗口，20 是窗口长度，不是点位上限。 |
| Cost | 切图出现 dB/减少语义 | Cost 单位是 `%` | 正式 UI 标题统一 `开销(%)`，展示 Without/With 双表盘对比。 |
| Throughput | Gbps 曲线 | 每点吞吐来自结构化点位 `throughputGbps` | 横轴点位动态，曲线长度随 N。 |
| Beam Accuracy | 样例百分比和成功/错误次数 | 文件基线 + 本轮 Without/With 同点位 beamId 对比 | 百分比、成功次数、错误次数均运行时计算。 |

## Gate 1 冻结检查

- [x] 创建并冻结 case3 设计源，不能把 `case3整体.png` 直接作为最终视觉契约。
- [x] 补齐 initial、without-running、without-completed、with-running、with-completed、resetting、failed 的设计/交接状态；Gate 1.5 只验收前五态和现场环境弹窗。
- [x] 固定动态 N 的点位进度窗口行为：最新 20 条滚动显示。
- [x] 修正正式 UI 标题为 `开销(%)`，字段/单位语义保持 Cost 百分比。
- [x] 固定正式运行资源落点：`04-runtime-assets/case3/`，不让正式 React 直接引用 `02-ux/`。
