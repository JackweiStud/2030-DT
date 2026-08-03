# case2 演示主线：DT Calibration

## 演示承诺

让内部团队看到：在同一场景下，Initial DT 经 `with dt` 校准后，RSS 误差、有效路径数误差和首径时延误差的空间分布与统计分布均得到改善。

## 前提与输入

- 当前 Tab：`DT Calibration`。
- Initial 数据：三项 Initial 热力图和 KPI 样本。
- 控制请求：前端侧适配服务写入 `case=case2`、`command=start`、`dt_type=with dt`。
- 启动状态链路：后端 `status=execute success` 后继续执行系统测试，最终以 `status=case complete` 表示测试完成；若 `status=execute fail`，前端显示执行命令失败，后端不再写 `case complete`。
- 结果发布规则：后端先完整写完并关闭六个 Calibrated 文件，最后才写 `status=case complete`；前端只在本轮启动后的 `execute success -> case complete` 链路上读取六文件。
- 重置状态链路：后端 `status=execute success` 后继续执行系统重置，最终以 `status=reinit complete` 表示重置完成；若 `status=execute fail`，前端显示执行命令失败，后端不再写 `reinit complete`。

## 主线状态

| 状态 | 用户动作/外部条件 | 左侧 | 右侧 | 控件 |
|---|---|---|---|---|
| Initial | `command=init,status=""`，或重置后 `status=reinit complete` | 仅 Initial DT 三项热力图；Calibrated 为空态 | 基线可见；Calibrated 对比为空态/说明态 | 启动可用，重置禁用 |
| 校准中 | 点击启动后，尚未完成 | 保留 Initial；Calibrated 显示校准中 | 不展示旧 CDF/均值，显示进行中反馈 | 启动、重置均禁用 |
| 命令已执行 | `status=execute success` | 启动路径仍不显示结果；重置路径仍等待重置完成 | 仍为进行中 | 当前动作结束前两按钮均禁用 |
| 完成 | `status=case complete` 且结果完整 | Initial/Calibrated 三行配对热力图 | 每项显示两条 CDF 与平均误差对比 | 启动禁用，重置可用 |
| 失败 | `status=execute fail` | 显示执行命令失败；本轮不再等待完成终态 | 显示执行命令失败 | 启动与重置解除，允许手动重试；不自动重试 |
| 重置 | 点击重置，写 `reinit`；两按钮禁用 | 等待重置确认；读到 `reinit complete` 后移除 Calibrated 热力图 | 等待重置确认；读到 `reinit complete` 后移除 Calibrated KPI/CDF/均值 | 成功后恢复登录时按钮状态，后续可再次启动 |

## 结论与禁止口径

- 结论只能表述为：在当前批次数据中，Calibrated DT 的误差分布左移且平均误差下降。
- 不得将现有参考文件称为本次真实采集结果。
- 不得将 `execute success` 或 Calibrated 文件存在本身称为“校准完成”或“重置完成”。
- 不得要求 `reinit` 成功后必须回到 `command=init,status=""`；`status=reinit complete` 已是重置完成信号。
- 不得在 `execute fail` 后继续等待 `case complete` 或 `reinit complete`；前端应显示执行命令失败。
- 截图：后端仅在启动路径 `execute success`→`case complete`（含同拍）将 `save_picture_flag` 0→1；Web 仅 `calibrating` 观察，同拍 complete 仍截一次；适配服务保存成功后清回 `0`。

## 来源

- 完成态 UX：`02-ux/case2/case2整体效果图.png`
- 左侧拆图：`02-ux/case2/左侧/左侧界面整体.png`
- 右侧拆图：`02-ux/case2/右侧/右侧整体效果.png`
- 范围与状态权属：`doc/PHASE0-SCOPE.md`
