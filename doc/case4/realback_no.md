# case4 模拟后端打桩规格（非真实后端）

> status: `已实现 — 2026-09-16 用户确认 2D 功能及本地自测完成，待真实后端联调`
>
> 使用者：Case4 本地模拟后端实现 agent。
>
> 本进程只在没有真实后端时扮演共享目录另一端：监听 `case_control.json`、写业务 status、按节拍 append 三路轨迹与两路吞吐、最后原子发布四份统计，并按窗口请求截图。它不是 Node REST 适配服务，不得并入 `code/server npm start`。
>
> case3-v2 **没有**独立打桩进程。应对齐现行 `code/back/case3/` 的控制原语、watch/poll、dwell、append 可见性、撤权和启动恢复；不要抄 case2「睡完再一次性倒文件」。不复制波束、Cost、双侧 `dt_type`。

开工前必读：`state.md`、[API-CONTRACT.md](API-CONTRACT.md) §2/§3/§8/§9/§12、本文、以及 `code/back/case3/` 的 `control-store.mjs`、`runner.mjs`、`publisher.mjs`、`config.mjs`。

实现及验收证据见 [QA-EVIDENCE.md](QA-EVIDENCE.md)。下列清单保留为施工核对项，本次文档收尾不将其批量勾选为独立复测通过。

## 0. 出口条件

- [ ] 独立实现于 `code/back/case4/`，与 Case2/Case3 stub 可分别启动/停止/测试；同一共享根上一次只跑一个 stub。
- [ ] 只识别 `case4 + start|reinit + dt_type="all" + status=""` 新轮元组；不依赖 command 变化或 mtime。`"with dt"` / `"without dt"` 对 case4 非法，只诊断不接单。
- [ ] 观察到 init、其他 Case 或新空 status 命令时，旧任务立即失去写入权。
- [ ] 先写 `execute success` 并保持至少 3000ms，**之后**才按步 append；失败路径不再写完成终态。
- [ ] Start 用双指针发布轨迹/吞吐；禁止按三轨迹最短行数截吞吐；禁止整文件覆盖发布实时数据。
- [ ] 计划三轨迹同长且 >0、九动态文件存在（空吞吐允许 0 行）、四份统计关闭后才写 complete。
- [ ] 默认同拍写 `case complete + save_picture_flag=1`；ReInit 不置截图 flag。
- [ ] 控制写只 patch stub 拥有字段，保留 command、`dt_type` 和未知字段，使用原子替换。
- [ ] 控制文件缺失/短暂半写时等待恢复，不自行创建；进程启动遇到在途 success 时按本文恢复表处理。
- [ ] Start 恢复固定清空九个动态文件并从第 1 行重放，不从 `K+1` 续写；撤权允许留下不齐尾部但不回滚。
- [ ] seed 只补缺失 base；共享 base 与 fixture 解析不一致则 `SEED_BASE_MISMATCH` 退出。
- [ ] 数据明确标为 `fixture-replay` / `synthetic-perturbation`，不得声称真实采集。
- [ ] `code/back` 的 `npm test` 包含 case2/3/4；Ctrl+C 停止后不再写共享目录。

## 1. 目录

```text
code/back/
├── package.json                    # 增加 start:case4；npm test 串行 case2+case3+case4
├── .env                            # 仅外部配置源；增加 CASE4_STUB_* 注释示例
├── README.md                       # 增加 Case4 启动说明
└── case4/
    ├── package.json
    ├── case4-stub.mjs
    ├── README.md
    ├── scripts/run.mjs
    ├── fixtures/
    │   ├── ue_position_coordinates_base.txt
    │   ├── ue_position_without_dt_coordinates_realtime.txt
    │   ├── ue_position_gaode_coordinates_realtime.txt
    │   ├── ue_position_with_dt_coordinates_realtime.txt
    │   ├── ue_position_without_dt_thrp.txt
    │   ├── ue_position_with_dt_thrp.txt
    │   ├── ue_position_without_dt_coordinates_realtime_cdf.txt
    │   ├── ue_position_gaode_coordinates_realtime_cdf.txt
    │   ├── ue_position_with_dt_coordinates_realtime_cdf.txt
    │   └── ue_position_with_dt_error_and_nlos.txt
    ├── src/
    │   ├── constants.mjs
    │   ├── config.mjs
    │   ├── errors.mjs
    │   ├── logger.mjs
    │   ├── control-store.mjs
    │   ├── fixture-store.mjs
    │   ├── kpi-generator.mjs
    │   ├── publisher.mjs
    │   └── runner.mjs
    └── test/case4-stub.test.mjs
```

实现期从 `01-参考资料/case4/data/` **一次性复制**上表 10 个文件到 stub fixtures，并做 §8 预检。运行时 **禁止** 回读 `01-参考资料/`。测试通过构造函数注入 `fixtureDir`，不增加 `CASE4_STUB_SOURCE_DIR` 生产环境变量。

不要复制 `ue_position_with_dt_coordinates_reflection_point.txt`。若误放入 fixtures，也不得 seed、append、清空或参与 complete。

当前仓库参考样本（只作默认 fixtures 事实，不是硬编码合同）：base/三轨迹/两吞吐各 38 行，三份 CDF 各 100 行，汇总 4 行。正常 replay 约 `3000ms + 38×1000ms`。禁止把 38/100 写进发布循环。

职责对照 case3，按 case4 删减：

| 模块 | 做 | 不做 |
|---|---|---|
| `config` | 解析并校验正式 env | clamp 非法值 |
| `fixture-store` | 预检、seed 缺失 base | import Node 解析器 |
| `control-store` | 拥有字段 patch + ownership | 写 command / 空 status / flag=0 |
| `kpi-generator` | 构造本轮不可变数据集；本地复制契约 `roundSemanticNumber`（含 `Number.EPSILON`） | 从随机轨迹重算 CDF/CEP；另写不含 EPSILON 的公式；import Node 解析器 |
| `publisher` | 双指针 append + 原子统计 + 可选反射按 Pi 追加 | 波束/Cost |
| `runner` | 门沿、dwell、恢复表、撤权 | REST、断点续写 |

## 2. 配置与命令

### 2.1 环境变量

| 变量 | 默认值 | 规则 |
|---|---:|---|
| `DT_SHARED_DIR` | `code/comdatafiles`（仅 run wrapper） | 写在 `code/back/.env`；正式入口必须为绝对目录。 |
| `CASE4_STUB_POLL_MS` | `200` | 监听控制文件；正整数。 |
| `CASE4_STUB_SUCCESS_DWELL_MS` | `3000` | 正式环境不得低于 3000。 |
| `CASE4_STUB_STEP_MS` | `1000` | 每个发布步间隔；正整数。 |
| `CASE4_STUB_OUTCOME` | `success` | `success` / `fail`。 |
| `CASE4_STUB_REQUEST_PICTURE` | `1` | `1`：Start 终态同拍 flag=1；`0`：只 complete。 |
| `CASE4_STUB_SEED_INIT` | `1` | 仅在缺失时向 shared/case4 写 base；仅本地 stub。 |
| `CASE4_STUB_DATA_MODE` | `random` | **与 case3 相同**：只允许 `random` / `replay`。`random` 相对包内 fixtures 小幅扰动；`replay` 原样回放包内 fixtures。 |
| `CASE4_STUB_SEED` | 空 | 仅 random；空值每次 Start 使用 operationId；非空值可复现。 |
| `CASE4_STUB_LOG_LEVEL` | `info` | `info` / `debug`。 |

数据模式切换与 case3 对齐，写在 `code/back/.env`，改完后重启 `start:case4`：

```dotenv
CASE4_STUB_DATA_MODE=random
# CASE4_STUB_SEED=demo-1
# CASE4_STUB_DATA_MODE=replay
```

两种模式都只读 `code/back/case4/fixtures/`，不读共享目录里上一轮九个动态文件，也不读 `01-参考资料/`。换一套用户样本：替换包内 fixtures 后重启。

**不增加** jitter、幅度、时钟或 case2 式 `CASE4_STUB_SOURCE_DIR`。随机幅度是代码常量（§5.3），不是配置。

正式环境变量严格校验：共享根必须为绝对路径且为目录；poll/step 必须是十进制正整数；dwell 必须是十进制整数且 ≥3000；outcome/dataMode/log level 必须命中枚举；requestPicture/seedInit 只能为 `0`/`1`。非法配置快速退出并记录 `CONFIG_INVALID`，禁止 clamp。测试通过构造函数注入更小 dwell/step/poll，不通过正式环境变量绕过约束。不引入 fake timer。

配置测试必须锁定正式默认：`poll=200, dwell=3000, step=1000, requestPicture=1, seedInit=1, dataMode=random, outcome=success, logLevel=info`。

`CASE4_STUB_STEP_MS` **不是** case2 的 `CASE2_STUB_STEP_MS`。case2 用它表示 success 后一次性发六文件前的等待；case4 用它表示流式发布步间隔。dwell 必须用 `CASE4_STUB_SUCCESS_DWELL_MS`。

### 2.2 命令

在 `code/back` 根目录：

| 命令 | 用途 |
|---|---|
| `npm run start:case2` | 启动 Case2 本地 stub。 |
| `npm run start:case3` | 启动 Case3 本地 stub。 |
| `npm run start:case4` | 启动 Case4 本地 stub。 |
| `npm test` | 串行运行 Case2 + Case3 + Case4 stub 测试。 |

子包仅保留 `start` / `test`。调试日志与关闭截图用环境变量（`CASE4_STUB_LOG_LEVEL=debug`、`CASE4_STUB_REQUEST_PICTURE=0`），不提供 `dev*` / `*:no-picture` npm 脚本。Case2 / Case3 / Case4 stub **分开启停**，不得并行抢同一控制文件。

`scripts/run.mjs` 复用 `code/back/src/env-file.mjs`：只读 `code/back/.env`；未写 `DT_SHARED_DIR` 时回退到 `code/comdatafiles` 的绝对路径。

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

「只合并后端拥有字段」，不是「所有字段」。

每次 patch：

1. 进入 stub 内同一串行队列。
2. 读取最新完整控制。
3. 校验当前任务仍拥有写入权。
4. 合并自有 patch。
5. 同目录临时文件写、fsync、close、原子 rename（文件名含 pid + nonce）。
6. 回读确认 patch 已生效，未修改字段（含未知字段）无丢失。

Windows 瞬时 `EPERM` / `EACCES` / `EBUSY` 对 rename 有限重试（建议 8 次、间隔 25ms）。这不是业务命令自动重试。失败清理临时文件。控制 JSON 使用 2 空格缩进并末尾换行。

### 3.2 控制读取与唤醒

- `fs.watch` 只负责低延迟唤醒，`CASE4_STUB_POLL_MS` 轮询始终作为兜底；mtime 或事件本身不代表新命令。watch 目录为共享根。
- 每次唤醒后重新读取并校验完整控制快照，再按 §3.3 分类。
- 控制文件不存在时不创建、不退出；记录一次等待日志，继续轮询。
- JSON/UTF-8 短暂不可读时最多重试 3 次、间隔 50ms；仍失败、shape 非法或其他 I/O 故障时本拍不动作，按错误类型限频记录，等待下一次唤醒。
- 只有配置非法、fixtures 预检失败或 seed 失败时才快速退出；运行期控制文件暂不可读不得杀死 stub。

控制快照五字段必填；`debug_flag` 若存在必须是整数，`scene_type` 若存在必须是字符串。校验失败视为本拍不可读。

### 3.3 新轮识别

合法 Start：

```text
case=case4
command=start
dt_type=all
status=""
```

合法 ReInit 同上，但 `command=reinit`。`dt_type` 必须是精确字符串 `"all"`。

`status=""` 是每次新轮门沿；因此同一 command 在 `execute fail` 后由 Node 再次清空 status 也可被识别。不以 command 是否变化、文件 mtime 或固定延时猜新轮。

watcher 在启动异步任务前先登记唯一 active task 和内存 `operationId`；`operationId` 只用于日志关联，不写共享文件，不作为恢复身份或 command_id。active task 未释放时，同一空 status 快照不得重复接单。

active task 在撤权或终态（`execute fail` / `case complete` / `reinit complete`）后释放，并**立即重读一次**当前快照，再等待下一次合法空 status。这不是断点恢复；漏掉这一步会丢掉执行期间到达的新命令。

### 3.4 写入权撤销

每次 sleep、**每个独立文件 append / 原子统计写**和 status patch 前都重读控制；以下任一条件成立，当前任务 abort：

- `command=init`
- `case` 不再是 case4
- command 或 `dt_type` 与接单元组不同
- 出现新的 `status=""` 命令元组
- 进程收到 SIGINT/SIGTERM

dwell 与 step 等待必须切片复验（建议 `checkEveryMs = min(pollMs, 200)`），不能整段 sleep 完再看一眼。

撤销可能发生在同一步的多个文件 append 之间，允许留下跨文件不齐的物理行尾。Stub 不回滚、不补齐、不实现跨文件事务。撤销后不再写数据、status 或 flag（包括不要写 `execute fail`），并立即重新求值当前控制。

SIGINT/SIGTERM：abort 在途任务，停止后不再写共享目录；**不要**把中断写成 `execute fail`。

## 4. 初始化文件

`CASE4_STUB_SEED_INIT=1` 时：

- 创建 `{DT_SHARED_DIR}/case4/`；
- seed **只**处理 `ue_position_coordinates_base.txt`，不复制或改写九个动态文件、反射、截图或其他 Case；
- 文件缺失时用 stub fixtures 原子创建（临时文件 + fsync + rename）；
- 文件已存在且合法、且与 fixture **解析后的坐标序列一致**（行数相同，各分量 `Number` 相等；允许 CRLF/多余空格文本差异）时保留，日志 `seedAction:"skippedExisting"`；
- 文件已存在但内容非法：`SEED_TARGET_INVALID` 快速退出，禁止静默覆盖；
- 文件已存在且合法，但与 fixture 解析结果不一致：`SEED_BASE_MISMATCH` 快速退出，禁止覆盖，禁止声称同源回放。操作者应改 `DT_SHARED_DIR` 或删除错误 base 后重启。

seed 启动日志标记 `dataSource:"reference-derived"`。该动作仅用于本地无真实后端环境。真实挂载联调必须 `CASE4_STUB_SEED_INIT=0` 并停止本进程。

正常 Start/ReInit **禁止** stub 清空九个动态文件；那是 Node 开轮职责。单测若没有 Node，由测试夹具自行准备空文件。第二轮不继承第一轮 append：依赖 Node 清空或测试夹具清空，而不是每次 Start 都 truncate。

## 5. Start 行为

主线时序（禁止调换 dwell 与发布的顺序）：

```text
合法门沿
  → 登记 operationId（recovery=false）
  → OUTCOME=fail：只 patch execute fail，不写数据/complete/flag
  → patch execute success（期望当前 status=""）
  → waitWhileOwned(SUCCESS_DWELL_MS)   // 期间不得 complete、不得发数据
  → 内存一次性构造本轮不可变数据集
  → 双指针按 STEP_MS 追加三轨迹 + 两吞吐
  → 原子写 3 CDF + 1 汇总并关闭
  → 确认 complete 不变量
  → 一次 patch complete；REQUEST_PICTURE=1 则同拍 flag=1
```

### 5.1 接单与失败

接单先记录：

- 内存 `operationId`
- `command`、`dt_type`
- `recovery:false`
- Start 的 `requestPicture`
- outcome、dataMode
- random 的 `resolvedSeed`（固定 seed 时用该字符串；空 seed 使用 operationId）

ReInit 日志省略 `requestPicture`。

若 `CASE4_STUB_OUTCOME=fail`：

1. 确认仍拥有写入权（期望 status=""）。
2. 原子 patch `status="execute fail"`。
3. 不写轨迹/吞吐/统计，不写 complete / reinit complete，不置 flag。

运行中 I/O 或数据集非法：若仍拥有写入权（status 仍为 `""` 或 `execute success`），先停止发布再 patch `execute fail`；已撤权则只记 `revoked`。本轮不再写完成态。

### 5.2 成功窗口

1. patch `status="execute success"`。
2. 等待 `CASE4_STUB_SUCCESS_DWELL_MS`，期间持续检查写入权。
3. dwell 未满前不得写 complete、不得覆盖 success、不得开始 append 或写统计。
4. dwell 结束后才开始 §5.3。

### 5.3 本轮数据集与双指针 append

每次 Start 先在内存中一次性构造本轮不可变数据集，之后只读取该快照；禁止每次轮询或每次文件写入时重新随机。

方案文件映射（与契约 §2 一致）：

| 方案 / side | 实时文件 |
|---|---|
| traditional | `ue_position_without_dt_coordinates_realtime.txt` |
| commercial | `ue_position_gaode_coordinates_realtime.txt` |
| dt | `ue_position_with_dt_coordinates_realtime.txt` |
| throughput without | `ue_position_without_dt_thrp.txt` |
| throughput with | `ue_position_with_dt_thrp.txt` |

#### replay

按 fixture **有效记录**顺序发布。逐行可统一换行符为 `\n`，**必须保留每条有效记录的原始数值文本**（含科学计数），不得改顺序、不得 `toFixed(2)` 重写 CDF、不得修改参考目录。不继承 case3 的 Cost 覆盖值。

预检允许的**文件首尾空行**只用于容忍 fixture 外围空白，**不得**当作记录发布到共享运行文件。忽略这些外围空行后，有效记录之间不得再插入空行；文件末尾一个换行不算额外记录。数据中间空行仍是非法 fixture，预检失败，不能靠过滤空行重编号。

`dataSource:"fixture-replay"`。轨迹与统计原始样本可以不是自洽同轮数据，不重算、不补正。

#### random

相对 fixture 做固定小幅扰动。幅度是代码常量，不是 env：

| 对象 | 规则 |
|---|---|
| 三轨迹 XY | 每个**非哨兵**分量独立加 `[-0.02,+0.02]` 米，写文件保留 2 位 |
| 三轨迹 Z | 保持原值 |
| `65535` | 该分量不扰动、不改成普通坐标；精确 `=== 65535`（含 `65535.0` / `6.5535e4`） |
| base | 不随机、不改写 |
| 两路吞吐 | 每样本乘 `[0.98,1.02]`，保持非负，写文件保留 2 位；原始 0 仍为 0 |
| CDF | 每方案每轮一个 `[0.98,1.02]` 正系数，只乘横轴 `errorM`；概率列保持原值；禁止量化到 0.01 |
| CEP50/90 | 使用**该方案同一系数**缩放；保持 `p50M ≤ p90M` |
| NLOS | 每轮加 `[-0.005,+0.005]` 后限制到 `[0,1]`；只用于合成。汇总第 4 行第 2 列保持原值 |
| 排名 | 不为 DT 优势或三方案排序重采样；不从随机轨迹重算统计 |

`resolvedSeed` 在构造数据集时固定 RNG；后续发布只读数组。`dataSource:"synthetic-perturbation"`。

随机坐标/吞吐写文件前的 2 位舍入 **必须与契约 §5 / 现网 `roundSemanticNumber` 同一公式**（复制 case3 `numeric-line.mjs` 实现到 stub 本地，禁止 import Node 模块，也禁止另写不含 `Number.EPSILON` 的公式）：

```js
function roundSemanticNumber(value, digits = 2) {
  const factor = 10 ** digits;
  const rounded =
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
  return Object.is(rounded, -0) ? 0 : rounded;
}
```

先检查原始范围与哨兵，禁止负数靠舍入变零后通过。CDF/CEP/NLOS **不**走该 2 位舍入，写出时必须能表达小于 0.01 的数（参考 DT CDF 首点 `5.71e-05`），禁止 `toFixed(2)`。

分隔符：replay 保持 fixture（当前参考 CDF/汇总为空白分隔）。random 每个统计文件内部只用一种分隔符，不混用逗号与空白。坐标文件始终逗号分隔。

#### 发布循环

```text
步数 = max(三轨迹计划行数, 两路吞吐计划行数)
每步按固定顺序：
  1. traditional 若还有下一行 → 整行 append
  2. commercial 若还有下一行 → 整行 append
  3. dt 若还有下一行 → 整行 append
  4. without 吞吐若还有下一行 → 整行 append
  5. with 吞吐若还有下一行 → 整行 append
  6. waitWhileOwned(STEP_MS)   // 最后一步之后也等待
已结束的序列本步跳过，不补 0、不截短对方
```

规则：

- 每个目标文件 append 前分别按 §3.4 复验写入权。
- 写入完整一行；单次 append，不故意拆半行。契约要求后端把一整行准备好再写，避免可解析数字前缀被当成完整数据。
- 立即对读者可见：`open(append) → write → fsync → close`。禁止长时间持有未刷盘缓冲导致运行中点位成批出现。
- 同一步内三轨迹依次写，允许 Node 读到短暂不同步；这是真实文件行为，不是 bug。
- 不得用三轨迹最短行数决定吞吐何时停止。
- 默认 fixtures 下约 38 步；以数据集实际长度为准。

空吞吐：计划长度为 0 时该路不 append。complete 前该文件必须存在（0 行合法）。两路计划长度可以不同（例如 38 与 12，或一路 0、一路非空）。测试无 Node 时，publisher 在发布前 `mkdir` 并对计划为空的吞吐文件确保存在（空文件），不写 `0` Gbps 行。

**轨迹计划合法性分两条路径，禁止为了测试放松正式预检：**

| 入口 | 三轨迹不同长或任一为 0 | 三轨迹同长、>0、≤ base（含 38 预期 / 30 完成） |
|---|---|---|
| 正式启动：`loadFixtureStore` / 默认 `fixtureDir` / `runMain` | **`FIXTURE_INVALID` 立即退出**，不接单、不发布 | 预检通过，走正常 Start |
| 测试专用：向 `createRoundDataset` / publisher 注入数据集，**绕过** `loadFixtureStore` | 允许把计划行发完以便观察 pending，但 **不得** `case complete`；仍拥有写入权时 patch `execute fail`，错误码 `TRAJECTORY_PLAN_INVALID` | 可用于缩短序列的发布测试 |

包内默认 fixtures 必须走正式预检。`5/3/4` 不得放进 `code/back/case4/fixtures/`，也不得作为 `createCase4Stub({ fixtureDir })` 的合法启动目录。

### 5.4 统计发布与截图

全部计划轨迹/吞吐：

- 已按 §5.3 写完或已因计划非法转入 fail；
- 文件句柄已关闭；
- 不再 append；
- 当前控制仍属于同一 Start。

然后按契约 §2 文件名 **原子整文件发布**（临时文件 + fsync + rename，不是 append）三份 CDF 和一份汇总。每个文件写前复验 ownership。

complete 不变量（全部满足才允许 complete）：

- 三轨迹最终行数相同且 ≥1；
- 不超过当时磁盘 base 行数（seed 后的共享 base；测试自行准备）；
- 两吞吐文件存在，0 行合法，无半行；
- 四份统计文件存在、句柄关闭。

然后：

- `CASE4_STUB_REQUEST_PICTURE=1`，或恢复路径上当前 `save_picture_flag` 已为 1：一次原子 patch

```json
{
  "status": "case complete",
  "save_picture_flag": 1
}
```

- 否则只 patch `status="case complete"`。

禁止先 complete 后补 flag。complete 后本任务不得再改九个动态文件。打桩不把 flag 清回 0，不写 PNG，不写 `out/case4/points/trajectory.jsonl`（JSONL 属于 Node）。

## 6. ReInit 行为

Node 在写 ReInit 控制前已经清空九个动态文件。stub 只模拟业务确认：

1. patch `execute success`（期望 status=""）。
2. `waitWhileOwned(SUCCESS_DWELL_MS)`。
3. 确认写入权仍有效。
4. patch `reinit complete`。

ReInit：

- 不写任何业务数据（含统计）；
- 不置 `save_picture_flag=1`；
- fail outcome 只写 `execute fail`。

## 7. 进程启动与恢复

恢复分类只在进程启动时执行一次；运行中 publish 失败不得被下一次 poll 自动当成恢复，否则会形成重复清空/重放循环。

不实现从现有行数 `K+1` 的断点续写。启动恢复采用「清空九动态文件后全量重放」，原因与 case3 相同：没有持久 batch/command_id，旧进程可能在同一步多个 append 之间退出。

| 启动时控制快照 | 动作 |
|---|---|
| 控制文件缺失/暂不可读 | 按 §3.2 等待，不创建控制文件。 |
| `command=init,status=""` | 空闲，不动作。 |
| 合法 Case4 Start/ReInit 元组且 `status=""` | 尚未接单，按新命令执行。 |
| 精确 `case4 + start + all + execute success` | 新建日志 `operationId,recovery:true`；清空九个动态文件；从第 1 行完整重放（replay 原样，random 重新构造；固定 seed 可复现，空 seed 重启后允许变化）。恢复 Start **跳过** success patch 与 dwell，直接发布。全部关闭后按当前截图配置写 complete；若控制中 flag 已为 1，最终写必须保留高电平。 |
| 精确 `case4 + reinit + all + execute success` 且 `save_picture_flag=0` | 新建日志 `operationId,recovery:true`；跳过再写 success，重新保持完整 dwell，再写 `reinit complete`。 |
| 合法 Case4 元组的 `execute fail` / `case complete` / `reinit complete` | 本轮已终止，不动作。 |
| 非 Case4、`dt_type` 不是 `"all"`（含旧值 `"with dt"` / `"without dt"`）、启动恢复见到 `reinit + execute success + flag=1`、未知 status 或其他不合法元组 | 记录诊断，不猜测、不动作。 |

说明：`reinit + flag=1` 仅作为**启动恢复分类**的非法快照；活体新轮门沿仍只认 §3.3。正常路径 Node 开轮会写 `flag=0`。

恢复 Start 时允许 truncate 九个动态文件，并对**已存在**的反射文件同步清空，因为本进程只用于无真实后端的本地 stub，且 `case complete` 前这些文件仍属于未完成轮。禁止与真实后端同时运行。**永远不清** base、`out/`、控制文件和其他 Case。反射不是 complete 门槛。

恢复沿用当前进程 `CASE4_STUB_REQUEST_PICTURE` 和 dataMode。`CASE4_STUB_OUTCOME=fail` 不得把已经处于 `execute success` 的旧轮改写为 fail。恢复过程中仍按 §3.4 在每次清空、append、等待和终态 patch 前复验 ownership。

## 8. Fixture 预检

stub 启动时先验证包内 fixtures，失败则 `FIXTURE_INVALID` 快速退出：

- base 至少 1 行；每行恰好 3 个逗号或空白字段；有限数；**禁止** 65535。
- 三轨迹行数必须相同、>0、且 ≤ base 行数；每行 3 个逗号或空白字段；有限数；允许分量 65535 或单行 65535（整点无效）。
- 两路吞吐文件必须存在；每行一个非负有限数；允许 0 行。
- 三份 CDF：每份至少 1 点；2 列；同一文件分隔符一致；`errorM` 非负、`probability` 在 `[0,1]`；两列各自非递减（允许重复）；不强制首 0 / 末 1；必须能解析科学计数。
- 汇总恰好 4 行 × 2 列；前三行 `p50M ≤ p90M` 且非负；第 4 行第 1 列 NLOS 在 `[0,1]`；第 2 列有限数即可。
- 允许文件**首尾**空行、CRLF 和无换行完整末行；这些外围空行在预检时剥离，不计入行号。数据**中间**空行仍非法，不得过滤后当合法 fixture。
- 不硬编码 38/100。

fixture 预检使用 stub 内纯解析函数，**不得** import Node 适配服务的生产解析器。seed 写出的共享 base 同样只含有效记录，不把 fixture 外围空行拷进运行目录。

`seedInit=1` 时还要按 §4 校验共享目录已存在的 base。

## 9. 日志

每条结构化日志至少包含 `caseId:"case4"`。任务日志再加：

- `operationId`、`recovery`
- `command`、`dtType`
- `event`：`started` / `accepted` / `success` / `step` / `stats` / `complete` / `fail` / `revoked` / `diagnose` / `control-wait` / `control-recovered` / `stopping`
- Start 的 `requestPicture`（ReInit 不要带）
- `dataMode`、`dataSource`、`resolvedSeed`（适用时）
- 各序列计划/已发布长度（适用时）
- `reason` / 错误码（适用时）

`dataSource` 取值：`fixture-replay` / `synthetic-perturbation` / seed 时的 `reference-derived`。

step 默认 debug；控制边沿、接单、complete、fail、revoked、seed、启动必须 info。控制文件缺失/不可读的重复日志限频，恢复后记录一次 recovered。不打印文件全文，不声称真实采集，不给产品 UI 加「模拟数据」徽标。

## 10. 测试计划

测试使用临时共享根，不改仓库 `01-参考资料/` 和正在联调的 `code/comdatafiles`。缩短间隔只走构造注入。

### 10.1 配置、控制读取与唤醒

- 正式默认断言 §2.1。
- 正式环境 dwell<3000、非正 poll/step、非法 outcome/dataMode/flag/log level、相对路径 `DT_SHARED_DIR` 均 `CONFIG_INVALID`，不 clamp。
- 控制文件启动时不存在：进程保持运行，文件随后创建后可接单。
- JSON/UTF-8 短暂不可读最多 3 次/50ms；持续非法只记限频诊断，不接单、不退出。
- `fs.watch` 与纯轮询都只唤醒；重复事件不重复接单；watch 不可用时轮询仍可完成主线。

### 10.2 控制原语

- 只允许 owned patch，拒绝空 status、flag=0 和其他字段。
- patch 保留未知字段，串行并发无丢失。
- 临时文件原子替换与失败清理；Windows 瞬时 rename 失败会重试。
- 相同 command 在 fail 后新 `status=""` 可再次接单。
- execute fail / case complete / reinit complete 和撤权都会释放 active task，并立即重读最新控制。

### 10.3 Start

- replay 回读与 fixture **有效记录**数值/顺序一致；外围空行不出现在运行文件；原始 fixture 文件不被修改。带首尾空行的 fixture 经正式 `loadFixtureStore` 启动后，发布产物无额外空记录、无记录间空行，行数等于有效记录数（与 Node「中间空行非法、末尾换行不算记录」兼容）。不为此 import Node 生产解析器。
- random 固定 seed 可复现，不同 seed 有变化；幅度不超过 §5.3；Z 与 65535 分量保持原值；base 不被改写；CDF 单调、p50≤p90、NLOS∈[0,1]；无强制优劣排序。
- `roundSemanticNumber` 边界：至少覆盖现网用例 `1.005→1.01`、`-1.005→-1.01`、`-0.001→0`（2 位）；与复制的公式逐值相等，禁止无 EPSILON 的实现混用。
- 本轮随机只生成一次；同轮多次读取发布数组不变。
- success 实际住满配置 dwell；dwell 结束前无数据文件增长、无统计文件、无 complete。
- 双指针：轨迹 30 + 吞吐 38 时吞吐发完 38，不被截成 30。再覆盖：两路吞吐 38/12 且三轨迹同长时可 complete；一路吞吐空、另一路非空可 complete。两路都空也可 complete。
- 同一步三文件依次写，允许短暂行数不同。
- **正式预检**：`loadFixtureStore` / 默认 fixtures 加载三轨迹 `5/3/4` → `FIXTURE_INVALID` 启动失败，不得接单。不得为跑下一通测试而放宽该预检。
- **发布器注入**：测试专用数据集注入计划 `5/3/4`（绕过 `loadFixtureStore`）→ 可把计划行发完，但不得 complete，应 `execute fail` / `TRAJECTORY_PLAN_INVALID`；文件可留下 5/3/4。
- 注入合法 fixture 目录（走正式预检）：base 38 / 三轨迹均为 30 → 允许 complete，不补造 31～38。
- 65535 原样进入轨迹文件；stub 不做 Node 的前点/base 替换。
- complete 前句柄关闭；complete 后无写入。
- 默认同拍 complete+flag=1；no-picture 只 complete。
- 配置 fail 不写数据/完成/flag。
- 每个独立 append 前检查 ownership；同一步中途撤权允许不齐尾部，不再继续写、不做回滚。
- 第二轮不继承第一轮 append（测试在第二轮前清空九文件，模拟 Node）。

### 10.4 ReInit、撤权与启动恢复

- ReInit success→dwell→reinit complete，永不截图、不写业务文件。
- init、其他 Case、新空 status 命令在 dwell/发布中途撤销旧写入权。
- SIGINT/SIGTERM 停止所有后续写，不写 execute fail。
- 撤销后的旧任务不能覆盖新命令 status。
- 覆盖 §7 恢复表全部分支；Start recovery 清空九动态文件并从第 1 行重放，不从 K+1 续写；不清 base。
- ReInit recovery 重新保持完整 dwell；恢复 success 不受当前 fail outcome 反向覆盖。
- 恢复只在 startup 分类一次；运行中 publish 错误不会被 poll 无限恢复。

### 10.5 Seed 与 Fixture

- 默认 10 个 fixtures 通过预检。
- 缺列、**记录中间**空行、负吞吐、CDF 非单调、p50>p90、NLOS>1、base 含 65535、正式入口三轨迹不同长分别 `FIXTURE_INVALID`。
- 仅首尾空行的合法 fixture 预检通过；seed/replay 写出后不含那些外围空行。
- seed 只创建缺失 base；已存在且与 fixture 解析一致则保留；非法 → `SEED_TARGET_INVALID`；合法但不一致 → `SEED_BASE_MISMATCH`；九动态文件永不被 seed 改写。
- 每个 append 后内容对读者立即可见。

## 11. 联调

本地推荐三个终端，**同一** `DT_SHARED_DIR`：

```text
1. code/server  -> npm start
2. code/back    -> npm run start:case4
3. code/web     -> npm run dev
```

Web+Node 一键仍用现有 `code/scripts/dev-web-server.sh`（Windows `.bat`）；该脚本 **不** 启打桩。打桩另开终端。未测环境如实记录，不预填 QA 通过。

三进程主线至少覆盖：replay 一轮、random 连续两轮、重置、默认截图同拍。前端/Node 各层 mock 不能代替这条主线。本轮不强制新增 `e2e-case4-stack.sh`；若后续 Web SPEC 要求再补。

实现后同步：`code/back/package.json`、`code/back/README.md`、`code/back/.env` 注释。`npm test` 必须实际跑到 `case4/test/*.test.mjs`。

## 12. 明确不做

- 不提供 REST / Socket。
- 不与真实后端或其他 case stub 同时跑同一控制文件。
- 不把 synthetic / fixture 表述为真实采集。
- 不写 JSONL；不写 PNG；不写 `out/case4/`。
- 不引入 manifest、batch_id、command_id、数据库、队列或取消命令。
- 不把 stub 自动并入适配服务启动命令。
- 不引入持久 task token 或从 K+1 断点续写；启动恢复采用清空九动态文件后全量重放。
- 不把本文延时、参考样本路径或编排命令写进真实后端交接文档。
- 不实现 65535 归一（那是 Node）、不重算 CDF/CEP、不强制 DT 优势。反射按包内模拟 fixture 原样发布，不把模拟称为真实采集。
- 不增加随机幅度配置、产品徽标或 case2 式 `SOURCE_DIR`。

## 13. 已确认的 stub 决策

- [x] 用户于 2026-09-13 批准同时支持参考回放与基于参考的随机动态测试；随机字段为轨迹/吞吐小幅变化，CDF/CEP/NLOS 独立小幅扰动；不强制三方案优劣；不增加幅度配置。
- [x] 用户于 2026-09-15 批准空吞吐文件允许完成、该路保持空态。
- [x] 用户于 2026-09-15 批准施工默认幅度：XY ±0.02m、吞吐 ×[0.98,1.02]、统计系数 [0.98,1.02]、NLOS ±0.005。
- [x] 用户于 2026-09-15 批准：进程启动遇到 `start/reinit + execute success` 时按 case3 模式清空九个动态文件并从第 1 行整轮重放，不从 K+1 续写。
- [x] 用户于 2026-09-15 批准：共享 base 与 fixture 解析不一致时启动失败退出（`SEED_BASE_MISMATCH`），不覆盖。
- [x] 用户于 2026-09-15 批准：实现期复制到 `code/back/case4/fixtures/`，运行时只读包内 fixtures，禁止回读 `01-参考资料/`。
- [x] 用户于 2026-09-15 确认数据模式 **与 case3 一样**：仅 `CASE4_STUB_DATA_MODE=random|replay` 切换；默认 random；不增加 `SOURCE_DIR`；换用户样本靠替换包内 fixtures。
- [x] 2026-09-15 Codex 检视收口（用户转达，无新业务）：random 舍入改为契约 `roundSemanticNumber`（含 `Number.EPSILON`）；正式 fixture 预检与发布器注入对 `5/3/4` 分路径；replay 忽略外围空行、不发布空记录；补两路吞吐 38/12 与一路空一路非空测试。
- [ ] 批准本文交给实现 agent。
