# 项目状态

## 当前阶段

- 项目 Gate 0：已于 2026-07-29 获用户批准。
- case2 Gate 1：已于 2026-07-30 经用户视觉审阅冻结（`APPROVED`）。
- case2 Gate 1.5：四态静态 HTML 已由用户人工检查并接受；Shell 与 case2 资源/token 归属已分离，验收记录见 `doc/case2/STATIC-HTML-ACCEPTANCE.md`。
- case2 Gate 2：API 契约 v1 已于 2026-07-31 获用户批准，P0-1 至 P0-4 全部关闭。
- case2 Gate 3：`WEB-SPEC` / `SERVER-SPEC` / Gate 3 演示向放宽已于 2026-08-03 获用户定稿确认。
- case2 Gate 4：正式 Web、Node 文件适配服务、模拟后端打桩均已实现；2026-08-04 用户确认三者本地测试联调完成，自动 + 人工 check 通过。
- case2 Gate 5：本地 QA 证据已补齐（`doc/case2/QA-EVIDENCE.md`）；本地打桩演示可进入用户/领导测试。真实后端、真实挂载和真实采集不在本次完成口径内。
- case3 Gate 0/2 草案：2026-08-06 用户确认 8 条关键边界，已创建 `doc/case3/MAINLINE.md`、`doc/case3/API-CONTRACT.md`、`doc/case3/UI-DATA-SOURCE-MAP.md`、`doc/case3/UX-STATE-MAP.md`。当前仅为文档草案，正式 Web/Node 尚未实现，Gate 2 契约 v1 仍待批准。
- case3 Gate 1：2026-08-06 设计源已推至 `REVIEW_READY`（`03-design/case3/case3-dt-com.pen` + Gate 1 文档）；**尚未**用户视觉审阅，不得标 `APPROVED`。
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
- 2026-08-03 截图锐度：`toPng` 改为 `pixelRatio=2`（逻辑舞台仍 1920×1080，落盘 3840×2160）；WEB-SPEC / SERVER-SPEC 已同步；不跟 `devicePixelRatio` 浮动。
- 2026-08-03 适配探活：`initial`+`adapterError` 时每 5s `GET control-file`，不封顶；恢复后清 error 并补拉 Initial。
- 2026-08-03 Gate 4-A：`code/server/` Node 文件适配服务已实现；控制快照五个核心字段必填、`debug_flag`/`scene_type` 可选；截图响应返回共享根相对路径。自动测试 25 项通过；使用仓库 `code/comdatafiles` 完成控制 GET 与 Initial 三指标只读启动烟测。参考文件只用于解析验证，不代表真实业务结果。
- 2026-08-04 Gate 4 主线联调收口：`code/web` + `code/server` + `code/back/case2` 打桩三端已可演示。
  - 进页：Web 串行门闩（先 `GET control-file` 诊断适配服务，成功后 `POST {command:"init"}` 写回空闲态，再 `GET data-files?phase=initial`）；StrictMode 去重避免 Initial 双发。
  - 启动：`status="" → execute success → case complete`；默认打桩同拍 `save_picture_flag=1`；Web 同拍先开截图再读 Calibrated；截图落盘后清 flag；Calibrated 成功且截图保存/放弃收尾后，Web 再 `POST {command:"init"}` 写回空闲态。
  - 重置：`status="" → execute success → reinit complete`；重置路径不置 flag；回 `initial` 并清空 Calibrated 后，再 `POST {command:"init"}` 写回空闲态。
  - 可观测：Node 请求摘要/截图 accepted+saved；打桩接单带 `requestPicture`；Web 成功边沿结构化 console log。
  - 用户反复实机验证：初始化 / 启动 / 重置功能正常。
- 2026-08-04 一键联调脚本：`code/scripts/dev-web-server.sh` 同时启动 Web + Node 适配（**不**启打桩）；`Ctrl+C` 结束全部子进程。打桩仍独立：`code/back && npm run dev`。
- 2026-08-04 Web 代码检视后补齐主线 E2E：`code/scripts/e2e-case2-stack.sh` 会准备临时共享目录并启动 Web + Node 适配 + case2 打桩；`code/web npm run test:e2e` 覆盖进页 Initial、启动、截图落盘/清 flag、重置回 Initial。
- 2026-08-04 本轮文档复核自动命令：`code/server npm test` 30/30 通过；`code/back npm test` 28/28 通过（首次复跑曾出现一次陈旧任务测试瞬时失败，立即重跑通过，后续保留观察）；`code/web npm run typecheck` 通过；`code/web npm test` 30/30 通过；`code/web npm run build` 通过；`code/web npm run test:e2e` 1/1 通过。
- 当前焦点：case2 本地打桩版本已具备测试/演示条件；case3 已进入 Gate 0/2 草案收敛。下一步若继续 case2，应做真实后端/真实挂载验收；若推进 case3，应先冻结 Gate 1 设计源与 Gate 2 契约 v1，再写 Gate 3 SPEC。

## 一句话演示承诺

内部团队在 `DT Calibration` 中先看到 Initial DT 的三项误差基线；启动 `with dt` 校准后，后端状态按 `execute success -> case complete` 推进，只有 `case complete` 且结果完整时才展示 Calibrated DT；点击“重置”（`reinit`）后，后端状态按 `execute success -> reinit complete` 推进，只有 `reinit complete` 才确认回到 Initial DT。若任一路径出现 `execute fail`，前端显示执行命令失败，后端本轮不再给完成终态。

## 当前事实

- 四个 case 通过同一 Web 入口的顶部 Tab 切换；case2 当前已实现，case3 已有 UX/数据资料和文档草案但运行页仍未接入，case1/case4 仍显示“建设中”。
- case2 控制参考文件为 `01-参考资料/case_control.json`；参考数据在 `01-参考资料/case2/前后端数据接口文件/`。
- `command`、`case`、`dt_type` 由前端侧发起；进页/刷新/切回 case2 的诊断 GET 成功后，Web 经适配服务写回 `case=case2,command=init,dt_type="",status="",save_picture_flag=0`，只表示空闲握手。启动轮读取 Calibrated 成功且截图保存/放弃收尾后、重置轮消费 `reinit complete` 并回 Initial 后，Web 也写回同一 init 空闲态。Gate 3 演示向：start/reinit 时适配服务强制清 `status=""`；合法 `start|reinit` 命令元组 + 空 status 是后端/打桩唯一的新轮命令门沿，不依赖 command 值变化或文件 mtime。其后业务 `status` 仍由后端写入。`case complete` 是测试完成信号，`reinit complete` 是重置完成信号；截图成功后前端侧适配服务将 `save_picture_flag` 从 `1` 清回 `0`。
- P0-1 已确认：后端每轮启动后，先完整写完并关闭六个 Calibrated 文件，最后才写 `status=case complete`；前端只在本轮启动后已见 `execute success` 再见到 `case complete` 的链路上读取这六个文件。本地打桩若本轮请求截图，在六文件全部完成后将 `case complete + save_picture_flag=1` 合并为同一次最终原子控制写。
- P0-2 已确认：启动和重置互斥；不做取消、队列、自动超时或业务命令自动重试；`execute fail` 解除按钮并允许手动重试；刷新页面后一切回 Initial。截图生成/上传的有限重试不属于业务命令重试。
- P0-3 已确认：Node 适配服务采用最小 REST；控制文件读写归一为 `GET /api/case2/control-file` 与 `POST /api/case2/control-file`。
- P0-4 已确认：后端仅在启动路径、`execute success` 之后至 `case complete`（允许同拍）置 `save_picture_flag=1`；重置不置 1。Web 仅 `calibrating` 观察，同拍 complete 仍截一次；同一截图任务最多尝试 3 次（首次 + 2 次重试），3 次仍失败则经适配服务自动清零并接受丢失本张截图。Node 采用临时文件 + 原子 rename 落盘，成功后清零；`seq` 从 `000` 递增且不覆盖。不做持久事务、SHA-256 去重或进程重启恢复。
- Gate 3 默认值：Node 适配服务监听 `127.0.0.1:3102`；Web 以 1000ms 串行轮询；共享根通过必填环境变量 `DT_SHARED_DIR` 注入，旧 `CASE2_SHARED_DIR` 仅作为兼容 fallback。
- Gate 3 控制写入：适配服务内串行、读最新快照、合并允许字段；`start`/`reinit` 额外强制 `status=""`；同目录临时文件 `fsync + rename`；不新增数据库、租约服务或长期锁文件。
- Gate 3 打桩发布：与真实后端相同，向 flat `case2/` 直接写完并关闭六个 Calibrated 文件，最后写 `status=case complete`；不引入临时运行目录、内部指针或 `CASE2_DATA_MODE`（见 `doc/case2/realback_no.md`）。
- 前后端 PC 使用同一已挂载共享目录；Web 与 Node 适配服务同机在前端 PC，适配服务是浏览器唯一文件/截图所有者。

## case3 已确认事实（Gate 0/2 草案）

- case3 主线：Without DT 先跑通信基线，With DT 再跑数字孪生辅助通信，最后对比 Cost、Throughput、Beam Accuracy。
- 运行顺序：测试时用户必须先跑 Without DT，再跑 With DT；两侧互斥运行，一次只允许 without 或 with 一侧运行/重置。
- 后端文件层：先沿用 `01-参考资料/case3/data/c3/` 的多 txt 现网协议；正式后端继续 append txt。JSONL 仅为收编讨论稿，当前不作为正式后端协议。
- Node/Web 边界：Node 提供 `/api/case3/*`，负责清空单侧实时 append 文件、按行号读取和校验多 txt、收编为区分 Without/With 的结构化点位；Web 只消费结构化数据，不直接读/删共享目录。
- 共享根配置：case2/case3 统一使用项目级 `DT_SHARED_DIR`；`CASE2_SHARED_DIR` 只作为历史兼容或迁移期映射。
- 控制文件：case3 沿用同一个 `case_control.json` 五字段结构。Start/ReInit 由 Node 写入 `case=case3`、`command=start|reinit`、`dt_type=without dt|with dt` 并强制 `status=""` 开新轮；进页/刷新/切回 case3 的 GET 成功后、单侧 `case complete` 结果被 Web 接收后、单侧 `reinit complete` 被 UI 消费后，Web 经 Node 写回 `command=init,status=""` 空闲态；业务终态仍只由后端写。
- Reset：单侧重置，路径仍是 `execute success -> reinit complete`。Without 重置后 With 历史结果可保留；With 重置后 Without 历史结果可保留；任意一侧重置都使本次 Beam Accuracy 增量失效并恢复到文件基线。
- 点位数动态 `N`，由运行时文件解析得到；点位进度显示最新 12 条，超过窗口长度滚动到最新点位。
- Cost 单位是 `%`；正式 UI 文案统一为 `Cost (%)`，不得沿用 UX 切图里的 dB 或 case2 误差减少语义。

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
- 共享目录实际挂载路径是部署输入，不写死在仓库；case2/case3 当前启动时应显式提供项目级 `DT_SHARED_DIR`，旧 `CASE2_SHARED_DIR` 只作为兼容 fallback。
- 无版本号共享 JSON 不能仅靠单端进程锁彻底消除双端同时整文件写入的最后写者覆盖；真实后端/真实挂载验收必须验证并发字段保留，若失败则回契约层增加双方共同锁协议。
- `execute success` 是必须观察的中间状态；打桩默认保持至少 `CASE2_STUB_STEP_MS=5000`（见 `realback_no.md`），真实后端是否能被 1000ms 轮询稳定观察需在真实环境验收时验证。
- 启动/重置的状态链路已确认：`execute success -> case complete` 或 `execute success -> reinit complete`；`execute fail` 为失败终态；刷新页面后一切回 Initial。
- 初始、校准中、失败态为基于完成态结构补建的设计源；用户已审阅并批准，后续变更须重新冻结。
- 当前参考 Calibrated 文件已存在，不能作为本次任务完成证据；本地打桩默认 random 合成 Calibrated（相对 Initial 改善），可 `copy` 回退参考样本；日志标注 synthetic/stub，不得表述为真实业务采集。
- 本地自动测试与用户人工联调已通过；截图输出 `code/comdatafiles/out/case2/calibrated-000.png` 至 `calibrated-005.png` 为 3840×2160 PNG 运行证据，但不默认提交。
- Gate 1 设计源中降幅已改为 `{reductionPct}%` 运行时占位；前端实现不得写死 50%。
- case3 仍缺 Gate 1 设计源冻结；当前 UX PNG 是输入，不是最终视觉契约。尤其点位进度动态 N、Cost(%) 文案、reset/failed 状态需要设计冻结。
- case3 多 txt 行号对齐、半写尾行、单侧重置后跨侧历史结果保留等仍未实现自动校验；需在 Gate 3 SPEC 和 Node 测试中覆盖。

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
- [case2 QA 证据](doc/case2/QA-EVIDENCE.md)
- [case2 复盘方法](doc/case2/RETRO-METHOD.md)
- [case2 UX 状态映射](doc/case2/UX-STATE-MAP.md)
- [case2 Gate 1 冻结](doc/case2/GATE1-FREEZE.md)
- [case3 主线草案](doc/case3/MAINLINE.md)
- [case3 API 契约草案](doc/case3/API-CONTRACT.md)
- [case3 UI 数据来源反向清单](doc/case3/UI-DATA-SOURCE-MAP.md)
- [case3 UX 状态映射](doc/case3/UX-STATE-MAP.md)

## 最小下一步与停止条件

下一步：二选一推进。若继续 case2，接真实后端与真实挂载路径，复跑 `QA-EVIDENCE.md` 的验证矩阵；若推进 case3，先审阅并批准 `doc/case3/API-CONTRACT.md` 草案，再进入 Gate 1 设计源冻结和 Gate 3 `SERVER-SPEC` / `WEB-SPEC`。

停止条件：不把本地打桩 synthetic/stub 数据表述为真实采集；不把 `code/comdatafiles/out/` 运行输出默认提交为源码；不把 case2 契约直接套用到 case3/4；不把 case3 JSONL 草案当作正式后端协议。
