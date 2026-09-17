# case4 API 契约 v1

> status: `APPROVED — 用户授权复核通过后定稿并进入下一阶段`
>
> updated_at: `2026-09-15`
>
> 本文面向 case4 Web、前端 PC Node 文件适配服务与后端文件交互。业务依据为 `PHASE0-SCOPE.md`、`BACKEND-QUESTIONS.md` 和用户最新确认；工程结构参考 case3 已批准契约及现行实现。已有业务决定继续有效。
>
> 工程选择已于 2026-09-15 检视后采纳，经用户授权复核通过后定稿为 v1：REST 三分（`/trajectory`、`/throughput?side=`、`/result`）、共享子目录 `case4/`、接受科学计数、列含义与 JSON 小数位见 §2/§4/§5、超过 base 的实时行报错不截短。业务澄清仍覆盖：某一路吞吐整轮为空允许完成，该路保持空态。
>
> 本文不授权修改现有后端文件名或引入 Socket。面向后端的简洁交接文档在本文批准后再整理，避免两套未冻结说明。

## 0. 接口总表与复用边界

Web 只通过本机 REST 访问 Node；真实后端只读写共享目录，不提供 REST、不使用 WebSocket。

```text
Web ──POST control──► Node ──原子写──► case_control.json ◄──后端写 status / flag=1
                         │
                         └─ start/reinit 前清 9 个动态文件（base 不清）

case4/ 文件                     REST                         Web 展示
base 只读 ──────────────────► GET init-data.baseRoute ──► 预期轨迹；误差基准
3 路 realtime xyz append ──► GET /trajectory 共同前缀 K ──► 三轨迹 / 当前点 / XY 误差
2 路 thrp 独立 append ─────► GET /throughput?side= ─────► 两条曲线，样点序号
3 CDF + 1 汇总 仅最终 ─────► GET /result 整批快照 ──────► CDF / CEP / NLOS
                                                    hypot 只在 Web；不回写文件
```

| 方法 | 路径 | 请求 | 成功响应主要字段 | 调用时机 |
|---|---|---|---|---|
| GET | `/api/case4/control-file` | 无 | `ok, control` | 初始化及运行/重置/最终读取/截图收尾期间 |
| POST | `/api/case4/control-file` | §3 四种精确请求体之一 | `ok, control` | init/start/reinit/截图放弃清零 |
| GET | `/api/case4/init-data` | 无 | `ok, baseRoute` | init 成功后 |
| GET | `/api/case4/trajectory` | 无 | `ok, points, completeCount, pendingTail` | 本轮已见 success、且尚未因 complete 转入最终读取 |
| GET | `/api/case4/throughput?side=without` 或 `side=with` | 唯一 query：side | `ok, side, samples, pendingTail` | 同上，两路独立读取 |
| GET | `/api/case4/result` | 无 | `ok, trajectory, throughput, statistics` | 本轮先见 success 再见 complete 后，最终统一快照 |
| POST | `/api/case4/screenshot` | `{ image_base64 }` | `ok, path, seq` | 本轮已登记截图请求，且最终渲染完成后 |

- 沿用 case3：共享 control store、串行控制写、跨 Case busy、init 撤权、最终读取有限重试、截图 ownership 与有限重试。
- case4 不继承：双侧启动/重置、历史侧配对、BeamID/Cost/BA、反射必需文件、吞吐与轨迹行号绑定。
- 一次 Start 覆盖三方案；`dt_type="all"` 是控制值，不是“只读取 DT 方案”的筛选条件。
- `/trajectory`、两路 `/throughput` 分开读取，避免一类数据的等待或错误阻塞其他运行中数据；`/result` 承担最终统一提交门槛。响应均为全量替换快照，不是 append 事件。
- Node 对 `/trajectory`、`/throughput` **不做** complete 门槛。complete 后九个动态文件仍留在磁盘，直到下一轮 start/reinit 才清；刷新回到 initial 时旧文件仍可能可读。**Web 纪律**：仅本轮已见 `execute success`、且尚未因 complete 转入最终读取时才调用这两类接口；进页、initial、刷新后的初始化握手完成前禁止调用。

## 1. 职责、目录与首版范围

| 层 | 负责 |
|---|---|
| Shell | 共用导航、固定 1920×1080 缩放、跨 Case 忙态锁；接入现有现场环境展示机制 |
| case4 Web | 用户动作、本轮状态、串行轮询、展示、XY 偏差派生、最终结果一次提交、截图；REST shape 防御 |
| Node 文件服务 | 唯一浏览器侧文件 I/O；控制保护、限定清理、解析/校验、65535 归一、完整前缀、稳定最终快照、截图落盘与诊断日志 |
| 后端 / 本地打桩 | 响应合法命令、停止旧轮写入、追加实时数据、完整发布统计、写业务 status、按窗口请求截图 |

控制为 `{DT_SHARED_DIR}/case_control.json`，业务数据为 `{DT_SHARED_DIR}/case4/`，截图为 `{DT_SHARED_DIR}/out/case4/`。共享根由部署注入；不把参考资料当运行目录。Web/Node 同机，沿用现有 Node 服务与同源代理，不新增独立端口服务。

原始样本为 `01-参考资料/case4/data/`，仅供回放和格式参考。底图与投影复用现行 Case3 V2 运行资源（`site-2d.jpg` 与 `mapProjectionV2`）；图标/token 使用正式运行资源。不要求后端补地图文件，初始化接口不返回地图 URL。

首版仅 2D，三方案同时展示。百分比、3D、反射后置；2026-09-16 误差回溯悬停已追加实现，不增加接口。静态页面只提供视觉、样式和组件结构；固定 Pencil 坐标、示意 CDF/CEP、URL 假状态不能进入正式运行路径。

## 2. 文件合同与清理边界

下表文件名相对共享根的 `case4/`。所有数量由文件决定，38/100 是样本数量，不是固定要求。

| 文件 | 格式 | 方案 / 用途 | start/reinit 前清空 |
|---|---|---|---|
| `ue_position_coordinates_base.txt` | 每行 `x,y,z`，至少 1 行 | 预期路线 | 否 |
| `ue_position_without_dt_coordinates_realtime.txt` | 每行 `x,y,z` | 传统基站，REST key `traditional` | 是 |
| `ue_position_gaode_coordinates_realtime.txt` | 每行 `x,y,z` | 商用方案，REST key `commercial` | 是 |
| `ue_position_with_dt_coordinates_realtime.txt` | 每行 `x,y,z` | DT 辅助，REST key `dt` | 是 |
| `ue_position_without_dt_thrp.txt` | 每行一个数 | 无 DT 吞吐，side `without` | 是 |
| `ue_position_with_dt_thrp.txt` | 每行一个数 | 有 DT 吞吐，side `with` | 是 |
| `ue_position_without_dt_coordinates_realtime_cdf.txt` | 每行 2 列，见列含义表 | 传统 CDF | 是 |
| `ue_position_gaode_coordinates_realtime_cdf.txt` | 同上 | 商用 CDF | 是 |
| `ue_position_with_dt_coordinates_realtime_cdf.txt` | 同上 | DT CDF | 是 |
| `ue_position_with_dt_error_and_nlos.txt` | 4 行×2 列，见列含义表 | CEP/NLOS 汇总 | 是 |

`no` 不是文件列，由 Node 按从 1 起的行号编入 REST。后端表上的 0.01 / 0.001 是文件建议精度与 UI 显示参考；**进 JSON 的小数位以下表为准**，不能把「百分比」写成 0～100 的百分数。

| 文件 | 列 | 含义 | REST 字段 | 进 JSON |
|---|---|---|---|---|
| base / 三路 realtime | 1 | X，米 | `x` | Node 四舍五入到 **2 位** |
| | 2 | Y，米 | `y` | **2 位** |
| | 3 | Z，米；首版误差不用 | `z` | **2 位**；65535 仍按分量替换 |
| 两路 thrp | 1 | 吞吐，Gbps，≥0 | `gbps` | **2 位** |
| 三份 CDF | 1 | 定位误差，米，CDF 横轴 | `errorM` | **保留解析精度**，不量化到 0.01 |
| | 2 | 累计概率 **0～1**，不是百分数 | `probability` | **保留解析精度**；校验 0～1 |
| CEP/NLOS 汇总 | 第 1 行两列 | 传统 CEP50 / CEP90，米 | `cep.traditional.p50M` / `p90M` | **保留解析精度** |
| | 第 2 行 | 商用 CEP50 / CEP90 | `cep.commercial.*` | 同上 |
| | 第 3 行 | DT CEP50 / CEP90 | `cep.dt.*` | 同上 |
| | 第 4 行第 1 列 | 平均 NLOS **比例 0～1** | `nlosRatio` | **保留解析精度**；UI 再 `×100` |
| | 第 4 行第 2 列 | 无业务含义 | 不进 REST | 只要求有限数 |

`errorM` 不得按 0.01 截进 JSON：参考 DT CDF 首点为 `5.71e-05`，截到 2 位会变成 0。`p50M` / `p90M` 不得先截到 2 位，否则完成态三位小数显示末位恒为 0。Web 派生逐点误差 `hypot(x-baseX,y-baseY)` 不是文件列，精度跟 2 位坐标走。

反射文件 `ue_position_with_dt_coordinates_reflection_point.txt` 首版不读取、不清理、不参与收齐或完成门槛，不进入上述 REST 结构。

Node 仅清空表中标“是”的 9 个文件；缺失时创建为空文件。任一失败，不写新 start/reinit，返回 `DATA_CLEAR_FAILED`；已清部分不回填旧结果，下次手动重试重新清全表。保留 base、地图、原始参考目录、截图和其他 Case 数据。不得递归清空共享根。`init` 本身不清数据文件。

## 3. 控制接口、字段权属与互斥

控制快照五字段必填：

```ts
type ControlSnapshot = {
  case: string;
  command: "init" | "start" | "reinit";
  dt_type: "" | "all" | "without dt" | "with dt";
  status: string;
  save_picture_flag: 0 | 1;
  debug_flag?: number; // 若出现必须 Number.isInteger，与现网 control-file-store 一致
  scene_type?: string;
  [key: string]: unknown;
};
```

业务 `status` 合法字面值只有：`""`、`execute success`、`execute fail`、`case complete`、`reinit complete`。未知字符串透传，Web 不能当作 success/fail/complete。GET 可看到其他 Case 控制，不强改归属；case4 开轮 **只写** `dt_type="all"`，读到其他 Case 的 `"without dt"` 不得当作 case4 本轮。

若快照中存在 `debug_flag` 且不是整数（`Number.isInteger`），或存在 `scene_type` 且非 string，视为控制文件非法，返回 `CONTROL_READ_FAILED`。浮点如 `0.5`、字符串 `"0"` 均非法。这两字段不出现在 POST 请求体中。

| 数据/状态 | 权威源 | Web 可派生 | 说明 |
|---|---|---|---|
| `case` / `command` / `dt_type` | Web 经 Node 写入 | 否 | 只通过 POST control-file |
| `status` 业务字面值 | 后端 | 否 | Node 只在开轮和 init 时清 `""` |
| `save_picture_flag=1` | 后端 | 否 | 仅 Start 的 success→complete 窗口；允许与 complete 同拍 |
| 截图 PNG 与 flag 清零 | Node | 否 | Web 只提交 Base64 |
| 轨迹 / 吞吐 / 统计文件语义与 65535 归一 | Node | 否 | Web 不重复解析文件 |
| 当前动作、是否见过 success、截图任务 | Web 本地 | 是 | 刷新后全部丢弃 |
| 逐点 XY 误差 | Web | 是 | 只用本页 `init-data.baseRoute` |
| 地图、图标、投影 | Web 运行资源 | 否 | 不来自共享目录 REST |

GET 只读，无写副作用。成功样例：

```json
{
  "ok": true,
  "control": {
    "case": "case4",
    "command": "init",
    "dt_type": "",
    "status": "",
    "save_picture_flag": 0
  }
}
```

POST 只接受以下精确 shape，额外字段拒绝：

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

- init 写 `case=case4,command=init,dt_type="",status="",save_picture_flag=0`；是撤销旧轮信号，不启动任务，不要求后端再写 success。
- start/reinit 先通过共享 busy guard，再在共享串行队列内清 §2 九文件，最后合并控制：指定命令、`dt_type="all",status="",save_picture_flag=0`。
- Web 不提交业务 status，不提交 flag=1。业务终态由后端写；Node 仅在开轮/init 清空 status。
- flag 清零不改变其他字段。flag 已为 0 时幂等成功；为 1 时必须仍属于 `case4/start/all`，否则 `SCREENSHOT_NOT_REQUESTED`。
- 每次控制写重新读最新 JSON，只合并本方字段，保留未知字段；同目录临时文件、fsync、关闭、原子 rename、回读验证。沿用现有 Windows 瞬时替换容错，不等于重发业务命令。

共享 busy guard 沿用 case2/case3：仅 idle `init + status=""` 或同 Case、同动作、同 dt_type 的 `execute fail` 手动重试可开启 start/reinit。未消费活动/完成命令、其他 Case 失败或未知活动状态均返回 `409 CONTROL_BUSY`。init 始终允许撤权。case4 加入现有共享保护，不能建立独立队列绕过 case2/case3。

后端识别新命令以合法元组加空 status 为门沿，不只检查 command 字符串是否变化。每次写状态/数据前检查任务仍有效；init、归属变化或新任务均使旧任务停止。进程内任务代次用于防旧异步写入，不新增共享文件 batch_id/manifest。

该机制沿用现有单活跃演示边界；进程内队列和原子替换不等于双端同时写的分布式锁，真实挂载并发仍需现场验收。

## 4. 初始化与实时数据模型

```ts
/** 米；Node 四舍五入到 2 位后再进 JSON */
type Meters2 = number;
/** 米；JSON 保留文件解析精度，Web 决定显示位 */
type MetersExact = number;
/** 比例 0～1，不是百分数；JSON 保留解析精度 */
type Ratio01 = number;
/** Gbps；Node 四舍五入到 2 位后再进 JSON */
type Gbps2 = number;

type XYZ = { x: Meters2; y: Meters2; z: Meters2 };
type BasePoint = XYZ & { no: number };
type Scheme = "traditional" | "commercial" | "dt";
type TrajectoryPoint = {
  no: number;
  traditional: XYZ;
  commercial: XYZ;
  dt: XYZ;
};
type TrajectorySnapshot = {
  points: TrajectoryPoint[];
  completeCount: number;
  pendingTail: boolean;
};
type ThroughputSample = { no: number; gbps: Gbps2 };
type ThroughputSnapshot = {
  samples: ThroughputSample[];
  pendingTail: boolean;
};
type CdfPoint = { errorM: MetersExact; probability: Ratio01 };
type CepPoint = { p50M: MetersExact; p90M: MetersExact };
type Statistics = {
  cdf: Record<Scheme, CdfPoint[]>;
  cep: Record<Scheme, CepPoint>;
  nlosRatio: Ratio01;
};
```

### 4.1 GET init-data

返回 `{ ok:true, baseRoute:BasePoint[] }`。base 非空、点号从 1 连续递增，坐标有限且无 65535。失败不返回部分 base；Web 禁止开始。base 在单轮运行中必须保持稳定，不能运行中更换路线；后端更新 base 应在空闲期进行，页面重新初始化读取。

```json
{
  "ok": true,
  "baseRoute": [
    { "no": 1, "x": 1.0, "y": 15.0, "z": 0.0 }
  ]
}
```

### 4.2 GET trajectory

返回 `{ ok:true, ...TrajectorySnapshot }`。Node **不**要求当前 control 已是 complete；运行中允许空数组与 pending。

- 三方案第 i 行与 **当前磁盘 base** 第 i 行对应 Pi；按连续共同前缀返回 `1..K`，`completeCount === points.length`。坐标值已经 §6 归一。
- 例如三文件长度 5/3/4，返回前三点，`pendingTail=true`。吞吐不参与 K 计算。
- 运行中允许空数组、三文件不齐或未完整尾行；半点不返回。三文件长度不同、存在未完整尾行或读取期间文件变化时标 pending。
- 读取期间文件变化可在 Node 内有限重读；若仍有变化，可返回已解析完整前缀并标 pending，不能据此完成。
- 已提交完整行非法则返回错误，不跳行、不用上一轮数据拼接。坐标超过 base 行数无法建立 Pi 对应，作为 `TRAJECTORY_DATA_INVALID`，不能静默截短。
- 缺少必需文件返回错误，不把缺文件当成零点。
- Web 替换快照，不累加轮询响应。地图、点位高亮与逐点误差消费同一份 points；误差配对用本页 `init-data.baseRoute`，不用再读文件。

```json
{
  "ok": true,
  "points": [
    {
      "no": 1,
      "traditional": { "x": 1.02, "y": 15.01, "z": 0.0 },
      "commercial": { "x": 1.05, "y": 14.98, "z": 0.0 },
      "dt": { "x": 1.00, "y": 15.00, "z": 0.0 }
    }
  ],
  "completeCount": 1,
  "pendingTail": true
}
```

### 4.3 GET throughput

唯一 query `side=without|with`，返回 `{ ok:true, side, ...ThroughputSnapshot }`。缺 `side`、非法值或额外 query 一律 `400 INVALID_SIDE`。Node 同样不做 complete 门槛。

- 只读取该路文件；第 i 行为样点 i，单位 Gbps，无时间戳要求。
- 两路独立发请求、独立更新；一条无新增行、pending 或读取失败，不阻塞另一条或轨迹。
- 运行中允许空数组；只返回完整行；半尾行标 pending，已提交非法行返回错误。
- 不要求两路长度相等，不补值、不按轨迹截短。Web 以全量替换避免重复点；显示窗口不删除已接收原始序列。

```json
{
  "ok": true,
  "side": "with",
  "samples": [{ "no": 1, "gbps": 8.5 }],
  "pendingTail": false
}
```

## 5. 文件解析与数值合同

本节为已采纳的工程合同；不直接继承 case2 拒绝科学计数的规则，因为 case4 原始 CDF 已包含科学计数。

- UTF-8，允许文件首 BOM、LF/CRLF、行首尾空白、文件尾空白。
- base 保持 3 个逗号字段；实时坐标接受 3 个逗号或空白分隔字段，并兼容单独一行 `65535`（等价 XYZ 均无效，仍占一个点号）。吞吐为单字段。CDF 与 CEP/NLOS 汇总为 2 列：同一文件内空白分隔或逗号分隔二选一，不得混用；列含义见 §2，不因分隔符改变字段。
- 支持十进制及科学计数，要求完整 token 匹配且转换后为有限数；拒绝 NaN/Infinity、空字段、额外列及半数字，不能用 parseFloat 接受垃圾后缀。
- 记录之间的空行按格式错误处理，不通过过滤空行改变 Pi/样点行号；文件末尾换行不算额外记录。
- 沿用 case3 尾行策略：无换行但字段完整、数值合法的末行可读；未换行且解析不完整的末行作为 pending，已换行的非法行是错误。后端必须把一整行数值准备好再 append，避免可解析的数字前缀被误当完整数据。complete 后任何 pending 均不通过。
- 初始化和最终统计不接受未完整记录。

| 数据 | 校验 | 进 JSON |
|---|---|---|
| base/实时 XYZ | 有限数；65535 先按 §6 处理 | 四舍五入到 2 位 |
| 吞吐 `gbps` | 有限、非负；不设设计图的 10 Gbps 上限 | 四舍五入到 2 位 |
| CDF `errorM` | 非负有限数；每方案至少 1 点；两列各自非递减、允许重复；不强制首值 0/末值 1，不固定 100 行；不因 >10 拒绝 | **保留解析精度**，禁止量化到 0.01 |
| CDF `probability` | 0～1 比例，不是百分数 | **保留解析精度** |
| CEP `p50M`/`p90M` | 非负有限数；各方案 p50M ≤ p90M；不检查三方案优势排序 | **保留解析精度** |
| NLOS `nlosRatio` | 比例 0～1；不接受 89.7 表示 89.7% | **保留解析精度** |

显示精度由 Web 决定：坐标/吞吐标签 2 位，概率/NLOS 可按 0.001 显示，CEP 可按 3 位显示，均不得反向要求 Node 先截断。坐标/吞吐四舍五入 **复用现网** `roundSemanticNumber`（case2 `numeric-file.mjs` / case3 `numeric-line.mjs`）：`sign(x) * Math.round((abs(x) + Number.EPSILON) * 10^n) / 10^n`，`n=2`，结果为负零时归一为 0。先检查原始范围，禁止负数靠舍入变零后通过。不要另写一套不含 `Number.EPSILON` 的公式。

CDF 与 CEP 分别由对应文件提供，不交叉重算，也不因参考样本与逐点误差不一致而篡改数据。只验证各文件内部的结构和合法性。

## 6. 无效坐标 65535

检测原始数值的 65535 哨兵，按方案、按分量处理，不能跳过点号。`/trajectory` 与 `/result` 的轨迹快照使用同一套归一。

单行 `65535` 先展开为三个哨兵，再应用下列替换规则；这是当前实现兼容格式，真实后端联调需核对实际输出。

1. Pi 的某一分量为 65535，使用同方案 P(i−1) 已归一的对应分量。
2. P1 无前点，使用 **当前磁盘 base** P1 对应分量。
3. 其余合法分量保持原值，再做统一精度归一。
4. 连续无效沿用上一个已修复值；XYZ 均按此规则归一，首版误差只用 XY。
5. base 本身无合法替代来源，含无效值时初始化失败；原始文件不回写修复值。

日志至少含 case、文件、方案、Pi、无效分量、原始值、替代值和替代来源。重复轮询同一修复事件不应刷屏；去重仅为进程内日志实现，不改变数据响应。

## 7. 最终结果接口

GET `/result` 返回：

```ts
type ResultResponse = {
  ok: true;
  trajectory: TrajectorySnapshot; // pendingTail=false，completeCount>0
  throughput: {
    without: ThroughputSnapshot;
    with: ThroughputSnapshot;
  };
  statistics: Statistics;
};
```

读取前后控制必须均为 `case4/start/all/case complete`。Node 对 base、三轨迹、两吞吐、四统计文件记录读取前后 size/高精度 mtime，并校验该读取窗口内文件与 `controlBefore`/`controlAfter` 的 case/command/dt_type/status 均未变化。Node **不**保存某次 Web `init-data` 会话，也不对账“本页初始化时的 base 内容”。

- 后端只允许在空闲期更换 base。运行中改 base 视为违规；Web 误差始终用本页 `init-data.baseRoute`，与 Node 当时磁盘 base 可能不一致，不要求 Node 补救。
- 最终轨迹快照同样经过 §6 的 65535 归一，规则与 `/trajectory` 相同。
- 三轨迹必须**同长**、至少 1 个完整点、无 pending，且不超过当时磁盘 base 长度。运行中取共同前缀；complete 时 30/30/31 为失败，不能静默截到 30。
- 实际点数可以少于 base：38 预期、三方案均 30 点允许完成，不补造 31～38。
- 两吞吐允许不等长，必须没有未完成尾行或非法记录；允许零样本，空文件返回 samples=[]；不以 0 Gbps 补值。
- 三份 CDF 加一份汇总均须完整、合法；任何失败不返回部分 result。
- `/trajectory`、`/throughput` 的成功不是完成证明；Web 仅在本轮先观察 success 再观察 complete 后接受 `/result`。
- Web 一次性替换最终轨迹、吞吐和统计，禁止用上轮统计补齐。之后完成渲染，再处理已登记截图请求与 init 收尾。

控制漂移、文件变化、三轨迹不同长、pending、空轨迹或统计未齐不能返回成功。

```json
{
  "ok": true,
  "trajectory": {
    "points": [
      {
        "no": 1,
        "traditional": { "x": 1.02, "y": 15.01, "z": 0.0 },
        "commercial": { "x": 1.05, "y": 14.98, "z": 0.0 },
        "dt": { "x": 1.00, "y": 15.00, "z": 0.0 }
      }
    ],
    "completeCount": 1,
    "pendingTail": false
  },
  "throughput": {
    "without": { "samples": [], "pendingTail": false },
    "with": { "samples": [], "pendingTail": false }
  },
  "statistics": {
    "cdf": {
      "traditional": [{ "errorM": 0.0, "probability": 0.0 }],
      "commercial": [{ "errorM": 0.0, "probability": 0.0 }],
      "dt": [{ "errorM": 0.0, "probability": 0.0 }]
    },
    "cep": {
      "traditional": { "p50M": 1.36, "p90M": 3.55 },
      "commercial": { "p50M": 3.34, "p90M": 8.05 },
      "dt": { "p50M": 0.15, "p90M": 0.47 }
    },
    "nlosRatio": 0.897
  }
}
```

成功时必须 `completeCount === points.length > 0`，且两路吞吐 `pendingTail=false`；上例吞吐空数组表示该路零样本仍可完成。

## 8. 主线、等待与错误恢复

```text
进页/刷新/切回 → GET control → POST init → GET init-data → initial
Start → Node清九文件并写空status命令 → 后端success → 实时轨迹及两路吞吐
      → 后端关闭所有本轮输出并停止写入 → complete（可同拍flag=1）
      → 若同拍：先登记截图任务，再 GET result
      → GET result通过 → completed渲染 → 截图收尾（若有）→ POST init
ReInit → 本轮UI结果立即失效 → Node清九文件并写命令 → success → reinit complete
       → POST init成功 → initial
```

- 后端 success 至少保持 3000ms，沿用 case3 可观测窗口。文件写完并关闭后最后发布 complete；complete 后不得追加或改写本轮数据。fail 后停止本轮写入，不再发布完成态。complete 时三份实时轨迹必须已经同长。
- 控制轮询默认 500ms，上次结束后再等待，不叠加请求。运行中 `/trajectory` 与两路 `/throughput` 各自串行轮询。
- 见到本轮 `case complete` 后：**停止** `/trajectory` 与 `/throughput` 轮询，旧响应按本地代次/取消丢弃；**继续**控制轮询与 `/result` 重试，直到截图保存/放弃清零并 POST init，或最终读取 10 次耗尽。不得把“停止实时请求”理解成连 control 一起停。
- 业务没有自动超时、自动命令重试、暂停、取消或队列。
- 最终读取失败（缺文件、非法、pending、漂移、HTTP/网络/shape 错误）累计 10 次，含首次；每次完整 HTTP 尝试计一次，Node 内部读重试不额外计数。期间保持等待，不显示部分最终统计。
- 耗尽后清本轮结果，提示“结果不完整已自动回退”，停止本轮处理并尝试 POST init；成功可再次开始，失败标适配异常，不宣称恢复成功。
- Start 命令失败仅允许手动重试 Start；ReInit 失败只允许重试 ReInit，不恢复旧结果。控制写请求结果不确定时先补读控制确认，不盲目重发命令。
- 初始化服务不可达时沿用 case3 每 5000ms 探活，恢复后重新 GET control→POST init→GET init-data。初始化数据非法保持禁用，刷新/重进重试。运行中暂时读失败保留本轮最近合法显示并提示，不造新样点。
- 成功 completed 后 init 写回失败保留已完成结果，但禁用业务动作并显示适配异常，不能用新 Start 覆盖未收尾控制。
- 切离清轮询、临时数据及本地状态；卸载 POST init 仅 best-effort，重新进入的初始化握手才是可靠恢复门槛。

| UI阶段 | 开始 | 重置 | 其他Tab |
|---|---|---|---|
| 初始且初始化成功 | 可用 | 禁用 | 可用 |
| 开始/运行/最终读取/截图和控制收尾 | 禁用 | 禁用 | 锁定 |
| 完成且收尾成功 | 禁用 | 可用 | 可用 |
| 重置及收尾 | 禁用 | 禁用 | 锁定 |
| 开始失败且适配可用 | 仅手动重试开始 | 禁用 | 可用 |
| 重置失败且适配可用 | 禁用 | 仅手动重试重置 | 可用 |
| 适配/初始化异常 | 禁用 | 禁用 | 非活动等待时可用 |

**零吞吐样本（2026-09-15 用户确认）：** 每路吞吐文件存在但整轮为空时，允许正常完成，该路保持空态；两路分别适用，不增加至少一条非空的门槛。这不豁免缺文件、非法记录或未完成尾行。三方案轨迹至少一个完整点和四份最终统计收齐的要求不变。

## 9. 截图

- 后端仅在 Start 的 success→complete 窗口置 flag=1；同拍 complete 必须同一次原子写，禁止 complete 后才补 flag；ReInit 不请求截图。
- Web **只在本轮 Start 等待/运行的控制轮询**里认 `save_picture_flag` 的 0→1；进页、initial、failed、resetting、completed 不新开截图任务。
- 同拍：同一控制快照上若 `status="case complete"` 且 `flag=1`，**先登记**本轮唯一截图任务，再开始 `/result`。
- `flag=1` 的后续轮询不新开任务；一轮最多一个截图任务。未在 running 窗口登记过的请求，不得在 completed 后再补登记。
- 登记后不立即截运行态。最终 result 通过、completed 至少完成一帧渲染、renderer 准备好后才生成 PNG。
- 同一任务最多 3 次：生成失败可重生成，上传失败复用同一 Base64；第三次仍失败 POST flag=0 放弃并记日志，不改变业务结果。放弃清零/收尾失败显示适配异常，不假装已解除。
- POST screenshot 仅接受 `{image_base64:string}`，纯 Base64 或 PNG data URL；解码验证 PNG signature。沿用请求体上限 20 MiB。
- 保存与清零前均核对当前 `case4/start/all,flag=1`；不限定 status 必须恰好 success，允许保存时推进到 complete。其他 Case 路由不得消费 case4 请求，反之亦然。
- 输出 `out/case4/case4-000.png`，seq 从 0 递增、至少三位补零、不覆盖；响应为 `{ok:true,path:"out/case4/case4-000.png",seq:0}`。
- 同目录临时文件、fsync、关闭、原子 rename、stat 成功后在共享队列重读控制并清 flag。截图逻辑复用现有原语，不引入持久事务或重启恢复。
- 截图逻辑舞台 1920×1080，沿用 pixelRatio=2；文件成功不等于内容正确，正式验收需检查实际 PNG 中曲线、仪表、文字和最终状态。

## 10. REST 错误与日志

响应 UTF-8 JSON，Web 使用 no-store。成功 `ok:true`；失败统一如下，不夹带可消费的部分业务数据：

```json
{ "ok": false, "error": { "code": "RESULT_NOT_READY", "message": "diagnostic" } }
```

| HTTP | code | 场景 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 非法 body、额外字段、非法截图内容 |
| 400 | `INVALID_SIDE` | 吞吐缺 side、side 非 without/with、或夹带其他 query |
| 409 | `CONTROL_BUSY` | 控制被活动/未消费命令占用 |
| 409 | `RESULT_NOT_READY` | `/result` 上下文不匹配、pending、空轨迹、三轨迹不同长、文件/控制读取漂移 |
| 409 | `SCREENSHOT_NOT_REQUESTED` | flag/归属不符 |
| 404 | `DATA_FILE_MISSING` | 对应读取的必需文件缺失 |
| 422 | `INIT_DATA_INVALID` | base非法 |
| 422 | `TRAJECTORY_DATA_INVALID` | 轨迹完整行/对应关系非法 |
| 422 | `THROUGHPUT_DATA_INVALID` | 吞吐完整行非法 |
| 422 | `STATISTICS_DATA_INVALID` | CDF/CEP/NLOS非法 |
| 413 | `PAYLOAD_TOO_LARGE` | 截图请求超过上限 |
| 500 | `CONTROL_READ_FAILED` / `CONTROL_WRITE_FAILED` | 控制 I/O或校验失败（含可选字段类型非法） |
| 500 | `DATA_CLEAR_FAILED` / `DATA_FILE_READ_FAILED` | 清理/读取失败 |
| 500 | `SCREENSHOT_SAVE_FAILED` / `INTERNAL_ERROR` | 截图/其他内部异常 |

最终 `/result` 中缺失/非法文件保留对应 404/422 诊断；Web 对所有未成功最终响应统一按 §8 计数，不只处理 409。运行中 `/trajectory` 与 `/throughput` 的失败只使对应响应不提交，不计入最终 10 次。异步响应到达时必须仍属于当前页面、本轮及适当阶段，不能覆盖刷新/重置后的 UI。

Node 是文件语义校验权威；Web 检查 envelope、对象/数组、必填字段与有限 number 类型，不重复解析文件或处理哨兵。shape 非法记录 `CASE4_INVALID_RESPONSE`。日志含 endpoint、case、command/side、文件/行号和 reason（适用时）；避免原始 Base64 和每次轮询重复报同一错误。

## 11. UI 数据来源反向清单

| 可见区域 | 权威输入 / 派生 | 生效阶段 |
|---|---|---|
| 预期轨迹/预置点 | init-data.baseRoute；现行 Case3 V2 物理坐标映射 | 初始化后 |
| 三方案轨迹/当前点/进度 | trajectory.points；no对齐；最终由result替换 | 运行及完成 |
| 逐点误差 | Web对每方案Pi计算 `hypot(x-baseX,y-baseY)`，base 取本页 init-data，不计Z | 同完整点一起推进 |
| 吞吐两条曲线 | 独立throughput.samples，no为样点序号 | 运行及完成 |
| 三条CDF | result.statistics.cdf，直接使用文件横纵值 | 完成后统一显示 |
| CEP50/90 | result.statistics.cep，不由轨迹或CDF反算 | 完成后统一显示 |
| NLOS | result.statistics.nlosRatio × 100，仅格式化为百分数 | 完成后统一显示 |
| 开始/重置/提示 | 本地动作状态+control+接口结果 | 按§8 |
| 现场环境 | 现有环境展示资源/组件 | 与case3一致 |

图表不硬编码设计数值、20点上限或固定优势排序。误差窗口显示最新20点，保留完整数据；CDF轴与CEP柱使用一致的数值尺度，不能把越界CDF横值压到右边界。显示空态按已接受视觉，未有最终统计不以0冒充结果。

## 12. 本地打桩与交付验收边界

replay 使用原始参考文件，random 小幅扰动三方案轨迹、两吞吐、CDF/CEP/NLOS；base不变，反射不处理。统计沿参考文件独立扰动，不声称由随机轨迹重算；不强制DT优势、不修改原始目录。模拟来源在打桩日志/运行说明中明确，不要求真实后端新增来源字段。随机幅度由实现采用保守固定值，不新增配置项。

最小验证：正常两轮、三方案延迟收齐、超过20点、38预期/30完成、complete时三轨迹必须同长、两路吞吐不等长和独立更新、65535首点/连续/单分量、半行/非法完整行、最终四文件缺失及10次回退、start/reinit失败、init失败、刷新后不自动拉旧轨迹、跨Case保护、截图同拍complete与三次失败、进页不因残留 flag 开截图任务、case2/case3共享行为回归。同时覆盖吞吐文件为空可完成、缺失/非法/半写仍拒绝最终结果。

本地Web+Node+打桩通过不等于真实后端、真实挂载或真实采集验收。本文已按用户授权复核定稿；正式实现仍以三份施工规格为施工依据。
