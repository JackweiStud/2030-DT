# case3 前后端共享文件接口交接

本文只描述真实后端需要实现的控制文件、多 txt 输入输出和时序。后端无需提供 REST，也无需了解浏览器页面实现。

## 0. 接口总表

| 接口对象 | 方向 | 触发/更新时机 | 关键内容 | 用途 |
|---|---|---|---|---|
| `case_control.json` 命令字段 | 前端侧 Node → 后端 | init/start/reinit | `case`、`command`、`dt_type`、`status=""` | 发起或结束一轮控制。 |
| `case_control.json.status` | 后端 → 前端侧 Node | 接单、失败、完成 | `execute success`、`execute fail`、`case complete`、`reinit complete` | 唯一业务状态。 |
| Without 四个逐点 txt | 后端 → 共享目录 | Without Start 后逐点 append | coordinates、16 beams、selected beam、throughput | Without 完整点。 |
| Without Cost txt | 后端 → 共享目录 | Without 运行中/完成前 | 最新一行百分比 | Without 开销。 |
| With 四个逐点 txt | 后端 → 共享目录 | With Start 后逐点 append | coordinates、selected beam、throughput、reflection | With 完整点。 |
| With Cost txt | 后端 → 共享目录 | With 运行中/完成前 | 最新一行百分比 | With 开销。 |
| Base route / BA baseline | 后端提供的初始化文件 | 页面初始化读取 | 路线坐标、`success,total` | 初始地图路线和准确率基线。 |
| `save_picture_flag` | 后端 → 前端侧 Node | Start 的 success→complete 窗口 | `0→1`，允许与 complete 同拍 | 请求保存当前 Case3 页面截图。 |

主线时序：

```text
前端侧 Node 写 start/reinit + dt_type + status=""
  -> 后端停止旧 Case/旧侧写入
  -> 后端写 execute success，并保持至少 3000ms
  -> Start: append 当前侧多 txt
  -> Start: 完整写完并关闭必需文件和 Cost
  -> Start: 停止本轮文件写入
  -> Start: 若请求截图，最后同拍写 case complete + save_picture_flag=1；否则只写 case complete
  -> ReInit: 完成重置，写 reinit complete

前端侧 Node 写 init
  -> 后端停止旧 Case/旧侧继续写文件
  -> 不启动新测试或新重置
```

## 1. 控制文件

### 1.1 核心结构

```json
{
  "case": "case3",
  "command": "init",
  "dt_type": "",
  "status": "",
  "save_picture_flag": 0
}
```

| 字段 | 允许值 | 写入方 | 说明 |
|---|---|---|---|
| `case` | `case3` | 前端侧 Node | case3 命令固定写 case3。 |
| `command` | `init` / `start` / `reinit` | 前端侧 Node | init 为空闲/撤销旧轮写入权。 |
| `dt_type` | `""` / `without dt` / `with dt` | 前端侧 Node | start/reinit 指明目标侧。 |
| `status` | `""` / `execute success` / `execute fail` / `case complete` / `reinit complete` | 后端写业务字面值；前端侧 Node 仅在开轮/init 时清空 | 单值状态，按时间推进。 |
| `save_picture_flag` | `0` / `1` | 后端仅置 `1`；前端侧 Node 清 `0` | 仅 Case3 Start 的 success→complete 窗口请求截图；ReInit 不置 1。 |

`debug_flag`、`scene_type` 或其他未知字段存在时必须保留。

### 1.2 写入规则

后端每次更新 `status` 时必须：

1. 重新读取最新 `case_control.json`。
2. 确认 `case=case3` 且命令/侧别仍属于当前任务。
3. 只修改 `status`；若本轮请求截图，可在最终 complete 写中同时置 `save_picture_flag=1`。保留 command、dt_type 和未知字段。
4. 使用同目录临时文件、写盘、关闭、原子 rename。
5. 回读确认写入值。

如果最新控制已经变为 `command=init`、其他 Case 或新的 start/reinit，旧任务必须停止写状态和数据。

## 2. 命令行为

### 2.1 Init

`case=case3,command=init,dt_type="",status=""` 表示：

- 当前没有新的业务命令。
- 后端必须停止此前 Case/侧别的继续写入。
- 不需要写 success/complete。
- 不要求后端清文件；目标侧文件由前端侧 Node 在下一次 start/reinit 前清理。

### 2.2 Start

合法元组：

```text
case=case3
command=start
dt_type=without dt | with dt
status=""
```

后端处理：

1. 停止旧任务写入。
2. 接单成功后写 `execute success`，保持至少 3000ms。
3. 只向 dt_type 指定侧的文件 append 本轮数据。
4. 完整写完并关闭全部必需文件和 Cost。
5. 停止本轮文件写入。
6. 最后写 `case complete`；若本轮请求截图，必须在同一次原子控制写中合并 `save_picture_flag=1`。

若命令失败，写 `execute fail`，并且本轮不再写 `case complete` 或 `reinit complete`。

截图规则：

- 仅 Start 路径可在 `execute success` 之后至 `case complete` 时置 `save_picture_flag=1`。
- 推荐在最终控制写中同拍写 `status="case complete",save_picture_flag=1`。
- 禁止先写 `case complete` 再补写 flag；页面完成后会停止控制轮询。
- 前端侧 Node 在截图成功落盘或三次失败后放弃时清回 `0`；后端不得抢先清零。

### 2.3 ReInit

合法元组：

```text
case=case3
command=reinit
dt_type=without dt | with dt
status=""
```

后端处理：

1. 接单成功后写 `execute success`，保持至少 3000ms。
2. 完成指定侧的业务重置。
3. 写 `reinit complete`。

若失败，写 `execute fail`；用户会再次点击同侧 ReInit。

## 3. 初始化文件

| 文件 | 格式 | 约束 |
|---|---|---|
| `ue_comm_coordinates_base.txt` | 每行 `x,y,z` | 至少 1 行；坐标有限；超过 2 位小数由前端侧 Node 四舍五入。 |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | `success,total` | 整数；`0 <= success <= total` 且 `total > 0`。 |

末行没有 LF/CRLF 但字段完整可解析时视为有效。

前端侧 Node 在 Start/ReInit 时不会清空 base route 或 Beam Accuracy 基线文件。

## 4. Without DT 文件

| 文件 | 每行格式 | 点位对齐 |
|---|---|---|
| `ue_comm_without_dt_coordinates.txt` | `x,y,z` | 第 i 行属于第 i 点。 |
| `ue_comm_without_dt_beams.txt` | 16 个逗号分隔 beam id | 第 i 行属于第 i 点。 |
| `ue_comm_without_dt_sel_beam.txt` | 一个 beam id | 第 i 行属于第 i 点。 |
| `ue_comm_without_dt_thrp.txt` | 一个 Throughput 数值 | 第 i 行属于第 i 点。 |
| `ue_comm_without_dt_cost.txt` | 一个或多个 Cost 数值 | 与点数解耦，取最新非空行。 |

第 i 个完整点必须同时存在前四个文件的第 i 行。

## 5. With DT 文件

| 文件 | 每行格式 | 点位对齐 |
|---|---|---|
| `ue_comm_with_dt_coordinates.txt` | `x,y,z` | 第 i 行属于第 i 点。 |
| `ue_comm_with_dt_sel_beam.txt` | 一个 beam id | 第 i 行属于第 i 点。 |
| `ue_comm_with_dt_thrp.txt` | 一个 Throughput 数值 | 第 i 行属于第 i 点。 |
| `ue_comm_with_dt_coordinates_reflection_point.txt` | `x,y,z,flag` | 第 i 行属于第 i 点，必需。 |
| `ue_comm_with_dt_cost.txt` | 一个或多个 Cost 数值 | 与点数解耦，取最新非空行。 |

第 i 个完整点必须同时存在前四个文件的第 i 行。`flag=1` 映射为 `los=true`（LOS），`flag=0` 映射为 `los=false`（NLOS）。

`ue_comm_without_dt_mse.txt`、`ue_comm_with_dt_mse.txt` 可以继续存在，但不进入页面数据、完整点或完成发布门槛。

## 6. 数值合同

| 数据 | 约束 |
|---|---|
| 坐标 / reflection 坐标 | 有限数；前端侧 Node 四舍五入到 2 位。 |
| Throughput | 有限且非负；前端侧 Node 四舍五入到 2 位。 |
| Cost | 有限数；前端侧 Node 四舍五入到 1 位；归一后必须在 `0～100`。 |
| beam id | 整数 `0～255`。 |
| Without beam 行 | 恰好 16 个互不重复的 beam id，selected beam 必须包含在这 16 项中。 |
| reflection flag | 只能为整数 `0` 或 `1`；`0→los=false`，`1→los=true`。 |

后端应尽量直接输出符合精度和范围的值；前端侧 Node 会执行最终校验和归一。

## 7. 完成发布门槛

写 `case complete` 前，后端必须确认：

- 当前控制仍属于同一 case3 start 和同一 dt_type。
- 所有目标侧逐点文件已经写完并关闭。
- 各逐点文件可以组成连续完整点 `1..N`，且 `N > 0`。
- Cost 文件至少有一个有效值。
- 后端已停止本轮文件写入。

`case complete` 后禁止继续 append、截断或重写本轮文件。

若前端最终读取时仍发现半点、空点、缺 Cost 或文件变化，页面不会进入完成态，也不会清控制终态。

## 8. 后端检查清单

- [ ] init 会停止旧 Case/旧侧继续写文件，但不启动新任务。
- [ ] start/reinit 只响应合法 case3 + dt_type + 空 status 元组。
- [ ] `execute success` 保持至少 3000ms。
- [ ] `execute fail` 后不再写其他完成终态。
- [ ] Start 只写命令目标侧文件。
- [ ] 所有必需文件和 Cost 完整关闭后，最后写 `case complete`。
- [ ] 请求截图时在 Start success→complete 窗口置 flag；同拍 complete 时合并为一次原子写；ReInit 不置 1。
- [ ] `case complete` 后不再修改本轮文件。
- [ ] status 更新保留控制文件未知字段。
- [ ] 数值、行数和 reflection flag 符合本文。
- [ ] 不要求浏览器或前端侧 Node读取 JSONL 作为后端输入。
