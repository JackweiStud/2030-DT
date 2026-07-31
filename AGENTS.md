# 2030 IMT 数字孪生项目协作约束

## 项目目标与范围

- 项目是面向内部团队的 PC Web 演示平台：同一入口下有四个 case Tab。
- 当前唯一活跃交付为 `case2`（`DT Calibration`）；其他 Tab 只显示“建设中”，不加载业务状态或数据。
- 基准画布为 Chrome 1920×1080，使用固定画布等比缩放；窗口变化时整体缩放、居中，不以业务页面自行重排替代 Shell 缩放。
- case2 Gate 1 已于 2026-07-30 经用户视觉审阅冻结；Gate 1.5 静态 HTML 已由用户人工检查接受；Gate 2 API 契约 v1 已于 2026-07-31 获用户批准。当前处于 Gate 3 SPEC 评审；两份 SPEC 未获批准前，不创建 React、Node 或业务实现代码。

## 共享与隔离

- Shell 只拥有：顶部导航、当前 Tab、1920×1080 缩放、公共视觉 token 和“建设中”占位页。
- case 业务状态、文件字段、指标语义、算法、媒体、弹层和业务 CSS 必须 case-local。
- 默认单活跃：切离 case2 时清理其轮询、临时数据和本地状态；不允许隐藏页继续读共享文件。
- 业务 CSS 必须以 `.caseN-page` 根作用域或 CSS Modules 隔离；禁止裸 `.metric-card`、`.panel-title` 等跨 case 类名。

## case2 已确认事实

- case2 是独立业务 case：Initial DT 基线 -> 启动校准 -> Calibrated DT 对比 -> 重置回初始态。
- 启动时前端侧写入 `case: "case2"`、`command: "start"`、`dt_type: "with dt"`。
- 命令枚举：`init` 为初始化/idle，`start` 为开始测试，`reinit` 为重置（旧称“清除”）。
- 后端侧写 `status`：`""`（初始化）、`execute success`（命令执行成功）、`execute fail`（命令执行失败）、`case complete`（后端系统测试完成）、`reinit complete`（后端系统重置完成）。启动路径为 `execute success -> case complete`；重置路径为 `execute success -> reinit complete`。若出现 `execute fail`，前端显示执行命令失败，后端本轮不再写完成终态。只有 `case complete` 能触发前端读取 Calibrated 结果；`reinit complete` 只表示重置完成，前端据此移除 Calibrated 显示并恢复登录时按钮状态。
- P0-1 已确认：真实后端先完整写完并关闭六个 Calibrated 文件，最后写 `status=case complete`；前端只在本轮启动后的 `execute success -> case complete` 链路上读取结果。Gate 3 打桩可用临时目录写入 + 原子目录/指针切换 + 最后写状态的更强实现，但不得反向要求真实后端必须提供 manifest、batch_id 或原子目录切换。
- P0-2/P0-3/P0-4 已确认：启动和重置互斥；不做取消、命令队列、自动超时或自动重试；刷新后一切回 Initial。Node 适配服务采用最小 REST，控制文件读写归一为 `GET /api/case2/control-file` 与 `POST /api/case2/control-file`。
- `save_picture_flag` 初始为 `0`；后端置为 `1` 后，Web 不额外判断 `status`，直接生成 Base64 PNG 交给前端侧 Node 适配服务；适配服务确认 `{CASE2_SHARED_DIR}/out/case2/calibrated-{seq}.png` 落盘后，持锁写回 `0`，其中 `seq` 从 `000` 递增且不覆盖旧截图。这是受控的双向字段，不是浏览器直接写文件。
- 当前 UX 的三项对比语义是误差：RSS 误差、有效路径数误差、首径时延误差。CDF 左移和平均误差下降才表示校准有效。

## 文件与适配边界

- 参考控制文件：`01-参考资料/case_control.json`。
- 参考 case2 数据目录：`01-参考资料/case2/前后端数据接口文件/`。
- 前后端 PC 将通过同一已挂载共享目录交换文件；实际挂载路径由 `CASE2_SHARED_DIR` 注入。Gate 3 默认 Node 适配服务为 `127.0.0.1:3102`，Web 控制轮询为 250ms。
- 前端 PC 将部署一个 Node.js 本地适配服务，作为浏览器唯一的文件读写、文件锁和截图落盘所有者；Chrome 只调用该服务的本机 REST 接口。
- 适配服务不是新的业务后端。Gate 3 控制写入采用适配服务内串行 + 同目录临时文件原子替换；打桩结果使用临时运行目录 + 原子指针切换。真实后端接口仍以 Gate 2 契约和后端交接文档为准。

## 数据真实性与文档纪律

- 仓库现有 Initial/Calibrated 文件是参考输入样本；不能因文件已存在而声称本次校准已产生真实结果。
- 后端未来在 `case complete` 前完整发布的一批结果，才可表述为本次真实业务采集结果；来源与锁证据在 Gate 2/5 补齐。
- 热力图插值/配色/叠加、CDF、均值和降幅均为前端派生数据；热力图尺寸为运行时解析得到的 `Nx × Ny`，KPI 样本数为运行时解析得到的 `N`，不得硬编码为 20×20 或 20 条；热力图和 KPI 文件数值最多保留 2 位小数；降幅必须按当前样本计算，不得写死为 50%。
- 项目状态只写入 `state.md`；项目级事实写入 `doc/`；case 业务细节从 Gate 1 起写入 `doc/caseN/`。不得把当前项目事实写进资产库或 Skill 目录。
- 设计源、Gate 1.5 静态原型和正式运行资源必须三轨分离；UX PNG 不是最终视觉契约。

## 当前验收与禁止事项

- Gate 1 设计源冻结了 initial、calibrating、completed 三个 Pencil frame；failed 是基于 error token 的 Gate 1.5 HTML 视觉派生态，已由用户人工检查接受。四个 UI 状态的视觉差异与前端规格见 `03-design/case2/` 和 `doc/case2/`。
- Gate 1.5 前不接共享目录、不做真实状态机、不把调试模拟逻辑带入正式运行路径。
- 不继承旧项目的 Socket 字段、指标含义、T-MIMO 业务语义、视频热点或模拟数值。
