# case2 演示主线：DT Calibration

## 演示承诺

让内部团队看到：在同一场景下，Initial DT 经 `with dt` 校准后，RSS 误差、有效路径数误差和首径时延误差的空间分布与统计分布均得到改善。

## 前提与输入

- 当前 Tab：`DT Calibration`。
- Initial 数据：三项 Initial 热力图和 KPI 样本。
- 控制请求：前端侧适配服务写入 `case=case2`、`command=start`、`dt_type=with dt`。
- 结果门槛：后端 `status=case complete`，且当批结果已完整发布。

## 主线状态

| 状态 | 用户动作/外部条件 | 左侧 | 右侧 | 控件 |
|---|---|---|---|---|
| Initial | `command=init`，`status=""` | 仅 Initial DT 三项热力图；Calibrated 为空态 | 基线可见；Calibrated 对比为空态/说明态 | 启动可用，重置禁用或无效 |
| 校准中 | 点击启动后，尚未完成 | 保留 Initial；Calibrated 显示校准中 | 不展示旧 CDF/均值，显示进行中反馈 | 启动禁用，重置可用 |
| 命令已执行 | `status=execute success` | 仍不显示结果 | 仍为进行中 | 同上 |
| 完成 | `status=case complete` 且结果完整 | Initial/Calibrated 三行配对热力图 | 每项显示两条 CDF 与平均误差对比 | 启动禁用或要求先重置；重置可用 |
| 失败 | `status=execute fail` | 保留 Initial；Calibrated 不显示旧结果 | 失败说明与重试提示 | 启动可重试，重置可用 |
| 重置 | 点击重置，写 `reinit` | 清空本地 Calibrated 显示，回 Initial | 清空对比结果，回初始说明 | 等待后端恢复初始语义 |

## 结论与禁止口径

- 结论只能表述为：在当前批次数据中，Calibrated DT 的误差分布左移且平均误差下降。
- 不得将现有参考文件称为本次真实采集结果。
- 不得将 `execute success` 或 Calibrated 文件存在本身称为“校准完成”。
- 截图只在 `save_picture_flag` 由 `0` 变为 `1` 时请求；适配服务保存成功后将其清回 `0`。

## 来源

- 完成态 UX：`02-ux/case2/case2整体效果图.png`
- 左侧拆图：`02-ux/case2/左侧/左侧界面整体.png`
- 右侧拆图：`02-ux/case2/右侧/右侧整体效果.png`
- 范围与状态权属：`doc/PHASE0-SCOPE.md`
