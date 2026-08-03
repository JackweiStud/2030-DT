# 项目状态

## 当前阶段

- 项目 Gate 0：已于 2026-07-29 获用户批准。
- case2 Gate 1：已于 2026-07-30 经用户视觉审阅冻结（`APPROVED`）。
- case2 Gate 1.5：四态静态 HTML 已由用户人工检查并接受；Shell 与 case2 资源/token 归属已分离，验收记录见 `doc/case2/STATIC-HTML-ACCEPTANCE.md`。
- case2 Gate 2：API 契约 v1 已于 2026-07-31 获用户批准，P0-1 至 P0-4 全部关闭。
- case2 Gate 3：`WEB-SPEC` / `SERVER-SPEC` / Gate 3 演示向放宽已于 2026-08-03 获用户定稿确认；进入 Gate 4 实现。
- 2026-08-03 用户定稿：失败态按 WEB-SPEC 路径互斥（`failed-start` 只可再启动，`failed-reinit` 只可再重置）；进页一律 `initial`；无 result-error/unknown-control；六文件失败保持 `calibrating`；`start`/`reinit` 强制 `status=""`；真实后端已确认接受开一轮空 `status`。
- 2026-08-03 分工：本会话只实现正式 Web（`WEB-SPEC`）；Node 适配（`SERVER-SPEC`）与 `realback_no` 打桩由 Codex 交付；本地联调必须同时具备打桩。
- 2026-08-03 Web SPEC 审阅增量已回填 `WEB-SPEC.md`。
- 2026-08-03 接口文档同步：Gate 3 开一轮清 `status=""`、Web 可见态已回填 `API-CONTRACT.md` 与 `BACKEND-API-HANDOFF.md`。
- 2026-08-03 SERVER-SPEC：目标目录改为 `shared/` + `cases/case2|3|4` 多 case 规划（本阶段只实现 case2）；与 WEB-SPEC 对齐。
- 2026-08-03 数值词法：热力/KPI 语义精度 **2** 位小数；超过 2 位由适配服务**四舍五入**到 2 位（不拒绝）；热力矩阵 **\-200～200**；KPI **0～500**（非负）；范围按归一后判定。Calibrated 整批拒绝时 HTTP 无部分数据，适配服务必须打诊断日志。
- 2026-08-03 打桩规格拆出：模拟后端见 `doc/case2/realback_no.md`（含 `CASE2_STUB_STEP_MS=5000`）；`SERVER-SPEC` 仅保留前端文件适配服务。
- 2026-08-03 SERVER-SPEC GET 控制：未知 `status` 透传（与契约/WEB-SPEC 对齐）；仅结构/类型/`save_picture_flag` 非法才 `CONTROL_READ_FAILED`。
- 2026-08-03 截图窗口：后端仅启动路径 success→complete（含同拍）置 flag；Web 仅 calibrating 观察；同拍 `case complete` 仍截一次；重置不截。
- 2026-08-03 截图实现收敛：用户确认内部演示不做持久事务、SHA-256 去重或进程重启恢复；Node 只保证进程内串行、临时文件原子落盘、不覆盖和成功后清零。极端崩溃窗口允许丢失或重复截图，业务状态不受影响。
- 当前焦点：Gate 4 — 按 `WEB-SPEC` 实现正式 React Web；依赖 Codex 侧适配服务与打桩完成联调。

## 一句话演示承诺

内部团队在 `DT Calibration` 中先看到 Initial DT 的三项误差基线；启动 `with dt` 校准后，后端状态按 `execute success -> case complete` 推进，只有 `case complete` 且结果完整时才展示 Calibrated DT；点击“重置”（`reinit`）后，后端状态按 `execute success -> reinit complete` 推进，只有 `reinit complete` 才确认回到 Initial DT。若任一路径出现 `execute fail`，前端显示执行命令失败，后端本轮不再给完成终态。

## 当前事实

- 四个 case 通过同一 Web 入口的顶部 Tab 切换；case2 当前优先，其他 case 显示“建设中”。
- case2 控制参考文件为 `01-参考资料/case_control.json`；参考数据在 `01-参考资料/case2/前后端数据接口文件/`。
- `command`、`case`、`dt_type` 由前端侧发起；Gate 3 演示向：start/reinit 时适配服务强制清 `status=""`；合法 `start|reinit` 命令元组 + 空 status 是后端/打桩唯一的新轮命令门沿，不依赖 command 值变化或文件 mtime。其后业务 `status` 仍由后端写入。`case complete` 是测试完成信号，`reinit complete` 是重置完成信号；截图成功后前端侧适配服务将 `save_picture_flag` 从 `1` 清回 `0`。
- P0-1 已确认：后端每轮启动后，先完整写完并关闭六个 Calibrated 文件，最后才写 `status=case complete`；前端只在本轮启动后已见 `execute success` 再见到 `case complete` 的链路上读取这六个文件。本地打桩若本轮请求截图，在六文件全部完成后将 `case complete + save_picture_flag=1` 合并为同一次最终原子控制写。
- P0-2 已确认：启动和重置互斥；不做取消、队列、自动超时或业务命令自动重试；`execute fail` 解除按钮并允许手动重试；刷新页面后一切回 Initial。截图生成/上传的有限重试不属于业务命令重试。
- P0-3 已确认：Node 适配服务采用最小 REST；控制文件读写归一为 `GET /api/case2/control-file` 与 `POST /api/case2/control-file`。
- P0-4 已确认：后端仅在启动路径、`execute success` 之后至 `case complete`（允许同拍）置 `save_picture_flag=1`；重置不置 1。Web 仅 `calibrating` 观察，同拍 complete 仍截一次；同一截图任务最多尝试 3 次（首次 + 2 次重试），3 次仍失败则经适配服务自动清零并接受丢失本张截图。Node 采用临时文件 + 原子 rename 落盘，成功后清零；`seq` 从 `000` 递增且不覆盖。不做持久事务、SHA-256 去重或进程重启恢复。
- Gate 3 默认值：Node 适配服务监听 `127.0.0.1:3102`；Web 以 1000ms 串行轮询；共享根通过必填环境变量 `CASE2_SHARED_DIR` 注入。
- Gate 3 控制写入：适配服务内串行、读最新快照、合并允许字段；`start`/`reinit` 额外强制 `status=""`；同目录临时文件 `fsync + rename`；不新增数据库、租约服务或长期锁文件。
- Gate 3 打桩发布：与真实后端相同，向 flat `case2/` 直接写完并关闭六个 Calibrated 文件，最后写 `status=case complete`；不引入临时运行目录、内部指针或 `CASE2_DATA_MODE`（见 `doc/case2/realback_no.md`）。
- 前后端 PC 使用同一已挂载共享目录；Web 与 Node 适配服务同机在前端 PC，适配服务是浏览器唯一文件/截图所有者。

## case2 状态机（Gate 0 语义）

| UI 状态 | 外部条件 | 用户看到什么 | 归属 |
|---|---|---|---|
| 初始就绪 | `command=init` 且 `status=""`，或重置后 `status="reinit complete"` | Initial DT；Calibrated 区不显示结果 | 前端展示 + 后端控制状态 |
| 提交/校准中 | 前端写入 `start + with dt`，尚未 `case complete` | 校准中；旧 Calibrated 结果不可复用 | 前端本地状态 |
| 命令成功待终态 | `status="execute success"` | 启动路径继续等 `case complete`；重置路径继续等 `reinit complete` | 后端状态 + 前端展示 |
| 校准完成 | `status="case complete"` 且结果批次完整 | Calibrated 热力图、CDF、均值和降幅 | 后端结果 + 前端派生 |
| 命令失败 | `status="execute fail"` | 显示执行命令失败；后端本轮不再给 `case complete` / `reinit complete` | 后端状态 + 前端展示 |
| 重置中/回初始 | 前端写入 `reinit`；读到 `status="reinit complete"` 后完成 | 启动按钮先变灰；成功后移除 Calibrated 热力图/KPI 并恢复登录时按钮状态 | 前端本地状态 + 后端控制状态 |

## 主要风险与证据缺口

- P0-1 的真实后端最小发布规则已冻结；本地模拟后端见 `doc/case2/realback_no.md`（flat；写完六文件后最后写 `case complete`），与 `SERVER-SPEC` 文件适配服务分离。
- 共享目录实际挂载路径是部署输入，不写死在仓库；启动时必须显式提供 `CASE2_SHARED_DIR`。
- 无版本号共享 JSON 不能仅靠单端进程锁彻底消除双端同时整文件写入的最后写者覆盖；Gate 4 必须验证真实挂载上的并发字段保留，若失败则回契约层增加双方共同锁协议。
- `execute success` 是必须观察的中间状态；打桩默认保持至少 `CASE2_STUB_STEP_MS=5000`（见 `realback_no.md`），真实后端是否能被 1000ms 轮询稳定观察需在 Gate 4 联调验证。
- 启动/重置的状态链路已确认：`execute success -> case complete` 或 `execute success -> reinit complete`；`execute fail` 为失败终态；刷新页面后一切回 Initial。
- 初始、校准中、失败态为基于完成态结构补建的设计源；用户已审阅并批准，后续变更须重新冻结。
- 当前参考 Calibrated 文件已存在，不能作为本次任务完成证据。
- Gate 1 设计源中降幅已改为 `{reductionPct}%` 运行时占位；前端实现不得写死 50%。

## 关键文档

- [Phase 0 范围](doc/PHASE0-SCOPE.md)
- [共享架构草案](doc/ARCHITECTURE-DRAFT.md)
- [Case 故事矩阵](doc/CASE-STORY-MATRIX.md)
- [文档分层](doc/DOC-STRUCTURE.md)
- [交付计划](doc/DELIVERY-PLAN.md)
- [case2 API 契约 v1](doc/case2/API-CONTRACT.md)
- [case2 API 契约评审](doc/case2/API-CONTRACT-REVIEW.md)
- [case2 后端接口交接](doc/case2/BACKEND-API-HANDOFF.md)
- [case2 主线](doc/case2/MAINLINE.md)
- [case2 UI 数据来源反向清单](doc/case2/UI-DATA-SOURCE-MAP.md)
- [case2 Node 适配服务施工规格](doc/case2/SERVER-SPEC.md)
- [case2 模拟后端打桩（非真实后端）](doc/case2/realback_no.md)
- [case2 Web 施工规格](doc/case2/WEB-SPEC.md)
- [case2 UX 状态映射](doc/case2/UX-STATE-MAP.md)
- [case2 Gate 1 冻结](doc/case2/GATE1-FREEZE.md)

## 最小下一步与停止条件

下一步：按 `WEB-SPEC.md` 实现正式 React Web（`code/web/`）；Node 适配与 `realback_no` 打桩由 Codex 交付后做本地联调。`MAINLINE.md` 失败态「两按钮均解除」已过时，施工以 WEB-SPEC 路径互斥为准。

停止条件：不实现 Node 适配或打桩（非本会话范围）；不把参考 Calibrated 文件表述为本次真实结果；不偏离 WEB-SPEC 可见态写死点。
