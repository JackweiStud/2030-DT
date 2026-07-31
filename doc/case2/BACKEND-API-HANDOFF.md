# case2 后端接口交接文档

本文面向后端团队，描述 `DT Calibration`（case2）需要遵守的共享文件、状态、数据文件、前端侧 REST 适配语义、WebSocket 边界、主线时序、错误格式和检查清单。

## 1. 系统边界


| 组件            | 职责                                                                     | 不负责                                      |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| 后端业务进程        | 读取控制文件；执行启动/重置；写 `status`；发布 Calibrated 结果文件；按需置 `save_picture_flag=1` | 浏览器展示；截图编码；截图文件落盘；清零 `save_picture_flag` |
| 前端侧 Node 适配服务 | 代表 Web 读写控制文件；读取和校验数据文件；保存截图 PNG；保存成功后清零 `save_picture_flag`           | 后端算法；写后端状态；伪造完成结果                        |
| Web 前端        | 用户交互；展示状态；渲染热力图/KPI；生成 Base64 PNG 截图                                   | 直接读写共享目录；直接写控制文件；直接输出截图文件                |


共享目录实际挂载路径由部署双方约定。本文用 `{SHARED_DIR}` 表示该共享根目录。

## 2. 接口总表


| 接口/文件                            | 方向                    | 所有者     | 用途                           |
| -------------------------------- | --------------------- | ------- | ---------------------------- |
| `{SHARED_DIR}/case_control.json` | 前端侧适配服务 ↔ 后端业务进程      | 双方分字段写入 | 命令、状态和截图请求控制                 |
| Calibrated 六个结果文件                | 后端业务进程 → 前端侧适配服务      | 后端业务进程  | 发布本轮校准结果                     |
| Initial 六个输入文件                   | 后端业务进程/部署材料 → 前端侧适配服务 | 部署约定    | 提供 Initial 基线输入              |
| `GET /api/case2/control-file`    | Web → 前端侧适配服务         | 前端侧适配服务 | 读取控制文件快照                     |
| `POST /api/case2/control-file`   | Web → 前端侧适配服务         | 前端侧适配服务 | 写启动、重置和截图清零字段                |
| `GET /api/case2/data-files`      | Web → 前端侧适配服务         | 前端侧适配服务 | 读取 Initial 或 Calibrated 数据文件 |
| `POST /api/case2/screenshot`     | Web → 前端侧适配服务         | 前端侧适配服务 | 上传 Base64 PNG 截图，由适配服务保存     |
| WebSocket                        | 无                     | 无       | 本接口不使用 WebSocket             |




## 3. 控制文件格式

控制文件为 JSON 对象。字段之外的未知键必须保留，任何一方不得整文件覆盖导致对方字段丢失。

```json
{
  "case": "case2",
  "command": "init",
  "dt_type": "",
  "status": "",
  "save_picture_flag": 0,
  "debug_flag": 0,
  "scene_type": "U6G"
}
```


| 字段                  | 类型/允许值                                                                                  | 写方                          | 要求                         |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------- | -------------------------- |
| `case`              | 字符串；case2 固定写 `"case2"`                                                                 | 前端侧适配服务                     | 启动请求必须写为 `case2`           |
| `command`           | `"init"` / `"start"` / `"reinit"`                                                       | 前端侧适配服务                     | `start` 表示启动；`reinit` 表示重置 |
| `dt_type`           | `""` / `"with dt"`                                                                      | 前端侧适配服务                     | case2 启动必须写 `"with dt"`    |
| `status`            | `""` / `"execute success"` / `"execute fail"` / `"case complete"` / `"reinit complete"` | 后端业务进程                      | 前端侧不得写该字段                  |
| `save_picture_flag` | `0` / `1`                                                                               | 后端置 `1`；前端侧适配服务保存截图成功后置 `0` | Web 不直接写该字段                |
| `debug_flag`        | 整数                                                                                      | 部署约定                        | 当前 Web 不消费、不修改             |
| `scene_type`        | 字符串                                                                                     | 部署约定                        | 当前 Web 不消费、不修改             |




## 4. 状态语义


| `status`            | 含义          | 前端行为                                                                |
| ------------------- | ----------- | ------------------------------------------------------------------- |
| `""`                | 初始化/空闲      | 显示 Initial，Calibrated 为空                                            |
| `"execute success"` | 命令执行成功的中间状态 | 启动路径继续等待 `case complete`； 重置路径继续等待 `reinit complete`                |
| `"execute fail"`    | 命令执行失败终态    | 显示执行命令失败； 本轮不再等待完成状态                                                |
| `"case complete"`   | 后端系统测试完成    | 前端只在本轮启动且已观察到 `execute success -> case complete` 后读取 Calibrated 六文件 |
| `"reinit complete"` | 后端系统重置完成    | 前端移除 Calibrated 显示，恢复 Initial                                       |




## 5. 命令写入要求



### 5.1 启动

前端侧适配服务代表 Web 写入：

```json
{
  "case": "case2",
  "command": "start",
  "dt_type": "with dt"
}
```

后端读取到该命令后：

1. 执行启动。
2. 命令执行成功后写 `status="execute success"`。
3. 完整写完并关闭六个 Calibrated 文件。
4. 最后写 `status="case complete"`。

`case complete` 必须是结果发布之后的最后状态信号。

### 5.2 重置

前端侧适配服务代表 Web 写入：

```json
{
  "command": "reinit"
}
```

后端读取到该命令后：

1. 执行重置。
2. 命令执行成功后写 `status="execute success"`。
3. 重置完成后写 `status="reinit complete"`。

后端不需要再把 `command` 改回 `init`，也不需要再把 `status` 改回 `""`。

### 5.3 命令失败

如果启动或重置命令执行失败，后端写：

```json
{
  "status": "execute fail"
}
```

写入 `execute fail` 后，本轮不得继续写 `case complete` 或 `reinit complete`。

## 6. 数据文件要求



### 6.1 文件清单


| UI 指标   | Initial 热力图                           | Calibrated 热力图                        | Initial KPI 样本                            | Calibrated KPI 样本                         |
| ------- | ------------------------------------- | ------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| RSS 误差  | `heatmap_init_rss.txt`                | `heatmap_cali_rss.txt`                | `heatmap_init_kpi_rss.txt`                | `heatmap_cali_kpi_rss.txt`                |
| 有效路径数误差 | `heatmap_init_effective_path_num.txt` | `heatmap_cali_effective_path_num.txt` | `heatmap_init_kpi_effective_path_num.txt` | `heatmap_cali_kpi_effective_path_num.txt` |
| 首径时延误差  | `heatmap_init_first_path_delay.txt`   | `heatmap_cali_first_path_delay.txt`   | `heatmap_init_kpi_first_path_delay.txt`   | `heatmap_cali_kpi_first_path_delay.txt`   |


当前 case 2 UI 只消费以上三项。

### 6.2 热力图文件内容

热力图文件表示 `Nx × Ny` 误差矩阵：

- `Nx` 和 `Ny` 不固定为 20。
- 文件必须是非空矩形矩阵。
- 每个非空行必须有相同数量的数值。
- 数值必须是有限数值。
- 分隔符允许逗号或空白字符。
- 换行允许 LF 或 CRLF。
- 数值最多保留 2 位小数。

示例：

```text
0.12 0.18 0.20
0.10 0.14 0.19
```

示例：

```text
0.12,0.18,0.20
0.10,0.14,0.19
```

### 6.3 KPI 文件内容

KPI 文件表示 `N` 个误差样本：

- `N` 不固定为 20。
- 至少包含 1 个有限数值。
- 行列排布不表达业务语义，前端侧按数值样本集合处理。
- 分隔符允许逗号或空白字符。
- 换行允许 LF 或 CRLF。
- 数值最多保留 2 位小数。

示例：

```text
0.12
0.18
0.20
```

示例：

```text
1.1,0.1,6
```

### 6.4 Calibrated 发布要求

启动后，后端必须先完整写完并关闭以下六个文件：

- `heatmap_cali_rss.txt`
- `heatmap_cali_effective_path_num.txt`
- `heatmap_cali_first_path_delay.txt`
- `heatmap_cali_kpi_rss.txt`
- `heatmap_cali_kpi_effective_path_num.txt`
- `heatmap_cali_kpi_first_path_delay.txt`

六个文件全部完成后，最后写：

```json
{
  "status": "case complete"
}
```

前端侧只在本轮启动后观察到 `execute success -> case complete` 时读取这六个文件。文件缺失、格式错误、非矩形热力图或非法 KPI 样本会导致整批拒绝。

## 7. 截图请求

后端需要请求截图时，将控制文件中的 `save_picture_flag` 从 `0` 写为 `1`。

前端侧行为：

1. Web 读取到 `save_picture_flag=1` 后立即截图，不额外判断 `status`。
2. Web 通过 `POST /api/case2/screenshot` 上传 Base64 PNG。
3. 前端侧适配服务保存为 `{SHARED_DIR}/out/case2/calibrated-{seq}.png`。
4. `seq` 从 `000` 开始递增，例如 `calibrated-000.png`、`calibrated-001.png`。
5. 前端侧适配服务确认 PNG 完整落盘后，将 `save_picture_flag` 写回 `0`。

若截图生成、传输或落盘失败，前端侧不得清零 `save_picture_flag`。后端后续再次把 `save_picture_flag` 从 `0` 写为 `1` 时，会生成下一张递增序号截图。

## 8. REST 输入输出

REST 接口由前端侧 Node 适配服务承载，后端业务进程不需要实现这些接口。这里列出 REST 语义，是为了后端团队理解 Web 与共享文件之间的中间层。

### 8.1 `GET /api/case2/control-file`

返回控制文件快照。

成功响应：

```json
{
  "ok": true,
  "control": {
    "case": "case2",
    "command": "start",
    "dt_type": "with dt",
    "status": "execute success",
    "save_picture_flag": 0,
    "debug_flag": 0,
    "scene_type": "U6G"
  }
}
```



### 8.2 `POST /api/case2/control-file`

用于写启动、重置或截图清零字段。

启动请求：

```json
{
  "case": "case2",
  "command": "start",
  "dt_type": "with dt"
}
```

重置请求：

```json
{
  "command": "reinit"
}
```

截图清零请求：

```json
{
  "save_picture_flag": 0
}
```

成功响应：

```json
{
  "ok": true,
  "control": {}
}
```

响应中的 `control` 为写入后的控制文件快照。

### 8.3 `GET /api/case2/data-files`

查询参数：


| 参数      | 允许值                      | 含义                           |
| ------- | ------------------------ | ---------------------------- |
| `phase` | `initial` / `calibrated` | 读取 Initial 输入或 Calibrated 结果 |


成功响应：

```json
{
  "ok": true,
  "phase": "calibrated",
  "metrics": {
    "rss": {
      "heatmap": [[0.12, 0.18], [0.10, 0.14]],
      "kpi": [0.12, 0.18, 0.20]
    },
    "effective_path_num": {
      "heatmap": [[1.0, 2.0], [1.5, 2.5]],
      "kpi": [1.0, 1.5, 2.0]
    },
    "first_path_delay": {
      "heatmap": [[0.03, 0.04], [0.02, 0.05]],
      "kpi": [0.03, 0.04, 0.05]
    }
  }
}
```



### 8.4 `POST /api/case2/screenshot`

请求：

```json
{
  "image_base64": "iVBORw0KGgo..."
}
```

成功响应：

```json
{
  "ok": true,
  "path": "{SHARED_DIR}/out/case2/calibrated-000.png",
  "seq": 0
}
```



## 9. WebSocket 事件

本接口不使用 WebSocket。


| 事件  | 说明                           |
| --- | ---------------------------- |
| 无   | 状态和数据均通过共享文件与前端侧 REST 适配语义表达 |




## 10. 错误 shape

前端侧 REST 适配服务失败时，统一返回：

```json
{
  "ok": false,
  "error": {
    "code": "CONTROL_READ_FAILED",
    "message": "failed to read case_control.json"
  }
}
```

建议错误码：


| code                      | 含义                  |
| ------------------------- | ------------------- |
| `CONTROL_READ_FAILED`     | 控制文件读取失败            |
| `CONTROL_WRITE_FAILED`    | 控制文件写入失败            |
| `DATA_FILE_MISSING`       | 数据文件缺失              |
| `DATA_FILE_INVALID`       | 数据文件格式非法            |
| `RESULT_BATCH_INCOMPLETE` | Calibrated 六文件批次不完整 |
| `SCREENSHOT_SAVE_FAILED`  | 截图保存失败              |


后端业务失败不得使用 REST 错误表达；后端业务失败只写 `status="execute fail"`。

## 11. 主线时序



### 11.1 启动到结果完成

```mermaid
sequenceDiagram
  autonumber
  participant Web as "Web 前端"
  participant Adapter as "前端侧适配服务"
  participant Shared as "共享目录"
  participant Backend as "后端业务进程"

  Web->>Adapter: POST control-file: start + with dt
  Adapter->>Shared: 写 case=case2, command=start, dt_type=with dt
  Backend->>Shared: 读取 command=start
  Backend->>Shared: 写 status=execute success
  Backend->>Shared: 写完并关闭 6 个 Calibrated 文件
  Backend->>Shared: 最后写 status=case complete
  Web->>Adapter: GET control-file
  Adapter-->>Web: 返回 case complete
  Web->>Adapter: GET data-files?phase=calibrated
  Adapter->>Shared: 读取并校验 6 文件
  Adapter-->>Web: 返回完整数据批次
```





### 11.2 重置完成

```mermaid
sequenceDiagram
  autonumber
  participant Web as "Web 前端"
  participant Adapter as "前端侧适配服务"
  participant Shared as "共享目录"
  participant Backend as "后端业务进程"

  Web->>Adapter: POST control-file: reinit
  Adapter->>Shared: 写 command=reinit
  Backend->>Shared: 读取 command=reinit
  Backend->>Shared: 写 status=execute success
  Backend->>Shared: 写 status=reinit complete
  Web->>Adapter: GET control-file
  Adapter-->>Web: 返回 reinit complete
```





### 11.3 截图保存

```mermaid
sequenceDiagram
  autonumber
  participant Web as "Web 前端"
  participant Adapter as "前端侧适配服务"
  participant Shared as "共享目录"
  participant Backend as "后端业务进程"

  Backend->>Shared: 写 save_picture_flag=1
  Web->>Adapter: GET control-file
  Adapter-->>Web: 返回 save_picture_flag=1
  Web->>Adapter: POST screenshot: Base64 PNG
  Adapter->>Shared: 保存 out/case2/calibrated-{seq}.png
  Adapter->>Shared: 写 save_picture_flag=0
```





## 12. 后端检查清单

- [ ] 启动命令只认 `case="case2"`、`command="start"`、`dt_type="with dt"`。
- [ ] 重置命令只认 `command="reinit"`。
- [ ] `execute success` 只作为中间状态写入，不作为完成状态。
- [ ] 启动成功链路为 `execute success -> case complete`。
- [ ] 重置成功链路为 `execute success -> reinit complete`。
- [ ] 失败链路只写 `execute fail`，本轮不再写完成状态。
- [ ] 写 `case complete` 前，六个 Calibrated 文件已经完整写完并关闭。
- [ ] 热力图文件为动态 `Nx × Ny` 非空矩形矩阵，不固定 20×20。
- [ ] KPI 文件为动态 `N` 个有限样本，不固定 20 条。
- [ ] 热力图和 KPI 文件数值最多保留 2 位小数。
- [ ] 需要截图时，将 `save_picture_flag` 从 `0` 写为 `1`。
- [ ] 不清零 `save_picture_flag`；清零由前端侧适配服务在截图保存成功后完成。
- [ ] 不要求重置完成后再回写 `command=init,status=""`。
- [ ] 不依赖 WebSocket。
