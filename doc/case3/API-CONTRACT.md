# case3 Gate 2 API 契约 v1

> status: `APPROVED`
>
> approved_at: `2026-08-10`
>
> amended_at: `2026-08-13`（Without `scanBeamIds` 改为至少 1 个 `[0,255]` 整数，允许重复；开销变化改为有 DT 相对无 DT；点位不对齐显示 NA 且不计入 Beam Accuracy）
>
> 本文已由用户确认冻结，是 `DT for Comm`（case3）前端、Node 本地适配服务与真实后端共享文件交互的唯一语义真相源。后续行为变更必须先修改本文并重新评审，再修改 SPEC 或代码。

## 0. 接口总表

case3 不使用 WebSocket。Web 只调用前端 PC 上的 Node 本地适配服务；真实后端只读写共享目录和 `case_control.json`。


| 接口                                  | 方法   | 请求              | 成功响应                                                             | 触发时机                                                     | 用途                                  |
| ----------------------------------- | ---- | --------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `/api/case3/control-file`           | GET  | 无 query/body    | `{ ok:true, control }`                                           | 进页；运行/重置中每 500ms                                         | 读取控制快照。                             |
| `/api/case3/control-file`           | POST | 四种精确请求体之一       | `{ ok:true, control }`                                           | init/start/reinit/截图放弃清零                            | 由 Node 串行执行文件清理和控制写入。               |
| `/api/case3/init-data`              | GET  | 无 query/body    | `{ ok:true, baseRoute, beamAccuracyBaseline }`                   | init 写回成功后                                               | 读取预置路线和 Beam Accuracy 基线；不返回地图 URL。 |
| `/api/case3/side?side=<side>` | GET  | 唯一 query `side=without` 或 `side=with` | `{ ok:true, side, points, completeCount, pendingTail, costPct }` | 该侧已见 `execute success` 后每 500ms；`case complete` 后再做最终读取 | 返回单侧完整点全量快照和侧级 Cost。                |
| `/api/case3/throughput?side=<side>` | GET | 唯一 query `side=without` 或 `side=with` | `{ ok:true, side, samples, pendingTail }` | 与 `/side` 同阶段独立轮询；`case complete` 后终态再读一次 | 只读该侧 thrp 文件；不等待坐标/波束/reflection。 |
| `/api/case3/screenshot`             | POST | `{ image_base64 }` | `{ ok:true, path, seq }`                                         | Start 等待态观察到 `save_picture_flag` 0→1                 | 原子保存 Case3 Stage 截图，成功后清零。             |


控制状态：`""`、`execute success`、`execute fail`、`case complete`、`reinit complete`。

关键约束：

1. Node 是浏览器侧唯一共享文件 I/O 和数值语义校验方；Web 不直接访问共享目录。
2. Start/ReInit 必须先清目标侧实时文件，再写 `start|reinit + dt_type + status=""`。
3. `init` 是空闲态和旧轮写入权撤销信号；后端观察到 `command=init` 后必须停止旧 Case/旧侧继续写文件。
4. 后端必须让 `execute success` 保持至少 3000ms，保证 500ms 轮询可观察。
5. 后端完整写完并关闭该侧全部必需文件和 Cost 后，最后才写 `case complete`，其后不得再写本轮数据。
6. Web 只有通过最终快照门槛、完成渲染且截图任务已保存或三次失败后放弃清零，才能 POST `init`；不能在 `case complete` 边沿立即清终态。
7. 任一 Case 处于 Start/ReInit 等待态时，Shell 锁定其他 Case Tab；不增加取消按钮、命令队列或自动业务超时。
8. Case3 截图与 Case2 同构：后端只在 Start 路径 success→complete 窗口置 `save_picture_flag=1`，Web 最多尝试 3 次，Node 原子落盘并清零；ReInit 不截图。



## 1. 边界与运行配置



### 1.1 责任边界


| 层           | 负责                                                         | 不负责                             |
| ----------- | ---------------------------------------------------------- | ------------------------------- |
| Shell       | 四 Tab、1920×1080 缩放、公共 token、现场环境弹窗、跨 Case 导航锁              | case3 点位/KPI、控制轮询、文件清理          |
| case3 Web   | 用户动作、可见状态、按钮互斥、最终快照门槛、地图/波束/KPI 展示、派生 KPI、Stage 截图与有限重试、REST 响应 shape 防御 | 共享文件 I/O、数值四舍五入、业务范围和多 txt 行号校验 |
| Node 本地适配服务 | 唯一浏览器侧文件 I/O、控制读写、单侧文件清理、多 txt 收编、截图原子落盘/清零、权威数值校验/归一、错误日志       | 通信算法、业务终态伪造、真实采集                |
| 真实后端        | 监听控制文件、停止旧轮写入、执行 Without/With、append 多 txt、按时序写 `status`，Start 路径按窗口置截图 flag | REST、浏览器 UI、历史文件清理、派生 KPI       |


Web 仍必须在 REST 信任边界检查响应是否为对象、必填字段和 JSON 类型是否正确。Web 不重复 Node 的小数归一、范围、行号和跨文件一致性校验；若响应 shape 非法，记 `CASE3_INVALID_RESPONSE`，不更新业务数据。

### 1.2 目录与资源

- 共享根：`DT_SHARED_DIR`。旧 `CASE2_SHARED_DIR` 只作为兼容 fallback。
- case3 数据目录：`{DT_SHARED_DIR}/case3/`。
- case3 截图目录：`{DT_SHARED_DIR}/out/case3/`。
- `01-参考资料/case3/data/c3/` 只用于格式说明，不是运行路径。
- 地图图片由正式 Web 从 `04-runtime-assets/case3/` 加载；`GET /init-data` 不返回文件路径或地图 URL。
- 正式后端继续使用多 txt append 协议；不得反向要求 JSONL、manifest、batch_id 或原子目录切换。



## 2. 状态、权属与合法动作



### 2.1 状态权属


| 数据/状态                  | 权威源             | Web 可派生 | 说明                               |
| ---------------------- | --------------- | ------- | -------------------------------- |
| `case/command/dt_type` | Web 经 Node 写入   | 否       | 只通过 POST control-file。           |
| `status` 业务字面值         | 真实后端            | 否       | Node 只在开轮和 init 时清 `""`，不伪造业务终态。 |
| 完整点与 Cost              | 多 txt，经 Node 校验 | 否       | Web 只消费成功快照。                     |
| 当前动作、目标侧、是否见过 success  | Web 本地          | 是       | 不写回控制文件。                         |
| 单侧结果是否有效/是否配对          | Web 本地          | 是       | 刷新后全部丢弃。                         |
| 相对开销变化                 | Web             | 是       | 基于双方 `costPct`。                  |
| Beam Accuracy 增量       | Web             | 是       | 按相同 `no` 的 `selectedBeamId` 对比。  |
| `save_picture_flag=1`  | 真实后端            | 否       | 仅 Start success→complete 窗口；允许与 complete 同拍。 |
| 截图 PNG 与 flag 清零       | Node             | 否       | Web 只提交 Base64；Node 原子落盘后清零。      |
| 地图、图标、背景               | Web 运行资源        | 否       | 不来自共享目录 REST。                    |




### 2.2 状态流程

```text
mount / refresh / return
  -> GET control
  -> POST init
  -> GET init-data
  -> initial

initial
  -> Start Without
  -> without-running
  -> execute success (>=3000ms)
  -> case complete
  -> final GET side(without) passes
  -> render without-completed
  -> screenshot saved / abandoned after 3 attempts (or no request)
  -> POST init

without-completed
  -> Start With
  -> with-running
  -> execute success (>=3000ms)
  -> case complete
  -> final GET side(with) passes
  -> render with-completed + derived KPI
  -> screenshot saved / abandoned after 3 attempts (or no request)
  -> POST init

completed side
  -> ReInit side
  -> invalidate target side + cross-side derived KPI
  -> resetting-side
  -> execute success (>=3000ms)
  -> reinit complete
  -> clear target UI
  -> POST init

start/reinit
  -> execute fail
  -> failed-start-side / failed-reinit-side
  -> only retry the same action on the same side
```



### 2.3 合法动作矩阵


| Web 条件                  | Without Start | With Start | Without ReInit | With ReInit     | 其他 Tab |
| ----------------------- | ------------- | ---------- | -------------- | --------------- | ------ |
| 双侧无有效结果                 | 允许            | 禁止         | 禁止             | 禁止              | 允许     |
| Without 有效；With 无有效/未配对 | 禁止            | 允许         | 允许             | 若有 With 历史结果则允许 | 允许     |
| 双侧有效且属于当前配对             | 禁止            | 禁止         | 允许             | 允许              | 允许     |
| Without 无效；保留 With 历史结果 | 允许            | 禁止         | 禁止             | 允许              | 允许     |
| 任一 Start/ReInit 等待态     | 禁止            | 禁止         | 禁止             | 禁止              | **禁止** |
| `failed-start-{side}`   | 仅同侧 Start 重试  | 按失败侧       | 禁止             | 禁止              | 允许     |
| `failed-reinit-{side}`  | 禁止            | 禁止         | 仅失败侧 ReInit    | 仅失败侧 ReInit     | 允许     |


任一侧开启新 Start 时，目标侧旧结果和全部跨侧派生 KPI 立即失效；另一侧历史结果可以保留展示，但在新一轮双侧重新完成前不得参与对比结论。

## 3. 通用 REST 约定



### 3.1 成功与失败 shape

成功：

```json
{
  "ok": true
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "human-readable diagnostic"
  }
}
```

- 所有响应为 UTF-8 JSON，Web 请求使用 `cache: no-store`。
- 失败响应不得夹带可消费的 `points`、`costPct`、`baseRoute` 或基线。
- Web 收到非 2xx、`ok:false` 或非法 shape 时不更新业务数据，并输出结构化 `console.error`。
- Node 输出对应结构化错误日志；日志至少含 endpoint、code、side/command（适用时）和 reason。



### 3.2 最小错误矩阵


| HTTP | code                    | 条件                                           | Web 行为                       |
| ---- | ----------------------- | -------------------------------------------- | ---------------------------- |
| 400  | `INVALID_REQUEST`       | query/body/字段组合非法                            | `console.error`；动作不推进。       |
| 400  | `INVALID_SIDE`          | `side` 不是 `without` 或 `with`                        | `console.error`；不更新。                        |
| 413  | `PAYLOAD_TOO_LARGE`     | 截图请求体超过 `20 MiB`                              | 本次截图失败，按有限重试处理。              |
| 409  | `CONTROL_BUSY`          | 仍有未消费的活动/完成命令，且请求不是 init 或合法同动作重试            | 保持当前态，不发第二命令。                |
| 409  | `RESULT_NOT_READY`      | 匹配侧 Start 的 `case complete` 最终读取仍有半点、缺 Cost、空点或读取期间文件变化 | 保持 running，继续轮询，不 POST init。 |
| 409  | `SCREENSHOT_NOT_REQUESTED` | 截图保存时 flag=0，或 flag=1 但最新控制不属于当前截图路由；高电平清零时 ownership 不匹配 | 补读控制；若 flag=0 按已收尾处理。          |
| 404  | `DATA_FILE_MISSING`     | 必需初始化/侧文件不存在                                 | 禁止启动或保持 running；记日志。         |
| 422  | `INIT_DATA_INVALID`     | base route 或基线内容非法                           | 双侧 Start 禁用；记初始化错误。          |
| 422  | `SIDE_DATA_INVALID`     | 已提交完整行的数值/字段/行号非法                            | 不更新该侧；记日志。                   |
| 500  | `CONTROL_READ_FAILED`   | 控制文件不可读                                      | 记 adapter error。             |
| 500  | `CONTROL_WRITE_FAILED`  | 控制原子写/回读校验失败                                 | 动作不完成；记 adapter error。       |
| 500  | `SIDE_CLEAR_FAILED`     | 目标侧必需文件未全部清空                                 | 不写 start/reinit 控制；记错误。      |
| 500  | `DATA_FILE_READ_FAILED` | 共享文件 I/O 失败                                  | 不更新；记日志。                     |
| 500  | `SCREENSHOT_SAVE_FAILED` | PNG 写入、原子替换、校验或清 flag 失败                    | 同一任务有限重试；不改变业务状态。           |
| 500  | `INTERNAL_ERROR`        | 未归类适配服务异常                                    | 不更新；记日志。                     |




## 4. 控制文件接口



### 4.1 控制快照

五个核心字段必填：

```ts
type ControlSnapshot = {
  case: string;
  command: "init" | "start" | "reinit";
  dt_type: "" | "without dt" | "with dt";
  status: string; // 已知值："" / execute success / execute fail / case complete / reinit complete
  save_picture_flag: 0 | 1;
  debug_flag?: number;
  scene_type?: string;
  [unknownField: string]: unknown;
};
```

Node 和后端每次控制写入都必须重新读取最新快照、只 patch 自己拥有的字段、保留未知字段，并使用同目录临时文件 + `fsync` + 原子 rename + 回读校验。

### 4.2 `GET /api/case3/control-file`

成功：

```json
{
  "ok": true,
  "control": {
    "case": "case3",
    "command": "init",
    "dt_type": "",
    "status": "",
    "save_picture_flag": 0
  }
}
```

GET 只读，不产生写副作用。未知未来 `status` 字符串可以透传，但 Web 不将其解释为 success/fail/complete。

### 4.3 `POST /api/case3/control-file`

只接受以下四种精确请求体；禁止 Web 提交 `status` 或 `save_picture_flag=1`。

Init：

```json
{ "command": "init" }
```

Start：

```json
{
  "case": "case3",
  "command": "start",
  "dt_type": "without dt"
}
```

ReInit：

```json
{
  "case": "case3",
  "command": "reinit",
  "dt_type": "without dt"
}
```

截图成功或三次失败后的受控清零：

```json
{ "save_picture_flag": 0 }
```

`dt_type` 可为 `without dt` 或 `with dt`。

成功：

```json
{
  "ok": true,
  "control": {
    "case": "case3",
    "command": "start",
    "dt_type": "without dt",
    "status": "",
    "save_picture_flag": 0
  }
}
```

操作语义：

1. `init`
  - 不清空 case3 数据文件。
  - 写入 `case=case3,command=init,dt_type="",status="",save_picture_flag=0`。
  - 后端观察到 init 后必须停止旧 Case/旧侧继续写文件。
  - init 不是新业务轮，不触发测试或重置。
2. `start|reinit`
  - Node 串行处理。
  - 先清空目标侧实时文件和该侧调试 JSONL。
  - 任一清空失败则不写控制，返回 `SIDE_CLEAR_FAILED`。
  - 清空全部成功后，写 `case=case3,command=start|reinit,dt_type=<side>,status=""`。
  - `save_picture_flag` 归一为 `0`，防止继承旧截图请求。
  - 正式后端必须停止旧轮写入，再开始当前命令侧。
3. `save_picture_flag=0`
  - 只用于截图完整落盘后的 Node 内部清零，或 Web 同一截图任务累计 3 次失败后的放弃清零。
  - 不改写 `case`、`command`、`dt_type`、`status` 或未知字段。
  - 不生成截图，不占用新序号。
  - 最新 flag 已为 0 时幂等 200，不要求 Case 上下文。
  - 最新 flag 为 1 时，Case3 路由仅允许在 `case=case3,command=start,dt_type=without dt|with dt` 下清零；ownership 不匹配返回 `SCREENSHOT_NOT_REQUESTED`。

页面关闭时，Web 可以通过 `pagehide` + keepalive 请求尽力 POST init，但正确性不得依赖卸载请求必达；下一次 mount 必须重新执行 GET control → POST init。

### 4.4 跨 Case 写入保护

同一 Node 进程内 Case2/Case3 控制 POST 共用一个控制 store 和串行队列。Start/ReInit guard：

- 当前 `command=init,status=""` 时允许开轮。
- 当前同 Case、同 command、同 side 且 `status="execute fail"` 时，只允许同动作手动重试。
- 当前任一 Case 的 `command=start|reinit` 且 status 为 `""`、`execute success`、`case complete` 或 `reinit complete` 时，拒绝新 Start/ReInit 并返回 `409 CONTROL_BUSY`，直到拥有者 POST init。
- 当前其他 Case 的 `execute fail`，或活动 command 带未知 status/无法证明是合法同动作失败重试时，也按 busy 失败关闭。
- POST init 永远允许，用于撤销旧 Case/旧侧写入权。

「同 side」判定：Case3 的 `start|reinit` side ≡ `dt_type`（`without dt` / `with dt`）；Case2 的 `start` side ≡ `dt_type=="with dt"`，Case2 的 `reinit` 无侧别，失败重试只比同 Case + 同 `command=reinit`（Case2 reinit 请求体不带 `dt_type`）。

该规则同样作用于 Case2。Case2 合法 Web 主线、REST 成功 shape、数据和截图路径不变；非法并发、跨 Case 或未消费终态下的直接命令从可能覆盖收紧为 `409 CONTROL_BUSY`。

## 5. 初始化数据接口



### 5.1 `GET /api/case3/init-data`

成功：

```json
{
  "ok": true,
  "baseRoute": [
    { "no": 1, "x": 1.0, "y": 15.0, "z": 0.0 }
  ],
  "beamAccuracyBaseline": {
    "success": 222,
    "total": 235
  }
}
```

Node 成功返回前必须保证：

- `baseRoute` 至少一个点，`no` 从 1 连续递增。
- 坐标为有限数，超过两位小数时四舍五入到两位。
- `success`、`total` 为整数，满足 `0 <= success <= total` 且 `total > 0`。
- 末行无 LF/CRLF 但字段完整可解析时仍算有效。
- Start/ReInit 不清空 base route 或 Beam Accuracy 基线文件。

初始化失败时：

- Node 返回 `ok:false`，不返回部分路线或部分基线。
- Web 保持 initial，Without/With Start 全部禁用。
- Web 输出：

```ts
console.error("case3 init-data failed", {
  code,
  endpoint: "/api/case3/init-data",
  reason
});
```

- 用户刷新或重新进入 case3 后重新尝试；不自动发业务命令。



## 6. 单侧快照接口



### 6.1 数据模型

```ts
type Case3Side = "without" | "with";

type Case3Point = {
  no: number;
  ue: { x: number; y: number; z: number };
  selectedBeamId: number;
  throughputGbps: number;
  scanBeamIds?: number[]; // Without 必需；至少 1 个 [0,255]，允许重复，必须包含 selectedBeamId
  reflection?: {
    x: number;
    y: number;
    z: number;
    los: boolean;
  }; // With 必需；v1 Web 不渲染
};

type Case3SideSnapshot = {
  ok: true;
  side: Case3Side;
  points: Case3Point[];
  completeCount: number;
  pendingTail: boolean;
  costPct: number | null;
};
```



### 6.2 `GET /api/case3/side`

请求：

```http
GET /api/case3/side?side=without
GET /api/case3/side?side=with
```

Without 示例：

```json
{
  "ok": true,
  "side": "without",
  "points": [
    {
      "no": 1,
      "ue": { "x": 1.01, "y": 15.01, "z": 0.0 },
      "selectedBeamId": 4,
      "scanBeamIds": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "throughputGbps": 8.5
    }
  ],
  "completeCount": 1,
  "pendingTail": false,
  "costPct": 25.0
}
```

With 示例：

```json
{
  "ok": true,
  "side": "with",
  "points": [
    {
      "no": 1,
      "ue": { "x": 1.01, "y": 15.01, "z": 0.0 },
      "selectedBeamId": 4,
      "throughputGbps": 9.1,
      "reflection": { "x": 5.0, "y": 7.0, "z": 0.0, "los": true }
    }
  ],
  "completeCount": 1,
  "pendingTail": false,
  "costPct": 15.0
}
```

响应语义：

- 返回当前侧完整连续点 `1..K` 的**全量替换快照**，不是增量。
- `completeCount === points.length`。
- Web 每次替换本地 points/costPct，不维护 cursor，不 append。
- 运行中允许 `points=[]`、`costPct=null` 或 `pendingTail=true`。
- `pendingTail=true` 只代表当前物理尾部尚未收齐；不把半点返回给 Web。
- 已提交完整行中出现非法值时返回 `SIDE_DATA_INVALID`，不能伪装成 pending tail。
- 末行无换行但字段完整可解析时按完整行处理。
- `/side` 是只读快照接口，不要求请求 side 与当前控制目标一致，也不因不一致返回 400/409。
- 必需侧文件任何阶段缺失均返回 `DATA_FILE_MISSING`；非缺失类 I/O 故障返回 `DATA_FILE_READ_FAILED`。



### 6.3 `GET /api/case3/throughput`

请求：

```http
GET /api/case3/throughput?side=without
GET /api/case3/throughput?side=with
```

成功示例：

```json
{
  "ok": true,
  "side": "without",
  "samples": [
    { "no": 1, "gbps": 8.5 },
    { "no": 2, "gbps": 9.1 }
  ],
  "pendingTail": false
}
```

响应语义：

- 只读取该侧 `ue_comm_*_thrp.txt`；**不**等待 coordinates / scan / selected / reflection 对齐。
- `samples` 按行序给出样点序号 `no=1..N` 与归一化后的 `gbps`（2 位小数）；缺点不补 0。
- 返回当前 thrp 文件的**全量替换快照**，不是增量。
- 运行中与 `/side` 一样为只读快照；不要求请求 side 与当前控制目标一致。
- `pendingTail=true` 表示物理尾部尚未收齐（例如末行无换行且无法解析）；已提交完整行非法时返回 `SIDE_DATA_INVALID`。
- **不做** `case complete` 终态门槛；`/side` 的 `RESULT_NOT_READY` 不适用于本接口。
- 缺 `side`、非法 side 或额外 query → `400 INVALID_SIDE`；文件缺失 → `404 DATA_FILE_MISSING`。

Web 纪律（Issue #6）：

- 运行中 `/side` 与 `/throughput` **独立**轮询；任一路失败不得阻塞另一路更新。
- 见到本轮 `case complete` 且 `/side` 终态通过后，**必须**再独立 `GET /throughput` 封存 `resultThrp`。
- 终态吞吐读取失败时保留本轮最后一次独立 live 快照；**禁止**从 `points[].throughputGbps` 回填 KPI 曲线。



### 6.4 多 txt 对齐

Without 第 `i` 点必须同时具备：

- `ue_comm_without_dt_coordinates.txt` 第 `i` 行；
- `ue_comm_without_dt_beams.txt` 第 `i` 行；
- `ue_comm_without_dt_sel_beam.txt` 第 `i` 行；
- `ue_comm_without_dt_thrp.txt` 第 `i` 行。

With 第 `i` 点必须同时具备：

- `ue_comm_with_dt_coordinates.txt` 第 `i` 行；
- `ue_comm_with_dt_sel_beam.txt` 第 `i` 行；
- `ue_comm_with_dt_thrp.txt` 第 `i` 行；
- `ue_comm_with_dt_coordinates_reflection_point.txt` 第 `i` 行。

Cost 与点数解耦，取该侧 cost 文件最新非空行，作为包级 `costPct`。

`ue_comm_without_dt_mse.txt`、`ue_comm_with_dt_mse.txt` 不进入当前 UI、完整点或完成门槛；后端可以保留这些文件，但 Node/Web 忽略。

## 7. Node 数值校验与 Web 防御边界

Node 对共享文件内容做唯一权威业务校验：


| 数据                    | Node 归一/校验                                          |
| --------------------- | --------------------------------------------------- |
| 坐标                    | 必须为有限数；超过两位小数四舍五入到两位。                               |
| Throughput            | 必须为有限非负数；四舍五入到两位。                                   |
| Cost                  | 必须为有限数；先四舍五入到一位再检查 `0～100`；越界拒绝，禁止 clamp。          |
| `selectedBeamId`      | 整数 `0～255`。                                         |
| Without `scanBeamIds` | 至少 1 个整数，每个 `0～255`，允许重复；`selectedBeamId` 必须包含在该行中。 |
| Reflection 坐标         | 必须为有限数；超过两位小数四舍五入到两位。                               |
| Reflection flag       | 只能为整数 `0` 或 `1`；`0 → los=false`，`1 → los=true`。       |
| Beam Accuracy 基线      | 整数，`0 <= success <= total` 且 `total > 0`。           |

四舍五入统一与 Case2 一致：先对绝对值进位，再恢复符号，即 `sign(x) * Math.round(abs(x) * 10^n) / 10^n`；结果为负零时归一为 0，范围检查在归一后执行。

Web 只检查响应 envelope、数组/对象、必填字段和 JSON 类型。Web 不重新四舍五入、不重复范围/行号/跨文件校验；若 Node 返回的 shape 非法，Web 记 `CASE3_INVALID_RESPONSE` 并丢弃整次响应。

## 8. 完成发布与最终快照门槛



### 8.1 后端发布顺序

Start 成功路径必须是：

1. 观察合法 `case3 + start + dt_type + status=""`。
2. 停止旧 Case/旧侧写入。
3. 写 `status="execute success"`，保持至少 3000ms。
4. 仅向命令目标侧 append 本轮数据。
5. 完整写完并关闭该侧全部逐点文件和 Cost 文件。
6. 停止本轮文件写入。
7. 若本轮请求截图，最后一次原子控制写合并 `status="case complete",save_picture_flag=1`；若不请求截图，只写 `status="case complete"`。

后端在 `case complete` 后不得追加、截断或重写该轮文件。

### 8.2 Web 完成门槛

Node 只有在以下上下文才把 `/side` 当作最终读取：

```text
requestedDtType = side == without ? "without dt" : "with dt"
control.case == "case3"
&& control.command == "start"
&& control.dt_type == requestedDtType
&& control.status == "case complete"
```

上下文不匹配时返回运行中/只读完整前缀，允许空点、null Cost 和 pending。上下文匹配时，若空点、pending、null Cost、读取中仍变化或 controlBefore/controlAfter 的 case/command/dt_type 漂移，返回 `409 RESULT_NOT_READY`。另一个侧的 complete 不得触发本侧最终门槛；ReInit 不读取 side，也不使用 `RESULT_NOT_READY`。

Web 只有满足全部条件才进入 completed：

- 当前本地动作是该侧 Start；
- 本轮已观察到 `execute success`；
- 之后观察到 `case complete`；
- 最终 `GET /side` 返回 `ok=true`；
- 并行或紧随其后独立 `GET /throughput?side=<same>` 成功时，以该快照封存 KPI 吞吐；失败则保留本轮最后 live 吞吐，**不得**用 `points[].throughputGbps` 推导曲线；
- `pendingTail=false`；
- `points.length > 0`；
- `completeCount === points.length`；
- `costPct !== null`；
- Node 最终读取期间文件未变化。

若最终快照不满足：

- Web 保持该侧 running；
- 不展示 completed；
- 不计算最终跨侧 KPI；
- 不 POST init；
- 继续串行轮询并输出 `CASE3_RESULT_NOT_READY` 诊断日志。

连续不过关达到 Web 常量 `CASE3_FINAL_NOT_READY_MAX_ATTEMPTS`（10）后：进入该侧失败态（徽标「结果不完整已自动回退」），解除 busy，并 POST `init` 撤权；仍不得把残缺快照当作 completed。

通过门槛后，Web 先提交本地结果、完成渲染和派生计算；若已观察到截图请求，还要等截图保存或累计 3 次失败后放弃清零，再 POST init。未收到截图请求时可直接收尾。init 写回失败不撤销已完成结果，但必须记录 adapter error。

### 8.3 截图请求与收尾

后端置位：

- 仅 Start 路径可在已写 `execute success` 后至写 `case complete` 时将 `save_picture_flag` 从 `0` 置为 `1`。
- 允许与 `case complete` 同拍；同拍时必须在同一次完整控制写中合并 status 与 flag，禁止先 complete 后补 flag。
- ReInit 路径不得置 `1`。

Web 观察：

- 仅在 `without-running` / `with-running` 的控制轮询中观察 0→1；进页、initial、completed、failed、resetting 不触发。
- 同拍 `case complete + flag=1` 时，先创建截图任务，再完成最终快照和 completed 切换。
- 同一任务最多 3 次：生成失败重新生成，上传失败复用已生成 Base64；前两次失败不清零。
- 第 3 次仍失败时 POST `{ "save_picture_flag": 0 }`，记录 `SCREENSHOT_DROPPED_AFTER_RETRIES`，接受丢失本张截图，不改变业务结果。

`POST /api/case3/screenshot` 请求：

```json
{ "image_base64": "iVBORw0KGgo..." }
```

成功：

```json
{
  "ok": true,
  "path": "out/case3/case3-000.png",
  "seq": 0
}
```

Node 行为：

- 接受纯 Base64 或 `data:image/png;base64,` 前缀；解码后必须是 PNG signature。
- 最新控制必须仍为 `case=case3,command=start,dt_type=without dt|with dt,save_picture_flag=1`；不额外锁死 status，允许保存期间从 success 推进到 complete。
- 输出 `{DT_SHARED_DIR}/out/case3/case3-{seq}.png`；`seq` 从 `000` 递增，绝不覆盖。
- 临时文件写入、`fsync`、关闭、同目录原子 rename、最终 stat 成功后，才清 flag；清零必须在共享队列内重读最新控制并复验 Case3 ownership，禁止用旧快照清掉另一个 Case 或后续任务的新 flag。
- 响应 `seq` 为未补零数字；三位补零只用于文件名，`1000` 及以上自然扩展。
- Case2 截图路由对称要求 `case=case2,command=start,dt_type=with dt,save_picture_flag=1`，不能消费 Case3 的 flag。
- 不做持久事务、SHA-256 去重或进程重启恢复；极端窗口允许丢失或重复截图，但不得影响业务 `status`。

## 9. ReInit、失败与重试



### 9.1 ReInit

- 点击 ReInit 后立即使目标侧本地结果及全部跨侧派生 KPI 失效；另一侧结果保留。
- Node 先清目标侧实时文件，再写 reinit 控制。
- `execute success` 必须保持至少 3000ms。
- `reinit complete` 被 Web 消费后，目标侧回空态，再 POST init。



### 9.2 失败

- `execute fail` 是当前命令失败终态；后端本轮不得再写 `case complete` 或 `reinit complete`。
- Start 失败：清目标侧本轮半点，进入 `failed-start-{side}`，只允许同侧 Start 重试。
- ReInit 失败：不恢复旧结果，进入 `failed-reinit-{side}`，用户只需重试同侧 ReInit。
- 不自动重试、不自动超时、不发取消命令、不排队。



## 10. 派生 KPI



### 10.1 相对开销变化

双方 Cost 有效且 Without Cost 非 0 时：

```text
relativeCostChangePct =
  (withCostPct - withoutCostPct) / withoutCostPct * 100
```

- Web 按一位小数展示。
- 正数表示有 DT 相对无 DT **增加**：向上箭头 + `X%`（不带正号）。
- 负数表示有 DT 相对无 DT **减少**：向下箭头 + `-X%`。
- 0：无箭头，显示 `0.0%`。
- 任一输入缺失或 Without Cost 为 0 时显示 `--`。
- Node 不返回 delta 字段。



### 10.2 Beam Accuracy

输入：

- 基线：`ue_comm_with_dt_beam_accuracy_rate.txt` 的 `success,total`。
- 增量：当前配对的 Without/With 完整点，按相同 `no` 比较 `selectedBeamId`。只有两侧都存在的 `no` 才计入 `roundTotal`；缺一侧的点在「点位和波束关系」显示 `NA`，不进入准确率。

```text
roundSuccess = count(matching no where selectedBeamId equal)
roundTotal   = count(matching no)
displaySuccess = baselineSuccess + roundSuccess
displayTotal   = baselineTotal + roundTotal
displayError   = displayTotal - displaySuccess
displayPct     = displaySuccess / displayTotal * 100
```

- 展示准确率保留一位小数。
- 坐标只用于可选诊断，不作为匹配主键。
- 任意侧 Reset、新 Start 或失效都会清除当前增量，恢复文件基线。
- `reflection` 仍是 With 完整点必需字段，但 v1 Web 不渲染 Reflection/LOS。



## 11. 刷新、切 Tab 与旧响应

- 进入/刷新/切回 case3：固定执行 GET control → POST init → GET init-data；可见态从 initial 开始，不恢复历史结果。
- `command=init` 被后端观察后必须停止旧 Case/旧侧写入；它不启动新业务。
- 等待态内锁定其他 Case Tab；完成、失败或重置结束后解除。
- 切离 case3 时卸载 case-local 状态、停止轮询、abort 在途 REST。
- Web 使用本地 generation/AbortController 丢弃旧 Start/ReInit 或卸载后的迟到响应。
- 页面关闭的 unload 请求仅 best-effort；下次 mount 的 init 握手才是可靠恢复门槛。
- 已开始的截图任务在业务结果进入 completed 后继续收尾；切 Tab 因等待态锁定，不会中途切离。



## 12. 调试 JSONL 与数据真实性

Node 可维护：

```text
{DT_SHARED_DIR}/out/case3/points/without.jsonl
{DT_SHARED_DIR}/out/case3/points/with.jsonl
```

- 内容只含该侧当前完整点，与 REST `points` 一致。
- 完整点数变化时整文件原子替换；Start/ReInit 时清目标侧。
- 不写 `side` 或 Cost；Web 不回读。
- 仅用于调试/QA，不是真实后端输入，不得写入 `out/case2/`。

参考样本不代表本次真实采集。只有真实后端按本文完成一轮发布，才可称为本轮业务结果。

## 附录 A：不可变与可替换项


| 项                           | 可替换                          | 说明                |
| --------------------------- | ---------------------------- | ----------------- |
| REST 路径、请求/响应 shape         | 否                            | Gate 2 契约主体。      |
| 控制字段和状态字面值                  | 否                            | 真实后端/Web 共同依赖。    |
| `execute success` 最少 3000ms | 否                            | 保障当前轮询可观察。        |
| 完整发布后最后写 `case complete`    | 否                            | 结果一致性门槛。          |
| 截图 REST、重试/清零与输出目录         | 否                            | 与 Case2 同构，Case3 独立输出。 |
| Web 500ms 轮询                | Gate 3 已冻结；不得破坏 success 可观察性 | success dwell 仍至少 3000ms。 |
| UI 动画、tooltip 文案            | 是                            | 不改变状态语义。          |
| Reflection/LOS 可视化          | 后续另行冻结                       | v1 不实现，字段仍必需。     |




## 附录 B：明确不做

- 不使用 `/points` + `/kpis` 双 cursor 主路径。
- 不要求后端 JSONL、manifest、batch_id、command_id 或原子目录切换。
- 不做取消按钮、命令队列、自动业务超时或自动业务重试。
- 不让 Web 直接读写共享目录。
- 不把 case2 指标或校准语义带入 case3；仅复用已确认的截图机制。
