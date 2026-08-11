# case3 API 契约评审

## 摘要

- 契约：`doc/case3/API-CONTRACT.md`
- 当前状态：`APPROVED`
- 评审日期：2026-08-10
- 批准日期：2026-08-10
- 结论：P0/P1 决策已回填，用户已确认冻结 Gate 2 v1 及真实后端交接材料；2026-08-10 用户追加确认 Case3 截图与 Case2 同构、Reflection flag 映射，以及 Cursor 对 Node 施工规格提出的 complete/busy/截图 ownership/数值边界澄清。

## 修

| 级别 | 问题 | 修订结论 | 影响文件 |
|---|---|---|---|
| P0 | Case2/Case3 共用控制文件，运行中切 Tab 会覆盖在途命令 | 任一 Case Start/ReInit 等待期间锁定其他 Tab；Node 对冲突命令返回 `CONTROL_BUSY` | API 契约、MAINLINE、UI 数据映射 |
| P0 | `case complete` 后缺少结果完整门槛 | 后端完整写完并关闭目标侧必需文件和 Cost 后最后写 complete；Web 最终快照必须 `pendingTail=false`、点非空、Cost 有效 | API 契约、后端交接 |
| P0 | 原 1000ms 轮询可能漏掉 `execute success` | 后端必须保持 success 至少 3000ms；后续 Gate 3 将 Web 默认轮询调整为 500ms，但不放松 dwell | API 契约、后端交接、Web SPEC |
| P0 | REST 路径、请求/响应和错误矩阵被推迟到后续规格 | Gate 2 冻结控制、初始化、单侧快照和截图 REST；四种控制 POST 请求体、成功/失败 shape 和最小错误码 | API 契约 |
| P0 | 刷新/重新进入会遗留旧轮写入 | init 定义为旧 Case/旧侧写入权撤销；后端观察后停止旧轮写文件 | API 契约、后端交接 |
| P1 | ReInit 失败是否恢复旧结果不明确 | 不恢复；进入 `failed-reinit-{side}`，仅允许同侧 ReInit 重试 | API 契约、MAINLINE |
| P1 | 初始化数据缺失仍可能启用 Start | base route 非空且 BA 基线合法才算初始化成功；失败禁用 Start 并输出 Web `console.error` | API 契约、Frontend Spec |
| P1 | Node/Web 校验责任重叠或缺失 | Node 做业务数值/行号/跨文件校验；Web 只做响应 shape/类型防御 | API 契约、UI 数据映射 |
| P1 | 数值精度和范围未冻结 | 坐标 2 位、Throughput 2 位、Cost 1 位且 0～100、beam id 0～255、scan 16 项且包含 selected、flag 0/1 | API 契约、后端交接 |
| P1 | Gate 1 交接文档仍有 12 槽、REVIEW_READY、旧 KPI 文案 | 已同步为 20 槽、APPROVED、`开销(%)`、Reflection/LOS 延后 | Gate 1/1.5 文档 |
| P1 | 静态页 25/15 的开销变化错误显示 66.7% | 修正为 `(25-15)/25=40.0%`；不改变静态页状态范围 | `web-static/case3/case3.js` |
| P1 | 截图口径与 Reflection flag 在冻结契约内自相矛盾 | 用户更正 Case3 截图与 Case2 同构；补全 `0→false,1→true`；同步契约、后端交接和 Gate 3 三份 SPEC | API 契约、后端交接、Gate 3 SPEC |
| P0 | `RESULT_NOT_READY` 可能误伤运行中空点或另一侧读取 | 只在 `case3 + start + 请求侧 + case complete` 匹配时启用最终门槛；其余返回运行中/只读前缀 | API 契约、SERVER-SPEC |
| P0 | shared busy 会改变 Case2 非法直接命令行为 | 对 Case2/Case3 同时启用；合法 Case2 主线/shape 不变，非法覆盖收紧为 409 | Case2/Case3 API、SERVER-SPEC |
| P0 | 截图清零幂等、route ownership 与保存后竞态不清 | flag0 幂等；flag1 按 Case 路由校验；PNG 落盘后清零前在共享队列内复验最新 ownership | Case2/Case3 API、SERVER-SPEC |
| P0 | Case3 严 guard 仍可能被 Case2 截图路由反向误消费 | Case2/Case3 对称校验 `case + start + dt_type + flag=1`；不锁死 status | Case2/Case3 API、SERVER-SPEC |
| P1 | scan 重复、Cost 越界、四舍五入、缺文件和 seq 边界未写死 | scan 16 项互异；Cost 归一后越界 422 不 clamp；复用 Case2 进位；缺文件 404；补零仅文件名 | API 契约、SERVER-SPEC、后端交接、stub SPEC |
| P1 | Gate 3 Web 轮询默认值从 1000ms 调整为 500ms | 只调整 GET control/side 触发节奏；串行不重叠、seen latch 与 success 至少 3000ms 均保持 | API 契约、MAINLINE、WEB-SPEC、SERVER-SPEC |

## 跳

| 项 | 为什么跳过 | 风险边界 |
|---|---|---|
| command_id / batch_id / manifest | 当前是内部单活跃演示；用户确认不扩展正式后端文件协议 | 依靠 Tab 锁、init 撤权、Node 串行和后端停止旧轮写入；真实联调必须验证。 |
| `/points` + `/kpis` 双 cursor | 当前点量小，单侧全量快照更简单 | 未来点量显著增加时重新评审，不在当前契约保留双主路径。 |
| 取消、队列、自动业务超时/重试 | 不服务当前演示主线，增加状态爆炸 | 用户通过同动作按钮手动重试；刷新回 initial。 |
| Reflection/LOS 可视化 | 不属于当前冻结视觉主线 | `reflection` 仍是 With 完整点必需字段，后续独立冻结。 |
| Web 重复业务数值校验 | 避免 Node/Web 双重规则漂移 | Web 仍做响应 shape/类型防御；非法响应整包丢弃。 |
| Web 从 REST 获取地图 URL | 地图是正式 Web 运行资源 | `/init-data` 只返回 base route 和 BA 基线。 |

## 批准记录

- [x] 用户批准 `doc/case3/API-CONTRACT.md` 为 Gate 2 v1。
- [x] 用户批准 `doc/case3/BACKEND-API-HANDOFF.md` 作为真实后端交接材料。
- [x] `state.md` / `CASE-STORY-MATRIX.md` 已同步为 Gate 2 `APPROVED`；三份 Gate 3 SPEC 已创建并标记 `REVIEW_READY`。
- [x] 用户确认 2026-08-10 Gate 2 勘误：Case3 支持截图且机制与 Case2 同构；Reflection flag 映射补全。
- [x] 用户确认 2026-08-10 Node 施工澄清：共享 store/busy、最终读取门槛、Case2/Case3 对称截图 ownership 和数值边界。
- [x] 用户批准共享 `ControlFileStore`、`DT_ADAPTER_HOST/PORT` 主变量及 `out/case3/case3-{seq}.png`。
- [x] 用户确认 2026-08-10 Gate 3 Web 默认 500ms 串行业务轮询；success dwell 仍至少 3000ms。

## 验证记录

- Gate 1/1.5 Markdown 交接文档旧口径扫描：无 `REVIEW_READY`、12 槽、待补修等残留。
- 静态代表值：Without=25、With=15、开销变化=40.0%。
- Node 澄清补丁：9 份关联 Markdown 的 fence、28 个 JSON block、59 个本地文档链接校验通过；真实后端 handoff 禁用词扫描无命中；暂存区与工作区 `git diff --check` 均通过。
- 本轮不修改 `.pen`、正式 Web、Node 或真实后端代码。
