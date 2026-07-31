# 项目状态

## 当前阶段

- 项目 Gate 0：已于 2026-07-29 获用户批准。
- case2 Gate 1：已于 2026-07-30 经用户视觉审阅冻结（`APPROVED`）。
- case2 Gate 1.5：四态静态 HTML 已由用户人工检查并接受；Shell 与 case2 资源/token 归属已分离，验收记录见 `doc/case2/STATIC-HTML-ACCEPTANCE.md`。
- 当前焦点：准备 Gate 2 API 契约；尚未进入 Gate 2，且未创建任何 React、Node 或业务实现代码。

## 一句话演示承诺

内部团队在 `DT Calibration` 中先看到 Initial DT 的三项误差基线；启动 `with dt` 校准后，只有当后端发布完整结果并标记 `case complete`，才展示 Calibrated DT 的热力图、CDF 与均值对比，以证明校准降低误差；清除后回到 Initial DT。

## 当前事实

- 四个 case 通过同一 Web 入口的顶部 Tab 切换；case2 当前优先，其他 case 显示“建设中”。
- case2 控制参考文件为 `01-参考资料/case_control.json`；参考数据在 `01-参考资料/case2/前后端数据接口文件/`。
- `command`、`case`、`dt_type` 由前端侧发起；`status` 由后端写入；截图成功后前端侧适配服务将 `save_picture_flag` 从 `1` 清回 `0`。
- 前后端 PC 使用同一已挂载共享目录；前端 PC 的 Node.js 本地适配服务是浏览器唯一文件/截图所有者。

## case2 状态机（Gate 0 语义）

| UI 状态 | 外部条件 | 用户看到什么 | 归属 |
|---|---|---|---|
| 初始就绪 | `command=init`，`status=""` | Initial DT；Calibrated 区不显示结果 | 前端展示 + 后端控制状态 |
| 提交/校准中 | 前端写入 `start + with dt`，尚未 `case complete` | 校准中；旧 Calibrated 结果不可复用 | 前端本地状态 |
| 命令成功待结果 | `status="execute success"` | 仍为校准中，不显示完成对比 | 后端状态 + 前端展示 |
| 校准完成 | `status="case complete"` 且结果批次完整 | Calibrated 热力图、CDF、均值和降幅 | 后端结果 + 前端派生 |
| 校准失败 | `status="execute fail"` | 失败提示与 Initial DT；不显示 Calibrated 结果 | 后端状态 + 前端展示 |
| 清除中/回初始 | 前端写入 `reinit` | 清空本地 Calibrated 结果，等待后端回到初始语义 | 前端本地状态 + 后端控制状态 |

## 主要风险与证据缺口

- `case complete` 与“六份 case2 UI 结果文件已原子发布”的锁/发布规则尚未冻结。
- 共享目录的挂载路径、跨 PC 文件锁、截图 `out` 路径和 Node 适配服务的 REST 路由尚未确定。
- 初始、校准中、失败态为基于完成态结构补建的设计源；用户已审阅并批准，后续变更须重新冻结。
- 当前参考 Calibrated 文件已存在，不能作为本次任务完成证据。
- Gate 1 设计源中降幅已改为 `{reductionPct}%` 运行时占位；前端实现不得写死 50%。

## 关键文档

- [Phase 0 范围](doc/PHASE0-SCOPE.md)
- [共享架构草案](doc/ARCHITECTURE-DRAFT.md)
- [Case 故事矩阵](doc/CASE-STORY-MATRIX.md)
- [文档分层](doc/DOC-STRUCTURE.md)
- [交付计划](doc/DELIVERY-PLAN.md)
- [case2 主线](doc/case2/MAINLINE.md)
- [case2 UX 状态映射](doc/case2/UX-STATE-MAP.md)
- [case2 Gate 1 冻结](doc/case2/GATE1-FREEZE.md)

## 最小下一步与停止条件

下一步：经用户授权后进入 Gate 2，编写 case2 API 契约与 UI 数据来源反向清单；不创建 React、Node 或业务实现代码。

停止条件：Gate 2 契约覆盖正常、失败、完整结果发布、重放与截图触发语义并获用户批准前，不进入 Gate 3 或任何实现。
