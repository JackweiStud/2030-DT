# case2 Node 适配服务施工规格（前端 PC 文件操作服务）

> 使用者：Node 适配服务实现 agent。本文把 [API-CONTRACT.md](API-CONTRACT.md) v1 转成**前端 PC 上文件适配服务**的实现约束，不替代面向真实后端团队的 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md)。
>
> **本文范围：** Chrome 唯一文件读写、控制文件 GET/POST、数据文件整批读取、截图落盘与 `save_picture_flag` 清零。Web 与本服务**同机**（默认 `127.0.0.1:3102`）。
>
> **不在本文：** 模拟后端写 `status` / 发布 Calibrated / 置截图 flag 的打桩进程。本地无真实后端时的打桩规格见 [realback_no.md](realback_no.md)。
>
> Gate 3 演示向：`start`/`reinit` 写入时强制 `status=""`（见 §4.2），相对契约「请求侧不写业务 status」的放宽；真实联调须后端接受开一轮时空 status（交接文档已于 2026-08-03 同步）。业务终态字面值仍只由后端（或打桩扮演的后端）写出。
>
> 2026-08-10 跨 Case 安全增量：Case3 接入同一进程后，Case2/Case3 共用控制 store 和 busy guard；Case2 截图路由必须对称校验 ownership。当前运行代码尚未实现该增量，随 Case3 Node Gate 4 一并落地。

## 0. 出口条件

- [ ] 四个 REST 接口的路径、输入、输出和错误 shape 与契约一致。
- [ ] 浏览器不直接访问共享目录；所有控制、数据和截图文件 I/O 都由适配服务完成。
- [ ] 控制文件写入：请求体只含允许字段；`start`/`reinit` 合并时强制 `status=""`；进页、启动轮收尾和重置轮收尾的 `init` 写回强制 `case=case2,command=init,dt_type="",status="",save_picture_flag=0`；截图清零保留后端 `status` 及未知字段。
- [ ] 控制文件 GET：结构/类型失败才 `CONTROL_READ_FAILED`；未知 `status` 字面值 200 透传（与契约 / WEB-SPEC 一致，由 Web 保持等待态）。
- [ ] 动态 `Nx × Ny` 热力矩阵、动态 `N` KPI 样本、超过 2 位小数四舍五入到 2 位，以及热力 `[-200,200]` / KPI `[0,500]` 范围规则有自动测试。
- [ ] Calibrated 任一文件缺失、变化或非法时整批拒绝：HTTP **不**返回部分业务数据；适配服务**必须**打诊断日志（失败文件名、原因），响应体仍为 `{ok:false,error:{code,message}}`。
- [ ] 截图请求进程内串行、临时文件原子落盘、递增命名且不覆盖，完整成功后按 Case2 ownership 清零；不能消费 Case3 flag；不实现持久事务、SHA-256 去重或进程重启恢复；Web 累计 3 次失败后的放弃清零有自动测试。
- [ ] `npm test` 通过；启动命令可独立运行并可用 `Ctrl+C` 正常退出。
- [ ] 未实现 WebSocket、鉴权、数据库、命令队列、业务超时或业务命令自动重试；截图有限重试不属于业务命令重试。
- [ ] **未**把模拟后端打桩并入本服务的默认启动路径（打桩见 [realback_no.md](realback_no.md)）。



## 1. 技术边界与目录



### 1.1 技术选择

- Node.js `>=20`，ESM。
- HTTP 层优先使用 `node:http`；当前仅四个接口，不引入 Express、Socket.IO 或数据库。
- 测试使用 `node:test` 与 `node:assert/strict`。
- 所有 API 默认只监听 `127.0.0.1`，不暴露到局域网。
- JSON 响应统一带 `Content-Type: application/json; charset=utf-8` 和 `Cache-Control: no-store`。
- 请求体上限 `20 MiB`，用于容纳 Stage 截图 PNG 的 Base64（逻辑 1920×1080、`pixelRatio=2` 时约 3840×2160）；超限直接拒绝。



### 1.2 目标目录

实现根为仓库已建的 `code/`（与 [WEB-SPEC.md](WEB-SPEC.md) 共用）。Gate 4 创建 `code/server/`；本地共享根已存在为 `code/comdatafiles/`。

**规划原则：** 一个 Node 适配进程、一个监听端口；HTTP 与共享目录均按 **case 命名空间** 隔离。本阶段只实现 `case2`；`case3`/`case4` 只占位目录约定，不注册路由、不读其数据。

```text
code/
├── web/                 # React Web（WEB-SPEC；cases/case2 业务隔离）
├── back/                # 真实后端或本地打桩进程（见 realback_no.md；非本 SPEC）
├── server/              # 本 SPEC：多 case 文件适配服务（Gate 4 创建）
│   ├── package.json
│   ├── src/
│   │   ├── shared/      # 进程级共用：HTTP 工具、串行队列、原子写、配置
│   │   └── cases/
│   │       ├── case2/   # 本阶段唯一实现：/api/case2/* 与 case2 文件语义
│   │       ├── case3/   # 预留（本阶段不实现、不挂路由）
│   │       └── case4/   # 预留（本阶段不实现、不挂路由）
│   ├── scripts/         # 本阶段仅 case2 联调辅助（如种子共享目录；不含后端状态机）
│   └── test/
│       ├── shared/
│       └── case2/
└── comdatafiles/        # 本地共享根（正式部署时 DT_SHARED_DIR 指向前端 PC 上已挂载共享根；结构不变）
    ├── case_control.json    # 当前 case2 控制文件（契约路径）
    ├── case2/               # case2 Initial + Calibrated
    ├── out/case2/           # case2 截图
    ├── case3/               # 预留
    └── out/case3/           # 预留
```

约定：

| 层 | 放什么 | 禁止 |
|---|---|---|
| `src/shared/` | 多 case 可复用的传输与文件原语（响应 JSON、串行队列、`fsync+rename`、env 加载） | case2 字段枚举、六文件名、截图序号规则；后端 status 状态机 |
| `src/cases/case2/` | case2 控制/数据/截图与路由注册 | 读取 `case3/` 数据或挂 `/api/case3`；模拟后端推进 `status` |
| `src/cases/case3\|4/` | 仅预留；可放空目录或一句 README | 本阶段任何业务代码或路由 |
| `comdatafiles/caseN/` / `out/caseN/` | 各 case 数据与输出隔离 | case2 代码写到别的 case 目录 |

补充：

- `cases/case2/` 内部分文件名由实现自定；对外只保证 `/api/case2/*` 与契约字段。
- 运行时临时内容放 `server/.runtime/`（加入 `.gitignore`）；测试用系统临时目录，不写 `01-参考资料/`。
- Chrome **不**读 `comdatafiles/`；只访问本机适配 `127.0.0.1:3102`。
- 未来加 case3：新增 `src/cases/case3/` + 注册 `/api/case3/*` + 共享目录 `case3/`/`out/case3/`；**不必**新建第二个适配进程。

### 1.3 本阶段范围（多 case）

- **做：** `case2` 四个 REST、共享目录 case2 语义（读控制、写允许字段、读六文件、截图落盘与清零）。
- **不做：** case3/case4 的 API 或文件解析；**不做**模拟后端打桩（见 [realback_no.md](realback_no.md)）。
- **预留：** 上表目录与 `/api/caseN` 命名空间；host/port 为进程级共享；各 case 业务 env 继续用 `CASE2_*`（未来 `CASE3_*` 等同前缀），互不混用。

## 2. 运行配置与命令



### 2.1 环境变量


| 变量                   | 默认值         | 要求                                                 |
| -------------------- | ----------- | -------------------------------------------------- |
| `CASE2_ADAPTER_HOST` | `127.0.0.1` | 只允许显式配置后改变监听地址。                                    |
| `CASE2_ADAPTER_PORT` | `3102`      | Web 通过同源 `/api` 代理访问，不在组件中散落端口。                 |
| `DT_SHARED_DIR`      | 无           | 必填；前端 PC 上共享根的绝对路径（与后端通过该目录交换文件）。由部署注入，代码不得回退到 `01-参考资料/`。 |


打桩专用变量（`CASE2_STUB_STEP_MS` / `CASE2_STUB_OUTCOME`）见 [realback_no.md](realback_no.md)，**不属于**本适配服务运行合同。

`DT_SHARED_DIR` 对应的最小运行时结构（本地演示默认指向仓库 `code/comdatafiles` 的**绝对路径**）：

```text
{DT_SHARED_DIR}/
├── case_control.json
├── case2/              # Initial + Calibrated 十二个固定文件名
└── out/case2/          # calibrated-{seq}.png
```

Web 与本适配服务**同机**部署在前端 PC（Chrome 只访问本机 `127.0.0.1:3102`），不存在「前端 PC ↔ 适配服务」分机。正式部署时 `DT_SHARED_DIR` 指向该前端 PC 上已挂载的共享根（与后端侧交换文件），**目录结构**不变。文件名映射见契约 / [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md)；HTTP 不接受任意路径。

Initial 与 Calibrated 均从 `{DT_SHARED_DIR}/case2/` 读取；截图写入 `{DT_SHARED_DIR}/out/case2/`。与真实后端或本地打桩**共用同一目录结构**（flat），本服务不设第二套数据模式。

### 2.2 npm 命令


| 命令            | 用途                         |
| ------------- | -------------------------- |
| `npm start`   | 启动正式适配服务；缺少共享目录或控制文件时快速失败。 |
| `npm run dev` | 启动适配服务并输出可读日志。             |
| `npm test`    | 运行本包（适配服务）自动测试。            |


编排「适配服务 + 模拟后端」或截图联调脚本的命令名与行为见 [realback_no.md](realback_no.md)；**不得**作为本服务 `npm start` 的默认副作用。

## 3. REST 到实现映射


| 契约入口                                  | 实现职责                           | 成功 HTTP | 主要失败                                                                  |
| ------------------------------------- | ------------------------------ | ------- | --------------------------------------------------------------------- |
| `GET /api/case2/control-file`         | 读取、解析控制 JSON；校验结构/类型后返回快照（未知 status 透传） | 200     | `CONTROL_READ_FAILED`                                                                                  |
| `POST /api/case2/control-file`        | 校验四类允许 payload，读最新快照、字段合并、原子替换 | 200     | `INVALID_REQUEST` / `PAYLOAD_TOO_LARGE` / `CONTROL_READ_FAILED` / `CONTROL_WRITE_FAILED`              |
| `GET /api/case2/data-files?phase=...` | 解析并整批校验六文件                     | 200     | `INVALID_REQUEST` / `CONTROL_READ_FAILED` / `DATA_FILE_MISSING` / `DATA_FILE_INVALID` / `RESULT_BATCH_INCOMPLETE` / `DATA_FILE_READ_FAILED` |
| `POST /api/case2/screenshot`          | 校验 Base64 PNG、递增落盘、成功后清零标志     | 200     | `INVALID_REQUEST` / `PAYLOAD_TOO_LARGE` / `CONTROL_READ_FAILED` / `SCREENSHOT_NOT_REQUESTED` / `SCREENSHOT_SAVE_FAILED` |


错误响应固定为：

```json
{
  "ok": false,
  "error": {
    "code": "DATA_FILE_INVALID",
    "message": "heatmap_cali_rss.txt is not a rectangular numeric matrix"
  }
}
```

### 3.1 唯一错误矩阵

实现不得按异常类、底层 `errno` 或个人判断另选 HTTP 状态；下表是四个接口失败响应的唯一映射：

| 接口/阶段 | 条件 | HTTP | `error.code` |
|---|---|---:|---|
| 任一 POST / data-files query | JSON、请求 shape、字段值、`phase`、Base64 或 PNG signature 非法 | 400 | `INVALID_REQUEST` |
| 任一 POST | 请求体超过 `20 MiB` | 413 | `PAYLOAD_TOO_LARGE` |
| `GET /api/case2/control-file` | 控制文件缺失、不可读、非 UTF-8、JSON/结构/必填字段类型非法 | 500 | `CONTROL_READ_FAILED` |
| `POST /api/case2/control-file` | 合并前读取最新控制快照失败 | 500 | `CONTROL_READ_FAILED` |
| `POST /api/case2/control-file` | 临时文件写入、`fsync`、关闭、原子替换或写后复读失败 | 500 | `CONTROL_WRITE_FAILED` |
| `GET ...data-files?phase=initial` | 任一必需 Initial 文件不存在 | 404 | `DATA_FILE_MISSING` |
| data-files，`phase=initial` 或 `phase=calibrated` | 文件存在，但数值词法、范围、矩阵形状或样本形状非法 | 422 | `DATA_FILE_INVALID` |
| `GET ...data-files?phase=calibrated` | 首次或二次控制快照读取/结构校验失败 | 500 | `CONTROL_READ_FAILED` |
| `GET ...data-files?phase=calibrated` | 首次控制快照不是 `status="case complete"` | 409 | `RESULT_BATCH_INCOMPLETE` |
| `GET ...data-files?phase=calibrated` | 首次快照已 complete，但任一 Calibrated 文件不存在 | 409 | `RESULT_BATCH_INCOMPLETE` |
| `GET ...data-files?phase=calibrated` | 读取期间文件 stat 变化，或二次控制快照不再是 `case complete` | 409 | `RESULT_BATCH_INCOMPLETE` |
| data-files，`phase=initial` 或 `phase=calibrated` | 文件存在但因权限、挂载或其它非“文件不存在”I/O 原因无法读取/stat | 500 | `DATA_FILE_READ_FAILED` |
| `POST /api/case2/screenshot` | 最新控制快照读取/结构校验失败 | 500 | `CONTROL_READ_FAILED` |
| `POST /api/case2/screenshot` | `save_picture_flag=0` | 409 | `SCREENSHOT_NOT_REQUESTED` |
| `POST /api/case2/screenshot` | 临时 PNG 写入/关闭/rename、最终文件校验或落盘后清零失败 | 500 | `SCREENSHOT_SAVE_FAILED` |

同一请求同时命中多个条件时，按以下优先级裁决，保证实现和测试结果唯一：

1. 先做 HTTP 请求大小、JSON、query、payload shape、Base64 和 PNG signature 校验；超限固定为 `413 PAYLOAD_TOO_LARGE`，其它请求输入错误固定为 `400 INVALID_REQUEST`。
2. Calibrated 先读控制快照；快照读取/结构校验失败为 `500 CONTROL_READ_FAILED`；成功读到但尚未 `case complete` 时直接返回 `409 RESULT_BATCH_INCOMPLETE`，不再用文件缺失覆盖该结果。
3. 首次快照已 complete 后：文件缺失为 `409 RESULT_BATCH_INCOMPLETE`；文件存在但内容非法为 `422 DATA_FILE_INVALID`；非缺失类 I/O 故障为 `500 DATA_FILE_READ_FAILED`；读取期间变化或二次快照成功读到但 status 改变为 `409 RESULT_BATCH_INCOMPLETE`；二次快照读取/结构校验失败为 `500 CONTROL_READ_FAILED`。
4. Initial 不检查业务 status：文件缺失为 `404 DATA_FILE_MISSING`，文件内容非法为 `422 DATA_FILE_INVALID`，非缺失类 I/O 故障为 `500 DATA_FILE_READ_FAILED`。
5. 截图请求先校验输入，再读取控制快照判断当前 flag：控制快照读取/结构校验失败为 `500 CONTROL_READ_FAILED`，成功读到且 flag 为 `0` 时固定为 `409 SCREENSHOT_NOT_REQUESTED`。

后端业务失败仍只来自控制文件中的 `status="execute fail"`（由后端或打桩写入），不得翻译成 REST 500。

## 4. 控制文件服务



### 4.1 GET

1. 从 `{DT_SHARED_DIR}/case_control.json` 读取 UTF-8 文本。
2. 下列情况返回 `CONTROL_READ_FAILED`（结构/类型不可用，不是业务 `status` 解释）：
   - 空文件、非 UTF-8 文本、非对象 JSON；
   - 缺少契约必填字段；
   - 必填字段类型错误（例如 `status` 非字符串、`save_picture_flag` 非数字）；
   - `save_picture_flag` 不是 `0` 或 `1`（截图安全；与业务 status 无关）。
   - 五个必填字段为 `case`、`command`、`dt_type`、`status`、`save_picture_flag`。
   - `debug_flag`、`scene_type` 为可选部署字段；存在时分别必须是整数、字符串。缺少可选字段不拒读。
3. **`status` 字面值不在已知枚举时不得拒读**：原样放入 `control` 以 HTTP 200 返回。业务解释由 Web 按契约 / [WEB-SPEC.md](WEB-SPEC.md) 处理（等待态内未知 status：打诊断日志、保持等待态、继续轮询；不映射为完成/失败）。适配服务不做 status → UI 相翻译。
4. `case` / `command` / `dt_type` 等其它已知名字段：类型正确即可原样返回；字面值是否落在契约枚举表由 Web/后端语义层处理，GET **不**因“枚举字面值未知”返回 `CONTROL_READ_FAILED`。（POST 写路径仍只接受三种合法 payload，见 §4.2。）
5. 未消费的未知字段原样放入 `control` 返回，不能过滤后再用于后续写入。
6. 读取遇到短暂 JSON 解析失败可做最多 3 次、间隔 50ms 的文件读取重试；这是 I/O 防抖，不是业务命令重试。



### 4.2 POST 允许的四种 payload

```json
{ "case": "case2", "command": "start", "dt_type": "with dt" }
```

```json
{ "command": "reinit" }
```

```json
{ "command": "init" }
```

```json
{ "save_picture_flag": 0 }
```

- 只接受以上四种完整 shape；请求体混入 `status`、未知字段、`save_picture_flag=1` 或其他枚举一律 `400 INVALID_REQUEST`。
- **Gate 3 演示向放宽（开一轮清盘）**：处理 `start` / `reinit` 时，适配服务在字段合并步骤**额外强制写入** `status=""`（请求体仍禁止带 `status`）。用于去掉上轮残留终态，供 Web 用「时刻 A 见 `execute success`、之后时刻 B 见完成终态」的规则（见 WEB-SPEC）；同时使合法 `start|reinit` 命令元组 + 空 status 成为后端/打桩唯一的新轮命令门沿，从而覆盖相同 command 的失败后重试。真实后端须接受开一轮时出现空 `status`；业务终态字面值仍只由后端写出。交接口径见 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md)。
- **空闲写回**：Web 进入 / 刷新 / 切回 case2 时，先 `GET control-file` 诊断可读；成功后再 `POST {command:"init"}`。启动轮已读取 Calibrated 六文件并完成截图保存/放弃收尾后、重置轮已消费 `reinit complete` 并回到 Initial 后，也可 `POST {command:"init"}`。适配服务合并为 `case=case2,command=init,dt_type="",status="",save_picture_flag=0`，保留未知字段，用于满足后端侧“控制文件回空闲”的握手诉求。该写回不是业务 start/reinit 门沿，后端不得把 `init,status=""` 当成一次测试命令。
- `save_picture_flag: 0` 路径可由截图成功落盘流程内部调用，或由 Web 在同一截图任务累计 3 次生成/上传失败后调用；两种路径都**不得**改写 `status`。后者必须记录“本张截图已放弃”日志，且不生成 PNG、不占用新序号。
- 启动与重置是否可点击由 Web 状态机负责；适配服务仍必须防止非法字段写入。
- 截图接口内部清零必须复用同一控制文件写服务，不另写一套文件算法。
- Case3 接入后，Case2/Case3 Start/ReInit 共用 `CONTROL_BUSY` guard：空闲允许；同 Case 同动作 `execute fail` 允许重试；活动、未消费终态、其他 Case fail 或未知活动 status 拒绝覆盖；POST init 永远允许。合法 Case2 主线/成功 shape 不变。
- `{save_picture_flag:0}` 在最新 flag=0 时幂等成功；flag=1 时 Case2 路由只允许清 `case=case2,command=start,dt_type=with dt`，否则返回 `SCREENSHOT_NOT_REQUESTED`。



### 4.3 最小写入算法

所有控制文件写入进入适配服务进程内同一串行队列：

1. 读取最新完整 JSON。
2. 只合并本次 payload 的允许字段；若本次为 `start` 或 `reinit`，再强制 `status=""`；若本次为 `init`，再强制 `case=case2,dt_type="",status="",save_picture_flag=0`。
3. 将完整合并结果写入共享目录中的唯一临时文件。
4. `fsync` 并关闭临时文件。
5. 在同一目录内用原子 `rename` 替换 `case_control.json`。
6. 重新读取并返回写后快照。

临时文件名必须包含进程号与随机 nonce；异常退出后遗留的临时文件不作为控制文件读取。

本项目不增加跨 PC 租约服务、数据库或长期 `.lock` 文件。进程内串行队列只解决前端侧并发请求；同目录原子替换只解决半写 JSON。真实后端与适配服务若同时整文件写入，仍可能发生最后写者覆盖，这是没有版本号的共享 JSON 的固有限制。Gate 4 必须做一次双端并发写验证；若出现字段丢失，回到契约层增加双方共同遵守的锁协议，不能在适配服务内部假装已经解决。

## 5. 数据文件服务



### 5.1 文件映射

服务端固定维护 `rss`、`effective_path_num`、`first_path_delay` 三项映射；HTTP 不接受指标名或文件名参数。`phase` 只允许 `initial` / `calibrated`。

每次响应必须包含三项指标，每项同时包含 `heatmap` 与 `kpi`；任何一个失败则整个请求失败（不返回部分 `metrics`；服务端打诊断日志）。

### 5.2 数值词法与解析

适用于 `{DT_SHARED_DIR}/case2/` 下十二个固定 txt（六热力矩阵 + 六 KPI）。

**共用：**

- 接受 LF / CRLF。
- 行内接受 ASCII 逗号或任意空白分隔；连续分隔符产生的空 token 忽略。
- 不接受科学计数法、`NaN`、`Infinity`、空 token 或尾随非数值字符。
- 小数归一：解析为有限数后，**四舍五入保留 2 位小数**（第 3 位小数 ≥5 则进位）。超过 2 位**不**拒绝，归一后再做范围校验。实现须对绝对值进位再还原符号：`sign(x) * round(|x| * 100) / 100`，避免 JS `Math.round` 对负半值偏向 +∞。
- 响应里的 `heatmap` / `kpi` 数字均为归一后的值。

**六热力矩阵**（`heatmap_{init|cali}_{rss|effective_path_num|first_path_delay}.txt`）：

- 词法：`^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$`，再 `Number.isFinite`，再按上款归一到 2 位小数。
- 数值范围（归一后）：**\-200 ≤ x ≤ 200**（含端点；可为正负或 0）。越界 → `DATA_FILE_INVALID`。
- 形状：忽略首尾空行，中间非空行必须等长；非空矩形即可，允许 `1×1`、`1×N`、`N×1`。

**六 KPI**（`heatmap_{init|cali}_kpi_{rss|effective_path_num|first_path_delay}.txt`）：

- 词法：`^[+]?(?:\d+(?:\.\d+)?|\.\d+)$`（**禁止负号**），再 `Number.isFinite`，再按上款归一到 2 位小数。
- 数值范围（归一后）：**0 ≤ x ≤ 500**（含端点；非负）。越界或带 `-` → `DATA_FILE_INVALID`。
- 形状：忽略行列分组并按文件顺序展平成一维，至少一个数值；`N` 不固定，Initial 与 Calibrated 的 `N` 允许不同。



### 5.3 稳定读取

Initial 六文件只做单批完整校验。Calibrated 额外执行：

1. 读取控制快照，确认当前 `status="case complete"`。
2. 记录六文件的路径、大小和高精度修改时间。
3. 读取并解析六文件。
4. 再次读取六文件 stat 与控制快照。
5. 失败 HTTP 与 `error.code` 严格按 §3.1：控制快照读取/结构校验失败 → `500 CONTROL_READ_FAILED`；文件缺失或读取期间变化、成功读到的状态不再是 `case complete` → `409 RESULT_BATCH_INCOMPLETE`；文件存在但内容非法 → `422 DATA_FILE_INVALID`；非缺失类 I/O 故障 → `500 DATA_FILE_READ_FAILED`。
6. 失败时：响应体**不得**含任何已成功解析的指标子集；服务端打诊断日志，至少包含 `phase`、失败文件名、错误码/原因；不把参考样本或旧批次塞进响应。

服务不缓存上一批 Calibrated；失败时不得返回旧数据或参考样本。

本服务只**读取**共享目录中已发布的文件；由谁写入（真实后端或 [realback_no.md](realback_no.md) 打桩）不在本文范围。发布侧须遵守契约：写完并关闭六文件后**最后**写 `case complete`。不设适配服务侧的 stub 指针目录或 `CASE2_DATA_MODE`。

## 6. 截图保存服务



### 6.1 输入校验

- 请求体只接受 `{ "image_base64": "..." }`。
- 允许纯 Base64 或 `data:image/png;base64,` 前缀；解码后必须以 PNG signature `89 50 4E 47 0D 0A 1A 0A` 开头。
- 空内容、非 PNG 或非法 Base64 返回 `400 INVALID_REQUEST`；请求体超过 `20 MiB` 返回 `413 PAYLOAD_TOO_LARGE`。
- 新截图开始前必须读取最新控制快照并确认 `case=case2,command=start,dt_type=with dt,save_picture_flag=1`；ownership 不匹配返回 `409 SCREENSHOT_NOT_REQUESTED`，不得生成额外截图或消费 Case3 flag。不额外锁死 status，允许保存期间从 `execute success` 推进到 `case complete`。



### 6.2 序号与落盘

1. 所有截图请求进入独立串行队列。
2. 创建 `{DT_SHARED_DIR}/out/case2/`。
3. 扫描严格匹配 `^calibrated-(\d+)\.png$` 的已完成文件。
4. 无历史文件取 `000`；否则最大序号加一；三位只是最小补零宽度，`1000` 不截断。
5. 先写同目录临时 PNG，`fsync`、关闭，再 rename 为最终文件。
6. 目标已存在时重新扫描并取下一号，绝不覆盖。
7. 最终 PNG 存在并可 stat 后，才调用控制文件服务写 `save_picture_flag=0`；该写入必须在共享队列内重读最新控制并复验 Case2 ownership，不能使用保存前旧快照。
8. 两步都成功后返回 `{ "ok": true, "path": "out/case2/calibrated-000.png", "seq": 0 }`。API 的 `path` 固定为相对 `DT_SHARED_DIR` 的 POSIX 风格路径；服务日志记录实际绝对路径。



### 6.3 失败边界与进程重启

本内部演示不创建 `.transactions/`、不计算 SHA-256、不做跨进程截图去重或重启恢复。截图可靠性止于“单进程串行 + 同目录临时文件 + 原子 rename + 不覆盖”：

1. 最终 PNG rename 成功且可 stat 后，才调用控制 POST 清 `save_picture_flag=0`。
2. 临时 PNG 写入、关闭或 rename 失败：尽力删除本次临时文件，返回 `500 SCREENSHOT_SAVE_FAILED`，不得清零。
3. 最终 PNG 已落盘但清零失败：保留 PNG，返回 `500 SCREENSHOT_SAVE_FAILED`，flag 可能仍为 `1`；Web 按同一任务有限重试处理。
4. 服务启动时只清理本服务命名规则下的残留临时 PNG，不删除已完成的 `calibrated-*.png`，也不恢复旧截图任务。
5. 若响应丢失但清零已成功，Web 补读控制快照见 flag=`0` 后按成功收尾；若 flag 仍为 `1`，重试可能额外保存一张新序号图片。该极端重复或崩溃导致的丢图已接受，不得覆盖旧文件，也不得改变业务 `status`。
6. 前两次 Web 生成/上传失败不得主动清零。累计第 3 次仍失败时，Web 可调用控制 POST `{save_picture_flag:0}` 放弃本张截图；该路径不生成 PNG、不占用新序号。

## 7. 测试计划



### 7.1 单元测试

- 控制文件：四种 payload、请求体禁止带 `status`、进页 `init` 写回空闲态、`start`/`reinit` 写后强制 `status=""`、相同 command 在 `execute fail` 后重试仍产生合法命令元组 + 空 status 门沿、截图清零不改 `status`、保留未知字段、并发 POST 串行、临时文件清理；GET 对未知 `status` 字面值 200 透传（不 `CONTROL_READ_FAILED`）；`save_picture_flag` 非 `0`/`1` 才拒读；Case2/Case3 活动、未消费终态、其他 Case fail 和未知活动 status 返回 `CONTROL_BUSY`，POST init 永远允许。
- 热力图：动态 `2×3`、`1×1`、CRLF、逗号/空白；空矩阵、行宽不一、科学计数、非有限数、归一后越出 `[-200,200]` 拒绝；超过 2 位小数四舍五入（如 `1.235→1.24`、`-1.235→-1.24`），不因小数位过多拒绝。
- KPI：动态 `N`、不同换行分组展平；空样本、非法 token、负号、归一后越出 `[0,500]` 拒绝；超过 2 位小数同样四舍五入后接受。
- 批次：六文件齐全；任一缺失、解析失败、读取期间变化、非 `case complete` 均整批拒绝；失败响应无部分 `metrics`；日志含失败文件名。
- 截图：非法 Base64/PNG；从 `000` 起；已有 `009` 后写 `010`；超过 `999` 自然扩展；并发请求不覆盖；Case2 guard 拒绝 Case3 flag，flag0 清零幂等，高电平清零 ownership 不匹配时拒绝。
- 截图失败边界：临时写/rename 失败不清零并清理临时文件；最终 PNG 已落盘但清零失败时保留 PNG、返回错误；进程重启只清残留临时 PNG，不删除完成文件、不恢复旧截图任务。
- 截图放弃：模拟 Web 同一任务累计 3 次失败后 POST `{save_picture_flag:0}`，断言不改 `status`、不生成 PNG、不占用序号并记录丢图日志。
- 截图响应丢失：Node 已落盘并清零但 Web 未收到成功响应时，后续 control GET 返回 flag=`0`；Web 据此按成功收尾。flag 仍为 `1` 时允许有限重试产生额外新序号，但不得覆盖旧文件。

打桩状态链测试见 [realback_no.md](realback_no.md) §5（不属于本包必过项，除非单独引入打桩测试包）。



### 7.2 HTTP 集成测试

- 每个成功响应与 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md) 示例 shape 一致。
- 每类错误都为 `{ok:false,error:{code,message}}`，且 HTTP 状态符合 §3.1；至少逐项覆盖 `400 INVALID_REQUEST`、两条 POST 路由的 `413 PAYLOAD_TOO_LARGE`、`404 DATA_FILE_MISSING`、`409 RESULT_BATCH_INCOMPLETE`、`409 SCREENSHOT_NOT_REQUESTED`、`422 DATA_FILE_INVALID` 以及四类 `500 *_FAILED`。
- Calibrated 在“状态非 complete 且文件缺失”时固定断言 `409 RESULT_BATCH_INCOMPLETE`；状态已 complete 后分别断言缺失为 409、内容非法为 422、非缺失类 I/O 故障为 500；首次/二次控制快照读取失败固定断言 `500 CONTROL_READ_FAILED`。
- `Cache-Control: no-store` 生效。
- 任一 POST 请求体超过 20 MiB 均返回 `413 PAYLOAD_TOO_LARGE`；截图路由不得生成文件。
- 跨 Case 冲突 Start/ReInit 返回 `409 CONTROL_BUSY`；Case2 截图保存/高电平清零不得消费 Case3 flag。



### 7.3 Gate 4 联调重点（适配服务视角）

- 真实共享挂载上验证同目录 `rename` 可用。
- 后端（或打桩）写 `execute success` 后，1000ms 轮询至少能观察一次，再看到终态；若真实后端状态跳转过快，必须回契约评审，不能仅把 Web 改成跳过中间状态。
- 后端与适配服务同时更新不同控制字段时，验证 `status` 和命令字段都不丢失。
- 启动路径窗口内连续两次 `0 -> 1` 截图请求，生成两个递增文件且每次都在成功后清零。



## 8. 明确不做

- 不实现后端校准算法、真实业务采集，或模拟后端状态机（后者见 [realback_no.md](realback_no.md)）。
- 不添加 WebSocket、Socket.IO、SSE、鉴权、数据库、任务队列或取消接口。
- 不引入 `CASE2_DATA_MODE` / stub 专用指针目录。
- 不实现截图持久事务、SHA-256 去重、跨进程幂等或进程重启恢复。
- 不为 AOA、ZOA、`without dt` 或其他 case **业务**预留运行分支；`case3`/`case4` 只保留 §1.2 目录与 `/api/caseN` 命名空间，本阶段不实现、不挂路由。
- 不读取 `02-ux/`、`03-design/` 或 `web-static/` 作为运行输入。
- 不把参考 Calibrated 文件宣称为本轮真实结果。
- 不把 case2 文件映射、截图序号或控制字段枚举写进 `src/shared/`（那些属于 `cases/case2/`）。
- 不在 `npm start` 默认路径启动打桩进程。
