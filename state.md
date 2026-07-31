# 项目状态

## 当前阶段

- 项目 Gate 0：已于 2026-07-29 获用户批准。
- case2 Gate 1：已于 2026-07-30 经用户视觉审阅冻结（`APPROVED`）。
- case2 Gate 1.5：四态静态 HTML 已由用户人工检查并接受；Shell 与 case2 资源/token 归属已分离，验收记录见 `doc/case2/STATIC-HTML-ACCEPTANCE.md`。
- case2 Gate 2：API 契约 v1 已于 2026-07-31 获用户批准，P0-1 至 P0-4 全部关闭。
- case2 Gate 3：已编写 `doc/case2/SERVER-SPEC.md` 与 `doc/case2/WEB-SPEC.md`，等待用户评审批准。
- 当前焦点：把 v1 契约转换为 Node 适配服务和正式 React Web 的可执行施工规格；尚未创建任何 React、Node 或业务实现代码。

## 一句话演示承诺

内部团队在 `DT Calibration` 中先看到 Initial DT 的三项误差基线；启动 `with dt` 校准后，后端状态按 `execute success -> case complete` 推进，只有 `case complete` 且结果完整时才展示 Calibrated DT；点击“重置”（`reinit`）后，后端状态按 `execute success -> reinit complete` 推进，只有 `reinit complete` 才确认回到 Initial DT。若任一路径出现 `execute fail`，前端显示执行命令失败，后端本轮不再给完成终态。

## 当前事实

- 四个 case 通过同一 Web 入口的顶部 Tab 切换；case2 当前优先，其他 case 显示“建设中”。
- case2 控制参考文件为 `01-参考资料/case_control.json`；参考数据在 `01-参考资料/case2/前后端数据接口文件/`。
- `command`、`case`、`dt_type` 由前端侧发起；`status` 由后端写入，其中 `case complete` 是测试完成信号，`reinit complete` 是重置完成信号；截图成功后前端侧适配服务将 `save_picture_flag` 从 `1` 清回 `0`。
- P0-1 已确认：后端每轮启动后，先完整写完并关闭六个 Calibrated 文件，最后才写 `status=case complete`；前端只在本轮启动后的 `execute success -> case complete` 链路上读取这六个文件。
- P0-2 已确认：启动和重置互斥；不做取消、队列、自动超时或自动重试；`execute fail` 解除按钮并允许手动重试；刷新页面后一切回 Initial。
- P0-3 已确认：Node 适配服务采用最小 REST；控制文件读写归一为 `GET /api/case2/control-file` 与 `POST /api/case2/control-file`。
- P0-4 已确认：Web 发现 `save_picture_flag` 从 `0` 变为 `1` 即截图，Base64 传给适配服务；适配服务保存 `{CASE2_SHARED_DIR}/out/case2/calibrated-{seq}.png` 后才清零，`seq` 从 `000` 递增。
- Gate 3 默认值：Node 适配服务监听 `127.0.0.1:3102`；Web 以 250ms 串行轮询；共享根通过必填环境变量 `CASE2_SHARED_DIR` 注入。
- Gate 3 控制写入：适配服务内串行、读最新快照、只合并允许字段、同目录临时文件 `fsync + rename`；不新增数据库、租约服务或长期锁文件。
- Gate 3 打桩发布：六文件先进入临时运行目录，完成后原子切换内部指针，最后写 `case complete`；该机制不要求真实后端实现。
- 前后端 PC 使用同一已挂载共享目录；前端 PC 的 Node.js 本地适配服务是浏览器唯一文件/截图所有者。

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

- P0-1 的真实后端最小发布规则已冻结；Gate 3 打桩采用临时目录写入 + 原子目录/指针切换 + 最后写 `case complete`，但这不是对真实后端的强制要求。
- 共享目录实际挂载路径是部署输入，不写死在仓库；启动时必须显式提供 `CASE2_SHARED_DIR`。
- 无版本号共享 JSON 不能仅靠单端进程锁彻底消除双端同时整文件写入的最后写者覆盖；Gate 4 必须验证真实挂载上的并发字段保留，若失败则回契约层增加双方共同锁协议。
- `execute success` 是必须观察的中间状态；打桩会保持至少 750ms，真实后端是否能被 250ms 轮询稳定观察需在 Gate 4 联调验证。
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
- [case2 Web 施工规格](doc/case2/WEB-SPEC.md)
- [case2 UX 状态映射](doc/case2/UX-STATE-MAP.md)
- [case2 Gate 1 冻结](doc/case2/GATE1-FREEZE.md)

## 最小下一步与停止条件

下一步：用户审阅并批准 `doc/case2/SERVER-SPEC.md` 与 `doc/case2/WEB-SPEC.md`；批准后进入 Gate 4，先按 SERVER-SPEC 实现 Node 适配服务与打桩，再按 WEB-SPEC 实现正式 Web。

停止条件：两份 Gate 3 SPEC 获用户批准前，不创建 Node、React、共享目录连接或正式状态机。
