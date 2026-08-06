# case3 UI 数据来源反向清单

> 目的：从每个可见动态区域反查到控制字段、文件输入或前端派生规则。本文只覆盖 case3；Shell 与 case2 不得借用 case3 业务数据源。
>
> 对应契约：[API-CONTRACT.md](API-CONTRACT.md)。

## 1. 页面级映射

| UI 区域 | 是否动态 | 来源/权威方 | 显示门槛 | 备注 |
|---|---|---|---|---|
| 顶部品牌、导航、1920x1080 缩放 | 否（Shell） | Shell 运行资源与公共 token | 始终 | 不读取 case3 文件。 |
| 现场环境弹窗 | 是（Shell 共用） | Shell `SiteEnvWindow` | 用户点击“现场环境” | 与 case2 共用弹窗能力；不进入 case3 业务状态。 |
| case3 背景、面板、图标、地图底图 | 否/半静态 | `04-runtime-assets/case3/`（未来正式运行资源） | 进入 case3 Tab | 正式运行不得直接回读 `02-ux/` 切图。 |
| Without Start/ReInit | 是 | Web 本地状态 + `/api/case3/control-file` | 无其他侧运行/重置时 | Node 清 without 侧实时 append 文件并写控制；React 不直接删文件。 |
| With Start/ReInit | 是 | Web 本地状态 + `/api/case3/control-file` | 已有 Without 有效结果且无其他侧运行/重置时 | Node 清 with 侧实时 append 文件并写控制；React 不直接删文件。 |
| Without 地图轨迹 | 是 | `/api/case3/points?side=without` 的结构化点位 | Without 本轮已见 `execute success` | UE 坐标由 `ue_comm_without_dt_coordinates.txt` 收编。 |
| With 地图轨迹 | 是 | `/api/case3/points?side=with` 的结构化点位 | With 本轮已见 `execute success` | UE 坐标由 `ue_comm_with_dt_coordinates.txt` 收编。 |
| Without BS 波束扫描 | 是 | 结构化点位 `scanBeamIds` + `selectedBeamId` | Without 逐点播放 | 扫描集合来自 `ue_comm_without_dt_beams.txt`；选择波束来自 `ue_comm_without_dt_sel_beam.txt`。 |
| With BS 波束预测 | 是 | 结构化点位 `selectedBeamId` | With 逐点播放 | 来自 `ue_comm_with_dt_sel_beam.txt`。 |
| With 反射/LOS 示意 | 是 | 结构化点位 `reflection` | With 逐点播放且反射点行有效 | 来自 `ue_comm_with_dt_coordinates_reflection_point.txt`。 |
| 点位进度 | 是 | 结构化点位 `no` 与运行时 `N` | 逐点播放 | 显示最新 12 条；超过窗口长度滚动到最新。 |
| Cost Comparison | 是 | `/api/case3/kpis` 或点位轮询附带的最新 cost | 对应侧运行后 | 单位 `Cost (%)`；取 cost 文件最新一行；不使用 dB。 |
| Throughput Comparison | 是 | 结构化点位 `throughputGbps` | 对应侧逐点数据有效 | Without/With 两条曲线；点位数动态。 |
| Beam Accuracy | 是 | 文件基线 + Web 本轮点位派生 | 进 Tab 显示基线；With 完成后且 Without 有效时显示基线+增量 | 任意一侧重置后增量失效，回到基线。 |
| 运行/失败/完成反馈 | 是 | `case_control.status` + Web 本轮动作来源 | 本轮等待态内 | `execute success` 非完成；`case complete` / `reinit complete` 是完成门槛。 |

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
| `ue_comm_with_dt_coordinates_reflection_point.txt` | `point.reflection` | With 反射/LOS 示意。 |
| `ue_comm_with_dt_thrp.txt` | `point.throughputGbps` | Throughput with 曲线。 |
| `ue_comm_with_dt_cost.txt` | `withCostPct` | Cost 右柱。 |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | `beamAccuracyBaseline` | Beam Accuracy 初始与重置后基线。 |

## 3. 派生规则

| 派生项 | 公式/规则 | 非法或不足时 |
|---|---|---|
| 动态点位数 `N` | 已返回结构化点位总数；完整 N 可随后端 append 增长 | 不显示固定 P1-P12 全量；只显示已有点位窗口。 |
| 点位进度窗口 | 当前点附近最新 12 条；超过 12 条滚动到最新 | 不压缩到不可读文字。 |
| Cost | 对应 cost 文件最新非空行，单位 `%` | 该侧柱值显示为空/不可用，不沿用旧值冒充本轮。 |
| Throughput | 每个结构化点位的 `throughputGbps` 按 `no` 入曲线 | 缺点不补 0，不跨侧对齐。 |
| Beam Accuracy 增量 | With 完成后，用同坐标 Without/With 点位比较 `selectedBeamId` | Without 缺失或任意侧重置后，仅显示基线。 |

## 4. 覆盖检查

- [x] Without/With 双侧 Start/ReInit、互斥和单侧重置都有权威来源。
- [x] 地图、波束、点位进度、Cost、Throughput、Beam Accuracy 均有文件或派生来源。
- [x] Node 是清空文件、读取多 txt 和结构化收编的唯一浏览器侧文件所有者。
- [x] Cost 单位已固定为 `%`，不继承 UX 切图中的 dB 语义。
- [x] 点位数按运行时动态 N，不硬编码 12 或 32。
