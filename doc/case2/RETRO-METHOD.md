# case2 复盘方法

## 可复用流程

1. 先压主线：Initial -> start -> execute success -> complete -> reset。
2. 先冻结视觉，再写静态 HTML，再写 API 契约，再写 SPEC，再实现。
3. Shell 与 case 业务分层：Shell 只管导航、缩放、公共 token；case 只管业务状态、数据、图表和资源。
4. 前端浏览器不直接读共享目录；由 Node 文件适配服务集中处理控制文件、数据文件和截图落盘。
5. 无真实后端时，模拟后端必须独立进程，只通过共享目录通信，不提供 REST，不混入适配服务。
6. Gate 结束时同步 `state.md`、项目级矩阵、QA 证据和残余风险。

## 下个 case 可直接复用

| 可复用项 | 复用方式 |
|---|---|
| Gate 流程 | 继续 Gate 0 -> 1 -> 1.5 -> 2 -> 3 -> 4 -> 5。 |
| Shell 结构 | 四 Tab、1920×1080 Stage、单活跃卸载规则。 |
| 文档结构 | `doc/caseN/MAINLINE.md`、`API-CONTRACT.md`、`SERVER-SPEC.md`、`WEB-SPEC.md`、`QA-EVIDENCE.md`。 |
| Node 适配形态 | 一个本机适配进程，多 case 命名空间隔离。 |
| QA 证据格式 | 自动命令、人工步骤、截图输出、残余风险分开记录。 |

## 不得直接复用

- case2 的指标语义：RSS 误差、有效路径数误差、首径时延误差。
- case2 的控制状态假设，除非新 case 后端明确同意。
- case2 的热力图锚区、地图底图、CDF/均值展示形态。
- case2 的 synthetic/random 数据生成逻辑。
- 本地打桩结果作为真实采集口径。

## 这次踩过的坑

| 问题 | 处理 |
|---|---|
| Shell 与 case2 资源边界曾混杂 | 拆分 `04-runtime-assets/shell/` 与 `04-runtime-assets/case2/`，正式 Web 再复制到 `code/web/assets/`。 |
| `重置` 与协议 `reinit` 易歧义 | 固定“界面重置 = 协议 reinit”。 |
| 参考样本形状容易被误写死 | 固定动态 `Nx×Ny` 热力矩阵和动态 `N` KPI。 |
| 截图 flag 与 complete 时序易漏截 | 固定启动路径 success->complete 窗口；同拍 complete+flag 仍先截图。 |
| 真实后端和本地打桩容易混为一谈 | 后端交接文档只写真实合同；`realback_no.md` 单独描述本地打桩。 |

## 后续停止线

- case2 本地打桩版本已经足够进入内部演示试跑；除真实后端/真实挂载验收外，不继续扩展 case2 协议。
- 开 case3/4 前必须重新做 Gate 0，不从 case2 推断业务字段。
- 若真实后端接入时发现状态、文件发布或并发写入不满足当前契约，先回 `API-CONTRACT.md` 修合同，再改实现。
