# case2 Node 适配服务施工规格

> 使用者：Node 适配服务实现 agent。本文把 [API-CONTRACT.md](API-CONTRACT.md) v1 转成实现约束，不替代面向真实后端团队的 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md)。
>
> 本阶段的主要交付是前端 PC 上的 Node 本地适配服务；同包内允许提供一个仅供联调的后端打桩进程。默认运行不得启动打桩，也不得把打桩目录、指针文件或延时参数变成真实后端要求。

## 0. 出口条件

- [ ] 四个 REST 接口的路径、输入、输出和错误 shape 与契约一致。
- [ ] 浏览器不直接访问共享目录；所有控制、数据和截图文件 I/O 都由适配服务完成。
- [ ] 控制文件写入只修改允许字段，保留 `status`、未消费字段和未来未知字段。
- [ ] 动态 `Nx × Ny` 热力矩阵、动态 `N` KPI 样本和最多两位小数的规则有自动测试。
- [ ] Calibrated 任一文件缺失、变化或非法时整批拒绝，不返回部分数据。
- [ ] 截图递增命名、不覆盖、落盘后清零和进程重启恢复有自动测试。
- [ ] 打桩成功路径严格为 `execute success -> case complete`，且 `case complete` 最后写入。
- [ ] `npm test` 通过；启动命令可独立运行并可用 `Ctrl+C` 正常退出。
- [ ] 未实现 WebSocket、鉴权、数据库、命令队列、业务超时或自动重试。

## 1. 技术边界与目录

### 1.1 技术选择

- Node.js `>=20`，ESM。
- HTTP 层优先使用 `node:http`；当前仅四个接口，不引入 Express、Socket.IO 或数据库。
- 测试使用 `node:test` 与 `node:assert/strict`。
- 所有 API 默认只监听 `127.0.0.1`，不暴露到局域网。
- JSON 响应统一带 `Content-Type: application/json; charset=utf-8` 和 `Cache-Control: no-store`。
- 请求体上限 `20 MiB`，用于容纳 1920×1080 PNG 的 Base64；超限直接拒绝。

### 1.2 目标目录

```text
server/
├── package.json
├── README.md
├── src/
│   ├── index.mjs
│   ├── config.mjs
│   ├── http/
│   │   ├── router.mjs
│   │   └── response.mjs
│   ├── adapter/
│   │   ├── control-file.mjs
│   │   ├── data-files.mjs
│   │   ├── numeric-file.mjs
│   │   ├── screenshot.mjs
│   │   └── serial-queue.mjs
│   └── stub/
│       ├── backend-stub.mjs
│       └── publish-run.mjs
├── scripts/
│   ├── seed-shared-dir.mjs
│   └── request-screenshot.mjs
└── test/
    ├── control-file.test.mjs
    ├── data-files.test.mjs
    ├── numeric-file.test.mjs
    ├── screenshot.test.mjs
    ├── api.test.mjs
    └── backend-stub.test.mjs
```

运行时临时内容放在 `server/.runtime/`，并加入 `.gitignore`；测试使用各自的系统临时目录，不写入 `01-参考资料/`。

## 2. 运行配置与命令

### 2.1 环境变量

| 变量 | 默认值 | 要求 |
|---|---|---|
| `CASE2_ADAPTER_HOST` | `127.0.0.1` | 只允许显式配置后改变监听地址。 |
| `CASE2_ADAPTER_PORT` | `3102` | Web 通过同源代理或 API base 访问，不在组件中散落端口。 |
| `CASE2_SHARED_DIR` | 无 | 必填；真实挂载路径由部署环境注入，代码不得回退到 `01-参考资料/`。 |
| `CASE2_DATA_MODE` | `flat` | `flat` 为真实共享目录；`stub-pointer` 仅用于本地打桩。 |
| `CASE2_STUB_STEP_MS` | `750` | 仅打桩使用，保证 `execute success` 至少跨过三个 250ms Web 轮询窗口。 |
| `CASE2_STUB_OUTCOME` | `success` | 仅允许 `success` / `fail`，不得出现在正式 Web UI。 |

`CASE2_SHARED_DIR` 对应的最小运行时结构：

```text
{CASE2_SHARED_DIR}/
├── case_control.json
├── heatmap_init_rss.txt
├── heatmap_init_effective_path_num.txt
├── heatmap_init_first_path_delay.txt
├── heatmap_init_kpi_rss.txt
├── heatmap_init_kpi_effective_path_num.txt
├── heatmap_init_kpi_first_path_delay.txt
├── heatmap_cali_rss.txt
├── heatmap_cali_effective_path_num.txt
├── heatmap_cali_first_path_delay.txt
├── heatmap_cali_kpi_rss.txt
├── heatmap_cali_kpi_effective_path_num.txt
├── heatmap_cali_kpi_first_path_delay.txt
└── out/
    └── case2/
        └── calibrated-{seq}.png
```

`flat` 模式下 Initial 与 Calibrated 文件都从共享根读取。路径拼接必须固定文件名并经过内部映射，不接受来自 HTTP 的任意文件路径。

### 2.2 npm 命令

| 命令 | 用途 |
|---|---|
| `npm start` | 启动正式适配服务；缺少共享目录或控制文件时快速失败。 |
| `npm run dev` | 启动适配服务并输出可读日志，不启动打桩。 |
| `npm run dev:stub` | 准备 `server/.runtime/shared/`，再同时启动适配服务与开发打桩。 |
| `npm run stub:picture` | 当标志为 `0` 时将 `save_picture_flag` 置 `1`，用于重复截图联调。 |
| `npm test` | 运行全部 Node 自动测试。 |

`dev:stub` 的子进程必须在 `SIGINT` / `SIGTERM` 时一起退出，不遗留轮询进程。

## 3. REST 到实现映射

| 契约入口 | 实现职责 | 成功 HTTP | 主要失败 |
|---|---|---:|---|
| `GET /api/case2/control-file` | 读取、解析并校验控制 JSON，返回当前快照 | 200 | `CONTROL_READ_FAILED` |
| `POST /api/case2/control-file` | 校验三类允许 payload，读最新快照、字段合并、原子替换 | 200 | `CONTROL_WRITE_FAILED` / `INVALID_REQUEST` |
| `GET /api/case2/data-files?phase=...` | 解析并整批校验六文件 | 200 | `DATA_FILE_MISSING` / `DATA_FILE_INVALID` / `RESULT_BATCH_INCOMPLETE` |
| `POST /api/case2/screenshot` | 校验 Base64 PNG、递增落盘、成功后清零标志 | 200 | `SCREENSHOT_SAVE_FAILED` / `INVALID_REQUEST` |

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

HTTP 状态只表达传输/适配层：

- `400`：请求 shape、查询参数或 Base64 非法。
- `404`：必需文件缺失。
- `409`：Calibrated 当前不可读取、批次不完整或读取期间变化。
- `500`：共享目录读写、原子替换或截图落盘失败。

后端业务失败仍只来自 `status="execute fail"`，不得翻译成 REST 500。

## 4. 控制文件服务

### 4.1 GET

1. 从 `{CASE2_SHARED_DIR}/case_control.json` 读取 UTF-8 文本。
2. 空文件、非对象 JSON、缺少契约字段或枚举非法均返回 `CONTROL_READ_FAILED`。
3. 未消费的未知字段原样放入 `control` 返回，不能过滤后再用于后续写入。
4. 读取遇到短暂 JSON 解析失败可做最多 3 次、间隔 50ms 的文件读取重试；这是 I/O 防抖，不是业务命令重试。

### 4.2 POST 允许的三种 payload

```json
{ "case": "case2", "command": "start", "dt_type": "with dt" }
```

```json
{ "command": "reinit" }
```

```json
{ "save_picture_flag": 0 }
```

- 只接受以上三种完整 shape；混入 `status`、未知字段、`save_picture_flag=1` 或其他枚举一律 `400 INVALID_REQUEST`。
- 启动与重置是否可点击由 Web 状态机负责；适配服务仍必须防止非法字段写入。
- 截图接口内部清零必须复用同一控制文件写服务，不另写一套文件算法。

### 4.3 最小写入算法

所有控制文件写入进入适配服务进程内同一串行队列：

1. 读取最新完整 JSON。
2. 只合并本次 payload 的允许字段。
3. 将完整合并结果写入共享目录中的唯一临时文件。
4. `fsync` 并关闭临时文件。
5. 在同一目录内用原子 `rename` 替换 `case_control.json`。
6. 重新读取并返回写后快照。

临时文件名必须包含进程号与随机 nonce；异常退出后遗留的临时文件不作为控制文件读取。

本项目不增加跨 PC 租约服务、数据库或长期 `.lock` 文件。进程内串行队列只解决前端侧并发请求；同目录原子替换只解决半写 JSON。真实后端与适配服务若同时整文件写入，仍可能发生最后写者覆盖，这是没有版本号的共享 JSON 的固有限制。Gate 4 必须做一次双端并发写验证；若出现字段丢失，回到契约层增加双方共同遵守的锁协议，不能在适配服务内部假装已经解决。

## 5. 数据文件服务

### 5.1 文件映射

服务端固定维护 `rss`、`effective_path_num`、`first_path_delay` 三项映射；HTTP 不接受指标名或文件名参数。`phase` 只允许 `initial` / `calibrated`。

每次响应必须包含三项指标，每项同时包含 `heatmap` 与 `kpi`；任何一个失败则整个请求失败。

### 5.2 数值词法与解析

- 接受 LF / CRLF。
- 行内接受 ASCII 逗号或任意空白分隔；连续分隔符产生的空 token 忽略。
- 数值 token 接受正负整数或最多两位小数，不接受科学计数法、`NaN`、`Infinity`、空 token 或尾随非数值字符。
- 固定词法：`^[+-]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$`，通过后再转为 `Number` 并检查 `Number.isFinite`。
- 热力图忽略首尾空行，但中间非空行必须等长；非空矩形即可，允许 `1×1`、`1×N`、`N×1`。
- KPI 忽略行列分组并按文件顺序展平成一维，至少一个数值。

### 5.3 稳定读取

Initial 六文件只做单批完整校验。Calibrated 额外执行：

1. 读取控制快照，确认当前 `status="case complete"`。
2. 记录六文件的路径、大小和高精度修改时间。
3. 读取并解析六文件。
4. 再次读取六文件 stat 与控制快照。
5. 任一文件在读取期间变化、状态不再是 `case complete` 或任一文件非法，返回 `409 RESULT_BATCH_INCOMPLETE`。

服务不缓存上一批 Calibrated；失败时不得返回旧数据或参考样本。

### 5.4 打桩专用原子批次

`CASE2_DATA_MODE=stub-pointer` 时，仅 Calibrated 数据改从内部指针解析：

```text
{CASE2_SHARED_DIR}/
├── .stub-current.json
└── .stub-runs/
    └── run-<id>/
        └── 六个 heatmap_cali_*.txt
```

打桩发布顺序：

1. 在 `.stub-runs/run-<id>.tmp/` 写完并关闭六文件。
2. 将临时目录 rename 为 `.stub-runs/run-<id>/`。
3. 原子替换 `.stub-current.json`，只指向已经完成的运行目录。
4. 最后把控制文件 `status` 写成 `case complete`。

适配服务一次请求只解析一次指针并固定该目录，避免跨批次混读。该指针、目录和模式仅用于本地打桩，不写进真实后端交接文档。

## 6. 截图保存服务

### 6.1 输入校验

- 请求体只接受 `{ "image_base64": "..." }`。
- 允许纯 Base64 或 `data:image/png;base64,` 前缀；解码后必须以 PNG signature `89 50 4E 47 0D 0A 1A 0A` 开头。
- 空内容、非 PNG、非法 Base64 或超限返回 `400 INVALID_REQUEST`。
- 新截图事务开始前必须读取最新控制快照并确认 `save_picture_flag=1`；若当前为 `0` 且没有待恢复事务，返回 `409 INVALID_REQUEST`，不得生成额外截图。

### 6.2 序号与落盘

1. 所有截图请求进入独立串行队列。
2. 创建 `{CASE2_SHARED_DIR}/out/case2/`。
3. 扫描严格匹配 `^calibrated-(\d+)\.png$` 的已完成文件。
4. 无历史文件取 `000`；否则最大序号加一；三位只是最小补零宽度，`1000` 不截断。
5. 先写同目录临时 PNG，`fsync`、关闭，再 rename 为最终文件。
6. 目标已存在时重新扫描并取下一号，绝不覆盖。
7. 最终 PNG 存在并可 stat 后，才调用控制文件服务写 `save_picture_flag=0`。
8. 两步都成功后返回 `{ "ok": true, "path": "...", "seq": 0 }`。

### 6.3 进程重启去重

为覆盖“PNG 已保存、标志尚未清零时进程重启”，每次截图事务在 `out/case2/.transactions/` 创建轻量事务标记，记录 `seq`、最终路径和 PNG SHA-256：

1. 先原子写事务标记，再写 PNG。
2. PNG 完成后清零控制标志。
3. 清零成功后删除事务标记。
4. 服务启动和新截图请求前先恢复未完成事务：最终 PNG 已存在时只重试清零，不再生成新序号；PNG 不存在时清理无效事务后再处理当前请求。

事务标记不是序号 manifest 或数据库；序号权威仍是已完成的 `calibrated-*.png`。同一高电平请求不会因轮询、HTTP 重试或适配服务重启重复保存。

任何失败都不得提前清零；已完成 PNG 不删除、不覆盖。

## 7. 开发打桩

打桩只模拟共享文件另一端，不提供额外 REST：

- 公共 POST 控制接口仍禁止 `status`；打桩进程使用仅在 `src/stub/` 可调用的后端字段写入器。该写入器与适配服务复用同一“读最新快照 + 字段合并 + 同目录原子替换”基础函数，但拥有独立的 `status` allowlist，不能被 HTTP 路由调用。
- 轮询控制文件修改；只在新写入的可执行命令上动作，不能因为自己写了 `status` 而重复触发。
- `start` 成功：写 `execute success`，等待 `CASE2_STUB_STEP_MS`，按 5.4 发布六文件，最后写 `case complete`。
- `reinit` 成功：写 `execute success`，等待 `CASE2_STUB_STEP_MS`，最后写 `reinit complete`。
- `CASE2_STUB_OUTCOME=fail`：收到 `start` 或 `reinit` 后只写 `execute fail`，本轮绝不再写完成终态。
- 不把 `command` 自动改回 `init`，不把 `status` 自动改回 `""`。
- `scripts/request-screenshot.mjs` 只在当前标志为 `0` 时置 `1`；待适配服务清零后可再次运行，验证 `000/001/002...`。
- 打桩数据来源可复制 `01-参考资料/case2/前后端数据接口文件/`，但日志和 UI 必须标注为参考/打桩数据。

## 8. 测试计划

### 8.1 单元测试

- 控制文件：三种 payload、禁止写 `status`、保留未知字段、并发 POST 串行、临时文件清理。
- 热力图：动态 `2×3`、`1×1`、CRLF、逗号/空白；空矩阵、行宽不一、超过两位小数、科学计数、非有限数拒绝。
- KPI：动态 `N`、不同换行分组展平；空样本和非法 token 拒绝。
- 批次：六文件齐全；任一缺失、解析失败、读取期间变化、非 `case complete` 均整批拒绝。
- 截图：非法 Base64/PNG；从 `000` 起；已有 `009` 后写 `010`；超过 `999` 自然扩展；并发请求不覆盖。
- 截图恢复：PNG 已完成但未清零时模拟进程重启，只清零并返回原序号。
- 打桩：成功、失败、重置三条状态链；断言 `case complete` 在六文件关闭和指针切换之后。

### 8.2 HTTP 集成测试

- 每个成功响应与 [BACKEND-API-HANDOFF.md](BACKEND-API-HANDOFF.md) 示例 shape 一致。
- 每类错误都为 `{ok:false,error:{code,message}}`，且 HTTP 状态符合第 3 节。
- `Cache-Control: no-store` 生效。
- 请求体超过 20 MiB 被拒绝且不生成文件。

### 8.3 Gate 4 联调重点

- 真实共享挂载上验证同目录 `rename` 可用。
- 后端写 `execute success` 后，250ms 轮询至少能观察一次，再看到终态；若真实后端状态跳转过快，必须回契约评审，不能仅把 Web 改成跳过中间状态。
- 后端与适配服务同时更新不同控制字段时，验证 `status` 和命令字段都不丢失。
- 后端连续发出两次 `0 -> 1` 截图请求，生成两个递增文件且每次都在成功后清零。

## 9. 明确不做

- 不实现后端校准算法或真实业务采集。
- 不添加 WebSocket、Socket.IO、SSE、鉴权、数据库、任务队列或取消接口。
- 不为 AOA、ZOA、`without dt` 或其他 case 预留运行分支。
- 不读取 `02-ux/`、`03-design/` 或 `web-static/` 作为运行输入。
- 不把参考 Calibrated 文件宣称为本轮真实结果。
- 不用固定 sleep 代替真实后端完成状态；固定延时只存在于开发打桩。
