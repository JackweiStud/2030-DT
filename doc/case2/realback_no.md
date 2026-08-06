# case2 模拟后端打桩规格（非真实后端）

> **本文不是真实后端合同。** 真实后端团队只认 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md) 与 [API-CONTRACT.md](API-CONTRACT.md)。
>
> 本文描述：在**没有真实后端进程**时，如何用本地打桩进程扮演「共享目录另一端」——写 `status`、发布 Calibrated 六文件、按窗口置 `save_picture_flag`。
>
> 前端 PC 上的 **Node 文件适配服务**（Chrome 唯一文件 I/O）见 [SERVER-SPEC.md](SERVER-SPEC.md)。打桩与适配服务**职责分离**：打桩不提供 `/api/case2/*`；适配服务不实现校准算法或业务 `status` 推进。

## 0. 边界

| 做 | 不做 |
|---|---|
| 轮询/监视 `{DT_SHARED_DIR}/case_control.json` 上由适配服务写入的 `start` / `reinit` | 实现 REST、给浏览器直接调用 |
| 按契约链路写业务 `status` 与 Calibrated 文件 | 替代 [SERVER-SPEC.md](SERVER-SPEC.md) 的控制写、截图落盘、清零 |
| 本地联调 / Gate 4 无真实后端时的演示 | 把延时、参考样本、打桩目录写成真实后端要求 |
| 与适配服务**共用同一** `DT_SHARED_DIR`（flat 目录） | 引入 `CASE2_DATA_MODE` / stub 指针目录 / manifest |

建议实现位置（Gate 4 可选）：`code/back/` 或独立脚本进程；**不得**塞进适配服务的正式 `npm start` 默认路径。

## 1. 环境变量（仅打桩）


| 变量 | 默认值 | 要求 |
|---|---|---|
| `DT_SHARED_DIR` | 无 | 必填；与适配服务指向同一共享根。 |
| `CASE2_STUB_STEP_MS` | `5000` | `execute success` 写出后至少保持该时长再写终态，保证 Web 1000ms 轮询能看见中间态。 |
| `CASE2_STUB_OUTCOME` | `success` | 仅 `success` / `fail`；不得出现在正式 Web UI。 |
| `CASE2_STUB_REQUEST_PICTURE` | `1` | 演示默认开截图请求。`1`：start 终态同拍 `case complete + save_picture_flag=1`；`0`：只写 `case complete`。reinit 永不置 flag。 |
| `CASE2_STUB_DATA_MODE` | `random` | `random`：相对共享目录 Initial 可控改善生成 Calibrated（演示默认）；`copy`：从 `CASE2_STUB_SOURCE_DIR` 复制参考样本。 |
| `CASE2_STUB_SOURCE_DIR` | `code/back/case2/back`（相对打桩包目录的绝对解析） | 仅 `copy`；参考样本根目录。未设置时默认 `path.resolve(__dirname, "back")`。 |
| `CASE2_STUB_SEED` | 空 | 仅 `random`；空则每轮新 seed；非空可复现同一套 synthetic 结果。 |
| `CASE2_STUB_IMPROVE_MIN` / `MAX` | `0.45` / `0.65` | 仅 `random`；Calibrated ≈ Initial × ratio + noise，ratio 抽自该区间。 |
| `CASE2_STUB_NOISE` | `0.05` | 仅 `random`；相对噪声幅度。 |
| `CASE2_STUB_POLL_MS` | `1000` | 控制文件轮询唤醒间隔（`fs.watch` 不可用时仍工作）。 |
| `CASE2_STUB_LOG_LEVEL` | `info` | `info` / `debug`；控制写成功默认 INFO。 |


## 2. 运行方式

| 命令（示例名，实现自定） | 用途 |
|---|---|
| 单独启动打桩进程（`code/back/case2`：`npm start`） | 只模拟后端；假定适配服务已在跑且共享目录就绪。**演示默认开截图**（`CASE2_STUB_REQUEST_PICTURE=1`）。 |
| 关闭截图的打桩（`npm run start:no-picture` 或 `CASE2_STUB_REQUEST_PICTURE=0`） | 只推进 status / 发布六文件，不置 flag。 |
| 与适配服务一并拉起（如历史名 `dev:stub`） | 可选编排：先准备沙箱共享根，再同时起适配服务 + 打桩；`SIGINT`/`SIGTERM` 时子进程一并退出。 |

默认 **`npm start`（适配服务）不得启动打桩**。

## 3. 行为规格

打桩只模拟共享文件另一端，**不提供额外 REST**：

1. **与适配服务的分工**
   - 适配服务 POST `start`/`reinit`：合并命令字段并强制 `status=""`（开一轮清盘）；请求体仍禁止带 `status`。
   - 打桩进程：使用下述**仅 stub 可调**的控制写入器写 `execute success` / `execute fail` / `case complete` / `reinit complete` 和 `save_picture_flag=1`；另负责发布六文件。该能力与适配服务 HTTP 路由隔离。

2. **打桩控制文件写入原语**
   - 所有打桩控制写必须进入打桩进程内同一串行队列，并复用唯一 `patchControl(stubPatch)`；不得在状态分支中直接 `writeFile(case_control.json)`。
   - `stubPatch` 只允许：
     - `status="execute success" | "execute fail" | "case complete" | "reinit complete"`；
     - `save_picture_flag=1`。
   - 打桩不得写 `case`、`command`、`dt_type`、`status=""` 或 `save_picture_flag=0`。
   - 每次写入先读取并校验最新完整 JSON，只把 `stubPatch` 合并进最新快照；必须原值保留 `case`、`command`、`dt_type`、`debug_flag`、`scene_type`、当前未修改的 flag 以及所有未来未知字段。
   - 将完整合并结果写入 `case_control.json` 同目录、包含 PID + 随机 nonce 的临时文件；写入后 `fsync`、关闭，再以同目录原子 `rename` 替换正式文件。临时文件尽量继承原控制文件权限。
   - rename 后重新读取验证：本次 patch 已生效，当前任务 command 未丢失，未知字段仍存在；失败则记录诊断并不得继续写业务终态。
   - 该原语解决单个打桩进程内串行、半写 JSON 和无竞争时的字段保留，不宣称解决适配服务与打桩同时整文件写入的最后写者覆盖；并发字段保留仍按 Gate 4 验证与回退条件处理。

3. **触发**
   - `fs.watch`、轮询、mtime 变化都只负责**唤醒**；每次唤醒后重新读取并校验完整控制快照，不把事件本身当作命令身份。
   - 启动的新轮门沿：`case="case2",command="start",dt_type="with dt",status=""`。
   - 重置的新轮门沿：`command="reinit",status=""`。
   - 上述合法命令元组 + 空 status 是**唯一**新命令门沿；不得只看 command 是否变化。失败后再次启动/重置时 command 可以不变，适配服务再次清空 status 即形成新轮。
   - 打桩内部只允许一个 active operation，不做命令队列。成功分支接单后立即写 `execute success`，失败分支立即写 `execute fail`，用非空 status 关闭门沿；不得因为自己后续写 status 引发的文件事件重复触发。active operation 完成或因陈旧保护放弃后，必须立即重新读取一次当前快照，避免只用 `fs.watch` 时漏掉执行期间已到达且仍为 status 空的最新命令。

4. **`start` + `CASE2_STUB_OUTCOME=success`**
   1. 通过 `patchControl` 写 `status=execute success`；
   2. 等待 `CASE2_STUB_STEP_MS`（默认 **5000ms**）；
   3. 向 `{DT_SHARED_DIR}/case2/` 发布六个 `heatmap_cali_*.txt`：每个文件先写同目录临时文件，`fsync`、关闭并 rename 为最终文件。默认 `CASE2_STUB_DATA_MODE=random`：读取同目录 Initial 六文件，按可控 improve ratio 生成 synthetic Calibrated（形状继承 Initial，范围遵守热力 `[-200,200]` / KPI `[0,500]`，2 位小数）；`copy` 模式才从参考目录拷贝样本。日志必须标注 stub/synthetic，不得表述为真实业务采集；
   4. 确认六个最终文件全部存在、可 stat，且所有句柄已关闭；
   5. 按陈旧任务保护重新确认当前仍为 `command=start,status="execute success"`；
   6. **最后一次控制写**：
      - 本轮不请求截图：`patchControl({status:"case complete"})`；
      - 本轮请求截图：一次 `patchControl({status:"case complete",save_picture_flag:1})`，把 complete 与 flag 合并为同一个原子控制快照。

只有六个最终文件全部完成后才能写 `case complete`。打桩不采用“flag 与 complete 分两拍”的可选分支，固定使用上述同拍合并写，减少一次控制文件竞争窗口并保证 Web 同拍先截图再完成。

5. **`reinit` + success**
   - 通过 `patchControl` 写 `execute success` → 等待 `CASE2_STUB_STEP_MS` → 通过 `patchControl` 写 `reinit complete`。
   - **不得**置 `save_picture_flag=1`（重置路径无截图诉求）。

6. **`CASE2_STUB_OUTCOME=fail`**
   - 收到 `start` 或 `reinit` 后只通过 `patchControl` 写 `execute fail`；本轮绝不再写完成终态。

7. **不做**
   - 不把 `command` 自动改回 `init`；
   - 不把 `status` 自动改回 `""`（清盘只发生在 Web 下一轮 `start`/`reinit` 经适配服务写入时）；
   - 不引入 stub 专用指针目录或第二套数据模式；与真实后端一样用 flat `case2/`。

8. **数据诚实性**
   - 打桩数据来源可复制参考样本，但日志和 UI 必须标注为参考/打桩数据，不得宣称为本轮真实采集结果。

9. **截图失败清盘提醒**
   - Web 对同一 0→1 最多尝试 3 次；累计失败后可经适配服务清零并接受丢失本张截图。打桩不得仅凭 flag 回到 `0` 断言一定生成了 PNG；需验证截图时应直接检查 `out/case2/calibrated-*.png`。

10. **陈旧任务保护**
   - 成功任务等待结束、准备写 `case complete` / `reinit complete` 前，必须重新读取控制快照并确认 `command` 仍等于本任务命令且 `status="execute success"`。
   - 若 status 已被新一轮清为 `""`、command 已改变或出现其它值，旧任务立即放弃，不得写过期终态覆盖新状态。

11. **打桩进程重启恢复**

| 重启后控制快照 | 动作 |
|---|---|
| `command=init,status=""` | 空闲，不动作。 |
| 合法 `start` / `reinit` 元组且 `status=""` | 尚未接单，按新命令执行。 |
| `command=start,status="execute success"` | 恢复启动成功路径：完整重写并关闭六文件；按本轮截图配置，最后只写 `case complete`，或一次合并写 `case complete + flag=1`。 |
| `command=reinit,status="execute success"` | 恢复重置成功路径，最后写 `reinit complete`。 |
| `status="execute fail"` | 本轮已失败，不动作。 |
| `status="case complete"` / `"reinit complete"` | 本轮已完成，不动作。 |
| 未知 status 或不合法命令元组 | 记录诊断日志，不猜测、不动作。 |

启动恢复允许重写六个 Calibrated 文件，因为 Web 在 `case complete` 前不会读取；恢复时仍必须写完并关闭全部六文件后才写完成终态。

## 4. 与契约的对齐（只读提醒）

- 发布规则：六文件关闭后最后写 `case complete`（P0-1）；不要求真实后端提供 manifest / batch_id / 原子目录切换。
- 截图窗口：仅启动路径、`execute success` 之后至 `case complete`（允许同拍）置 flag；详见契约 §6。
- 真实后端是否在 1000ms 轮询下稳定露出 `execute success`，以 Gate 4 联调为准；打桩用 `CASE2_STUB_STEP_MS` 只服务本地演示。

## 5. 测试（打桩侧）

- 成功、失败、重置三条状态链。
- 打桩控制写入器：拒绝非 owned 字段和 `status=""` / `save_picture_flag=0`；只合并 patch，保留 command、未修改字段及未知字段；并发调用在进程内串行；临时文件 `fsync + close + rename` 后正式 JSON 完整可读。
- 断言 `case complete` 在六文件关闭之后。
- 断言六个 Calibrated 文件均通过同目录临时文件、`fsync + close + rename` 发布；缺任一最终文件时不得写 `case complete`。
- 断言请求截图时最终控制写是一次合并 patch `{status:"case complete",save_picture_flag:1}`，不存在 complete 后补 flag；不截图时只写 complete。
- 断言 `execute success` 至少保持 `CASE2_STUB_STEP_MS`。
- 断言 `reinit` 路径不置 `save_picture_flag`。
- 断言相同 `start` / `reinit` 在 `execute fail` 后由 status 再次清空可触发且只触发一轮。
- 断言打桩自己写 `execute success` / `execute fail` / 完成终态引发的文件事件不会重复接单。
- 断言旧任务写终态前若发现 command/status 已变化会放弃，不覆盖新轮。
- 断言旧任务放弃并释放 active operation 后会立即重读当前快照，接住执行期间到达且仍为 status 空的新轮。
- 覆盖重启恢复表全部分支；`start + execute success` 恢复时重写完整六文件后才写 `case complete`。
- 可选：最终同拍合并写 `case complete + flag=1` 时，配合 Web/适配服务验证截图落盘与清零。

## 6. 明确不做

- 不把本文任何延时、参考样本路径或编排命令写进 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md) 作为真实后端义务。
- 不实现真实校准算法或现场采集。
- 不用固定 sleep 冒充已联调通过的真实后端时序（联调时以后端实测为准）。
