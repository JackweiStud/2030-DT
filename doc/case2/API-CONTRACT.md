# case2 Gate 2 API 契约（草案 v0.2）

> 范围：只约束 `DT Calibration`（case2）的文件控制、结果发布、浏览器与前端 PC Node 适配服务之间的**语义**。本文是 Gate 2 的唯一接口真相源；实现、目录、端口、具体 REST 路由和文件锁算法留到 Gate 3。
>
> 状态：`DRAFT`。已进入 Gate 2；本文列出的 P0 待确认项未冻结前，不得进入 Gate 3 或连接真实共享目录。

## 0. 契约边界与术语

### 0.1 固定术语

| 面向 | 固定名称 | 含义 |
|---|---|---|
| UI 按钮 | **启动** | 发起一次 `with dt` 校准请求。 |
| UI 按钮 | **重置** | 提交协议命令 `reinit`；读到 `status="reinit success"` 后移除 Calibrated 显示并回到登录时按钮状态。界面不再使用“清除”作为按钮文案。 |
| 协议命令 | `init` / `start` / `reinit` | 初始化/空闲、开始测试、重置。 |
| 后端状态 | `""` / `execute success` / `execute fail` / `case complete` / `reinit success` | 初始化、命令已执行但未完成、执行失败、结果已可读取、重置完成。 |
| 结果批次 | Calibrated 六文件集合 | 三张 Calibrated 热力图 + 三组 Calibrated KPI 样本；缺任一文件即不是完整批次。 |

“清除”仅可作为历史文档中的旧称；正式 Web、后端交接和后续 SPEC 一律使用“重置”。

### 0.2 层级与禁止事项

| 层 | 负责 | 明确不负责 |
|---|---|---|
| Shell | Tab、1920×1080 缩放、公共 token、建设中占位 | case2 命令、结果、轮询、截图和业务 CSS |
| case2 Web | 交互意图、case-local 可见状态、热力/CDF/均值派生展示、生成完成态截图 | 直接读取共享目录、持锁、写结果或输出 PNG |
| Node 本地适配服务（前端 PC） | 唯一文件 I/O、控制读写、稳定批次读取、锁、截图落盘和 `save_picture_flag` 回写 | 后端校准算法、其他 case 的状态判断 |
| 后端业务进程（后端 PC） | 读取控制、执行校准、发布结果、写 `status` 与截图请求标志 | 浏览器展示、前端截图编码 |

当前没有已冻结的 REST 路径、方法、轮询周期、挂载目录或锁实现。Gate 2 只定义下述逻辑操作；不得把示例路径、Socket.IO 或轮询间隔写成既成事实。

## 1. 逻辑接口总表

| 逻辑操作 | 方向 | 触发 | 输入/输出语义 | 约束 |
|---|---|---|---|---|
| 读取控制快照 | Web → 适配服务 → 控制文件 | 页面进入、恢复前台、运行期间 | 返回当前 `case_control` 字段及可用性 | Web 不直接读文件；具体 REST 形状待 Gate 3。 |
| 提交启动 | Web → 适配服务 → 控制文件 | 用户点击“启动” | 写入 `case=case2`、`command=start`、`dt_type=with dt` | 提交后立刻丢弃本地旧 Calibrated 结果。 |
| 提交重置 | Web → 适配服务 → 控制文件 | 用户点击“重置” | 写入 `command=reinit` | 启动按钮变灰/禁用；不得把点击动作本身当成重置完成。 |
| 确认重置完成 | Web → 适配服务 → 控制文件 | 轮询读到后端写入 `status="reinit success"` | 返回重置完成快照 | 前端移除 Calibrated 热力图和 KPI 数据；启动按钮恢复到登录时状态。 |
| 读取 Initial 输入 | Web → 适配服务 → 初始文件 | case2 进入 Initial | 返回三项 Initial 热力矩阵与 KPI 样本 | 当前是参考离线输入，不得标为本次校准产物。 |
| 读取完成批次 | Web → 适配服务 → Calibrated 文件 | 仅 `status=case complete` 后 | 返回经完整性与稳定性校验的六文件批次 | 文件存在、`execute success` 或旧缓存均不能替代此门槛。 |
| 消费截图请求 | 后端标志 → 适配服务 ↔ Web | `save_picture_flag` 由 `0` 变为 `1` 且完成态稳定 | Web 生成完成态截图；适配服务确认落盘后写回 `0` | 浏览器不得写共享目录；失败不得提前清零。 |

## 2. 控制文件合同

参考文件：`01-参考资料/case_control.json`。部署时的实际共享目录路径尚未冻结；该参考路径不是运行时挂载路径。

| 字段 | 类型/允许值 | 权威写方 | case2 Web 语义 |
|---|---|---|---|
| `case` | 字符串；当前为 `case2` | 前端侧适配服务代表 Web 写入 | 每次启动请求必须写 `case2`。 |
| `command` | `init` / `start` / `reinit` | 前端侧适配服务代表 Web 写入 | `start` 对应启动；`reinit` 对应重置；`init` 表示初始/空闲。 |
| `dt_type` | `""` / `with dt` | 前端侧适配服务代表 Web 写入 | 本 case 的启动必须为 `with dt`；不得自行加入 `without dt`。 |
| `status` | `""` / `execute success` / `execute fail` / `case complete` / `reinit success` | 后端 | Web 只读解释，绝不以此字段向后端回写业务结论。 |
| `save_picture_flag` | `0` / `1` | 后端置 `1`；适配服务在截图成功后置 `0` | Web 只消费请求并回传截图数据，不能直接写标志或文件。 |
| `debug_flag` | 整数；当前参考值 `0` | 未冻结 | 当前 UI 不消费、不修改、不赋予业务语义。 |
| `scene_type` | 字符串；当前参考值 `U6G` | 未冻结 | 当前 UI 不消费、不修改、不赋予业务语义。 |

### 2.1 写入保护

1. 适配服务只能代表 case2 写入 `case`、`command`、`dt_type` 和受控的 `save_picture_flag` 回写；不得因整文件写入丢失 `status`、`debug_flag`、`scene_type` 或未来未消费字段。
2. 后端拥有 `status`；Web 或适配服务不得用前端本地状态伪造 `execute success`、`execute fail`、`case complete` 或 `reinit success`。
3. 具体原子写、互斥锁与字段保留算法是 Gate 3 实现事项，但其结果必须满足前两条。

## 3. 状态机与可见行为

### 3.1 映射优先级

适配服务可达时，case2 Web 按以下优先级解释快照。本地提交态只表达按钮和过渡 UI，不能伪造后端状态或结果批次。

| 优先级 | 条件 | case2 可见状态 | Calibrated 区域 |
|---:|---|---|---|
| 1 | 适配服务不可达或快照无效 | 连接/读取异常，不能冒充业务失败 | 不展示旧结果；Initial 保留或显示其自身读取错误。 |
| 2 | 本地已提交 `reinit`，且尚未读到 `status="reinit success"` | `resetting` | 启动按钮禁用；Calibrated 不得被视为新一轮可复用结果。 |
| 3 | `status="reinit success"`，且当前没有本地已接受的 `start` 请求 | `initial` | 移除 Calibrated 热力图和 KPI 数据；控件回登录时状态。 |
| 4 | `status=case complete` 且六文件批次通过全部校验 | `completed` | 显示新批次热力图、CDF、均值与降幅。 |
| 5 | `status=case complete` 但批次缺失、解析失败或无法证明稳定 | 结果发布异常 | 不显示完成态，也不得回退为旧 Calibrated 结果。 |
| 6 | `status=execute fail` | `failed` | 保留 Initial；清空 Calibrated；允许重新启动或重置。 |
| 7 | `command=start`，或本地启动已被适配服务接受，且尚未命中上述条件 | `calibrating` / `execute-success-waiting` | 不展示任何旧结果。`execute success` 仍属于等待结果。 |
| 8 | `command=init` 且 `status=""` | `initial` | Initial 可见；Calibrated 为空态。 |
| 9 | 其他组合 | 未知控制状态 | 不得显示完成态；保留诊断信息给适配服务/QA。 |

### 3.2 主线时序

| 阶段 | Web | 适配服务 | 后端 | 结果展示 |
|---|---|---|---|---|
| 进入 case2 | 请求控制快照与 Initial 输入 | 读取并返回可用快照/输入 | 无需新命令 | 仅 Initial 基线。 |
| 启动 | 先清空本地 Calibrated，再提交启动 | 写 `case2/start/with dt` | 读取并执行 | 校准中。 |
| 命令已执行 | 继续读取控制快照 | 转发 `execute success` | 写 `status=execute success` | 仍是等待，不读 Calibrated。 |
| 完成发布 | 仅在 `case complete` 后请求完成批次 | 校验并提供完整稳定批次 | 先完成当批六文件发布，再写 `case complete` | 显示成对热力图、CDF、均值和运行时降幅。 |
| 失败 | 解释 `execute fail` | 转发状态 | 写 `status=execute fail` | Initial + 失败反馈；无 Calibrated。 |
| 重置 | 提交 `reinit` 并禁用启动 | 写命令并继续读取快照 | 写 `status="reinit success"` 表示重置完成 | 前端收到成功状态后移除 Calibrated 数据并回 Initial。 |

`reinit` 后端不需要再把 `command` 改回 `init`、把 `status` 改回 `""` 才算完成；`status="reinit success"` 就是本轮重置的完成确认。后续用户点击“启动”时，前端侧适配服务再次写入 `command=start` 与 `dt_type=with dt`，进入新一轮测试。

### 3.3 刷新、切 Tab 与重放

- 页面刷新、切离 case2 或适配服务重连时，必须销毁 case2 的本地 Calibrated 数据、轮询和截图临时状态；回到 case2 后重新取得当前快照。
- 仅当**本次重新读取**到 `case complete` 且完整批次校验通过，才可再次显示 Calibrated 结果；不能拿浏览器内存、静态原型或既有参考 Calibrated 文件回填。
- `execute success`、文件已存在和静态样本均不是可重放完成态的依据。
- 如果刷新后读到 `command=reinit` 且 `status="reinit success"`，Web 进入 Initial 可见状态并保持 Calibrated 为空；不得要求后端额外回落到 `command=init,status=""`。
- 轮询频率、超时阈值和重连退避待 Gate 3；但超时/断连必须与 `execute fail` 视觉和语义分开。

## 4. 结果批次与数据格式

### 4.1 当前 UI 唯一消费的六文件

| UI 指标 | Initial 热力图 | Calibrated 热力图 | Initial KPI 样本 | Calibrated KPI 样本 |
|---|---|---|---|---|
| RSS 误差 | `heatmap_init_rss.txt` | `heatmap_cali_rss.txt` | `heatmap_init_kpi_rss.txt` | `heatmap_cali_kpi_rss.txt` |
| 有效路径数误差 | `heatmap_init_effective_path_num.txt` | `heatmap_cali_effective_path_num.txt` | `heatmap_init_kpi_effective_path_num.txt` | `heatmap_cali_kpi_effective_path_num.txt` |
| 首径时延误差 | `heatmap_init_first_path_delay.txt` | `heatmap_cali_first_path_delay.txt` | `heatmap_init_kpi_first_path_delay.txt` | `heatmap_cali_kpi_first_path_delay.txt` |

AOA、ZOA 的参考文件不进入当前 case2 UI、结果批次、截图或“校准有效”结论。

### 4.2 解析与有效性

| 文件类别 | 正式语义 | 可接受格式 | 有效性条件 |
|---|---|---|---|
| 热力图矩阵 | `Nx × Ny` 误差空间分布 | 文本；CRLF 或 LF；逗号或空白分隔 | 非空矩形矩阵；每个非空行必须有相同数量的有限数值。列数为 `Nx`，行数为 `Ny`，二者均由文件解析得到且不固定为 20。 |
| KPI 样本 | `N` 个误差标量 | 文本；CRLF 或 LF；逗号或空白分隔 | 至少 1 个有限数值；`N` 由文件解析得到且不固定为 20。行列分组不表达业务语义。 |

当前仓库参考样本经验证表现为热力图 20×20、KPI 20×1；这只是参考样本形状，不是正式接口限制。前端必须从文件内容推导 `Nx`、`Ny` 与 `N`，再计算热力图、CDF 与均值。

### 4.3 完整批次门槛

1. 后端必须先发布同一轮校准的六个 Calibrated 文件，再写 `status=case complete`。
2. 适配服务只能在看到 `case complete` 后读取 Calibrated 文件；读取后必须一次性校验六个文件，任一无效则整批拒绝。
3. 被拒绝时，Web 保持 Initial 和“结果发布异常/等待处理”状态，绝不拼接旧文件、部分新文件或静态代表图。
4. 当前控制文件没有批次 ID、发布清单、校验和或目录切换标志，无法独立证明“六文件同批且为本次运行”。该证明机制为 P0-1，未确定前不得把读取到的 Calibrated 文件表述为本次真实产物。

### 4.4 数据真实性标签

| 数据 | 当前标签 | 可否宣称为本次校准结果 |
|---|---|---|
| `heatmap_init_*` 参考文件 | 参考离线输入 | 否；只能作为基线样本。 |
| 已存在的 `heatmap_cali_*` 参考文件 | 参考离线样本 | 否；仅可支持设计、静态验收和格式验证。 |
| 后端按 P0-1 发布并在 `case complete` 后读取的完整批次 | 待 Gate 5 运行证据确认 | 可作为当前批次展示；真实采集来源仍需 Gate 5 证据。 |

## 5. 前端派生数据合同

| UI 输出 | 输入 | 固定算法/规则 |
|---|---|---|
| Initial / Calibrated 热力色场 | 对应 `Nx × Ny` 矩阵 + `04-runtime-assets/case2/maps/heatmap-map-base.png` | 运行时按已提供热力图说明进行插值、配色和马赛克叠加；静态代表图 `heatmap-calibrated-represent.png` 不得进入正式运行路径。 |
| CDF | 每项对应的 `N` 个 KPI 样本 | 升序经验 CDF；按 `t=0..1` 的 51 个等距位置取 `floor(t×(n-1))`，其中 `n` 为当前样本数。 |
| 平均误差 | 每项对应的 `N` 个 KPI 样本 | 算术平均；显示精度由 Gate 3 WEB-SPEC 冻结。 |
| 降幅 | Initial / Calibrated 平均误差 | `(meanInitial - meanCalibrated) / meanInitial × 100%`，仅当 `meanInitial > 0` 且两者均有效时显示。不得写死 50%。 |

“校准有效”只能基于当前已展示批次的三项误差 CDF 左移与平均误差下降来解释；UI 不得把参考样本、单一指标或固定数字包装成真实执行结论。

## 6. 截图请求合同

1. 前提：`status=case complete`、六文件批次已通过校验、完成态已稳定渲染。
2. 触发：后端将 `save_picture_flag` 从 `0` 置为 `1`。适配服务检测到该请求后协调 Web 生成完成态截图。
3. 所有权：Web 只生成并交给适配服务；适配服务是截图文件、目录、写入结果与标志回写的唯一所有者。
4. 回写：仅在适配服务确认 PNG 已完整落盘后，才可在其受控写入/锁范围内把标志写回 `0`。
5. 失败：截图生成、传输或落盘失败时保留请求或记录可恢复失败，禁止未保存即写 `0`；也不得把失败伪装成校准失败。

截图输出路径、文件命名、浏览器到适配服务的截图载荷、成功回执及进程重启后的去重策略为 P0-4。

## 7. 异常合同

| 情况 | Web 行为 | 禁止行为 |
|---|---|---|
| 适配服务不可达/读控制失败 | 与业务失败区分，显示连接/读取异常；不展示旧 Calibrated | 把网络或本机服务错误标为 `execute fail`。 |
| `status` 未知 | 进入未知控制状态，保留诊断并停止完成态展示 | 猜测为完成。 |
| `case complete` 但六文件不完整/格式错误 | 拒绝整批，显示结果发布异常 | 部分图表完成、复用旧数据或静态代表图。 |
| `execute fail` | 清空 Calibrated，允许重新启动或重置 | 保留失败前的完成态结果。 |
| `reinit` 提交后刷新 | Calibrated 继续为空，重新读快照 | 由浏览器缓存恢复旧完成态。 |
| `save_picture_flag=1` 但未满足完成前提 | 保持请求待处理并记录异常 | 抓取 Initial/失败/半成品画面后清零。 |

## 8. Gate 2 验收与待确认

### 已冻结的合同事实

- UI 文案“重置”严格映射 `command=reinit`；启动严格映射 `case=case2`、`command=start`、`dt_type=with dt`。
- `status="reinit success"` 是重置完成信号；前端据此移除 Calibrated 数据并恢复登录时按钮状态，不再等待后端回到 `command=init,status=""`。
- `execute success` 不是完成；只有 `case complete` 且完整有效批次才可展示 Calibrated。
- 当前 UI 只消费 RSS、有效路径数、首径时延三项；每项包括动态解析得到的热力矩阵与 KPI 样本集合，不能硬编码为 20×20 或 20 个样本。
- CDF、均值、降幅都是前端派生，降幅按当前样本计算；浏览器不能直接读写共享目录或截图文件。

### P0：用户/后端负责人确认后才能批准 v1

| ID | 待确认事实 | 为什么阻塞 Gate 2 批准 |
|---|---|---|
| P0-1 | 六文件同批、原子发布与本次运行新鲜度的证明机制（例如发布清单/批次 ID/原子目录切换；具体方案由后端确认） | 只有状态字面量时无法排除新旧文件混读。 |
| P0-2 | `reinit` 失败、超时、重复点击和刷新中断时的处理策略 | 成功口径已由 `status="reinit success"` 固定，但异常收敛与按钮解除仍需事实来源。 |
| P0-3 | 适配服务的 REST 路由、请求/响应 shape、轮询/超时、锁和挂载路径 | 语义已经冻结，但实现端点尚无事实来源。 |
| P0-4 | 截图输出路径、命名、确认回执与进程重启去重策略 | 否则不能保证“已保存才清零”且可能重复输出。 |

**停止条件：** P0-1 至 P0-4 全部得到用户/后端负责人确认，并在 `API-CONTRACT-REVIEW.md` 标记为已修后，用户批准契约 v1；此前不写 Node、React、共享目录连接或真实状态机。
