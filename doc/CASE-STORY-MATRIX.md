# Case 故事矩阵

> 仅做项目级索引。未提供的 case 业务故事明确标为待确认，不从 Tab 名或旧项目推断。

| Case | Tab 名 | 交付顺序 | 一句话故事 | 派生 / 独立判断 | 当前 Gate | 文档入口 |
|---|---|---:|---|---|---|---|
| case1 | DT Construction（按导航顺序推断，待确认） | 4 | 未提供 | 待判断 | 未启动 | `doc/case1/`（未来） |
| case2 | DT Calibration | 1 | Initial DT 基线经 `with dt` 校准后，以 Calibrated DT 的误差分布与均值下降证明校准有效 | 独立业务 case | 本地开发完成：正式 Web + Node 适配 + 打桩 QA 通过；真实后端/真实挂载待外部验收 | `doc/case2/` |
| case3 | DT for Comm | 2 | Without DT 先跑通信基线，With DT 再跑数字孪生辅助通信，并对比 Cost、Throughput 与 Beam Accuracy | 独立业务 case；复用 Shell/Node 适配骨架和截图机制，不复用 case2 指标语义 | 本地开发完成：Gate 1/1.5/2/3 已冻结，正式 Web + Node 适配 + 打桩已实现并通过本地验证；真实后端/真实挂载待外部验收 | `doc/case3/` |
| case4 | DT for positioning | 3 | 通过三方案轨迹与误差对比证明 DT 辅助定位更准确，同时展示吞吐率、NLOS 与 2D 反射路径 | 独立业务 case；沿用 Shell 与流程，首版 2D；3D 未做 | 本地开发完成：正式 Web + Node 适配 + 打桩；除 3D 外功能已交付；真实后端/真实挂载待独立验收 | `doc/case4/` |

## 当前项目规则

- Tab 顺序不等于业务复用关系。
- 未启动 case 只展示 Shell 占位；不拥有文件读取、轮询、计时器或后台连接。当前已接入运行页的业务 case 为 case2、case3 与 case4；仅 case1 仍为占位。
- 新 case 开工时必须独立判断其主线、数据真实性、状态机和是否可派生复用。
- case2 的可复用经验是 Shell/文档/Gate 节奏，不是 case2 指标语义或状态字段可直接套给 case3/4。
