# case3 演示主线：DT for Comm

## 演示承诺

让内部团队看到：同一条 UE 轨迹先跑 Without DT 通信基线，再跑 With DT 数字孪生辅助通信；最终对比三类 KPI：测量开销 Cost、吞吐 Throughput、波束预测准确率 Beam Accuracy。

## 已确认范围

- 当前 Tab：`DT for Comm`（case3）。
- 执行顺序：用户必须先跑 Without DT，再跑 With DT；两侧互斥运行，一次只允许一侧处于运行或重置中。
- 后端文件层：沿用 `01-参考资料/case3/data/c3/` 的多 txt 现网协议；正式后端继续 append txt。
- Web 与 Node：浏览器不直接读、删或写共享目录；Node 适配服务提供 `/api/case3/*`，负责清空单侧 append 文件、按行号收编并校验为区分 Without/With 的结构化点位；Web 通过 `GET /api/case3/side` 拉取单侧全量快照（完整点 + 侧级 `costPct`）。
- 控制文件：沿用同一个 `case_control.json` 五个核心字段结构。case2/case3 共享根统一使用项目级 `DT_SHARED_DIR`；`CASE2_SHARED_DIR` 仅可作为历史兼容名。
- 控制收尾：case3 与 case2 最新口径保持一致。进页/刷新/切回 case3 的控制文件 GET 成功后，Web 先触发一次 `command=init,status=""` 空闲写回；单侧 Start 在本轮已见 `execute success -> case complete` 且完成结果被 Web 接收后写回空闲态；单侧 ReInit 在 UI 消费 `reinit complete` 并完成单侧清理后写回空闲态。业务终态仍只由后端写，`init,status=""` 只表示控制文件清洁态。
- 删除清空：Start/ReInit 前清空对应侧实时 append 文件归属 Node 适配服务；后端不负责清历史文件，React 不直接删文件。开新轮后，正式后端必须停止旧轮写入，并只向当前命令侧文件写入本轮数据。
- Reset：单侧重置。Without 重置后 With 历史结果可保留；With 重置后 Without 历史结果可保留。任意一侧重置都必须让本次 Beam Accuracy 增量对比失效，恢复到跑 With 前的基线展示。
- 点位数：动态 `N`，由运行时数据解析得到。顶部点位进度固定窗口显示最新 20 条；超过窗口长度时滚动到最新点位；20 只是窗口长度，不是点位总上限。
- Cost：单位为 `%`，正式 UI 文案统一为 `Cost (%)`；不得沿用 UX 切图里的 dB 或 case2 误差减少语义。两侧 Cost 都有效且 Without Cost 非 0 时，Web 显示相对开销降低率：`(withoutCostPct - withCostPct) / withoutCostPct * 100`。

## 主线状态

| 状态 | 用户动作/外部条件 | Without DT | With DT | KPI |
|---|---|---|---|---|
| 初始 | 进入 case3 Tab | 预置 UE 路线、地图、空运行态 | 预置 UE 路线、地图、空运行态 | Cost/Throughput 为空或基线占位；Beam Accuracy 显示文件基线 |
| Without 运行中 | 点击 Without Start；Node 清空 without 侧实时文件并写 `case3/start/without dt/status=""`；后端写 `execute success` | 按结构化点位逐点更新 UE 轨迹、扫描波束集合、选择波束、吞吐、点位进度 | 保留现有 With 历史结果或空态，不运行 | 更新 without Cost/Throughput；Beam Accuracy 不重算 |
| Without 完成 | 本轮已见 `execute success -> case complete`，Web 接收完成结果后写回 `command=init,status=""` | 停止轮询，保留 without 完成结果 | With Start 可用 | without 曲线/柱值保留；Beam Accuracy 仍为基线 |
| With 运行中 | 已有 Without 结果后点击 With Start；Node 清空 with 侧实时文件并写 `case3/start/with dt/status=""`；后端写 `execute success` | 保留 without 完成结果 | 按结构化点位逐点更新 UE 轨迹、预测波束、吞吐、点位进度；`reflection` 只用于完整点校验，v1 不渲染 Reflection/LOS | 更新 with Cost/Throughput；Beam Accuracy 等待 With 完成 |
| With 完成 | 本轮已见 `execute success -> case complete`，Web 接收完成结果后写回 `command=init,status=""` | 保留 without 完成结果 | 停止轮询，保留 with 完成结果 | Cost/Throughput 双侧对比；Beam Accuracy = 文件基线 + 本轮 without/with 同点位 beamId 对比 |
| 单侧重置中 | 点击任一侧重置；Node 写 `reinit`、对应 `dt_type`、`status=""`；UI 消费 `reinit complete` 后写回 `command=init,status=""` | 若重置 without：等待 `reinit complete` 后清 without 本轮结果；with 历史结果可保留 | 若重置 with：等待 `reinit complete` 后清 with 本轮结果；without 历史结果可保留 | 任意重置立刻使本次 Beam Accuracy 增量失效，显示回基线 |
| 命令失败 | 本轮运行或重置中读到 `execute fail` | 显示对应侧执行命令失败；允许该侧手动重试 | 显示对应侧执行命令失败；允许该侧手动重试 | 不自动拼接旧运行数据，不自动重算 Beam Accuracy |

## 结论与禁止口径

- 只能在 Without 与 With 均完成后表达“DT 辅助通信相对基线的 Cost、Throughput、Beam Accuracy 对比”。
- `execute success` 只表示命令执行成功，不表示本侧运行完成；完成门槛是本轮已见 `execute success -> case complete`。
- `reinit complete` 是单侧重置完成信号；不要求后端再写 `command=init,status=""`，由 Web 经 Node 在 UI 消费完成后写回空闲态。
- 空闲写回不是业务命令边沿；后端识别新轮次仍只看 `start|reinit + status=""`。
- JSONL 是收编讨论稿，不是当前正式后端文件协议。除非重新冻结契约，不要求正式后端改写为 JSONL。
- `ue_comm_*_mse.txt` 暂不进入 case3 正式 UI 主线；不得把 case2 的误差下降语义套到 case3 Cost。
- 调试 JSONL 快照落盘：Node 在完整点变化时，将当前侧完整点以**整文件原子替换**写入 `{DT_SHARED_DIR}/out/case3/points/{without|with}.jsonl`；Web 不回读；不得写到 `out/case2/`。
- 演示期主路径不采用 `/points` + `/kpis` 双 cursor 增量；Cost 与点位同包于 `/side`，但不进入 `Case3Point`。
- Web 主逻辑只消费 `/side` 的 `points` + `costPct`；先判 `ok`，`ok:false` 不更新业务数据、不推断业务终态。`pendingTail` 仅可选提示，不参与完成/失败判定。`Case3Point` 不带 `side`，侧别只在 snapshot/`side` 参数表达。
- With `reflection` 保持为 Node 收编的完整点必需字段；v1 正式 Web 暂不渲染 Reflection/LOS，后续作为独立可视化能力实现。

## 来源

- UX 总图：`02-ux/case3/case3整体.png`
- 上半区：`02-ux/case3/上部分/上部分整体.png`
- 下半区：`02-ux/case3/下部分/下部分整体.png`
- 多 txt 现网协议：`01-参考资料/case3/case3_文件清单与使用时机_多txt版.md`
- JSONL 草案：`01-参考资料/case3/ue_comm_聚合JSON协议草案.md`
