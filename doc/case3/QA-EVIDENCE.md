# case3 QA 证据

## 2026-08-25 Case3 V2 功能验收收口

- 用户确认已完成人工测试，并批准 Case3 V2 Ticket 01–07 全部通过，功能验收完成。
- Ticket 06 提交前自动验证：Web 33 个测试文件 / 258 项、typecheck、生产构建及 5 条 Case3 前端隔离 E2E 通过；人工另行确认业务 `execute fail` 与最终结果不完整自动回退符合预期。
- 用户明确豁免 Ticket 07 原计划新增的三进程自动化测试。故本节只记录**功能人工验收完成**；下文“尚无 Case3 三进程一键 E2E、真实后端/真实挂载/真实采集未验收”的证据边界继续有效。

## 结论

- 状态：`PASS_LOCAL_STUB_AND_FRONTEND_ISOLATED`。
- 日期：2026-08-11。
- 范围：正式 Web、Node 文件适配服务、Case3 模拟后端打桩、本机共享根 `code/comdatafiles`、前端隔离 Playwright 主线。
- 结论：Case3 本地开发闭环完成，自动测试、构建、Node/stub 分层能力和前端隔离 E2E 均通过，可进入本地演示和用户试跑。
- 边界：未覆盖真实后端 PC、真实挂载路径、真实采集数据、真实三进程一键 E2E 脚本。

## 验证对象

| 层 | 路径 | 结论 |
|---|---|---|
| Web | `code/web/` | React/Vite 正式 Case3 页面已实现；地图交互、点位窗口、原生 SVG/DOM KPI、截图收尾和维测日志已进入测试。 |
| Node 文件适配服务 | `code/server/` | `/api/case3/*` REST、共享 control store、跨 Case busy、单侧文件清空、多 txt 收编、最终快照门槛、截图落盘测试通过。 |
| 模拟后端打桩 | `code/back/case3/` | 31 点逐点发布、dynamic/replay 模式、逐点 Cost、seed、撤权、启动恢复和同拍截图 flag 测试通过。 |
| 共享根 | `code/comdatafiles/` | 本地联调使用；其中 case3 txt、JSONL 和截图输出是运行产物/样本，不代表真实采集。 |

## 自动验证

| 命令 | 结果 |
|---|---|
| `cd /Users/jackwl/Code/2030-DT/code/server && npm test` | PASS：50/50。 |
| `cd /Users/jackwl/Code/2030-DT/code/back && npm test` | PASS：48/48（case2 28/28，case3 20/20）。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm run typecheck` | PASS。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm test` | PASS：87/87。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm run build` | PASS。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm run test:e2e -- --workers=1` | PASS：2/2。Case2 为本地三端 E2E；Case3 为前端隔离 E2E。 |

## Playwright 口径

- `code/web/e2e/case3-mainline.spec.ts` 使用 `page.route` mock `/api/case3/*`，验证 Without/With 执行、独立重置、历史保留和重新配对。
- 当前仓库没有 `code/scripts/e2e-case3-stack.sh`；不能把现有 Case3 Playwright 结果表述为 Web + Node + Case3 stub 三进程 E2E。
- 运行全部 Playwright 时必须使用 `--workers=1`。默认并行 workers 会共用 `e2e-case2-stack.sh` 启动的 Case2 临时共享栈，可能导致 Case2 误报 `CONTROL_READ_FAILED` 或卡在 `resetting`。

## 本地联调覆盖口径

- 进入 Case3 后执行 `GET control -> POST init -> GET init-data`，初始化失败会禁用 Start 并输出结构化错误。
- Without Start 后逐点显示路线、波束、Throughput 和 live Cost；完成后保留 Without 结果。
- With Start 后逐点显示路线、预测波束、Throughput 和 live Cost；完成后计算 Cost 变化、Throughput 双曲线和 Beam Accuracy。
- Without/With ReInit 独立重置；目标侧清空，另一侧历史结果按 pairValid 规则保留或标记未配对。
- Start 完成态截图与 Case2 同构，输出隔离在 `out/case3/case3-{seq}.png`，失败最多 3 次后放弃并清 flag。
- 浏览器控制台 Case3 维测日志包含 entryGeneration / roundGeneration、side.live_progress、final_ready、completed_rendered、screenshot 和 completion init 关键事件。

## 残余风险

| 风险 | 当前处理 |
|---|---|
| 真实后端是否严格按 `execute success >= 3000ms -> case complete` 发布 | 未验证；真实环境必须复跑。 |
| 真实共享挂载上的双端同时整文件写入字段保留 | 未验证；若丢字段，回契约层增加双方共同锁协议。 |
| Case3 三进程一键 E2E | 未实现脚本；当前用手工联调和前端隔离 Playwright 覆盖。 |
| 本地打桩 dynamic/replay 数据不等于真实采集 | 已明确标注；不得对外宣称真实结果。 |
| 未来 3D 地图替换 | 当前为 2D renderer；接口保留 renderer 句柄、原始坐标和截图准备钩子，未引入 Three.js。 |

## 进入下一步条件

- 若目标是内部演示测试：可以进入用户/领导试跑。
- 若目标是真实环境交付：必须停止本地 Case3 stub，接入真实后端和真实挂载路径，并在本文追加真实环境 QA 记录。
