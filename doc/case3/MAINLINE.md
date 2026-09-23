# case3 演示主线：DT for Comm

## 演示承诺

让内部团队看到：同一条 UE 轨迹先跑 Without DT 通信基线，再跑 With DT 数字孪生辅助通信；最终对比三类 KPI：测量开销 Cost、吞吐 Throughput、波束预测准确率 Beam Accuracy。

## 已确认范围

- 当前 Tab：`DT for Comm`（case3）。
- 执行顺序：用户必须先跑 Without DT，再跑 With DT；两侧互斥运行，一次只允许一侧处于运行或重置中。
- 后端文件层：沿用 `01-参考资料/case3/data/c3/` 的多 txt 现网协议；正式后端继续 append txt。
- Web 与 Node：浏览器不直接读、删或写共享目录；Node 适配服务提供 `/api/case3/*`，负责清空单侧 append 文件、按行号收编并校验为区分 Without/With 的结构化点位；Web 通过 `GET /api/case3/side` 拉取单侧全量快照（完整点 + 侧级 `costPct`）。
- 控制文件：沿用同一个 `case_control.json` 五个核心字段结构。case2/case3 共享根统一使用项目级 `DT_SHARED_DIR`；`CASE2_SHARED_DIR` 仅可作为历史兼容名。
- 控制收尾：进页/刷新/切回 case3 的控制文件 GET 成功后，Web 触发 `command=init,status=""` 空闲写回；后端观察到 init 后必须停止旧 Case/旧侧继续写文件。单侧 Start 只有在本轮已见保持至少 3000ms 的 `execute success -> case complete`，且最终 `/side` 快照通过完整性门槛并渲染完成后，才写回空闲态；单侧 ReInit 在 UI 消费 `reinit complete` 并完成单侧清理后写回空闲态。
- 删除清空：Start/ReInit 前清空对应侧实时 append 文件归属 Node 适配服务；后端不负责清历史文件，React 不直接删文件。开新轮后，正式后端必须停止旧轮写入，并只向当前命令侧文件写入本轮数据。
- Reset：单侧重置。Without 重置后 With 历史结果可保留；With 重置后 Without 历史结果可保留。任意一侧重置都必须让本次 Beam Accuracy 增量对比失效，恢复到跑 With 前的基线展示。
- ReInit 失败不恢复目标侧旧结果；进入对应侧 `failed-reinit` 后，用户只需重试该侧 ReInit。
- 跨 Case：任一 Case 处于 Start/ReInit 等待态时，Shell 锁定其他 Case Tab；不增加取消、队列或自动业务超时。
- 初始化门槛：base route 必须非空，Beam Accuracy 基线必须满足 `0 <= success <= total` 且 `total > 0`。失败时两侧 Start 禁用，Web 输出结构化 `console.error`。
- 点位数：动态 `N`，由运行时数据解析得到。顶部点位进度固定窗口显示最新 20 条；超过窗口长度时滚动到最新点位；20 只是窗口长度，不是点位总上限。
- Cost：单位为 `%`，正式 UI 标题为 `开销(%)`；Node 校验 `0～100` 并四舍五入到 1 位。两侧 Cost 都有效且 Without Cost 非 0 时，Web 显示有 DT 相对无 DT 的开销变化：`(withCostPct - withoutCostPct) / withoutCostPct * 100`。增加为向上箭头 + `X%`，减少为向下箭头 + `-X%`。
- 截图：与 case2 同构。后端仅在 Start 的 `execute success -> case complete` 窗口置 `save_picture_flag=1`；Web 最多尝试 3 次，Node 原子保存到 `out/case3/` 后清零；ReInit 不截图。

## 主线状态

| 状态 | 用户动作/外部条件 | Without DT | With DT | KPI |
|---|---|---|---|---|
| 初始 | 进入 case3 Tab | 预置 UE 路线、地图、空运行态 | 预置 UE 路线、地图、空运行态 | Cost/Throughput 为空或基线占位；Beam Accuracy 显示文件基线 |
| Without 运行中 | 点击 Without Start；Node 清空 without 侧实时文件并写 `case3/start/without dt/status=""`；后端写并保持 `execute success` 至少 3000ms | 结构文件逐点更新 UE 轨迹、扫描波束集合、选择波束与点位进度 | 保留现有 With 历史结果但标记为未配对，不运行 | Cost 按 `/side` 更新；Throughput 按独立 `/throughput` 更新；跨侧 KPI 失效 |
| Without 完成 | 本轮已见 `execute success -> case complete`；最终快照满足 `ok=true,pendingTail=false,points>0,costPct!=null`；Web 渲染且截图保存/放弃收尾后写回 `init` | 停止业务轮询，保留 without 完成结果 | With Start 可用 | without 曲线/表盘保留；Beam Accuracy 仍为基线 |
| With 运行中 | 已有当前有效 Without 后点击 With Start；Node 清空 with 侧实时文件并写 `case3/start/with dt/status=""`；后端写并保持 `execute success` 至少 3000ms | 保留 without 完成结果 | 结构文件逐点更新 UE 轨迹、预测波束与点位进度；`reflection` 只用于完整点校验，v1 不渲染 Reflection/LOS | Cost 按 `/side` 更新；Throughput 按独立 `/throughput` 更新；Beam Accuracy 按配对点实时更新 |
| With 完成 | 本轮已见 `execute success -> case complete`；最终快照通过同一完整性门槛；Web 渲染且截图保存/放弃收尾后写回 `init` | 保留 without 完成结果 | 停止业务轮询，保留 with 完成结果 | Cost/Throughput 双侧对比；Beam Accuracy = 文件基线 + 当前配对点位增量 |
| 单侧重置中 | 点击任一侧重置；Node 写 `reinit`、对应 `dt_type`、`status=""`；UI 消费 `reinit complete` 后写回 `command=init,status=""` | 若重置 without：等待 `reinit complete` 后清 without 本轮结果；with 历史结果可保留 | 若重置 with：等待 `reinit complete` 后清 with 本轮结果；without 历史结果可保留 | 任意重置立刻使本次 Beam Accuracy 增量失效，显示回基线 |
| 命令失败 | 本轮运行或重置中读到 `execute fail` | Start 失败只允许同侧 Start 重试；ReInit 失败不恢复旧结果，只允许同侧 ReInit 重试 | 同左 | 不自动拼接旧运行数据，不自动重算 Beam Accuracy |

## 结论与禁止口径

- 只能在 Without 与 With 均完成后表达“DT 辅助通信相对基线的 Cost、Throughput、Beam Accuracy 对比”。
- `execute success` 只表示命令执行成功，不表示本侧运行完成；完成门槛是本轮已见 `execute success -> case complete`。
- 后端必须让 `execute success` 保持至少 3000ms；不得在 500ms Web 轮询可能完全漏过的窗口内直接覆盖为完成终态。
- `case complete` 只在目标侧必需文件和 Cost 完整写完、关闭并停止写入后发布；Web 最终快照不完整时保持 running，不写回 init。
- 若 Start 本轮请求截图，后端应将 `case complete + save_picture_flag=1` 合并为同一次最终控制写；Web 同拍先建立截图任务，再完成结果收尾。截图失败不改业务状态，累计 3 次后允许清 flag 并丢失本张截图。
- `reinit complete` 是单侧重置完成信号；不要求后端再写 `command=init,status=""`，由 Web 经 Node 在 UI 消费完成后写回空闲态。
- 空闲写回不是业务命令边沿；后端识别新轮次仍只看 `start|reinit + status=""`。
- JSONL 是收编讨论稿，不是当前正式后端文件协议。除非重新冻结契约，不要求正式后端改写为 JSONL。
- `ue_comm_*_mse.txt` 暂不进入 case3 正式 UI 主线；不得把 case2 的误差下降语义套到 case3 Cost。
- 调试 JSONL 快照落盘：Node 在完整点变化时，将当前侧完整点以**整文件原子替换**写入 `{DT_SHARED_DIR}/out/case3/points/{without|with}.jsonl`；Web 不回读；不得写到 `out/case2/`。
- 演示期主路径不采用 `/points` + `/kpis` 双 cursor 增量；Cost 与点位同包于 `/side`，但不进入 `Case3Point`。
- Web 主逻辑只消费 `/side` 的 `points` + `costPct`；先判 `ok`，`ok:false` 不更新业务数据、不推断业务终态。运行中 `pendingTail` 仅作收数提示；`case complete` 后它必须为 false 才能完成。`Case3Point` 不带 `side`，侧别只在 snapshot/`side` 参数表达。
- With `reflection` 保持为 Node 收编的完整点必需字段；v1 正式 Web 暂不渲染 Reflection/LOS，后续作为独立可视化能力实现。
- Node 负责共享文件数值归一和范围/行号校验；Web 只检查 REST envelope/shape/JSON 类型，不重复业务数值校验，非法响应记 `CASE3_INVALID_RESPONSE`。
- 截图输出固定隔离在 `{DT_SHARED_DIR}/out/case3/`，不得写入 `out/case2/`。

## 来源

- UX 总图：`02-ux/case3/case3整体.png`
- 上半区：`02-ux/case3/上部分/上部分整体.png`
- 下半区：`02-ux/case3/下部分/下部分整体.png`
- 多 txt 现网协议：`01-参考资料/case3/case3_文件清单与使用时机_多txt版.md`
- JSONL 草案：`01-参考资料/case3/ue_comm_聚合JSON协议草案.md`
