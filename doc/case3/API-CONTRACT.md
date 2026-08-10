# case3 Gate 2 API 契约草案

> 范围：只约束 `DT for Comm`（case3）的控制文件语义、Node 文件适配服务 REST、结构化点位数据、单侧重置和 KPI 派生。本文是草案，需用户批准后才可作为 Gate 2 v1。

## 0. 契约边界


| 层           | 负责                                                                           | 不负责                        |
| ----------- | ---------------------------------------------------------------------------- | -------------------------- |
| Shell       | Tab、1920x1080 缩放、公共 token、现场环境弹窗--case2已支持                                   | case3 业务状态、数据轮询、文件清空       |
| case3 Web   | 用户意图、可见状态、点位进度、地图/波束/KPI 展示、Beam Accuracy 派生                                 | 直接访问共享目录、删除文件、解释多 txt 行号对齐 |
| Node 本地适配服务 | 唯一浏览器侧文件 I/O；控制文件读写；Start/ReInit 前清空单侧实时 append 文件；把多 txt 收编为结构化点位数据；校验字段和行号 | 后端通信算法、业务终态伪造、真实采集         |
| 后端业务进程      | 监听 `case_control.json`；执行 Without/With 通信测试；append 多 txt；写 `status` 业务终态     | 浏览器 UI、清历史文件、REST 接口       |


正式后端文件层沿用多 txt 现网协议。Node/Web 内部可以 normalized point model 收编，但不得反向要求正式后端提供 JSONL、manifest、batch_id 或原子目录切换。

Start/ReInit 开新轮后，Node 会先清空该侧实时 append 文件，再写控制命令。正式后端必须停止旧轮写入，并且只向当前命令侧文件写入本轮数据；不得把旧轮尾部 append 回已清空文件，否则 Web 会把旧轮尾巴解释成本轮数据。

## 1. 运行配置

- 共享根：case3 接入后使用项目级环境变量 `DT_SHARED_DIR` 指向已挂载共享目录。
- 兼容：当前 case2 已改为优先使用 `DT_SHARED_DIR`；`CASE2_SHARED_DIR` 仅作为旧脚本兼容 fallback。新 case3 文档与代码必须以 `DT_SHARED_DIR` 为主。
- 运行数据目录：`{DT_SHARED_DIR}/case3/`，本地联调即 `/Users/jackwl/Code/2030-DT/code/comdatafiles/case3/`。参考资料路径 `01-参考资料/case3/data/c3/` 仅用于格式说明，不是正式运行路径。



## 2. 逻辑接口总表


| 逻辑操作      | 最小 REST 语义                                                    | 方向                       | 触发                           | 语义                                                                      |
| --------- | ------------------------------------------------------------- | ------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| GET 控制文件  | `GET /api/case3/control-file`                                 | Web -> Node -> 控制文件      | 进 Tab、运行/重置轮询                | 返回 `case_control.json` 当前快照。                                            |
| Start 单侧  | `POST /api/case3/control-file`                                | Web -> Node -> 控制文件/文件清空 | 用户点击 Without/With Start      | Node 先清空该侧实时 append 文件，再写 `case=case3,command=start,dt_type=without dt 或 with dt,status=""`；该侧完成并被 Web 接收后，Web 再触发一次空闲写回。 |
| ReInit 单侧 | `POST /api/case3/control-file`                                | Web -> Node -> 控制文件/文件清空 | 用户点击单侧重置                     | Node 写 `command=reinit,dt_type=without dt 或 with dt,status=""`；清空该侧本轮实时文件；不清另一侧文件；UI 消费 `reinit complete` 后再空闲写回。 |
| 空闲写回      | `POST /api/case3/control-file`                                | Web -> Node -> 控制文件          | 进页 GET 成功、单侧完成收尾、单侧重置收尾       | 写回 `case=case3,command=init,dt_type="",status="",save_picture_flag=0`。这是控制文件清洁态，不是业务新命令。 |
| 读取初始化数据   | `GET /api/case3/init-data`                                    | Web -> Node -> 文件        | 进 Tab、单侧重置完成后按需刷新            | 返回地图资源路径、base route、Beam Accuracy 基线。                                   |
| 读取单侧运行快照  | `GET /api/case3/side?side=without` 或 `side=with`              | Web -> Node -> 多 txt     | 该侧已见 `execute success` 后每 1s | 返回该侧当前已收齐完整点位全量 + 侧级 `costPct`；不使用双 cursor 增量。                          |


具体路径名可在 Gate 3 SPEC 收窄，但语义不得改变：浏览器不直接删文件，Node 先清文件再写控制，后端只写业务状态和追加数据。

演示期主路径**不采用** `GET /api/case3/points?cursor=` 与 `GET /api/case3/kpis?cursor=` 双增量 REST。若未来点数显著增大，可在仍返回侧级 `costPct` 的前提下，为 `/side` 增加可选 `sinceCount` 减负；不得再拆回独立 kpis 流作为默认方案。

## 3. 控制文件合同

控制文件沿用 `case_control.json` 五个核心字段结构：


| 字段                  | 类型/允许值                                                                          | 权威写方                                       | case3 语义                                           |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `case`              | 字符串；case3 请求写 `case3`                                                           | Node 代表 Web 写入                             | Start/ReInit 必须写入 `case3`。                         |
| `command`           | `init` / `start` / `reinit`                                                     | Node 代表 Web 写入                             | `start` / `reinit` 是单侧命令轮；`init` 是空闲态。进页 GET 成功、单侧完成收尾、单侧重置收尾后由 Web/Node 写回 `init`。 |
| `dt_type`           | `without dt` / `with dt` / `""`                                                 | Node 代表 Web 写入                             | Start/ReInit 指明当前命令侧；空闲写回时清 `""`。Without 与 With 互斥运行。 |
| `status`            | `""` / `execute success` / `execute fail` / `case complete` / `reinit complete` | 业务终态只由后端写；Node 在 Start/ReInit 开轮和空闲写回时清 `""` | Web 必须按本轮已见 `execute success` 后的完成/失败终态解释，不解释历史残留；不得在消费 `case complete` / `reinit complete` 前清状态。 |
| `save_picture_flag` | `0` / `1`                                                                       | case2 截图路径使用；case3 暂不消费                    | case3 不因该字段触发截图或业务状态；空闲写回统一写 `0` 以清洁共享控制文件。 |


`debug_flag`、`scene_type` 和未来未知字段存在时应保留。Node 写控制文件必须合并最新快照，禁止整文件覆盖导致其他字段丢失。

## 4. 多 txt 文件合同



### 4.1 初始化文件


| 文件                                       | 读取时机                | 格式                    | 用途                                    |
| ---------------------------------------- | ------------------- | --------------------- | ------------------------------------- |
| `ue_comm_coordinates_base.txt`           | 进 case3 Tab 读一次     | 每行 `x,y,z`            | 预置 UE 完整路线，点位数动态。                     |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | 进 Tab、任意重置后读一次或恢复基线 | 首个非空行 `success,total` | Beam Accuracy 基线。Start/ReInit 不清空该文件。 |
| `ue_comm_map.png`                        | 进 Tab 加载            | PNG                   | UE 地图底图。正式运行资源落点由 Gate 3 冻结。          |




### 4.2 Without DT 实时文件


| 文件                                   | 格式                                     | 是否逐点对齐 | Start/ReInit 前清空 |
| ------------------------------------ | -------------------------------------- | ------ | ---------------- |
| `ue_comm_without_dt_coordinates.txt` | 每行 `x,y,z--支持2位小数，单位是米`                | 是      | 是                |
| `ue_comm_without_dt_beams.txt`       | 每行 16 个逗号分隔 beam id --- 数值范围：0～255     | 是      | 是                |
| `ue_comm_without_dt_sel_beam.txt`    | 每行 0-255 整数                            | 是      | 是                |
| `ue_comm_without_dt_thrp.txt`        | 每行非负 Gbps 浮点，`--支持2位小数，单位Gbps`         | 是      | 是                |
| `ue_comm_without_dt_cost.txt`        | 一行或多行百分比浮点；取最新一行 ，web显示50%，这里txt的数字是50 | 否      | 是                |




### 4.3 With DT 实时文件


| 文件                                                 | 格式                                     | 是否逐点对齐 | Start/ReInit 前清空 |
| -------------------------------------------------- | -------------------------------------- | ------ | ---------------- |
| `ue_comm_with_dt_coordinates.txt`                  | 每行 `x,y,z--支持2位小数，单位是米`                | 是      | 是                |
| `ue_comm_with_dt_sel_beam.txt`                     | 每行 0-255 整数                            | 是      | 是                |
| `ue_comm_with_dt_thrp.txt`                         | 每行非负 Gbps 浮点`--支持2位小数，单位Gbps`          | 是      | 是                |
| `ue_comm_with_dt_coordinates_reflection_point.txt` | 每行 `x,y,z,flag`，`flag` 为 1=LOS、0=NLOS  | 是      | 是                |
| `ue_comm_with_dt_cost.txt`                         | 一行或多行百分比浮点；取最新一行（web显示50%，这里txt的数字是50） | 否      | 是                |


`ue_comm_*_mse.txt` 暂不进入当前 case3 UI 主线。JSONL 草案不作为正式后端输入。

## 5. 结构化点位模型

Node 对多 txt 增量读取后，向 Web 返回区分侧别的结构化点位；Cost 与点无关，作为**侧级字段**与点位快照同包返回，不写入 `Case3Point`。

```ts
type Case3Side = "without" | "with";

// 点位本身不带 side；侧别只在 Case3SideSnapshot.side / 请求参数里表达
type Case3Point = {
  no: number; // 该侧本轮点位序号，从 1 递增；由完整点行号得到
  ue: { x: number; y: number; z: number };
  selectedBeamId: number;
  throughputGbps: number;
  scanBeamIds?: number[]; // Without 必需
  reflection?: { x: number; y: number; z: number; los: boolean }; // 仅 With；With 完整点必需，Without 不带
};

type Case3SideSnapshot = {
  // 包级成功位：true=本次 REST 读侧成功，业务字段可信。
  // 失败时返回 ok:false + error，不带可用 points/costPct。
  // ok 不是业务状态；完成/失败只看 control.status。
  ok: true;
  side: Case3Side; // 侧别权威字段；points 内不再重复 side
  points: Case3Point[];
  completeCount: number;
  // 读侧提示：可能存在未齐半点。前端主逻辑只消费 points + costPct；
  // pendingTail 最多做可选“收数中”提示，不参与完成/失败判定。
  pendingTail: boolean;
  costPct: number | null; // 侧级 Cost(%)；与点无关，不得写入 Case3Point
};

// 失败响应（与 case2 适配服务习惯一致；具体 error.code 矩阵 Gate 3 再冻结）
// {
//   ok: false,
//   error: { code: string, message: string }
// }
```



### 5.1 `GET /api/case3/side` 响应

请求：

```http
GET /api/case3/side?side=without
GET /api/case3/side?side=with
```

语义：返回该侧**当前已收齐完整点位的全量快照**，不是“只返回自上次轮询后的新点”。Web 每次用响应直接替换本地 `points` 与 `costPct`，不维护 cursor，不在本地 append。

Without DT 示例：

```json
{
  "ok": true,
  "side": "without",
  "points": [
    {
      "no": 1,
      "ue": { "x": 1.01, "y": 15.01, "z": 0.00 },
      "selectedBeamId": 0,
      "scanBeamIds": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "throughputGbps": 8.50
    },
    {
      "no": 2,
      "ue": { "x": 1.01, "y": 14.01, "z": 0.00 },
      "selectedBeamId": 4,
      "scanBeamIds": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      "throughputGbps": 8.10
    }
  ],
  "completeCount": 2,
  "pendingTail": false,
  "costPct": 10
}
```

With DT 示例：

```json
{
  "ok": true,
  "side": "with",
  "points": [
    {
      "no": 1,
      "ue": { "x": 1.01, "y": 15.01, "z": 0.00 },
      "selectedBeamId": 0,
      "throughputGbps": 9.1,
      "reflection": { "x": 5.01, "y": 7.01, "z": 0.00, "los": true }
    }
  ],
  "completeCount": 1,
  "pendingTail": false,
  "costPct": 5
}
```

字段规则：

- `ok`：包级成功位。`true` 表示本次 REST 读侧成功；`false` 表示接口失败，响应无可用业务快照。
- `ok` **不是**业务运行/完成/失败状态；业务终态只看控制文件 `status`。
- `side`：只出现在 snapshot 根上；`Case3Point` **不带** `side` 字段。
- `points`：仅含完整连续点位 `1..K`；`completeCount === points.length`。
- `pendingTail=true`：Node 已看到某些文件多出新行，但还不能形成下一个完整点；Web 不报错、不展示半点。
- `costPct`：侧级字段。Node 取该侧 cost txt 最新非空行；没有有效 cost 时为 `null`。
- Cost 与点位解耦：cost 缺失不阻塞 `points`；半点不阻塞已有 `costPct` 返回。
- Cost **不得**写入每个 `Case3Point`。

Web 消费约定：

```ts
// 该侧已见 execute success 后每 1s
const snap = await getCase3Side("without");

// 1) 先判 ok：失败则不更新业务数据，不推断 case complete / execute fail
if (!snap.ok) {
  // 保留上一帧成功数据或空态；可记日志/轻提示
  // 下一秒继续轮询；不自动 start/reinit
  return;
}

// 2) 主逻辑只消费 points + costPct
setPoints(snap.points);     // 全量替换，不 append
setCostPct(snap.costPct);   // 侧级标量

// 3) pendingTail 最多做可选提示，不参与完成/失败判定
// 完成看 execute success -> case complete；失败看 execute fail
// if (snap.pendingTail) showReceivingHint();
```

### 5.2 点位与 Cost 规则

- `no` 从 1 递增，由运行时行号得到，不固定为 12 或 32。
- Without 点位必须包含 `scanBeamIds` 和 `selectedBeamId`。
- With 点位必须包含 `selectedBeamId` 和 `reflection`；反射点文件第 `i` 行是 With 第 `i` 个完整点位的必需字段。
- 同侧逐点文件按行号对齐。Node 只返回已经具备完整必需字段的连续点位；不完整尾行保留到下次轮询，不向 Web 暴露半点。
- 坐标与数值非法时，该侧本轮进入数据异常，不拼接旧行或跨侧补齐。
- Throughput 来自 `points[].throughputGbps`；Cost 来自同包 `costPct`，不再提供独立 `/api/case3/kpis` 主路径。



### 5.3 行号对齐与半点处理

“同侧逐点文件按行号对齐”的意思是：第 `i` 行的坐标、第 `i` 行的波束、第 `i` 行的吞吐，合在一起才是第 `i` 个点位。

Without 第 `i` 个点位需要同时具备：

- `ue_comm_without_dt_coordinates.txt` 第 `i` 行；
- `ue_comm_without_dt_beams.txt` 第 `i` 行；
- `ue_comm_without_dt_sel_beam.txt` 第 `i` 行；
- `ue_comm_without_dt_thrp.txt` 第 `i` 行。

With 第 `i` 个点位需要同时具备：

- `ue_comm_with_dt_coordinates.txt` 第 `i` 行；
- `ue_comm_with_dt_sel_beam.txt` 第 `i` 行；
- `ue_comm_with_dt_thrp.txt` 第 `i` 行；
- `ue_comm_with_dt_coordinates_reflection_point.txt` 第 `i` 行。

例：Without 侧 coordinates/thrp/beams 都已有 10 行，但 sel_beam 只有 9 行，Node 只能返回 1-9 号完整点位；第 10 个点位必须等 sel_beam 第 10 行到达后再返回。这就是“只返回已经具备完整必需字段的连续点位”。

“不完整尾行”包括两类：

- 后端正在 append，某文件末尾字段截断、字段数不足或字段非法，暂不可 parse；
- 某些文件已经有第 `i` 行，但同侧另一个必需文件还没有第 `i` 行。

末行没有尾随 LF/CRLF 但字段完整且可 parse 时，按完整行处理，不因 `wc -l` 结果偏小而判为 pending tail。Node 对真正不完整的尾部数据只保留在内部读取状态，不向 Web 暴露。Web 不会看到只有坐标但没有 beamId、或只有吞吐但没有坐标的“半点”。

### 5.4 调试 JSONL 快照落盘

为方便维护测试和回看数据，Node 在收编出该侧当前完整点位后，同步维护本地快照文件：

```text
{DT_SHARED_DIR}/out/case3/points/without.jsonl
{DT_SHARED_DIR}/out/case3/points/with.jsonl
```

本地联调路径示例：

```text
/Users/jackwl/Code/2030-DT/code/comdatafiles/out/case3/points/without.jsonl
/Users/jackwl/Code/2030-DT/code/comdatafiles/out/case3/points/with.jsonl
```

更新方式：**整文件原子替换**，不是运行期逐行 append。

1. 内容 = 该侧当前已返回给 Web 的完整点位 `1..K`（与 REST `points` 一致）。
2. 每行一个 `Case3Point` JSON（无 `side` 字段；侧别由文件名 without/with 表达）。
3. 写入同目录临时文件 → `fsync` → rename 覆盖目标文件。
4. 仅当该侧 `completeCount` 变化时重写；无新完整点时不改文件。
5. 该侧 Start/ReInit 清空实时数据后，将对应 jsonl 写成空文件（或等价清空）。
6. 只重置一侧时，不动另一侧 jsonl。

约束：

- 该输出仅为本地调试/QA 证据，不能作为正式后端输入。
- **Web 主路径不回读**这些 jsonl。
- **不写 cost 进 jsonl 行**；cost 仍是 side-level REST 字段。
- 不得写入 `{DT_SHARED_DIR}/out/case2/` 或 `out/case2/case3/`。

## 6. Beam Accuracy 派生

输入：

- 文件基线：`ue_comm_with_dt_beam_accuracy_rate.txt` 的 `success,total`。
- 本轮增量：With 完成后，用 With 第 `i` 个点位与 Without 第 `i` 个点位按 `no` 对比 `selectedBeamId`。坐标只作为可选诊断，不作为匹配主键。

计算：

```text
本轮成功数 = count(withPoint where matchingWithoutPoint.selectedBeamId == withPoint.selectedBeamId)
本轮总数 = With 本轮可匹配点位数
总数 = baselineTotal + 本轮总数 

展示成功数 = baselineSuccess + 本轮成功数
展示错误数 = 总数 - 展示成功数 
展示准确率 = 展示成功数 / 总数 --保留1位小数 % 
```

约束：

- 没有 Without 本轮有效结果时，不计算 With 增量。
- 只有 Without/With 两侧都存在相同 `no` 的完整点位时，该序号才进入本轮 Beam Accuracy 增量统计；不得用浮点坐标相等性做匹配。
- 任意一侧 ReInit 后，本次增量对比失效，展示恢复到文件基线。
- Beam Accuracy 不由后端提供本轮最终百分比；本轮增量由 Web 基于 Node 结构化点位派生。



## 7. 刷新、切 Tab、失败

- 刷新后一切回 case3 初始可见状态；不因控制文件残留 `case complete` 自动恢复运行结果。进页或刷新时先 `GET /api/case3/control-file`，GET 成功后 Web 触发一次空闲写回，再加载初始化数据。
- 切离 case3 时停止 case3 轮询、定时器和本地播放状态；切回按进 Tab 流程重新 GET 控制文件、空闲写回、加载初始化数据。
- 单侧启动收尾：只有本轮已见 `execute success -> case complete`，且 Web 已接收该侧完成结果后，才触发空闲写回。case3 不消费截图，所以不需要等待 `save_picture_flag` 截图链路。
- 单侧重置收尾：必须先消费 `reinit complete`，完成 UI 单侧结果清理和 Beam Accuracy 增量失效处理，再触发空闲写回。
- 空闲写回后的 `command=init,status=""` 不构成后端新命令；正式后端识别新轮次仍只应看 `command=start|reinit` 且 `status=""` 的合法命令元组。
- `execute fail` 是命令失败终态；该侧显示执行命令失败并允许手动重试。前端不得自动重试、自动超时或发取消命令。
- Without/With 两侧互斥：任一侧运行或重置期间，另一侧 Start/ReInit 禁用。
