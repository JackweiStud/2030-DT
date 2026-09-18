# case4 Node 文件适配服务施工规格

> status: `已实现 — 2026-09-16 用户确认 2D 功能及本地自测完成，待真实后端联调`
>
> 使用者：前端 PC Node 适配服务实现 agent。
>
> 本文扩展现有 `code/server/` **单进程**，不创建第二个适配服务、不新开端口。业务语义以 [API-CONTRACT.md](API-CONTRACT.md) 为唯一真相源；成功/失败 JSON 字段逐项以契约为准，本文不复制 canonical 响应体。模拟后端见 [realback_no.md](realback_no.md)。
>
> case3-v2 **没有**独立 Node 文件服务。应对齐现行 `code/server` 的 case3 路由、共享 control store、截图原语与 `app.mjs` 接线，只换 case4 文件语义。
>
> 开工前必读：`state.md`、契约 §2～§10、本文、以及 `code/server/src/app.mjs`、`shared/control-file-store.mjs`、`shared/png-screenshot.mjs`、`cases/case3/control-file.mjs`、`cases/case3/side-files.mjs`。

实现及验收证据见 [QA-EVIDENCE.md](QA-EVIDENCE.md)。下列清单保留为施工核对项，本次文档收尾不将其批量勾选为独立复测通过。

## 0. 出口条件

- [ ] 同一 `127.0.0.1:3102` 进程同时注册 `/api/case2/*`、`/api/case3/*`、`/api/case4/*`。
- [ ] 仍只有一个 shared control store 和一条控制写队列；case2/case3 合法请求语义、成功 shape、数据路径不变。
- [ ] Start/ReInit：同一队列内 `guard → 清九文件 → 再 guard → patch`；清理失败返回 `DATA_CLEAR_FAILED`，不写命令。
- [ ] `GET /trajectory`、`GET /throughput` 无 complete 门槛；`GET /result` 才做最终门槛。
- [ ] 65535 在四舍五入前判定；坐标/吞吐 2 位；CDF/CEP/NLOS 保留解析精度。
- [ ] 截图输出 `out/case4/case4-000.png`；ownership 与 case2/case3 对称隔离。
- [ ] 调试 JSONL 镜像 `/trajectory` 与最终 `/result` 的 `points`（含可选 reflection）到 `out/case4/points/trajectory.jsonl`；内容指纹变更才覆盖；最终快照封印后 live 不得覆盖；Web 不回读；写/清失败不得挡住 REST 或开轮。
- [ ] `npm test` 脚本纳入 `test/case4/*.test.mjs`，且 shared/case2/case3 回归仍过。
- [ ] 结构化日志带 `caseId`；控制 GET 降噪覆盖 case4；不打印 Base64。

## 1. 架构与目录

### 1.1 技术选择

沿用现网：Node `>=20`、ESM、`node:http`、`node:test`。JSON UTF-8、`Cache-Control: no-store`、请求体上限 `20 MiB`（`shared/http.mjs`）。不增加 Express / Socket / 数据库 / 第二套锁。

### 1.2 目标目录

```text
code/server/src/cases/case4/
├── constants.mjs
├── numeric-file.mjs      # 自建解析；禁止 import case2/case3 解析器
├── init-data.mjs
├── trajectory.mjs
├── throughput.mjs
├── result.mjs
├── control-file.mjs
├── screenshot.mjs        # 薄封装 png-screenshot.mjs
├── debug-jsonl.mjs       # 对照 case3 debug-jsonl.mjs，仅一份 trajectory
└── routes.mjs

code/server/test/case4/*.test.mjs
```

只对共享模块做 **最小扩展**：

| 文件 | 允许的改动 |
|---|---|
| `shared/control-file-store.mjs` | `assertScreenshotOwnership` 为 case4 增加显式分支；注释改为 Case2/3/4。busy 判定可沿用现逻辑 |
| `src/app.mjs` | 注入 case4 services/router；handler 分发；控制 GET 降噪路径；initialize 清 case4 临时截图 |
| `package.json` | `test` 脚本追加 `test/case4/*.test.mjs` |

禁止把 case4 文件名、65535、CDF 解析放进 `src/shared/`。禁止改 case2/case3 合法 REST 主线。

### 1.3 运行时目录

```text
{DT_SHARED_DIR}/
├── case_control.json
├── case2/
├── case3/
├── case4/
│   ├── ue_position_coordinates_base.txt          # 不清
│   └── <九个动态文件，见 §5.3>
└── out/
    ├── case2/
    ├── case3/
    └── case4/
        ├── case4-000.png
        └── points/
            └── trajectory.jsonl    # 调试镜像，非业务真值
```

配置沿用现有 `DT_SHARED_DIR` / `DT_ADAPTER_HOST` / `DT_ADAPTER_PORT` 及 `CASE2_*` fallback。不新增 case4 专用端口或共享根变量。`npm start` / `npm run dev` 仍是 `scripts/run.mjs`。

## 2. 共享原语：必须改对的三处

### 2.1 `assertScreenshotOwnership`

现行 else 把「非 case2」当成 case3（`without dt | with dt`）。必须改成显式表，禁止再靠 else：

| caseId | 允许的高电平上下文 |
|---|---|
| `case2` | `command=start` 且 `dt_type="with dt"` |
| `case3` | `command=start` 且 `dt_type` 为 `"without dt"` 或 `"with dt"` |
| `case4` | `command=start` 且 `dt_type="all"` |
| 其他 | 一律 `SCREENSHOT_NOT_REQUESTED` |

仍要求 `control.case === caseId` 且 `save_picture_flag === 1`。不锁死 `status`（允许 success→complete）。

`assertCommandAvailable` 对 case4 无需新特殊分支：start/reinit 请求都带 `dtType="all"`；case2 `reinit` 的「不比 dt_type」例外保持不动。补测试：case4 `execute fail` 同动作重试可通过；其他 Case 活动/完成命令返回 `CONTROL_BUSY`。

### 2.2 `createAdapterApp`

1. 同一 `controlStore` 注入 case2、case3、case4。
2. handler：`routeCase2` → 未处理则 `routeCase3` → 未处理则 `routeCase4` → 仍未处理 `404 NOT_FOUND`。
3. 每个 case4 成功路由的 `access.caseId` 必须是 `"case4"`。
4. `createControlGetSampler` 的静默 GET 路径增加 `/api/case4/control-file`。
5. 无 `access.caseId` 时 **禁止**再把所有非 case3 路径默认成 case2；按 pathname 前缀判断 `case2|case3|case4`。
6. `initialize()`：`Promise.all` 增加 `case4Screenshot.cleanupTemporaryFiles()`。

### 2.3 测试发现

`package.json` 的 `test` 目前写死 case2/case3 glob。必须追加 `test/case4/*.test.mjs`，否则新测试不会跑。

## 3. 路由与错误矩阵

`CASE4_API_PREFIX = "/api/case4"`。

| 方法 | 路径 | 服务 | Query |
|---|---|---|---|
| GET | `/control-file` | shared read | 禁止任何 query |
| POST | `/control-file` | case4 control | 禁止 query；body 见 §5 |
| GET | `/init-data` | init-data | 禁止 query |
| GET | `/trajectory` | trajectory | 禁止 query |
| GET | `/throughput` | throughput | **恰好一个** `side=without\|with` |
| GET | `/result` | result | 禁止 query |
| POST | `/screenshot` | screenshot | 禁止 query；body 仅 `image_base64` |

吞吐：缺 `side`、非法值、或多个 query → `400 INVALID_SIDE`（不要用 `INVALID_REQUEST`）。其他接口出现 query → `400 INVALID_REQUEST`。

失败响应不夹带可消费业务数据。HTTP/code 以契约 §10 为准：

| HTTP | code | Node 适用 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | 非法 JSON/body/多余字段/非法 PNG |
| 400 | `INVALID_SIDE` | 吞吐 query 不合规 |
| 409 | `CONTROL_BUSY` | 共享 busy guard |
| 409 | `RESULT_NOT_READY` | **仅** `/result`：上下文不匹配、pending、空轨迹、三路不同长、stat/control 漂移 |
| 409 | `SCREENSHOT_NOT_REQUESTED` | flag/归属不符 |
| 404 | `DATA_FILE_MISSING` | 该次读取的必需文件缺失 |
| 413 | `PAYLOAD_TOO_LARGE` | 体超过 20 MiB |
| 422 | `INIT_DATA_INVALID` | base 非法或含 65535 |
| 422 | `TRAJECTORY_DATA_INVALID` | 轨迹完整行/超 base 非法 |
| 422 | `THROUGHPUT_DATA_INVALID` | 吞吐完整行非法 |
| 422 | `STATISTICS_DATA_INVALID` | CDF/CEP/NLOS 非法 |
| 500 | `CONTROL_READ_FAILED` / `CONTROL_WRITE_FAILED` | 控制 I/O 或 shape（含可选字段类型） |
| 500 | `DATA_CLEAR_FAILED` | 九文件清理失败；**不要**用 case3 的 `SIDE_CLEAR_FAILED` |
| 500 | `DATA_FILE_READ_FAILED` | 非缺失类读失败 |
| 500 | `SCREENSHOT_SAVE_FAILED` / `INTERNAL_ERROR` | 截图或其他内部异常 |

`/trajectory` 与 `/throughput` **不得**在 control 非 complete 时返回 `RESULT_NOT_READY`。ReInit 不走 `/result`。

4xx 打 `logger.warn`，5xx 打 `logger.error`。请求摘要沿用 `dt adapter request`，context 含 `caseId, method, path, statusCode, durationMs`，失败加 `code`。

## 4. 日志

| 事件 | level | 要点 |
|---|---|---|
| `dt adapter request` | info/warn/error | 见现 `app.mjs`；case4 控制成功 GET 仅在 `status` 或 `save_picture_flag` 变化时记 |
| `control file updated` | info | store 已有；`caseId: "case4"` |
| `case4 screenshot request accepted` | info | 只记 `bytes`，禁止 Base64 |
| `case4 screenshot saved` | info | 绝对路径 + `seq` + `bytes` |
| `case4 screenshot request cleared by Web after finite retries` | warn | code `SCREENSHOT_DROPPED_AFTER_RETRIES` |
| `case4 invalid coordinate substituted` | warn | `filename, scheme, no, component, original, substitute, source`；进程内按这些字段去重，重复轮询不刷屏 |
| `case4 trajectory snapshot read` | info | `completeCount, pendingTail` |
| `case4 throughput snapshot read` | info | `side, sampleCount, pendingTail` |
| `case4 result snapshot read` | info | `completeCount, thrpWithout, thrpWith, final: true` |
| `case4 debug JSONL write failed` | warn | `reason`；不得把 REST 改成失败 |
| 控制/数据 5xx | error | `code, reason`；不要 dump 文件全文 |

去重只为日志，不缓存业务结果、不改变 JSON。

## 5. 控制 POST

### 5.1 精确 payload

只接受契约四种 shape，额外字段/`status`/`flag=1` 一律 `INVALID_REQUEST`。

```json
{ "command": "init" }
```
```json
{ "case": "case4", "command": "start", "dt_type": "all" }
```
```json
{ "case": "case4", "command": "reinit", "dt_type": "all" }
```
```json
{ "save_picture_flag": 0 }
```

实现对照 `cases/case3/control-file.mjs` 的 `exactKeys` + `store.update({ guard, beforeWrite })`。

### 5.2 Init

patch：`case=case4, command=init, dt_type="", status="", save_picture_flag=0`。

- **不清**任何数据文件。
- 始终允许（撤权）；不跑 busy guard。
- 保留未知字段。

### 5.3 Start/ReInit 清理（同一队列）

```text
queue.run:
  read control
  assertCommandAvailable({ caseId:"case4", command, dtType:"all" })
  mkdir case4/
  白名单 9 文件 writeFile("")（缺失则创建）
  任一失败 → DATA_CLEAR_FAILED，不 patch
  再 read + 再 guard
  patch { case:"case4", command, dt_type:"all", status:"", save_picture_flag:0 }
  原子写 + 回读校验
```

白名单（相对 `case4/`），**仅这 9 个**：

1. `ue_position_without_dt_coordinates_realtime.txt`
2. `ue_position_gaode_coordinates_realtime.txt`
3. `ue_position_with_dt_coordinates_realtime.txt`
4. `ue_position_without_dt_thrp.txt`
5. `ue_position_with_dt_thrp.txt`
6. `ue_position_without_dt_coordinates_realtime_cdf.txt`
7. `ue_position_gaode_coordinates_realtime_cdf.txt`
8. `ue_position_with_dt_coordinates_realtime_cdf.txt`
9. `ue_position_with_dt_error_and_nlos.txt`

禁止清：`ue_position_coordinates_base.txt`、截图 PNG、其他 Case、参考资料。禁止 `rm -r` 共享根。已清部分不回填；下次重试重新清全表。反射文件为第 10 个**可选**清理目标：存在则清空，ENOENT 忽略；其他失败仍 `DATA_CLEAR_FAILED`。不要把反射加入最终九文件门槛。

调试 JSONL（§8.5）在开轮成功后另清，**不得**放进这 9 文件白名单，也不得因 JSONL 失败返回 `DATA_CLEAR_FAILED`（case3 曾因 `out/case3/points` 清失败挡住 Start）。

### 5.4 截图清零

`{save_picture_flag:0}`：只 patch flag。flag 已为 0 幂等成功、不要求归属。flag 为 1 时必须 `case4/start/all`，否则 `SCREENSHOT_NOT_REQUESTED`。清零走 store 的 `rereadBeforeWrite` + `FLAG_CLEAR_CONFLICT_ATTEMPTS`（与 case3 截图保存后清零相同）。Web 放弃清零打 §4 的 warn 日志。

可选 `debug_flag` / `scene_type` **遵循现有 store 校验**（`debug_flag` 必须是 integer，不是任意 number）。

## 6. 解析与 65535

放在 `numeric-file.mjs`。可 **复制** case3 `roundSemanticNumber` 实现（含 `Number.EPSILON`），不要第三套公式。禁止调用 `cases/case3/numeric-line.mjs` 或 case2 `numeric-file.mjs`（case2 拒绝科学计数；case3 坐标解析会先 round）。

### 6.1 词法

- UTF-8（fatal）、允许 BOM、LF/CRLF、行首尾空白、文件尾空白。
- 完整 token：`^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$`，再 `Number` 必须有限；拒绝 NaN/Infinity/空字段/半数字/`parseFloat` 垃圾后缀。
- 记录间空行 = 格式错误，不删空行重编号。
- 物理尾行：无换行但字段完整合法 → 计入 complete；无换行且不完整 → `hasPendingTail`；已换行的非法行 → 对应 422，不能装成 pending。
- base：3 个逗号字段；实时坐标：3 个逗号或空白字段，兼容单行 `65535`，展开为 XYZ 三个哨兵后按 §6.3 归一。
- 吞吐：单字段。
- CDF / CEP 汇总：2 列；**同一文件**内空白或逗号二选一，按首条非空记录检测，其后混用 → 非法。

错误码按文件用途抛：base→`INIT_DATA_INVALID`，实时 xyz→`TRAJECTORY_DATA_INVALID`，thrp→`THROUGHPUT_DATA_INVALID`，cdf/汇总→`STATISTICS_DATA_INVALID`。

### 6.2 进 JSON 精度

| 字段 | 规则 |
|---|---|
| `x,y,z` / `gbps` | 先范围/哨兵，再 `roundSemanticNumber(v, 2)`；JSON 是 number，不补尾零字符串 |
| `errorM` / `probability` / `p50M` / `p90M` / `nlosRatio` | **不 round** |
| 吞吐 / CDF 误差 | 原始值不得为负；禁止靠 round 把 `-0.004` 变成 0 后通过 |
| `probability` / `nlosRatio` | `[0,1]` 比例，拒绝 `89.7` 当百分数 |
| CDF | 每方案 ≥1 点；两列各自非递减（允许重复）；不强制首 0 / 末 1；不因 `errorM>10` 拒绝 |
| CEP | 非负；`p50M ≤ p90M`；不检查三方案排序 |
| 汇总第 4 行第 2 列 | 有限数即可，不进 REST |

### 6.3 65535

对坐标每个分量，在 round **之前** 用原始有限数 `=== 65535`（含 `65535.0`、`6.5535e4`）。**不要**先 round 再比：`65534.996` round 到 2 位会变成 65535，不是哨兵。

按方案、按分量、按行号 1..n 顺序：

1. 该分量是哨兵：用同方案上一完整点 **已归一** 的对应分量。
2. P1 无前点：用 **当前这次读取的磁盘 base** 同行（P1）已 round 的对应分量。
3. 其余分量保持原值后 round。
4. 连续哨兵递推已修复值，禁止把 65535 再传下去。
5. base 自身出现哨兵 → 整个 `INIT_DATA_INVALID`，不编造。
6. 不回写原始文件。

`/trajectory` 与 `/result` 必须走同一函数。每次读取都重新读磁盘 base，Node 不保存 Web 某次 init 会话。

## 7. 稳定读取

与 case3 `init-data.mjs` / `side-files.mjs` 相同节奏：`for (attempt = 1; attempt <= 3; attempt++)`，即 **首次 + 变化再读最多 2 次**。不要理解成「重试 3 次共 4 次」。

每次尝试：

1. `controlBefore`（init-data 不读 control，但仍要文件前后 stat）。
2. `stat({ bigint:true })` → read bytes → 再 stat。
3. snapshot 键：`size` + `mtimeNs`（与 case3 `snapshot()` 相同）。
4. 有变化且 `attempt < 3` → continue。
5. 按接口处理第 3 次仍变化（见下表），然后才解析。

| 接口 | 第 3 次前后 stat 仍变化 |
|---|---|
| `GET /init-data` | `500 DATA_FILE_READ_FAILED`（与 case3 初始化一致：`"init files changed while being read"`）；**不解析、不返回部分** `baseRoute`。预期轨迹必须稳定。 |
| `GET /trajectory`、`GET /throughput` | 解析当前完整前缀，`pendingTail=true`，**仍 200**（无完整行非法时） |
| `GET /result` | `409 RESULT_NOT_READY`；不返回部分结果 |

ENOENT → `DATA_FILE_MISSING`。其他读失败 → `DATA_FILE_READ_FAILED`。

## 8. 三类读取

### 8.1 GET init-data

只读 `ue_position_coordinates_base.txt`。至少 1 行；`no` 从 1 连续；坐标有限且无哨兵；失败不返回部分。空实时文件与 base 无关，不得把实时当初始结果。

稳定读按 §7：连续三次仍变化则 `DATA_FILE_READ_FAILED`，Web 保持初始化失败、禁止开始，不得把不稳定 base 当本轮预期轨迹。

### 8.2 GET trajectory（live）

读当前磁盘 base + 三路 realtime。组装：

- 三路 complete 行数取 `K = min`；返回 `points[0..K-1]`，`completeCount === K`。
- 行数不等、物理 pending、或第 3 次仍 stat 变化 → `pendingTail=true`，**仍 200**（只要没有完整行非法）。
- `K=0` 允许空数组。
- 任一完整行非法 → 422，不跳行。
- 任一路 complete 行数 **> base 行数** → `TRAJECTORY_DATA_INVALID`，禁止截短。
- 缺任一必需文件 → 404。
- **不**看 control 是否 complete；**不**返回 `RESULT_NOT_READY`。

方案文件映射：`without_dt` → `traditional`，`gaode` → `commercial`，`with_dt` → `dt`。

200 成功组装后调用 §8.5 `writeIfChanged(points)`。

### 8.3 GET throughput（live）

每次只读一路文件。`no` 从 1。两路不比较、不读轨迹。空文件 `samples=[]`。pending/变化规则同 live。完整行非法 422。缺文件 404。无 complete 门槛。

### 8.4 GET result（final）

一次请求读取：**base + 九个动态文件**（10 个）。

成功前提（否则对应错误，且 **不** 返回部分 `trajectory/throughput/statistics`）：

```text
controlBefore 与 controlAfter 均为
  case=case4 AND command=start AND dt_type="all" AND status="case complete"
且 case/command/dt_type/status 窗口内不变
且 10 个文件 stat 窗口内不变（第 3 次仍变 → RESULT_NOT_READY）
```

门槛：

- 三路轨迹同长、`K>0`、无 pending、`K ≤ base.length`；30/30/31 → `RESULT_NOT_READY` 或非法（不同长走 409；超 base 走 422）。
- 轨迹值走 §6.3。
- 两路吞吐可空、可不等长，但无 pending、无非法行。
- 三 CDF + 汇总全部合法；CDF 每方案至少 1 点。
- 上下文不匹配、pending、空轨迹、漂移 → `409 RESULT_NOT_READY`。
- 缺文件保持 404，内容非法保持 422。

Node 内部 3 次重读 **不** 计入 Web 的 10 次。成功返回前同样 `writeIfChanged(trajectory.points)`，便于对照最终收齐结果。

### 8.5 调试 JSONL（给人看，不是接口）

对照 `code/server/src/cases/case3/debug-jsonl.mjs`。Web **不回读**；不是 REST 字段；不能当完成证明。用途：打开一个文件就能看到 Node 实际收齐并做完 65535 归一的三方案点，不必自己对三份不等长 txt。

路径：`{DT_SHARED_DIR}/out/case4/points/trajectory.jsonl`

每行与 GET `/trajectory` 的一个 `points[]` 元素相同，不含吞吐、CDF、CEP、envelope：

```json
{"no":1,"traditional":{"x":1.15,"y":15,"z":0.94},"commercial":{"x":1.1,"y":15,"z":0.94},"dt":{"x":1.05,"y":15,"z":0.94}}
```

规则：

1. 文件是完整快照原子覆盖。变更判断用坐标+反射内容指纹，不只比较点数；同点数反射变化也要覆盖。
2. `/result` 成功后强制写出并封印；之后 live 写入忽略，避免晚到 live 覆盖最终尾点。Start/ReInit 成功 `clear()` 解除封印。
3. 仅在 `/trajectory` 或 `/result` **HTTP 200** 之后写；422/404/409 不改旧文件。
4. Start/ReInit 控制 patch **成功之后** 再 `clear()` 成空文件；与九文件清理解耦。
5. `clear` / `writeIfChanged` 失败只 `logger.warn("case4 debug JSONL write failed", { reason })`，**必须仍返回成功 REST / 成功开轮**。
6. 开启反射时行内附加 `reflection`；关闭时保持原三方案字段。不要 without/with 两份，不要把吞吐绑进同一行，不要写进 `out/case3/`。

## 9. 截图

`screenshot.mjs` 只包装：

```js
createPngScreenshotService({
  caseId: "case4",
  filenamePrefix: "case4",
  outputSegments: ["out", "case4"],
  controlFile, // 必须暴露 assertScreenshotOwnership + clearPictureFlag
})
```

行为全部复用现网原语：PNG signature、20 MiB、独立串行队列、`case4-(\d+)\.png`、seq 从 0、三位补零、`wx` 临时文件、fsync、rename、stat 后经共享队列清 flag。响应 `path` 为 POSIX 相对共享根（`out/case4/case4-000.png`），`seq` 为未补零数字。日志写绝对路径。

失败边界与 case3 §8.4 相同：未落盘删临时不清 flag；已落盘清 flag 失败保留 PNG 并 `SCREENSHOT_SAVE_FAILED`。启动只清 `.case4-*.tmp`。

## 10. 测试矩阵

必须真实被 `npm test` 跑到。用临时共享根，不改 `01-参考资料/case4/data/`，不碰用户联调目录。

**控制与 busy**

- 四种精确 shape；多余字段 / flag=1 / 错 dt_type 拒绝。
- 队列内先 guard 再清九文件；清理失败控制未写。
- 不在白名单的 base/反射仍在。
- 跨 Case busy；case4 同动作 `execute fail` 可重试；init 撤权。
- 未知字段保留；`debug_flag` 非整数读失败。

**解析**

- BOM、CRLF、科学计数、无换行完整末行、半行 pending、内部空行、额外列、NaN/Infinity、CDF 逗号/空白、同一文件混用分隔符。
- 坐标/吞吐 2 位 number；CDF 首点 `5.71e-05` JSON 不能变成 0。
- 负吞吐（含 round 后可能为 0 的负小数）拒绝。

**轨迹 / 吞吐 / 最终**

- 5/3/4 → 3 点 + pending。
- 65535：P1 用 base、连续、单分量、仅 Z；base 含哨兵初始化失败。
- 实时超 base → 422。
- 两路吞吐独立、空、不等长。
- `/result`：38 base / 30 同长通过；30/30/31 拒绝；K=0 拒绝；两路空吞吐通过；缺 CDF 404；半行 409 或 422（按是否已换行）。
- CDF 非单调拒绝；末概率 0.99 允许；control/stat 漂移 409。
- live 接口在 `status=""` 时仍 200（空或前缀），不 409。
- **init-data：读期间连续三次 stat 仍变化 → 500 `DATA_FILE_READ_FAILED`，响应无 `baseRoute`。**
- JSONL：`completeCount` 从 0→3 写出 3 行且含归一后坐标；未变化不重写；start 成功后文件被清空；注入写失败时 `/trajectory` 仍 200、start 仍写入控制。

**截图与回归**

- case4 ownership；case2/case3 不能消费 case4 的 flag=1，反之亦然。
- seq 不覆盖；放弃清零幂等。
- 现有 case2/case3 测试全绿。

## 11. 联调与验收（适配服务视角）

- 临时共享根；`npm start` 可 Ctrl+C。
- 不预填 QA 通过；三进程主线记入后续 `QA-EVIDENCE.md`。
- 本 SPEC 交付：case4 模块、共享最小补丁、测试、`package.json` glob、`app.mjs` 接线。
- Playwright / 打桩节奏不在本文实现范围。

命令：

```text
cd code/server && npm test
```

## 12. 明确不做

- 不写业务 `status`，不置 `save_picture_flag=1`。
- 不新开端口/进程/控制队列。
- 不实现 WebSocket、SSE、manifest、batch_id。
- 反射文件按 [REFLECTION-SPEC.md](REFLECTION-SPEC.md) 可选读取与开轮清理；调试 JSONL 按 §8.5 镜像轨迹 `points`（可含 reflection）；不把 JSONL 当业务真值，Web 不回读。
- 不把 case4 输出写进 `case2/`、`case3/`、`out/case2/`、`out/case3/`。
- 不修改 case2/case3 成功 shape 或合法主线。
- 不把参考资料当运行目录，不在测试里改原始样本。
- 不算 XYZ 误差、不投影地图（Web 的事）。
- 不把内部 3 次稳定重读计进 Web 的 10 次最终失败。
