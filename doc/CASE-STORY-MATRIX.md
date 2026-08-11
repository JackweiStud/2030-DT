# Case 故事矩阵

> 仅做项目级索引。未提供的 case 业务故事明确标为待确认，不从 Tab 名或旧项目推断。

| Case | Tab 名 | 交付顺序 | 一句话故事 | 派生 / 独立判断 | 当前 Gate | 文档入口 |
|---|---|---:|---|---|---|---|
| case1 | DT Construction（按导航顺序推断，待确认） | 4 | 未提供 | 待判断 | 未启动 | `doc/case1/`（未来） |
| case2 | DT Calibration | 1 | Initial DT 基线经 `with dt` 校准后，以 Calibrated DT 的误差分布与均值下降证明校准有效 | 独立业务 case | Gate 5：本地打桩 QA 通过；真实后端/真实挂载待外部验收 | `doc/case2/` |
| case3 | DT for Comm | 2 | Without DT 先跑通信基线，With DT 再跑数字孪生辅助通信，并对比 Cost、Throughput 与 Beam Accuracy | 独立业务 case；复用 Shell/Node 适配骨架，不复用 case2 指标语义 | Gate 1 已冻结；Gate 1.5 已接受；Gate 2 v1 与后端交接材料已于 2026-08-10 批准；Gate 3 SPEC 尚未创建 | `doc/case3/` |
| case4 | DT for positioning（按导航顺序推断，待确认） | 3 | 未提供 | 待判断 | 未启动 | `doc/case4/`（未来） |

## 当前项目规则

- Tab 顺序不等于业务复用关系。
- 未启动 case 只展示 Shell 占位；不拥有文件读取、轮询、计时器或后台连接。case3 Gate 1.5 静态 HTML 已接受，但正式 Web/Node 仍未接入，当前运行页仍不应启动 case3 轮询。
- 新 case 开工时必须独立判断其主线、数据真实性、状态机和是否可派生复用。
- case2 的可复用经验是 Shell/文档/Gate 节奏，不是 case2 指标语义或状态字段可直接套给 case3/4。
