# Node 文件适配服务

本服务运行在前端 PC，向 Web 提供 `/api/case2/*` 与 `/api/case3/*` REST，并独占浏览器侧的共享目录文件 I/O。

## 运行

```bash
npm start
```

本地默认把 `DT_SHARED_DIR` 解析为仓库内 `code/comdatafiles` 的绝对路径（与打桩服务共用）。该默认由 **`npm start` / `npm run dev` 脚本注入**（见 `package.json`），**不是** `config.mjs` 静默回退：配置层仍要求环境变量为绝对目录。正式部署或换共享根时再显式覆盖：

```bash
DT_SHARED_DIR=/absolute/path/to/shared npm start
```

`CASE2_SHARED_DIR` 仅作为旧脚本兼容 fallback；新配置使用 `DT_SHARED_DIR`。

默认监听 `127.0.0.1:3102`。可通过 `CASE2_ADAPTER_HOST`、`CASE2_ADAPTER_PORT` 覆盖。

## 测试

```bash
npm test
```

## 边界

- 已实现 case2 与 case3 文件适配；不推进业务 `status`。
- 不启动模拟后端，不读取 `01-参考资料/`。
- `src/shared/` 只放通用基础能力；case2/case3 字段、文件名、数值校验和截图规则分别位于 `src/cases/case2/`、`src/cases/case3/`。
- Case3 负责单侧文件清空、多 txt 收编、最终快照门槛、调试 JSONL 输出和 `out/case3/case3-{seq}.png` 截图落盘。

## 特别注意：Case3 `GET /api/case3/side` 终态门槛

仅当控制文件**同时**满足下列条件时，本次 `/side` 才按**最终读取**执法（`isFinalRead=true`）：

```text
case == "case3"
&& command == "start"
&& dt_type == 请求侧对应值   # without → "without dt"；with → "with dt"
&& status == "case complete"
```

任一成立即返回 **`409 RESULT_NOT_READY`**（不返回残缺 completed）：

| 条件 | 含义 |
|------|------|
| `completeCount === 0` | 空点（各点位文件最短完整前缀为 0） |
| `pendingTail === true` | 半行、多文件行数不齐，或读中 size/mtime 仍在变 |
| `costPct === null` | 该侧 Cost 文件无有效最新值 |
| 读前后 control 元组漂移 | 同一次读里 `case/command/dt_type` 在 before/after 不一致 |

**不是门槛的：**

- 点数不必等于 base route（例如预置 31 点）；只要齐、有点、有 Cost、无 pending，即可 200。
- 另一侧的 `case complete` **不会**触发本侧终态门槛；侧别不匹配时仍按运行中/只读前缀返回（可空点、pending、null Cost）。
- ReInit 路径不读 `/side`，也不使用 `RESULT_NOT_READY`。

实现位置：`src/cases/case3/side-files.mjs`（`readSide`）。细则见 [../../doc/case3/SERVER-SPEC.md](../../doc/case3/SERVER-SPEC.md) / [API-CONTRACT.md](../../doc/case3/API-CONTRACT.md)。

### 怎么观察

1. **控制文件**：确认 `code/comdatafiles/case_control.json`（或 `DT_SHARED_DIR` 下同名文件）已是上表四元组 + `case complete`。
2. **浏览器 Network**：Web 在 Start 且已见 `execute success` 后轮询；终态时 `GET /api/case3/side?side=without|with`
   - `200` + `ok:true` 且 `pendingTail:false`、`points.length>0`、`costPct!=null` → 可通过
   - `409` + `error.code === "RESULT_NOT_READY"` → Node 终态门禁拒绝
3. **适配服务日志**：成功读有 `case3 side snapshot read`（含 `final: true/false`、`completeCount`、`pendingTail`、`hasCost`）；`409` 时按统一错误响应打出。
4. **Web 侧**：连续不过关会 warn「最终快照未就绪，继续等待」；满 10 次后 error「无DT/有DT启动测试结果不完整…」并徽标「结果不完整已自动回退」（Web 出口，不是 Node 放行）。

联调时若后端已写 `case complete` 但仍一直 `409`：先对表各侧 txt 行数是否一致、有无半行、Cost 是否有非空行，再看控制元组是否在读文件窗口内被改写。

## 特别注意：Case2 `GET /api/case2/data-files?phase=calibrated` 终态门槛

仅当控制快照同时满足 `case == "case2"`、`command == "start"`、`dt_type == "with dt"`、`status == "case complete"` 时，才允许返回 Calibrated 六文件批次；否则 **`409 RESULT_BATCH_INCOMPLETE`**。读批期间文件变化，或二次控制快照不再满足该四元组，同样 `409`。缺文件 / 内容非法另有 `DATA_FILE_MISSING` / `DATA_FILE_INVALID` 等码。

实现：`src/cases/case2/data-files.mjs`。细则见 [../../doc/case2/SERVER-SPEC.md](../../doc/case2/SERVER-SPEC.md)。

### 怎么观察

1. **控制文件**已是 `case=case2,command=start,dt_type=with dt,status=case complete`。
2. **Network**：`GET /api/case2/data-files?phase=calibrated` → `200` 为齐批；`409 RESULT_BATCH_INCOMPLETE` 为未齐/读中变化。
3. **Web 侧**（与 Case3 对齐）：连续失败会 warn「最终 Calibrated 批次未就绪，继续等待」；满 10 次后 error「启动测试结果不完整…」并徽标「结果不完整已自动回退」，随后 POST `init` 撤权。

### start / reinit 清空 Calibrated（与 Case3 对齐）

合法 `POST` start 或 reinit 时，Node 在写控制前将下列六个文件写空（不清 Initial）：

- `heatmap_cali_rss.txt` / `heatmap_cali_kpi_rss.txt`
- `heatmap_cali_effective_path_num.txt` / `heatmap_cali_kpi_effective_path_num.txt`
- `heatmap_cali_first_path_delay.txt` / `heatmap_cali_kpi_first_path_delay.txt`

观察：点启动或重置后，上述文件应为空；失败码 `500 CALIBRATED_CLEAR_FAILED` 时控制文件不应已推进到新命令。
