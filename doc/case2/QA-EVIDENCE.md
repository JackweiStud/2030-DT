# case2 QA 证据

## 结论

- 状态：`PASS_LOCAL_STUB`。
- 日期：2026-08-04。
- 范围：正式 Web、Node 文件适配服务、case2 模拟后端打桩、本机共享根 `code/comdatafiles`。
- 结论：本地打桩链路的自动测试、构建和用户人工联调均通过，可作为内部演示测试版本。
- 边界：未覆盖真实后端 PC、真实挂载路径、真实采集数据、真实双端并发写压力。

## 验证对象

| 层 | 路径 | 结论 |
|---|---|---|
| Web | `code/web/` | React/Vite 正式 Web 已实现；typecheck、单测、build 通过。 |
| Node 文件适配服务 | `code/server/` | 四个 `/api/case2/*` REST、文件解析、截图落盘与清零测试通过。 |
| 模拟后端打桩 | `code/back/case2/` | 共享目录状态推进、synthetic/random Calibrated 发布、截图 flag 同拍测试通过。 |
| 共享根 | `code/comdatafiles/` | 本地联调使用；其中 Calibrated 文件与截图输出是运行产物/样本，不代表真实采集。 |

## 自动验证

| 命令 | 结果 |
|---|---|
| `cd /Users/jackwl/Code/2030-DT/code/server && npm test` | PASS：30/30。 |
| `cd /Users/jackwl/Code/2030-DT/code/back && npm test` | PASS：28/28。备注：首次复跑出现一次“旧 start 任务陈旧后不覆盖新一轮状态”瞬时失败，立即重跑通过，保留为观察项。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm run typecheck` | PASS。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm test` | PASS：27/27。 |
| `cd /Users/jackwl/Code/2030-DT/code/web && npm run build` | PASS；生成 `dist/index.html` 与打包资产。 |

## 人工联调

用户确认：`case2` 的 Web、Node 文件服务、后端打桩三者本地测试联调完成，自动 + 人工 check 通过。

人工覆盖口径：

- 进入页面后 Initial 正常加载。
- 点击启动后，Web、Node 适配服务、打桩后端形成闭环。
- 启动链路按 `execute success -> case complete` 推进，Calibrated 结果可展示。
- 截图 flag 被消费，输出递增 PNG。
- 点击重置后，状态链按 `execute success -> reinit complete` 回到 Initial。

## 截图输出证据

当前本地共享根下存在 6 张截图运行输出：

| 路径 | 文件特征 |
|---|---|
| `code/comdatafiles/out/case2/calibrated-000.png` | PNG，3840×2160。 |
| `code/comdatafiles/out/case2/calibrated-001.png` | PNG，3840×2160。 |
| `code/comdatafiles/out/case2/calibrated-002.png` | PNG，3840×2160。 |
| `code/comdatafiles/out/case2/calibrated-003.png` | PNG，3840×2160。 |
| `code/comdatafiles/out/case2/calibrated-004.png` | PNG，3840×2160。 |
| `code/comdatafiles/out/case2/calibrated-005.png` | PNG，3840×2160。 |

这些文件是本地联调运行输出，不默认作为源码提交；若后续需要正式证据归档，应明确归档路径、截图时间、浏览器版本和触发轮次。

## 当前工作区注意项

- `code/comdatafiles/case2/heatmap_cali_*.txt` 当前有运行后差异，属于本地打桩生成/联调数据，不应直接当作真实结果提交。
- `code/comdatafiles/out/` 当前未跟踪，包含截图输出和 `.DS_Store`；`.DS_Store` 不应提交。
- `code/web/dist/` 与 `code/web/node_modules/` 为忽略项。

## 残余风险

| 风险 | 当前处理 |
|---|---|
| 真实后端 `execute success` 是否能被 1000ms 轮询稳定观察 | 未验证；接真实后端时必须复跑。 |
| 真实共享挂载上的双端同时整文件写入字段保留 | 未验证；若丢字段，回契约层增加双方共同锁协议。 |
| 本地打桩 synthetic/random 数据不等于真实采集 | 已明确标注；不得对外宣称真实结果。 |
| 截图持久事务、SHA-256 去重、进程重启恢复 | 用户已接受不做；极端崩溃窗口允许丢失或重复截图，不影响业务状态。 |

## 进入下一步条件

- 若目标是内部演示测试：可以进入用户/领导试跑。
- 若目标是真实环境交付：必须接入真实后端和真实挂载路径，并在本文追加真实环境 QA 记录。
