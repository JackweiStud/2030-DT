# case3 UI 数据来源反向清单

> 目的：从每个可见动态区域反查到控制字段、文件输入或前端派生规则。本文只覆盖 case3；Shell 与 case2 不得借用 case3 业务数据源。
>
> 对应契约：[API-CONTRACT.md](API-CONTRACT.md)。

## 1. 页面级映射

| UI 区域 | 是否动态 | 来源/权威方 | 显示门槛 | 备注 |
|---|---|---|---|---|
| 顶部品牌、导航、1920x1080 缩放 | 是（Shell 导航锁） | Shell 运行资源 + 当前 Case 等待态 | 始终 | 任一 Case Start/ReInit 等待期间锁定其他 Tab；不读取 case3 业务文件。 |
| 现场环境弹窗 | 是（Shell 共用） | Shell `SiteEnvWindow` | 用户点击“现场环境” | 与 case2 共用弹窗能力；不进入 case3 业务状态。 |
| case3 背景、面板、图标、地图底图 | 否/半静态 | `04-runtime-assets/case3/`（未来正式运行资源） | 进入 case3 Tab | 正式运行不得直接回读 `02-ux/` 切图。 |
| Without Start/ReInit | 是 | Web 本地状态 + `/api/case3/control-file` | 初始化成功且无其他侧运行/重置时 | Start 按主线门槛；ReInit 仅在有目标侧结果时可用。Node 清 without 侧实时 append 文件并写控制。 |
| With Start/ReInit | 是 | Web 本地状态 + `/api/case3/control-file` | Start 需要当前有效 Without；ReInit 只需存在 With 历史结果；无其他侧运行/重置 | Node 清 with 侧实时 append 文件并写控制；React 不直接删文件。 |
| 初始化失败 | 是 | `/api/case3/init-data` 错误或非法响应 | base route 空/非法，或 BA 基线非法 | 双侧 Start 禁用；Web 输出含 endpoint/code/reason 的结构化 `console.error`。 |
| Without 地图轨迹 | 是 | `/api/case3/side?side=without` 的 `points` | Without 本轮已见 `execute success` | UE 坐标由 `ue_comm_without_dt_coordinates.txt` 收编。 |
| With 地图轨迹 | 是 | `/api/case3/side?side=with` 的 `points` | With 本轮已见 `execute success` | UE 坐标由 `ue_comm_with_dt_coordinates.txt` 收编。 |
| Without BS 波束扫描 | 是 | 结构化点位 `scanBeamIds` + `selectedBeamId` | Without 逐点播放 | 扫描集合来自 `ue_comm_without_dt_beams.txt`；选择波束来自 `ue_comm_without_dt_sel_beam.txt`。 |
| With BS 波束预测 | 是 | 结构化点位 `selectedBeamId` | With 逐点播放 | 来自 `ue_comm_with_dt_sel_beam.txt`。 |
| With 反射/LOS 示意 | 后续阶段 | 结构化点位 `reflection` | v1 不渲染 | 来自 `ue_comm_with_dt_coordinates_reflection_point.txt`；reflection 仍是 With 完整点必需字段，缺第 `i` 行时不返回第 `i` 个半点。 |
| 点位进度 | 是 | 结构化点位 `no` 与运行时 `N` | 逐点播放 | 固定显示最新 20 条；超过窗口长度滚动到最新；20 不是总点位上限。 |
| Cost Comparison | 是 | `/api/case3/side` 同包侧级字段 `costPct` | 对应侧运行后 | 正式标题 `开销(%)`；Node 四舍五入到 1 位且校验 `0～100`；不写入 `Case3Point`。 |
| 相对开销变化 | 是 | Web 基于双方 `costPct` 派生 | 两侧 Cost 有效且 Without Cost 非 0 | `(withoutCostPct - withCostPct) / withoutCostPct * 100`；正数表示降低、负数表示上升，无法计算时显示 `--`。 |
| Throughput Comparison | 是 | 结构化点位 `throughputGbps` | 对应侧逐点数据有效 | Without/With 两条曲线；点位数动态。 |
| Beam Accuracy | 是 | 文件基线 + Web 本轮点位派生 | 进 Tab 显示基线；With 完成后且 Without 有效时显示基线+增量 | 任意一侧重置后增量失效，回到基线。 |
| 运行/失败/完成反馈 | 是 | `case_control.status` + Web 本轮动作来源 | 本轮等待态内 | success 至少保持 3000ms；case complete 后最终快照通过并渲染才写 init。ReInit 失败不恢复旧结果，只显示同侧 ReInit 重试。 |

## 2. 文件到 UI 映射

| 文件 | Node 收编字段 | UI 消费 |
|---|---|---|
| `ue_comm_coordinates_base.txt` | `baseRoute[]` | 双侧地图预置 UE 路线。 |
| `ue_comm_without_dt_coordinates.txt` | `point.ue` | Without UE 实时轨迹。 |
| `ue_comm_without_dt_beams.txt` | `point.scanBeamIds` | Without 16 个扫描波束。 |
| `ue_comm_without_dt_sel_beam.txt` | `point.selectedBeamId` | Without 当前选择波束、Beam Accuracy 对比输入。 |
| `ue_comm_without_dt_thrp.txt` | `point.throughputGbps` | Throughput without 曲线。 |
| `ue_comm_without_dt_cost.txt` | `withoutCostPct` | Cost 左柱。 |
| `ue_comm_with_dt_coordinates.txt` | `point.ue` | With UE 实时轨迹。 |
| `ue_comm_with_dt_sel_beam.txt` | `point.selectedBeamId` | With 当前预测波束、Beam Accuracy 对比输入。 |
| `ue_comm_with_dt_coordinates_reflection_point.txt` | `point.reflection` | With 完整点校验；Reflection/LOS 可视化后续单独实现。 |
| `ue_comm_with_dt_thrp.txt` | `point.throughputGbps` | Throughput with 曲线。 |
| `ue_comm_with_dt_cost.txt` | `withCostPct` | Cost 右柱。 |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | `beamAccuracyBaseline` | Beam Accuracy 初始与重置后基线。 |

## 3. 派生规则

| 派生项 | 公式/规则 | 非法或不足时 |
|---|---|---|
| 动态点位数 `N` | `/side` 返回的 `completeCount` / `points.length`；完整 N 可随后端 append 增长 | 只显示已有点位的最近 20 条窗口；20 不代表 N 的上限。 |
| 点位进度窗口 | 当前点附近最新 20 条；超过 20 条滚动到最新 | 不压缩到不可读文字。 |
| Cost | 对应 cost 文件最新非空行，Node 四舍五入到 1 位并校验 `0～100` | 运行中可为 `null`；完成门槛要求非空，不沿用旧值冒充本轮。 |
| 相对开销变化 | `(withoutCostPct - withCostPct) / withoutCostPct * 100` | 任一侧 Cost 缺失或 Without Cost 为 0 时显示 `--`；正数表示降低、负数表示上升。 |
| Throughput | 每个结构化点位的 `throughputGbps` 按 `no` 入曲线 | 缺点不补 0，不跨侧对齐。 |
| Beam Accuracy 增量 | With 完成后，用相同 `no` 的 Without/With 点位比较 `selectedBeamId`；坐标只做可选诊断，不做匹配主键 | Without 缺失、同 `no` 点位不完整或任意侧重置后，仅显示基线。 |
| 调试 JSONL 快照 | Node 在 `completeCount` 变化时，将当前完整点全量以整文件原子替换写入 `{DT_SHARED_DIR}/out/case3/points/{side}.jsonl`，side 为 without 或 with | 仅作 QA/定位证据，Web 不回读；不写 cost 行；不写入 `out/case2/`。 |

## 4. 覆盖检查

- [x] Without/With 双侧 Start/ReInit、互斥和单侧重置都有权威来源。
- [x] 地图、波束、点位进度、Cost、Throughput、Beam Accuracy 均有文件或派生来源。
- [x] Node 是清空文件、读取多 txt 和结构化收编的唯一浏览器侧文件所有者。
- [x] Cost 单位已固定为 `%`，不继承 UX 切图中的 dB 语义。
- [x] 点位数按运行时动态 N；点位进度固定为最近 20 条窗口，不把 20 当作总点位上限。
- [x] case3 调试输出归属 `out/case3/`，不污染 `out/case2/`。
- [x] Web 主路径为单侧全量快照 `/api/case3/side`（points 全量 + 侧级 costPct），不采用双 cursor 增量。
- [x] 控制文件完成/重置终态只在本轮等待态内消费；随后写回 `init,status=""`，不把历史 `case complete` / `reinit complete` 当作刷新恢复依据。
- [x] init 撤销旧轮写入权；等待态锁定跨 Case Tab。
- [x] 初始化失败禁用 Start 并记录 Web console error。
- [x] case complete 后最终快照必须无 pending tail、点非空且 Cost 有效。
- [x] Node 做权威数值校验；Web 只做响应 shape/类型防御。
