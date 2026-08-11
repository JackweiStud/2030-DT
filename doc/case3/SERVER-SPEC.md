# case3 Node 文件适配服务施工规格

> status: `REVIEW_READY`
>
> 使用者：前端 PC Node 适配服务实现 agent。
>
> 本文扩展现有 `code/server/` 单进程，不创建第二个适配服务。业务语义以 [API-CONTRACT.md](API-CONTRACT.md) 为唯一真相源；真实后端只读 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md)。模拟后端见 [realback_no.md](realback_no.md)。
>
> 实现 agent 开工前必须完整阅读 `state.md`、API 契约 §3～§8 和本文；本文不复制 init-data / side 的 canonical JSON，HTTP 成功/失败字段必须逐项以契约为准。

## 0. 出口条件

- [ ] 同一个 `127.0.0.1:3102` 进程同时注册现有 `/api/case2/*` 和新增 `/api/case3/*`。
- [ ] 控制文件读取、原子 patch 和串行队列升级为进程级共享原语；Case2 合法 Web 主线、REST shape、数据和截图路径不变，非法并发/跨 Case 直接命令按新规则返回 `CONTROL_BUSY`。
- [ ] Node 对跨 Case 活动命令执行 `CONTROL_BUSY` 防御，不只依赖 Shell 按钮锁。
- [ ] Case3 Start/ReInit 在写控制前完整清空目标侧实时文件和调试快照；失败不写命令。
- [ ] init-data、单侧全量快照、pending tail、稳定读取和最终完成门槛有自动测试。
- [ ] 数值四舍五入、范围、逐点行号和 Reflection `0→false,1→true` 由 Node 唯一校验。
- [ ] 截图 Base64/PNG 校验、进程内串行、原子落盘、不覆盖、成功后清零与 Case2 同构，输出隔离到 `out/case3/`。
- [ ] 结构化日志可区分 case、endpoint、side/command、错误码和原因。
- [ ] `npm test` 同时通过 shared、case2、case3 测试；`npm start` 可 Ctrl+C 退出。

## 1. 架构与目录

### 1.1 技术选择

- Node.js `>=20`、ESM、`node:http`。
- 测试使用 `node:test` 与 `node:assert/strict`。
- JSON 响应 UTF-8、`Cache-Control:no-store`。
- 默认只监听 `127.0.0.1`。
- 请求体默认上限保持 `20 MiB`，覆盖 3840×2160 PNG Base64。
- 不增加 Express、Socket.IO、数据库或跨机器锁服务。

### 1.2 目标目录

```text
code/server/
├── package.json
├── scripts/run.mjs
├── src/
│   ├── app.mjs
│   ├── index.mjs
│   ├── shared/
│   │   ├── atomic-write.mjs
│   │   ├── config.mjs
│   │   ├── control-file-store.mjs   # 新增：唯一控制读/写/队列
│   │   ├── errors.mjs
│   │   ├── http.mjs
│   │   ├── logger.mjs
│   │   ├── png-screenshot.mjs       # 从 Case2 抽取可参数化原语
│   │   └── serial-queue.mjs
│   └── cases/
│       ├── case2/                    # 通过 shared 原语保持现有行为
│       └── case3/
│           ├── constants.mjs
│           ├── control-file.mjs
│           ├── init-data.mjs
│           ├── numeric-line.mjs
│           ├── side-files.mjs
│           ├── debug-jsonl.mjs
│           ├── screenshot.mjs
│           └── routes.mjs
└── test/
    ├── shared/
    ├── case2/
    └── case3/
```

只抽取确实共享的文件原语。Case3 文件名、数值字段和完成门槛不得进入 `src/shared/`；Case2 热力/截图命名也不得进入 Case3 模块。

## 2. 配置与运行

### 2.1 环境变量

| 变量 | 默认值 | 规则 |
|---|---:|---|
| `DT_ADAPTER_HOST` | `127.0.0.1` | 项目级主变量。 |
| `DT_ADAPTER_PORT` | `3102` | 十进制整数 1～65535。 |
| `CASE2_ADAPTER_HOST` | 无 | 旧 fallback；仅当 `DT_ADAPTER_HOST` 未设时读取。 |
| `CASE2_ADAPTER_PORT` | 无 | 旧 fallback；仅当 `DT_ADAPTER_PORT` 未设时读取。 |
| `DT_SHARED_DIR` | 无 | 正式启动必填绝对目录。 |
| `CASE2_SHARED_DIR` | 无 | 旧 fallback；不允许回退到参考资料。 |

`scripts/run.mjs` 的本地开发默认仍可使用 `code/comdatafiles/`，但 `src/index.mjs` 正式入口必须显式配置共享根。

最小结构：

```text
{DT_SHARED_DIR}/
├── case_control.json
├── case2/
├── case3/
│   ├── ue_comm_coordinates_base.txt
│   ├── ue_comm_with_dt_beam_accuracy_rate.txt
│   └── ue_comm_*_*.txt
└── out/
    ├── case2/
    └── case3/
        ├── case3-000.png
        └── points/
            ├── without.jsonl
            └── with.jsonl
```

### 2.2 命令

| 命令 | 用途 |
|---|---|
| `npm start` | 启动正式适配服务；控制文件或共享根不可用时快速失败。 |
| `npm run dev` | 同一服务，输出可读日志。 |
| `npm test` | shared + case2 + case3 全量测试。 |

适配服务启动不隐式启动 Case3 模拟后端。

## 3. 共享控制文件原语

### 3.1 为什么必须抽取

现有 Case2 控制服务拥有自己的串行写队列。Case3 接入后若再复制一套队列，两个模块可能同时以旧快照整文件覆盖同一个 `case_control.json`。因此：

- 全进程只有一个 `ControlFileStore`；
- 所有 Case2/Case3 POST、截图清零都进入同一 `SerialQueue`；
- 每次写都在队列内重读最新快照，patch 自有字段，原子替换并回读。

### 3.2 读取

五个必填字段及两个可选字段按契约校验：

- `case/command/dt_type/status` 为字符串；
- `save_picture_flag` 为 `0|1`；
- `debug_flag` 存在时为整数；
- `scene_type` 存在时为字符串；
- 未知字段保留。

未知 status 200 透传。短暂 JSON 半写最多 3 次、间隔 50ms 的读取防抖可以保留；它不是业务重试。

适配服务不合成、延长或缩短业务 status。`execute success` 至少保持 3000ms 是真实后端/模拟后端责任；Node 只透传当前快照。

### 3.3 原子 patch

1. 队列内读取最新对象。
2. 调用 case-specific guard 校验当前控制和请求。
3. 合并仅允许字段。
4. 同目录 `wx` 临时文件，写完整 JSON、`fsync`、关闭。
5. 原子 rename 替换。
6. 回读并验证 patch 生效、未知字段未丢。

临时文件含 pid + nonce。启动时只清理本服务命名规则的临时文件。

### 3.4 跨 Case busy

对 Start/ReInit 请求：

- 当前 `command=init,status=""`：允许。
- 当前同 Case/同 command/同 side 且 `status="execute fail"`：允许手动同动作重试，写回新轮 `status=""`。
- 当前任一 Case `start|reinit` 且 status 为 `""`、`execute success`、`case complete` 或 `reinit complete`：拒绝 `409 CONTROL_BUSY`，直到拥有者 POST init。
- 当前其他 Case 的 `execute fail`：也拒绝跨 Case覆盖；失败所属页面应先消费并 init/切换。
- 当前 `command=start|reinit` 但 status 为未知字符串，或 case/side 不能证明是合法同动作失败重试：按 busy 失败关闭，拒绝覆盖。

「同 side」判定：

- Case3：`start|reinit` 的 side ≡ 请求/当前控制的 `dt_type`（`without dt` / `with dt`）。
- Case2：`start` 的 side ≡ `dt_type=="with dt"`；`reinit` 无侧别，失败重试只比同 Case + 同 `command=reinit`（Case2 reinit 请求体本就不带 `dt_type`）。

该 guard 同时应用于 Case2 和 Case3 控制 POST。它不改变 Case2 合法 Web 主线和成功响应 shape；只把过去可能覆盖共享控制文件的非法并发/未消费终态直接请求收紧为 `409 CONTROL_BUSY`。

POST init 永远允许，语义是撤销旧 Case/旧侧写入权。截图清零不走 Start/ReInit busy 判定，改按 §5.4 的 route ownership 规则处理。

## 4. Case3 路由与错误矩阵

### 4.1 路由

| 路由 | 实现服务 |
|---|---|
| `GET /api/case3/control-file` | shared control read |
| `POST /api/case3/control-file` | Case3 command/clear guard + shared patch |
| `GET /api/case3/init-data` | init-data |
| `GET /api/case3/side?side=<side>` | side-files；side 仅为 without 或 with |
| `POST /api/case3/screenshot` | Case3 screenshot |

每个 GET/POST 严格拒绝多余 query/body 字段。`/side` 必须恰好一个 `side` query。

### 4.2 唯一错误映射

| HTTP | code | 适用条件 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | JSON、query、精确 payload 或截图 PNG 非法。 |
| 400 | `INVALID_SIDE` | side 不是 without/with。 |
| 413 | `PAYLOAD_TOO_LARGE` | 截图请求超过 20 MiB。 |
| 404 | `DATA_FILE_MISSING` | 必需初始化/侧文件不存在。 |
| 409 | `CONTROL_BUSY` | 共享控制仍归活动/未消费命令。 |
| 409 | `RESULT_NOT_READY` | 匹配侧 Start 的 complete 最终读取仍有半点、空点、缺 Cost 或文件变化。 |
| 409 | `SCREENSHOT_NOT_REQUESTED` | 截图保存时 flag=0/上下文非法，或高电平清零时 route ownership 不匹配。 |
| 422 | `INIT_DATA_INVALID` | base route / baseline 内容非法。 |
| 422 | `SIDE_DATA_INVALID` | 已提交完整行的词法、数值、行号或跨文件字段非法。 |
| 500 | `CONTROL_READ_FAILED` | 控制文件 I/O/结构失败。 |
| 500 | `CONTROL_WRITE_FAILED` | 控制原子写或回读失败。 |
| 500 | `SIDE_CLEAR_FAILED` | Start/ReInit 前目标文件无法清空。 |
| 500 | `DATA_FILE_READ_FAILED` | 数据文件非缺失类 I/O 故障。 |
| 500 | `SCREENSHOT_SAVE_FAILED` | PNG 写入/rename/stat/清 flag 失败。 |
| 500 | `INTERNAL_ERROR` | 未分类异常。 |

失败响应不夹带业务数据。5xx 记录 error，4xx 记录 warn；控制 500ms（约 2Hz）GET 只在 case/command/status/flag 变化时记录摘要。

## 5. Case3 控制 POST

### 5.1 精确 payload

```json
{ "command": "init" }
```

```json
{ "case": "case3", "command": "start", "dt_type": "without dt" }
```

```json
{ "case": "case3", "command": "reinit", "dt_type": "with dt" }
```

```json
{ "save_picture_flag": 0 }
```

禁止请求提交 `status`、flag=1 或未知字段。

### 5.2 Init

patch 为：

```json
{
  "case": "case3",
  "command": "init",
  "dt_type": "",
  "status": "",
  "save_picture_flag": 0
}
```

- 不清数据文件；
- 保留未知字段；
- 不触发业务任务；
- 表示后端应停止旧任务写入。

### 5.3 Start/ReInit 文件清理

Without 必需清空/创建：

- `ue_comm_without_dt_coordinates.txt`
- `ue_comm_without_dt_beams.txt`
- `ue_comm_without_dt_sel_beam.txt`
- `ue_comm_without_dt_thrp.txt`
- `ue_comm_without_dt_cost.txt`

With 必需清空/创建：

- `ue_comm_with_dt_coordinates.txt`
- `ue_comm_with_dt_sel_beam.txt`
- `ue_comm_with_dt_thrp.txt`
- `ue_comm_with_dt_coordinates_reflection_point.txt`
- `ue_comm_with_dt_cost.txt`

对应 `*_mse.txt` 若存在则一并清空，但缺失不阻塞，因为契约不消费。Base route 与 BA baseline 永不清。目标侧调试 JSONL 一并清空。

全部文件操作成功后才 patch：

```text
case=case3
command=start|reinit
dt_type=without dt|with dt
status=""
save_picture_flag=0
```

任何清空失败返回 `SIDE_CLEAR_FAILED`，控制文件保持原值。

### 5.4 截图清零

`{save_picture_flag:0}`：

- 只 patch flag；
- 不改 status/command/dt_type；
- 正常由截图保存服务内部调用；
- Web 三次失败放弃也可调用，不生成 PNG、不占序号；
- 最新 flag 已为 0 时直接幂等返回当前快照，不要求 Case 上下文，避免响应丢失后的重复故障；
- 最新 flag 为 1 时，Case3 路由只允许在 `case=case3,command=start,dt_type=without dt|with dt` 下清零；
- Case2 路由对称要求 `case=case2,command=start,dt_type=with dt`；任一路由不得清另一个 Case 的高电平；
- flag=1 且 route ownership 不匹配时返回 `409 SCREENSHOT_NOT_REQUESTED`，不写控制文件。

## 6. 初始化数据服务

固定文件：

| 文件 | 输出 |
|---|---|
| `ue_comm_coordinates_base.txt` | `baseRoute[]` |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | `{success,total}` |

解析：

- LF/CRLF；完整无换行末行有效；
- route 每行恰好 `x,y,z`，至少 1 行；
- 输出 `no` 从 1 连续生成；
- 坐标有限，按 §7.3 的统一四舍五入规则保留 2 位；
- baseline 取第一个非空完整行，恰好两个十进制整数；
- `0<=success<=total` 且 `total>0`。

读取两文件前后 stat；任何文件变化重试最多 2 次。仍变化则 `DATA_FILE_READ_FAILED`，不返回部分初始化数据。

## 7. 单侧快照服务

### 7.1 文件映射

Without：

| 文件 | 字段 |
|---|---|
| coordinates | `ue` |
| beams | `scanBeamIds` |
| sel_beam | `selectedBeamId` |
| thrp | `throughputGbps` |
| cost | package `costPct` |

With：

| 文件 | 字段 |
|---|---|
| coordinates | `ue` |
| sel_beam | `selectedBeamId` |
| thrp | `throughputGbps` |
| reflection_point | `reflection` |
| cost | package `costPct` |

### 7.2 行与物理尾部

每个文件解析为：

```ts
type ParsedLines<T> = {
  complete: T[];
  hasPendingTail: boolean;
};
```

- 以 LF/CRLF 分行。
- 最后一段无换行但词法完整可解析：计入 complete。
- 最后一段无换行且明显未写完：不返回该行，`hasPendingTail=true`。
- 已有换行的非法行，或 complete 前任一非法行：`SIDE_DATA_INVALID`，不能伪装 pending。
- 空文件运行中合法，返回空数组。

### 7.3 业务数值

| 数据 | 规则 |
|---|---|
| 坐标 / reflection | 有限数，四舍五入 2 位。 |
| Throughput | 有限、非负，四舍五入 2 位。 |
| Cost | 最新非空行；有限，先四舍五入 1 位再检查 0～100；越界拒绝，禁止 clamp。 |
| selected beam | 十进制整数 0～255。 |
| scan beams | 恰好 16 个互不重复的十进制整数 0～255；必须包含 selected。 |
| reflection flag | 十进制整数 0/1；0→`los:false`，1→`los:true`。 |

数值 token 必须被完整消费并解析为有限数；接受普通小数或科学计数法，不接受 `NaN`、`Infinity`、尾随字符或部分 token。负零归一为 0。

统一四舍五入与 Case2 一致：先对绝对值进位，再恢复符号，即 `sign(x) * Math.round(abs(x) * 10^n) / 10^n`；结果为负零时归一为 0。范围检查在归一后执行。

### 7.4 对齐与 pendingTail

1. 读取 controlBefore。
2. stat 所有目标文件，读取内容，再 stat。
3. 解析所有 complete 行。
4. `K=min(各逐点文件 complete 行数)`。
5. 只组装连续点 `1..K`；`completeCount=K`。
6. 任一逐点行数不等、任一物理尾部未收齐、读取期间 stat 变化，`pendingTail=true`。
7. Cost 与点数解耦；空文件时 `costPct=null`。
8. 读取 controlAfter。

每次请求先计算：

```text
requestedDtType = side == without ? "without dt" : "with dt"
isFinalRead =
  controlAfter.case == "case3"
  && controlAfter.command == "start"
  && controlAfter.dt_type == requestedDtType
  && controlAfter.status == "case complete"
```

- `isFinalRead=false`：这是运行中或非目标侧只读快照。允许 `K=0`、`costPct=null`、`pendingTail=true`；返回当前完整前缀。读取期间变化时最多重试 2 次，仍变化则返回前缀并置 `pendingTail=true`。
- `isFinalRead=true`：若 `K=0`、任一 pending、Cost null、文件读取中仍变化，或 controlBefore/controlAfter 的 case/command/dt_type 不一致，返回 `409 RESULT_NOT_READY`；否则返回 200 最终快照。
- `/side` 不因请求 side 与当前控制目标不一致而返回 400/409；但另一个侧的 `case complete` 绝不能触发本侧最终门槛。
- 必需侧文件任何阶段缺失都返回 `404 DATA_FILE_MISSING`；非缺失类 I/O 故障返回 `DATA_FILE_READ_FAILED`。
- `RESULT_NOT_READY` 只适用于匹配侧 Start 的 complete 最终读取；ReInit 不读取 side，也不使用该错误。

### 7.5 调试 JSONL

当某侧 `completeCount` 变化：

- 将 REST `points` 每点一行 JSON；
- 不写 side、Cost 或 envelope；
- 整文件临时写 + fsync + rename 到 `out/case3/points/{side}.jsonl`；
- Start/ReInit 清目标侧；
- 写失败记日志，但不得把成功 REST 降级为业务失败；QA 证据能力不是业务真值源。

## 8. 截图服务

### 8.1 请求

只接受：

```json
{ "image_base64": "..." }
```

- 纯 Base64 或 PNG data URL；
- Base64 严格完整，解码后校验 PNG signature；
- 超 20 MiB 为 `PAYLOAD_TOO_LARGE`。

### 8.2 上下文 guard

保存前最新控制必须：

- `case="case3"`；
- `command="start"`；
- `dt_type` 为 Without/With；
- `save_picture_flag=1`。

否则 `SCREENSHOT_NOT_REQUESTED`，避免 Case2 的 flag 被 Case3 路由消费。

Case2 截图路由必须对称检查 `case=case2,command=start,dt_type=with dt,save_picture_flag=1`。不额外锁死 status，因为 PNG 保存期间允许从 `execute success` 合法推进到 `case complete`。

### 8.3 落盘

1. Case3 截图请求进入独立串行队列。
2. 目录 `out/case3/`。
3. 已完成文件匹配 `^case3-(\d+)\.png$`。
4. 无历史为 seq 0；否则最大值 +1。
5. 临时文件 `wx`、写、fsync、close、rename。
6. 已存在则重新扫描下一号，绝不覆盖。
7. 最终 stat 大小与输入一致后，经共享控制 store 清 flag；清零操作必须在共享队列内重新读取最新控制并复验 Case3 ownership，不能使用保存前旧快照清掉另一个 Case 或后续任务的新 flag。
8. 返回：

```json
{ "ok": true, "path": "out/case3/case3-000.png", "seq": 0 }
```

path 为相对共享根的 POSIX 路径；日志写绝对路径。

响应 `seq` 是未补零数字；文件名采用最小三位补零，`1000` 及以上自然扩展、不截断。

### 8.4 失败边界

- PNG 未落盘：删除临时文件，不清 flag。
- PNG 已落盘但清 flag 失败：保留 PNG，返回 `SCREENSHOT_SAVE_FAILED`；Web 可重试，极端情况允许多一张。
- 启动只清理 `.case3-*.tmp`，不删除完成 PNG，不恢复旧任务。
- 不做事务目录、SHA-256、持久去重或重启恢复。

## 9. App 组装与兼容

`createAdapterApp`：

1. 创建唯一 shared control store。
2. 将同一 store 注入 Case2 和 Case3。
3. 创建 Case2 services/router。
4. 创建 Case3 services/router。
5. 路由按 prefix 分发；都未处理才 404。
6. initialize 读取控制文件，清理 Case2/Case3 自己的截图临时文件。

日志文案从硬编码 `case2 adapter` 改为项目级 `dt adapter`，具体请求 context 带 `caseId`。Case2 合法主线的对外 API、成功 shape、数据和截图路径不变；跨 Case 冲突命令新增 `CONTROL_BUSY`，错误截图 ownership 新增 `SCREENSHOT_NOT_REQUESTED`，属于用户批准的安全收紧。

## 10. 测试计划

### 10.1 shared / 回归

- Case2/Case3 并发 patch 进入同一队列，未知字段无丢失。
- 原子写失败、回读失败和残留临时清理。
- `DT_*` 主变量优先、`CASE2_*` fallback、非法端口和共享根快速失败。
- 全部现有 Case2 测试不删不降级。

### 10.2 控制

- 四种精确 payload；多余字段/flag=1/status 被拒。
- Start/ReInit 先清全部目标文件，再写空 status/flag0。
- 某一清空失败时控制未写。
- base/baseline 不清，MSE 缺失不阻塞。
- 同动作 `execute fail` 重试允许；活动/未消费终态与跨 Case 命令 `CONTROL_BUSY`。
- 未知活动 status 失败关闭；Case2 合法主线不受影响，直接冲突请求返回 busy。
- init 撤权且不清数据；截图清零不改 status；flag0 幂等，flag1 按 route ownership 清零。

### 10.3 init-data / side

- CRLF、无换行完整末行、空文件、缺文件。
- 坐标、Throughput、Cost、beam、scan、reflection、baseline 的有效/非法边界和四舍五入。
- scan 16 项互异；Cost 归一后越界 422 且不 clamp；正负半值进位与负零归一。
- 0/1 Reflection 映射。
- 多文件等长、不同长、半行、提交非法行、文件读取中变化。
- running/非目标侧返回完整前缀 + pending；只有匹配侧 Start complete 时 pending/空点/null Cost/漂移返回 RESULT_NOT_READY。
- 运行中/complete 必需文件缺失均为 DATA_FILE_MISSING；ReInit 不触发 RESULT_NOT_READY。
- `completeCount===points.length`，全量快照不 append。
- JSONL 只写完整点且目录隔离。

### 10.4 截图

- 纯 Base64/data URL、PNG signature、20 MiB。
- Case3 control guard，Case2 flag 不能被误消费。
- Case2 对称 guard，Case3 flag 不能被误消费；PNG 落盘后清零前重新校验最新 ownership。
- seq 从 000、递增、不覆盖、1000 不截断。
- 成功落盘后清零但不改 status。
- 写失败不清零；落盘后清零失败保留 PNG。
- 放弃清零不生成 PNG、不占序号。

### 10.5 HTTP

逐项覆盖 §4.2 错误码和 exact shape；检查 `Content-Type`、`Cache-Control`、未知路由 404。控制 500ms 轮询日志降噪按 Case 区分。

## 11. 联调与验收

- 临时共享目录，不写 `01-参考资料/`，不覆盖 tracked Case2 样本。
- 新增 `code/scripts/e2e-case3-stack.sh`：准备 temp shared root、启动 Node + Web + Case3 stub、跑 Case3 Playwright、Ctrl+C/退出清理子进程。
- `dev-web-server.*` 仍只启动 Web + Node，不默认启动任何 stub；提示 `code/back` 独立启动。
- 验收命令：

```text
code/server: npm test
code/back: npm test
code/web: npm test
code/web: npm run typecheck
code/web: npm run build
code/web: npm run test:e2e
```

## 12. 明确不做

- 不在适配服务推进业务 status 或生成 Case3 业务结果。
- 不为 Case3 新开端口/进程。
- 不实现 WebSocket、SSE、数据库、租约、manifest、batch_id、command_id。
- 不读 JSONL 作为后端输入。
- 不把 Case3 输出写入 `case2/` 或 `out/case2/`。
- 不修改 Case2 合法 REST 主线、成功 shape 或业务状态机；`CONTROL_BUSY` 与截图 ownership 仅收紧非法跨 Case/直接请求。

## 13. Gate 3 已批准的 Node 决策

- [x] 用户于 2026-08-10 批准同一 Node 进程共享一个控制 store 和串行队列。
- [x] 用户于 2026-08-10 批准 `DT_ADAPTER_HOST/PORT` 为主变量、旧 `CASE2_*` 为 fallback。
- [x] 用户于 2026-08-10 批准 Case3 截图输出 `out/case3/case3-{seq}.png`。
