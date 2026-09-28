# case3 QA 证据

## 2026-08-25 Case3 V2 功能验收收口

- 用户确认已完成人工测试，并批准 Case3 V2 Ticket 01–07 全部通过，功能验收完成。
- Ticket 06 提交前自动验证：Web 33 个测试文件 / 258 项、typecheck、生产构建及 5 条 Case3 前端隔离 E2E 通过；人工另行确认业务 `execute fail` 与最终结果不完整自动回退符合预期。
- 用户明确豁免 Ticket 07 原计划新增的三进程自动化测试。故本节只记录**功能人工验收完成**；下文“尚无 Case3 三进程一键 E2E、真实后端/真实挂载/真实采集未验收”的证据边界继续有效。

## 2026-09-22 Cost 静态文件生命周期调整

- 两侧 Cost 文件作为共享目录预置静态输入；Node Start/ReInit 清理与 Case3 本地打桩均不得修改。
- Node 仍读取并校验 Cost，Web 的读取与开销计算保持不变。
- 验证：`code/server npm test` 121/121；`code/back npm test` 91/91（Case2 29、Case3 21、Case4 41）。
- 用户确认本地联调验证通过。
- 两份正式共享 Cost 文件未进入本次 diff；Start/ReInit/stub 回归测试均在临时共享目录运行。此证据不代表真实后端或真实挂载已验收。

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
| Node 文件适配服务 | `code/server/` | `/api/case3/*` REST、共享 control store、跨 Case busy、单侧逐点文件清理、静态 Cost 保留、多 txt 收编、最终快照门槛、截图落盘测试通过。 |
| 模拟后端打桩 | `code/back/case3/` | 逐点发布、dynamic/replay 模式、静态 Cost 保留、seed、撤权、启动恢复和同拍截图 flag 测试通过。 |
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
- Without Start 后逐点显示路线、波束、Throughput 和预置 Cost；完成后保留 Without 结果。
- With Start 后逐点显示路线、预测波束、Throughput 和预置 Cost；完成后计算 Cost 变化、Throughput 双曲线和 Beam Accuracy。
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


## 2026-09-28 数据栏全屏

- 参考：`01-参考资料/更新/case3/case3全屏 (1).png`。回溯标题旁增加全屏/收起按钮，Esc 返回，保留 Shell 顶部导航与固定画布缩放。全屏状态仅属于当前页面，切换不重置业务数据或触发业务命令。
- typecheck、生产 build 通过；case3 / case3-v2 / case4 共 44 个测试文件、342 项通过。
- Chrome 构建产物预览配合模拟接口验证：1920×1080 与 1280×720，展开、按钮收起、Esc 返回、KPI 边界、带数据曲线悬停；case4 另验证 CDF 50% 悬停。正式模式浏览器脚本退出码 0、无 pageerror。未复验真实后端。
- 截图（模拟数据，仅用于布局核对）：`C:/Users/wzq13/Documents/Codex/2026-09-28/case3-case4-d-code-2030-dt/outputs/case3-fullscreen.png`；复核脚本：`C:/Users/wzq13/Documents/Codex/2026-09-28/case3-case4-d-code-2030-dt/work/verify.cjs`。截图未纳入 Git。

## 2026-09-28 Case3 3D 本地验证

- Web：`npm run build` 通过；`npm test -- test/case3 test/case3-v2 --silent` 27 文件、213 项通过。
- Node：`node --test test/case3/*.test.mjs` 26 项通过，包括独立模型 GET 字节 SHA-256 一致性、拒绝写入和非法 query。
- Chrome：`scripts/check-case3-3d.mjs` 使用真实 case3 GLB、模拟业务接口，1920×1080 和 1280×720 下验证加载、旋转、缩放、复位、切换保留视角、单次停留仅一次模型请求、Without/With 两轮实际 WebGL PNG 截图、退出销毁、404 提示与显式重试。最终 case3 隔离流程 pageerror 为零。
- 调试浏览器通过临时环境变量 `VITE_CASE3_3D_DEBUG_INFO=true` 开启面板；正式 `.env` 默认 false。代码级配置往返测试覆盖 position/target/zoom 复制格式；业务截图已目视确认包含 GLB/HUD/指标且不含 debug。
- 本地截图生成时间：2026-09-28；路径：`code/web/test-results/case3-3d/initial.png`（初始+debug）、`completed.png`（With完成+debug）、`business-0.png` 与 `business-1.png`（实际 Without/With 业务截图）。用途为本次前端隔离验证，位于忽略输出目录，不默认提交。
- 使用现有 21 点预置路线检查可渲染；路线地物精确落位、真实 BS 高度、最终初始视角及目标 PC 性能仍需用户现场审阅。本次不宣称真实后端、真实挂载、真实采集或精确标定验收。
- 跨入 case4 后立即切回的探索流程曾出现 `signal is aborted without reason` pageerror；切离到 case1 的 case3 隔离验收未出现。本次未修改 case4，也未将该跨 case4 取消行为判定为已解决。
- 最终补验：1280×720 下右键平移、滚轮缩放与实际剪贴板复制通过；Windows 剪贴板 CRLF 归一后与七行 env 文本一致。相机手势按 Shell 可见/逻辑高度比例修正。最终生产构建通过，`git diff --check` 无空白错误。

## 2026-09-28 3D 标识/路线/反射视觉修订验证

- 改为 2D 同款图钉及 UE 图片、固定逻辑像素尺寸、14/9 双层路线、紫青/绿色波纹及白色移动亮段。新增三维叠加模块，不改变业务坐标与 2D 页面。
- Chrome 使用真实模型和模拟业务通过两轮业务截图、视角复位、切换保留、剪贴板、缩放/平移、失败重试；pageerror 为零。近景截图：`code/web/test-results/case3-3d/completed-closeup.png`，生成于 2026-09-28，用于确认数字无拉伸和图钉/路线风格；业务 PNG 仍验证过滤 debug。输出不默认提交。
- 新增几何测试覆盖图钉屏幕尺寸在不同距离下不变、反射端点保留、近裁剪面外坐标不产生 NaN，以及运行态亮段与静态区分。最终视觉由用户审阅；本地模拟结果不代表真实数据验收。
