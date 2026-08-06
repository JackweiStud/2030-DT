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

## 1. 运行配置

- 共享根：case3 接入后使用项目级环境变量 `DT_SHARED_DIR` 指向已挂载共享目录。
- 兼容：当前 case2 已实现仍使用 `CASE2_SHARED_DIR`；迁移期可由启动脚本将 `CASE2_SHARED_DIR` 兼容映射到 `DT_SHARED_DIR`，但新 case3 文档与代码应以 `DT_SHARED_DIR` 为主。
- 运行数据目录：`{DT_SHARED_DIR}/case3/data/c3/` 或经 SPEC 冻结后的等价 case-local 目录。参考资料路径 `01-参考资料/case3/data/c3/` 仅用于格式说明，不是正式运行路径。



## 2. 逻辑接口总表


| 逻辑操作      | 最小 REST 语义                          | 方向                       | 触发                      | 语义                                                                      |
| --------- | ----------------------------------- | ------------------------ | ----------------------- | ----------------------------------------------------------------------- |
| GET 控制文件  | `GET /api/case3/control-file`       | Web -> Node -> 控制文件      | 进 Tab、运行/重置轮询           | 返回 `case_control.json` 当前快照。                                            |
| Start 单侧  | `POST /api/case3/control-file`      | Web -> Node -> 控制文件/文件清空 | 用户点击 Without/With Start | Node 先清空该侧实时 append 文件，再写 `case=case3,command=start,dt_type=<without dt |
| ReInit 单侧 | `POST /api/case3/control-file`      | Web -> Node -> 控制文件/文件清空 | 用户点击单侧重置                | Node 写 `command=reinit,dt_type=<without dt                              |
| 读取初始化数据   | `GET /api/case3/init-data`          | Web -> Node -> 文件        | 进 Tab、单侧重置完成后按需刷新       | 返回地图资源路径、base route、Beam Accuracy 基线。                                   |
| 读取单侧增量点位  | `GET /api/case3/points?side=without | with&cursor=`            | Web -> Node -> 多 txt    | 该侧已见 `execute success` 后每 1s                                            |
| 读取单侧标量    | `GET /api/case3/kpis?side=without   | with&cursor=`            | Web -> Node -> cost txt | 该侧已见 `execute success` 后每 1s                                            |


具体路径名可在 Gate 3 SPEC 收窄，但语义不得改变：浏览器不直接删文件，Node 先清文件再写控制，后端只写业务状态和追加数据。

## 3. 控制文件合同

控制文件沿用 `case_control.json` 五个核心字段结构：


| 字段                  | 类型/允许值                                                                          | 权威写方                                       | case3 语义                                           |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `case`              | 字符串；case3 请求写 `case3`                                                           | Node 代表 Web 写入                             | Start/ReInit 必须写入 `case3`。                         |
| `command`           | `init` / `start` / `reinit`                                                     | Node 代表 Web 写入                             | Start 对应单侧运行；ReInit 对应单侧重置。完成后前端不改回 `init`。        |
| `dt_type`           | `without dt` / `with dt` / `""`                                                 | Node 代表 Web 写入                             | 指明当前命令侧。Without 与 With 互斥运行。                       |
| `status`            | `""` / `execute success` / `execute fail` / `case complete` / `reinit complete` | 业务终态只由后端写；Node 仅在 Start/ReInit 开轮时强制清 `""` | Web 必须按本轮已见 `execute success` 后的完成/失败终态解释，不解释历史残留。 |
| `save_picture_flag` | `0` / `1`                                                                       | case2 截图路径使用；case3 暂不消费                    | case3 不因该字段触发截图或业务状态。                              |


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

Node 对多 txt 增量读取后，向 Web 返回区分侧别的结构化点位：

```ts
type Case3Side = "without" | "with";

type Case3Point = {
  side: Case3Side;
  no: number;
  ue: { x: number; y: number; z: number };
  selectedBeamId: number;
  throughputGbps: number;
  scanBeamIds?: number[];
  reflection?: { x: number; y: number; z: number; los: boolean };
};
```

规则：

- `no` 从 1 递增，由运行时行号得到，不固定为 12 或 32。
- Without 点位必须包含 `scanBeamIds` 和 `selectedBeamId`。
- With 点位必须包含 `selectedBeamId`，并在反射点文件有对应行时包含 `reflection`。
- 同侧逐点文件按行号对齐。Node 只返回已经具备完整必需字段的连续点位；不完整尾行保留到下次轮询，不向 Web 暴露半点。
- 坐标与数值非法时，该侧本轮进入数据异常，不拼接旧行或跨侧补齐。



## 6. Beam Accuracy 派生

输入：

- 文件基线：`ue_comm_with_dt_beam_accuracy_rate.txt` 的 `success,total`。
- 本轮增量：With 完成后，用 With 点位与 Without 点位按同坐标点对比 `selectedBeamId`。

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
- 任意一侧 ReInit 后，本次增量对比失效，展示恢复到文件基线。
- Beam Accuracy 不由后端提供本轮最终百分比；本轮增量由 Web 基于 Node 结构化点位派生。



## 7. 刷新、切 Tab、失败

- 刷新后一切回 case3 初始可见状态；不因控制文件残留 `case complete` 自动恢复运行结果。
- 切离 case3 时停止 case3 轮询、定时器和本地播放状态；切回按进 Tab 重新加载初始化数据。
- `execute fail` 是命令失败终态；该侧显示执行命令失败并允许手动重试。前端不得自动重试、自动超时或发取消命令。
- Without/With 两侧互斥：任一侧运行或重置期间，另一侧 Start/ReInit 禁用。

