# 2030 IMT 数字孪生项目协作约束

## 项目目标与范围

- 项目是面向内部团队的 PC Web 演示平台：同一入口下有四个 case Tab。
- 当前已完成本地开发的活跃业务 Tab 为 `case2`（`DT Calibration`）、`case3`（`DT for Comm`）与 `case4`（`DT for positioning`）。`case1`（`DT Construction`）已接入离线浏览正式页与预置 GLB 交互；本地验证及未完成项见 `doc/case1/QA-EVIDENCE.md`，不涉及实时后端建模。
- case4 除 3D 外功能已完成本地开发（正式 Web、Node 文件适配、打桩、2D Reflection、CEP 百分比、误差/吞吐/CDF 悬停）；3D 按钮可见禁用、不接业务。证据见 `doc/case4/QA-EVIDENCE.md`。不得把本地打桩或用户提供的联调 PASS 表述为本仓库已独立验收真实后端。
- 基准画布为 Chrome 1920×1080，使用固定画布等比缩放；窗口变化时整体缩放、居中，不以业务页面自行重排替代 Shell 缩放。
- case2 Gate 1 已于 2026-07-30 经用户视觉审阅冻结；Gate 1.5 静态 HTML 已由用户人工检查接受；Gate 2 API 契约 v1 已于 2026-07-31 获用户批准；Gate 3 演示向放宽与 `WEB-SPEC` / `SERVER-SPEC` 已于 2026-08-03 定稿。Gate 4 的正式 Web、Node 文件适配服务与模拟后端打桩已完成本地自动测试与人工联调；证据见 `doc/case2/QA-EVIDENCE.md`。
- case3 Gate 1/1.5/2/3 已冻结，正式 Web、Node 文件适配服务与模拟后端打桩已完成本地开发；证据见 `doc/case3/QA-EVIDENCE.md`。case3 现有 Playwright 为前端隔离主线；三进程真实后端 E2E 与真实挂载验收仍未完成。
- case2/case3/case4 的真实后端、真实挂载路径与真实采集数据均仍未由本仓库独立验收。

## 共享与隔离

- Shell 只拥有：顶部导航、当前 Tab、1920×1080 缩放、公共视觉 token 和“建设中”占位页。
- case 业务状态、文件字段、指标语义、算法、媒体、弹层和业务 CSS 必须 case-local。
- 默认单活跃：切离 case1/case2/case3/case4 时清理对应 case 的轮询、临时数据和本地状态；不允许隐藏页继续读共享文件。任一业务 case Start/ReInit 等待期间锁定其他 Tab。
- 业务 CSS 必须以 `.caseN-page` 根作用域或 CSS Modules 隔离；禁止裸 `.metric-card`、`.panel-title` 等跨 case 类名。

## case2 已确认事实

- case2 是独立业务 case：Initial DT 基线 -> 启动校准 -> Calibrated DT 对比 -> 重置回初始态。
- 启动时前端侧写入 `case: "case2"`、`command: "start"`、`dt_type: "with dt"`；Gate 3 演示向：适配服务在 start/reinit 合并写入时同时清 `status=""`（开一轮去残留），业务终态字面值仍只由后端写出。后端/打桩识别新轮次时不得只看 `command` 是否变化：文件事件只负责唤醒，合法 `start|reinit` 命令元组与 `status=""` 的组合才是唯一新命令门沿。
- 命令枚举：`init` 为初始化/idle，`start` 为开始测试，`reinit` 为重置（旧称“清除”）。
- 后端侧写 `status`：`""`（初始化）、`execute success`（命令执行成功）、`execute fail`（命令执行失败）、`case complete`（后端系统测试完成）、`reinit complete`（后端系统重置完成）。启动路径为 `execute success -> case complete`；重置路径为 `execute success -> reinit complete`。若出现 `execute fail`，前端显示执行命令失败，后端本轮不再写完成终态。只有本轮已见 `execute success` 后的 `case complete` 能触发前端读取 Calibrated 结果；`reinit complete` 只表示重置完成，前端据此移除 Calibrated 显示并恢复登录时按钮状态。
- P0-1 已确认：真实后端先完整写完并关闭六个 Calibrated 文件，最后写 `status=case complete`；前端只在本轮启动后的 `execute success -> case complete` 链路上读取结果。本地模拟后端见 `doc/case2/realback_no.md`：flat 写完六文件后才做最终控制写；若本轮请求截图，打桩将 `status=case complete` 与 `save_picture_flag=1` 合并为同一次原子控制写。打桩控制写只合并 `status`/置 `1` 的 flag，保留 command 及未知字段；不引入 `CASE2_DATA_MODE` / stub 指针目录，不得反向要求真实后端提供 manifest、batch_id 或原子目录切换。
- P0-2/P0-3/P0-4 已确认：启动和重置互斥；不做取消、命令队列、自动超时或**业务命令**自动重试；刷新后一切回 Initial。截图生成/上传的有限重试按 P0-4 单独处理。Node 适配服务采用最小 REST，控制文件读写归一为 `GET /api/case2/control-file` 与 `POST /api/case2/control-file`。
- `save_picture_flag` 初始为 `0`；后端仅在启动路径、`execute success` 之后至 `case complete`（允许同拍）置 `1`；重置路径不置 1。Web 仅在 `calibrating` 观察 0→1（同拍已是 `case complete` 仍截一次），同一截图任务最多尝试 3 次（首次 + 2 次重试）：生成失败可重新生成，上传失败复用同一 Base64；累计 3 次仍失败则由 Web 经 Node 控制 POST 自动清 `0`，接受丢失本张截图并记日志。Node 采用临时文件 + 原子 rename 落盘，成功后清零；`seq` 从 `000` 递增且不覆盖。不实现截图持久事务、SHA-256 去重或进程重启恢复；极端崩溃窗口允许丢失或重复截图，但不得影响业务 `status`。受控双向字段，浏览器不直接写文件。
- 当前 UX 的三项对比语义是误差：RSS 误差、有效路径数误差、首径时延误差。CDF 左移和平均误差下降才表示校准有效。

## 文件与适配边界

- 参考控制文件：`01-参考资料/case_control.json`。
- 参考 case2 数据目录：`01-参考资料/case2/前后端数据接口文件/`。
- 前后端 PC 将通过同一已挂载共享目录交换文件；实际路径由前端 PC 上的 `DT_SHARED_DIR` 注入（旧 `CASE2_SHARED_DIR` 仅作为兼容 fallback）。Web 与 Node 适配服务同机部署在前端 PC（默认 `127.0.0.1:3102`），不存在「浏览器前端 ↔ 适配服务」分机；Web 控制轮询为 1000ms。
- 前端 PC 的 Node.js 本地适配服务是浏览器唯一的文件读写、文件锁和截图落盘所有者；Chrome 只调用该服务的本机 REST 接口。
- 适配服务不是新的业务后端，规格见 `doc/case2/SERVER-SPEC.md`（仅文件 I/O / REST）。Gate 3 控制写入采用适配服务内串行 + 同目录临时文件原子替换。本地无真实后端时的打桩见 `doc/case2/realback_no.md`。真实后端接口以 Gate 2 契约、后端交接文档及其中 2026-08-03 Gate 3 增量（开一轮空 `status`）为准。
- 控制快照以 `case`、`command`、`dt_type`、`status`、`save_picture_flag` 为五个必填字段；`debug_flag`、`scene_type` 可选且存在时校验类型。截图成功响应返回相对共享根的 `out/case2/calibrated-{seq}.png`，日志记录实际绝对路径。

## 数据真实性与文档纪律

- 仓库现有 Initial/Calibrated 文件是参考输入样本；不能因文件已存在而声称本次校准已产生真实结果。
- 后端未来在 `case complete` 前完整发布的一批结果，才可表述为本次真实业务采集结果；来源与锁证据在 Gate 2/5 补齐。
- 热力图插值/配色/叠加、CDF、均值和降幅均为前端派生数据；热力图尺寸为运行时解析得到的 `Nx × Ny`，KPI 样本数为运行时解析得到的 `N`，不得硬编码为 20×20 或 20 条；文件语义精度 **2** 位小数（超过时适配服务四舍五入到 2 位，不拒绝）；数值范围按指标可配（见 `code/server/.env.example`）：热力越界由适配双边掐位且不删格，KPI 越界丢弃样本；降幅必须按当前样本计算，不得写死为 50%。
- 项目状态只写入 `state.md`；项目级事实写入 `doc/`；case 业务细节从 Gate 1 起写入 `doc/caseN/`。不得把当前项目事实写进资产库或 Skill 目录。
- 设计源、Gate 1.5 静态原型和正式运行资源必须三轨分离；UX PNG 不是最终视觉契约。
- 运行输出（如 `code/comdatafiles/out/case2/calibrated-*.png`）是本地联调证据，不默认提交；若需归档截图证据，应在 QA 文档中登记路径、时间和用途。

## 当前验收与禁止事项

- Gate 1 设计源冻结了 initial、calibrating、completed 三个 Pencil frame；failed 是基于 error token 的 Gate 1.5 HTML 视觉派生态，已由用户人工检查接受。四个 UI 状态的视觉差异与前端规格见 `03-design/case2/` 和 `doc/case2/`。
- Gate 1.5 静态原型不接共享目录、不做真实状态机、不把调试模拟逻辑带入正式运行路径。
- case2 当前只宣称“本地打桩联调通过”，不得对外表述为真实后端、真实挂载或真实采集已经完成验收。
- 不继承旧项目的 Socket 字段、指标含义、T-MIMO 业务语义、视频热点或模拟数值。

## case1 离线展示边界

- 当前 Pencil 四帧及已验收静态布局为视觉标准；正式资源位于 `code/web/assets/case1/`，不运行时引用 `web-static`。
- case1 只调用只读数据/GLB GET，无控制命令、Start/ReInit、轮询。参考文件不代表本次生成结果。
- 首页呈现后依次准备几何/电磁 GLB；本次停留内保留视角，切 case/刷新丢弃。初值取 Web `.env`；默认关闭参数调试，可复制后手工写配置，无保存/Reset/持久化。
- RF 已按页读取离线矩阵并叠加，复用 case2 热力算法，蓝青黄红图例与矩阵一致；支持 RF 视图交互及恢复配置初值（与两层3D无Reset分开）。当前前端效果用户已于2026-09-22确认通过；代码复核发现修复并经非浏览器验证后，case1开发冻结。证据与既有项目级限制见 doc/case1/QA-EVIDENCE.md。
