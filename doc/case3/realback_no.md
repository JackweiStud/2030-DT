# case3 模拟后端打桩规格（非真实后端）

> status: `IMPLEMENTED_LOCAL_STUB_AWAITING_E2E`
>
> 使用者：Case3 本地模拟后端实现 agent。
>
> 本进程只在没有真实后端时扮演共享目录另一端：监听 `case_control.json`、写业务 status、逐点 append Case3 多 txt，并按窗口请求截图。它不是 Node REST 适配服务，不得并入 `code/server npm start`。

## 0. 出口条件

- [x] 独立实现于 `code/back/case3/`，与 Case2 stub 可分别启动/停止/测试。
- [x] 只识别 `case3 + start|reinit + 合法 dt_type + status=""` 新轮元组；不依赖 command 变化或 mtime。
- [x] 观察到 init、其他 Case 或新命令时，旧任务立即失去写入权。
- [x] `execute success` 保持至少 3000ms；失败路径不再写完成终态。
- [x] Start 逐点 append 目标侧全部必需文件，完整关闭和停止写入后最后写 complete。
- [x] 默认同拍写 `case complete + save_picture_flag=1`；ReInit 不置截图 flag。
- [x] 控制写只 patch stub 自有字段，保留 command、`dt_type` 和未知字段，使用原子替换。
- [x] 控制文件缺失/短暂半写时等待恢复，不自行创建；进程启动遇到在途 success 时按本文恢复表处理。
- [x] Start 恢复固定清空目标侧并从第 1 点重放，不续写未知半轮；撤权允许留下不齐尾部但不回滚。
- [x] 数据明确标为 synthetic/reference-derived，不得声称真实采集。
- [x] `npm test` 通过；Ctrl+C 停止后不再写共享目录。

## 1. 目录

```text
code/back/
├── package.json                    # 增加 Case3 scripts；现有 Case2 scripts 保留
└── case3/
    ├── package.json
    ├── case3-stub.mjs
    ├── README.md
    ├── scripts/run.mjs
    ├── fixtures/
    │   ├── ue_comm_coordinates_base.txt
    │   ├── ue_comm_with_dt_beam_accuracy_rate.txt
    │   ├── ue_comm_without_dt_coordinates.txt
    │   ├── ue_comm_without_dt_beams.txt
    │   ├── ue_comm_without_dt_sel_beam.txt
    │   ├── ue_comm_without_dt_thrp.txt
    │   ├── ue_comm_with_dt_coordinates.txt
    │   ├── ue_comm_with_dt_sel_beam.txt
    │   ├── ue_comm_with_dt_thrp.txt
    │   ├── ue_comm_with_dt_coordinates_reflection_point.txt
    ├── src/kpi-generator.mjs
    └── test/case3-stub.test.mjs
```

实现期可以从 `01-参考资料/case3/data/c3/` 一次性复制并校验 base route、BA baseline 和两侧逐点样本到 stub 自有 fixtures；运行时禁止回读 `01-参考资料/`。Fixtures 同时承担 `replay` 的完整回放源和 `random` 的结构/KPI 模板。

Cost 不属于 stub fixtures。`ue_comm_without_dt_cost.txt` 与
`ue_comm_with_dt_cost.txt` 必须由部署/演示准备流程预置在共享目录；Node 与本地
stub 均不得创建、清空、截断或更新。Node/Web 仍读取并校验静态侧级 Cost。

## 2. 配置与命令

### 2.1 环境变量

| 变量 | 默认值 | 规则 |
|---|---:|---|
| `DT_SHARED_DIR` | `code/comdatafiles`（仅 run wrapper） | 写在 `code/back/.env`；正式入口必须为绝对目录。 |
| `CASE3_STUB_POLL_MS` | `200` | 监听控制文件；正整数。 |
| `CASE3_STUB_SUCCESS_DWELL_MS` | `3000` | 正式环境不得低于 3000。 |
| `CASE3_STUB_POINT_MS` | `1000` | 每点 append 间隔；正整数。 |
| `CASE3_STUB_OUTCOME` | `success` | `success` / `fail`。 |
| `CASE3_STUB_REQUEST_PICTURE` | `1` | `1`：Start 终态同拍 flag=1；`0`：只 complete。 |
| `CASE3_STUB_SEED_INIT` | `1` | 仅在缺失时向 shared/case3 写 base/baseline；仅本地 stub。 |
| `CASE3_STUB_DATA_MODE` | `random` | `random`：只生成 Throughput；`replay`：回放逐点 fixture。 |
| `CASE3_STUB_SEED` | 空 | 仅 random；空值每次 Start 使用新的 operationId，非空值按 `seed+side` 可复现。 |
| `CASE3_STUB_THROUGHPUT_JITTER` | `0.10` | 仅 random；fixture Throughput 的双向相对抖动，0～1。 |
| `CASE3_STUB_LOG_LEVEL` | `info` | `info` / `debug`。 |

正式环境变量严格校验：共享根必须为绝对路径；poll/point/dwell 必须为十进制整数且 poll/point 为正、dwell 不低于 3000；outcome/dataMode/log level 必须命中枚举，requestPicture/seedInit 只能为 0/1，Throughput jitter 必须为 0～1。非法配置快速退出并记录 `CONFIG_INVALID`，禁止 clamp。测试通过构造函数依赖注入更小 dwell/point，不通过正式环境变量绕过约束。

默认结构 fixture 每侧 21 点；Throughput 文件独立计数并可多于或少于结构点。发布时按较长的一路推进，运行耗时约 `max(结构点数, 吞吐样点数) × 1000ms + 3000ms dwell`，另加少量文件 I/O。Web 500ms 轮询时通常约两拍看到 1 个新结构点或吞吐样点。配置测试必须锁定正式默认 `point=1000ms,dwell=3000ms,poll=200ms`。

### 2.2 命令

在 `code/back` 根目录：

| 命令 | 用途 |
|---|---|
| `npm run start:case2` | 启动 Case2 本地 stub。 |
| `npm run start:case3` | 启动 Case3 本地 stub。 |
| `npm test` | 串行运行 Case2 + Case3 stub 测试，避免并发共享测试目录。 |

子包仅保留 `start` / `test`；调试日志与关闭截图用环境变量（如 `CASE3_STUB_LOG_LEVEL=debug`、`CASE3_STUB_REQUEST_PICTURE=0`），不再提供 `dev*` / `*:no-picture` npm 脚本。Case2 与 Case3 stub **分开启停**，不得并行抢同一控制文件。

## 3. 控制文件所有权

### 3.1 可写字段

stub 只允许 patch：

- `status`：`execute success`、`execute fail`、`case complete`、`reinit complete`
- `save_picture_flag=1`

禁止写：

- `case`、`command`、`dt_type`
- `status=""`
- `save_picture_flag=0`
- 未知字段

每次 patch：

1. 进入 stub 内同一串行队列。
2. 读取最新完整控制。
3. 校验当前任务仍拥有写入权。
4. 合并自有 patch。
5. 临时文件写、fsync、close、原子 rename。
6. 回读确认 patch，未修改字段无丢失。

### 3.2 控制读取与唤醒

- `fs.watch` 只负责低延迟唤醒，`CASE3_STUB_POLL_MS` 轮询始终作为兜底；mtime 或事件本身不代表新命令。
- 每次唤醒后重新读取并校验完整控制快照，再按 §3.3 分类。
- 控制文件不存在时不创建、不退出；记录一次等待日志，继续轮询。
- JSON/UTF-8 短暂不可读时最多重试 3 次、间隔 50ms；仍失败、shape 非法或其他 I/O 故障时本拍不动作，按错误类型限频记录，等待下一次唤醒。
- 只有配置非法、fixtures 预检失败或 seed 目标已存在但非法时才快速退出；运行期控制文件暂不可读不得杀死 stub。

### 3.3 新轮识别

合法 Start：

```text
case=case3
command=start
dt_type=without dt | with dt
status=""
```

合法 ReInit 同上但 command 为 reinit。

`status=""` 是每次新轮门沿；因此同一 command 在 `execute fail` 后重试也可被识别。不以 command 是否变化、文件 mtime 或固定延时猜新轮。

watcher 在启动异步任务前先登记唯一 active task 和内存 `operationId`；`operationId` 只用于日志关联，不写共享文件、不作为恢复身份或 command_id。active task 未释放时，同一空 status 快照不得重复接单。

active task 在撤权或终态（`execute fail` / `case complete` / `reinit complete`）后释放，并立即重读一次当前快照，再等待下一次合法空 status。

### 3.4 写入权撤销

每次 sleep、每个逐点文件 append 和 status patch 前都重读控制；以下任一条件成立，当前任务 abort：

- `command=init`
- `case` 不再是 case3
- command/dt_type 与接单元组不同
- 出现新的 `status=""` 命令元组
- 进程收到 SIGINT/SIGTERM

撤销可能发生在同一点的多个文件 append 之间，允许留下跨文件不齐的物理行尾。Stub 不回滚、不补齐、不实现跨文件事务；Node 只返回完整前缀，下一轮 Start/ReInit 由 Node 清空目标侧逐点文件、保留 Cost。撤销后不再写数据、status 或 flag，并立即重新求值当前控制。

## 4. 初始化文件

`CASE3_STUB_SEED_INIT=1` 时：

- 创建 `{DT_SHARED_DIR}/case3/`；
- seed 只处理 `ue_comm_coordinates_base.txt` 与 `ue_comm_with_dt_beam_accuracy_rate.txt` 两个初始化文件，不复制或改写逐点文件或 Cost；
- 文件缺失时用 stub fixtures 原子创建；
- 文件已存在且合法时保留，日志记录 `seedAction:"skippedExisting"`；
- 文件已存在但内容非法时以 `SEED_TARGET_INVALID` 快速退出，禁止静默覆盖；
- seed 启动日志标记 `dataSource:"reference-derived"`（seed 只写 base/baseline）。

该动作仅用于本地无真实后端环境。真实挂载联调必须关闭 seed，使用真实后端提供的初始化文件。Cost 文件须由共享目录预置，seed 和 Start 均不处理 Cost。

## 5. Start 行为

### 5.1 接单与失败

接单先记录：

- 内存 `operationId`；
- command、dt_type
- `recovery:false`
- Start 的 `requestPicture`
- outcome、dataMode
- random 的 `resolvedSeed`（固定 seed 时按侧可复现；空 seed 使用 operationId）

ReInit 日志省略 `requestPicture`，避免把截图配置误解为 ReInit 业务字段。

若 `CASE3_STUB_OUTCOME=fail`：

1. 确认仍拥有写入权。
2. 原子 patch `status="execute fail"`。
3. 不写点文件、不写 complete/reinit complete、不置 flag。

### 5.2 成功窗口

成功路径：

1. patch `status="execute success"`。
2. 等待 `CASE3_STUB_SUCCESS_DWELL_MS`，期间持续检查写入权。
3. dwell 未满前不得写 complete 或覆盖 success。
4. 开始目标侧逐点 append。

### 5.3 逐点 append

每次 Start 先在内存中一次性构造本轮不可变数据集，之后才逐点 append；禁止每次轮询或每次文件写入时重新随机。`replay` 完整使用逐点 fixture，`random` 只替换 Throughput：

- UE coordinates、Without scans、两侧 selected Beam、With Reflection 始终使用 fixture；
- Throughput 以同侧 fixture 曲线为模板做 ±10% 有 seed 抖动，保留两位小数；
- With 每点仍限制在自身 ±10% 内，同时高于对应 Without fixture 在 +10% 时的理论上限至少 0.01 Gbps；fixture 无法满足时以 `KPI_GENERATION_INVALID` 失败；
- Beam Accuracy 不单独随机，继续由预置 selected Beam 的匹配结果派生。

Without 每点按同一索引写：

1. coordinates
2. beams（≥1 个 id；本地 fixture 仍写 16 列）
3. selected beam
4. throughput

With 每点按同一索引写：

1. coordinates
2. selected beam
3. throughput
4. reflection `x,y,z,flag`

每个点：

- 每个目标文件 append 前分别按 §3.4 复验写入权；
- 写入各目标文件的完整一行；
- 使用单次 append，不故意拆半行；
- 每次 append 后必须立即对读者可见：对该 fd `flush`/`fsync`，或采用 open-append-close 一行；禁止长时间持有未刷盘缓冲导致运行中点位成批出现；
- 文件内容符合 Gate 2 精度/范围；
- 等待 `CASE3_STUB_POINT_MS`；
- 写下一点前再次检查控制仍属于当前任务。

Cost 是共享目录预置的静态侧级输入，与逐点数据发布解耦。stub 对其不做读取、校验、创建或写入；Start/ReInit 及恢复均不得改变文件内容。Node 仍在 REST 快照中读取、校验并提供 Cost，最终快照门槛保持不变。

MSE 不属于当前契约和 UI；stub 不需要生成。

### 5.4 完成发布与截图

全部目标侧逐点文件：

- 已写完；
- 文件句柄已关闭；
- 不再 append；
- 当前控制仍属于同一 Start/side。

然后：

- `CASE3_STUB_REQUEST_PICTURE=1`：一次原子 patch

```json
{
  "status": "case complete",
  "save_picture_flag": 1
}
```

- 为 0：只 patch `status="case complete"`。

禁止先 complete 后补 flag。complete 后本任务不得再修改该侧文件。

## 6. ReInit 行为

Node 在写 ReInit 控制前已经清空目标侧文件。stub 只模拟业务确认：

1. patch `execute success`。
2. 保持至少 3000ms。
3. 确认写入权仍有效。
4. patch `reinit complete`。

ReInit：

- 不写任何业务数据；
- 不置 `save_picture_flag=1`；
- fail outcome 只写 execute fail。

## 7. 进程启动与恢复

恢复分类只在进程启动时执行一次；运行中 publish 失败不得被下一次 poll 自动当成恢复，否则会形成重复清空/重放循环。

| 启动时控制快照 | 动作 |
|---|---|
| 控制文件缺失/暂不可读 | 按 §3.2 等待，不创建控制文件。 |
| `command=init,status=""` | 空闲，不动作。 |
| 合法 Case3 Start/ReInit 元组且 `status=""` | 尚未接单，按新命令执行。 |
| 精确 `case3 + start + dt_type + execute success` | 新建日志 `operationId,recovery:true`；清空该侧逐点文件（Cost 不触碰），从第 1 点完整重放；禁止从现有 `K+1` 续写。replay 原样回放 fixture；random 重新构造本轮 KPI，固定 seed 可复现，空 seed 在进程重启后允许变化。全部关闭后按当前截图配置写 complete；若控制中 flag 已为 1，最终写必须保留高电平。 |
| 精确 `case3 + reinit + dt_type + execute success` 且 `save_picture_flag=0` | 新建日志 `operationId,recovery:true`；重新保持完整 3000ms，再写 `reinit complete`。 |
| 合法 Case3 元组的 `execute fail` / `case complete` / `reinit complete` | 本轮已终止，不动作。 |
| 非 Case3、非法 `dt_type`、启动恢复见到 `reinit + execute success + flag=1`、未知 status 或其他不合法元组 | 记录诊断，不猜测、不动作。 |

说明：`reinit + flag=1` 仅作为**启动恢复分类**的非法快照；活体新轮门沿仍只认 §3.3 的 `case/command/dt_type/status=""` 元组（正常路径 Node 开轮会写 `flag=0`）。

恢复 Start 时允许 truncate 目标侧逐点运行文件，但不得触碰 Cost；本进程只用于无真实后端的本地 stub，且 `case complete` 前文件仍属于未完成轮。禁止与真实后端同时运行。全量重放优先于续写，原因是没有持久 batch/command_id，且旧进程可能在同一点的多个 append 之间退出，现有行数不能证明可靠恢复位置。

恢复沿用当前进程 `CASE3_STUB_REQUEST_PICTURE` 和 dataMode；`CASE3_STUB_OUTCOME=fail` 不得把已经处于 `execute success` 的旧轮改写为 fail。random 若要求进程重启后逐值一致，必须配置固定 `CASE3_STUB_SEED`；默认空 seed 只保证结构和数值范围。恢复过程中仍按 §3.4 在每次清空、append、等待和终态 patch 前复验 ownership。

## 8. Fixture 预检

stub 启动时先验证 fixtures，失败则快速退出：

- Base route 非空，三坐标有限。
- BA baseline 两整数，`0<=success<=total,total>0`。
- Without coordinates/beams/selected 三个结构文件行数一致且大于 0。
- With coordinates/selected/reflection 三个结构文件行数一致且大于 0。
- 两侧 Throughput 文件独立校验；样点数允许为 0，也允许互不相同，吞吐不进入结构点完整性门槛。
- scan 每行至少 1 个 0～255 整数，并包含**同索引行**的 selected；允许重复，不要求 16 列。stub 自带 fixture 仍写 16 个互不重复 id（演示数据质量，不是 Node / 真实后端合同）。
- selected 0～255；Throughput 非负；Reflection flag 0/1。
- 允许首尾空行、CRLF 和无换行完整末行；数据中间空行仍非法。

fixture 预检可以复用 stub 内纯解析函数，但不得 import Node 适配服务的生产解析器，否则测试会失去独立性。

seed=1 时还要按初始化接口语义校验共享目录中已存在的 base/baseline；非法时不得覆盖。

## 9. 日志

每条结构化日志至少包含：

- `caseId:"case3"`
- `operationId`、`recovery`（任务日志适用时）
- command、side
- event：accepted / success / point / complete / fail / revoked
- point index/total（适用时）
- requestPicture（仅 Start）
- reason/error code

逐点 info 可降为 debug，避免高频噪音。控制状态边沿必须 info；控制文件缺失/不可读的重复日志必须限频，恢复后记录一次 recovered。

## 10. 测试计划

### 10.1 配置、控制读取与唤醒

- 正式默认断言：poll=200ms、point=1000ms、dwell=3000ms、requestPicture=1、seedInit=1、dataMode=random、Throughput jitter=0.10。
- 正式环境 dwell<3000、非正 poll/point、非法 outcome/dataMode/flag/log level、越界 Throughput jitter 均 `CONFIG_INVALID`，不 clamp；测试构造注入可使用更短间隔。
- 控制文件启动时不存在：进程保持运行，文件随后创建后可接单。
- JSON/UTF-8 短暂不可读最多 3 次/50ms；持续非法只记限频诊断，不接单、不退出。
- `fs.watch` 事件与纯轮询都只唤醒；重复事件不重复接单，watch 不可用时轮询仍可完成主线。

### 10.2 控制原语

- 只允许 owned patch，拒绝空 status、flag0 和其他字段。
- patch 保留未知字段，串行并发无丢失。
- 临时文件原子替换与失败清理。
- 相同 command fail 后新 `status=""` 可再次接单。
- execute fail / case complete / reinit complete 和撤权都会释放 active task，并立即重读最新控制。

### 10.3 Start

- Without/With 只写目标侧，逐点文件对齐。
- random 固定 seed 可复现，不同 seed 产生不同 KPI；坐标、Beam、Reflection 与 fixture 逐行一致。
- random Throughput 不越过冻结抖动范围并保留 2 位小数；replay 逐行保持 fixture。
- Start、ReInit、恢复重放不得更改两侧预置 Cost 文件，逐字节校验内容不变。
- success 实际保持配置 dwell，complete 不提前。
- complete 前文件关闭；complete 后无写入。
- 默认最终同拍 complete+flag1；no-picture 只 complete。
- fail 不写数据/完成/flag。
- 每个逐点文件 append 前均检查 ownership；同一点中途撤权允许留下不齐尾部，但不再继续写、不做回滚。

### 10.4 ReInit、撤权与启动恢复

- ReInit success→dwell→reinit complete，永不截图。
- init、其他 Case、新命令在 dwell/逐点中途撤销旧写入权。
- SIGINT/SIGTERM 停止所有后续写。
- 撤销后的旧任务不能覆盖新命令 status。
- 覆盖 §7 恢复表全部分支；Start recovery 清空目标侧并从第 1 点重放，不从 K+1 续写。
- ReInit recovery 重新保持完整 3000ms；恢复 success 不受当前 fail outcome 反向覆盖。
- 恢复只在 startup 分类一次；运行中 publish 错误不会被 poll 无限恢复。

### 10.5 Seed 与 Fixture

- 全部有效 fixture 通过。
- 行数不同、scan 数量/同索引包含关系、beam 范围、负 Throughput/flag 分别失败；scan 同行重复仅作为 stub fixture 质量失败，不声称契约也会拒绝。
- seed 只创建缺失 base/baseline；已存在合法文件保留，非法文件快速失败；逐点文件与预置 Cost 永不被 seed 改写。
- 每个逐点 append 后内容对读者立即可见；持有未刷盘缓冲导致点位成批出现视为失败。

## 11. 联调

本地推荐三个终端：

```text
1. code/server  -> npm start
2. code/back    -> npm run start:case3
3. code/web     -> npm run dev
```

一键 E2E 使用临时共享目录：

```text
code/scripts/e2e-case3-stack.sh
```

脚本负责：

- 创建 temp shared root；
- 写最小 control；
- 启动 Case3 stub、Node、Web；
- 等待探活；
- 运行 Case3 Playwright；
- 无论成功失败都清理子进程；
- 不写 `code/comdatafiles/` tracked 样本。

## 12. 明确不做

- 不提供 REST。
- 不与真实后端同时运行。
- 不把 synthetic/reference fixture 表述为真实采集。
- 不写 JSONL 调试输出；它属于 Node。
- 不引入 manifest、batch_id、command_id、数据库、队列或取消命令。
- 不写 `out/case2/`，不生成 PNG；截图 PNG 由 Node 保存。
- 不把 stub 自动并入适配服务启动命令。
- 不引入持久 task token、断点续写或跨文件事务；启动恢复采用清空后全量重放。

## 13. Gate 3 已批准的 stub 决策

- [x] 用户于 2026-08-10 批准默认逐点间隔 1000ms、success dwell 3000ms（同日由 500ms 改为 1000ms）。
- [x] 用户于 2026-08-10 批准默认每次 Start 请求截图，no-picture 作为可选旁路。
- [x] 历史决策（2026-08-10 至 2026-08-11）：曾批准 stub 生成/逐点发布 Cost；该规则已由 2026-09-22 静态共享文件约定取代，不再适用于当前实现。
