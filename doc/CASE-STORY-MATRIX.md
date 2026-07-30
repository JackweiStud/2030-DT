# Case 故事矩阵

> 仅做项目级索引。未提供的 case 业务故事明确标为待确认，不从 Tab 名或旧项目推断。

| Case | Tab 名 | 交付顺序 | 一句话故事 | 派生 / 独立判断 | 当前 Gate | 文档入口 |
|---|---|---:|---|---|---|---|
| case1 | DT Construction（按导航顺序推断，待确认） | 4 | 未提供 | 待判断 | 未启动 | `doc/case1/`（未来） |
| case2 | DT Calibration | 1 | Initial DT 基线经 `with dt` 校准后，以 Calibrated DT 的误差分布与均值下降证明校准有效 | 独立业务 case | Gate 1：Pencil 计划待确认 | `doc/case2/` |
| case3 | DT for Comm（按导航顺序推断，待确认） | 2 | 未提供 | 待判断 | 未启动 | `doc/case3/`（未来） |
| case4 | DT for positioning（按导航顺序推断，待确认） | 3 | 未提供 | 待判断 | 未启动 | `doc/case4/`（未来） |

## 当前项目规则

- Tab 顺序不等于业务复用关系。
- 未启动 case 只展示 Shell 占位；不拥有文件读取、轮询、计时器或后台连接。
- 新 case 开工时必须独立判断其主线、数据真实性、状态机和是否可派生复用。
