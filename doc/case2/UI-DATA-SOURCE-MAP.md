# case2 UI 数据来源反向清单

> 目的：从每个可见动态区域反查到控制字段、文件输入或前端派生规则。本文只覆盖 case2；Shell 与其他 Tab 不得借用 case2 数据源。
>
> 对应契约：[API-CONTRACT.md](API-CONTRACT.md)。

## 1. 页面级映射

| UI 区域 | 是否动态 | 来源/权威方 | 显示门槛 | 备注 |
|---|---|---|---|---|
| 顶部品牌、导航、1920×1080 缩放 | 否（Shell） | Shell 运行资源与公共 token | 始终 | 不读取 case2 文件。 |
| case2 标题、面板标题、指标标签、图例、地图底图 | 否 | `04-runtime-assets/case2/` + 静态文案 | 始终 | 正式运行不得回读 `02-ux/` 或 Gate 1.5 代表图。 |
| “启动 / 重置”按钮 | 是 | Web 本地交互 + 适配服务提交结果 | 当前状态可执行时 | “重置”唯一映射 `command=reinit`；启动/重置互斥；读到终态或失败后解除；刷新后一切回 Initial。 |
| 状态反馈、按钮禁用/运行中文字 | 是 | `command`、`status` 与 Web 本地提交态 | 状态机映射成立 | 适配服务断连不是 `execute fail`；`execute success` 是命令执行成功，`execute fail` 是命令执行失败，`reinit complete` 是重置完成。 |
| Initial 三张热力图 | 是 | Initial 三个动态 `Nx × Ny` 文件 + 前端热图渲染 | Initial 输入通过校验 | 参考输入，不是本次校准成果；不得硬编码 20×20。 |
| Calibrated 三张热力图 | 是 | Calibrated 三个动态 `Nx × Ny` 文件 + 前端热图渲染 | 本轮启动后观察到 `execute success -> case complete`，且六文件批次有效 | 不得显示静态 `heatmap-calibrated-represent.png`；读到 `reinit complete` 后移除；刷新后不自动恢复。 |
| 三张 Initial CDF、均值柱 | 是 | Initial 三组动态 `N` 个 KPI 样本 + 前端派生 | Initial KPI 输入通过校验 | CDF 为经验 CDF，均值为算术平均；不得硬编码 20 条。 |
| 三张 Calibrated CDF、均值柱、降幅徽章 | 是 | Calibrated 三组动态 `N` 个 KPI 样本 + 前端派生 | 本轮启动后观察到 `execute success -> case complete`，且六文件批次有效 | 降幅运行时计算，不能沿用 40%/50% 视觉样例；读到 `reinit complete` 后移除；刷新后不自动恢复。 |
| 完成/校准中/失败/结果发布异常反馈 | 是 | 状态机、适配服务可用性、批次校验 | 对应条件 | 业务失败、服务错误、发布错误必须分开。 |
| 截图保存反馈 | 是 | `save_picture_flag` 消费进度 | `save_picture_flag` 从 `0` 变为 `1` | Web 不额外判断 `status`；Web 生成 Base64 PNG，适配服务按递增序号落盘后清零，不覆盖旧截图。 |
| 其他 case Tab 的建设中页 | 否（Shell） | Shell 占位 | 切入其他 Tab | 不启动 case2 轮询、读文件或截图。 |

## 2. 指标到文件与派生结果

| 指标 | Initial 热力图 | Calibrated 热力图 | Initial KPI | Calibrated KPI | 可见结果 |
|---|---|---|---|---|---|
| RSS 误差 | `heatmap_init_rss.txt` | `heatmap_cali_rss.txt` | `heatmap_init_kpi_rss.txt` | `heatmap_cali_kpi_rss.txt` | 两张热图、两条 CDF、两根均值柱、降幅。 |
| 有效路径数误差 | `heatmap_init_effective_path_num.txt` | `heatmap_cali_effective_path_num.txt` | `heatmap_init_kpi_effective_path_num.txt` | `heatmap_cali_kpi_effective_path_num.txt` | 两张热图、两条 CDF、两根均值柱、降幅。 |
| 首径时延误差 | `heatmap_init_first_path_delay.txt` | `heatmap_cali_first_path_delay.txt` | `heatmap_init_kpi_first_path_delay.txt` | `heatmap_cali_kpi_first_path_delay.txt` | 两张热图、两条 CDF、两根均值柱、降幅。 |

文件参考根：`01-参考资料/case2/前后端数据接口文件/`。运行时根目录由部署决定，不能把该参考路径硬编码为正式前端路径。

## 3. 格式与算法反查

| 数据 | 已验证参考形状 | 前端派生 | 非法时的显示 |
|---|---|---|---|
| 热力图 | 正式契约为动态 `Nx × Ny` 非空矩形矩阵，数值最多保留 2 位小数；当前参考样本为 20×20 | 插值、配色、马赛克叠加到运行时底图 | Initial 读取失败：基线不可用；Calibrated 读取失败：整批拒绝。 |
| KPI | 正式契约为动态 `N` 个有限样本，数值最多保留 2 位小数；当前参考样本为 20×1 | 展平、排序、51 点经验 CDF、均值、降幅 | Initial 读取失败：该指标基线不可用；Calibrated 读取失败：整批拒绝。 |
| 降幅 | 无独立文件 | `(Initial 均值 - Calibrated 均值) / Initial 均值 × 100%` | Initial 均值非正或无效：显示不可计算，不用固定占位。 |

KPI 说明资料中的 4×5 和当前参考实物中的 20×1 都只是样本形状；正式接口只认样本集合的数值有效性，样本总数由运行时文件解析得到。

## 4. 数据真实性边界

| 来源 | 当前用途 | 不能表达什么 |
|---|---|---|
| 参考 Initial 文件 | 基线视觉与格式验证 | 经过本次业务链路实时产生。 |
| 参考 Calibrated 文件 | 设计/静态验收、解析与算法验证 | 已完成本次 `with dt` 校准。 |
| `case complete` 后的完整运行批次 | 当前轮结果展示 | 在没有来源、批次和锁证据前，不能扩大为真实采集证明。 |

## 5. 覆盖检查

- [x] 三个可见热力图指标均有 Initial 与 Calibrated 文件来源。
- [x] 三个 KPI 区均有 CDF、均值与降幅的输入和派生规则。
- [x] 状态、重置、失败、刷新、Tab 切离、截图请求都有权威来源。
- [x] Shell、静态资源、参考文件与正式运行输入已分层。
- [x] P0-1 的批次/新鲜度机制已确认：本轮启动后观察到 `execute success -> case complete`，再由适配服务读取并校验完整 Calibrated 六文件批次。
