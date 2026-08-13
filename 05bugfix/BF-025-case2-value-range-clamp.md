# BF-025 Case2：真实算法数据撞上统一范围，整批 422

- Status: done
- Severity: P0
- Area: `code/server` Case2 data-files（Web 绘制不改）
- 一次只修这一条：按指标可配范围；热力越界双边掐位；KPI 越界丢弃样本；`.env` 可改 Min～Max
- 来源：2026-08-13 真实算法数据联调（`06dataTest`），**不是**原代码检视列表
- 完成：2026-08-13。`code/server npm test` 70/70

## 问题

Gate 2/3 把十二个 txt 写成**同一套**范围：热力 `\-200～200`，KPI `0～500`（禁止负号）。越界整文件 `422 DATA_FILE_INVALID`，Calibrated 六文件任一失败则整批拒绝。

真实算法输出（`06dataTest/case2/` Calibrated，40×72，KPI N=8）三项量纲不同，会直接撞上这套演示护栏：

| 文件 | 观测 | 旧契约 | 结果 |
|---|---|---|---|
| `heatmap_cali_rss.txt` | \-120～15.76 | 热力 \-200～200 | 过关 |
| `heatmap_cali_kpi_rss.txt` | max 689.06 | KPI 0～500 | **422**（控制台第一条） |
| `heatmap_cali_effective_path_num.txt` | 6～256 | 热力 ≤200 | 也会 422 |
| `heatmap_cali_kpi_effective_path_num.txt` | 1849～45796 | KPI ≤500 | 全超 |
| `heatmap_cali_first_path_delay.txt` | \-4166.67～887.48 | 热力 \-200～200 | 哨兵与正值都越界 |
| `heatmap_cali_kpi_first_path_delay.txt` | 157～约 1.1×10⁷ | KPI ≤500 | 多数超 |

Web 现象：`GET /api/case2/data-files?phase=calibrated` 连续 422，日志把内容非法当成「批次未就绪」连试 10 次，最后 `result-incomplete` / `failed-start` 撤权。文件不会在 10 秒内变合法。

补充：

- 行内 `238.17, 240.67, 235.66, ` 这类空格/末尾逗号**本来就合法**（`split(/[,\s]+/)`），不是这次 422 的原因，工单里仍写成明确口径。
- `06dataTest/case2/` 里 Initial 仍是 20×20 打桩样，Calibrated 才是真值；并排对比/降幅会失真，**不是本单范围**。
- 热力格子对应地图位置：**不能**从行里删掉越界数，否则后面的格左移。

## 方案

1. **按指标拆范围**（init/cali 同一指标共用），不再用一套 `\-200～200` / `0～500`。
2. **热力越界双边掐位**：`x>max → max`，`x<min → min`，`Nx×Ny` 不变。
3. **KPI 越界丢弃该样本**；滤完 `N=0` 仍 422。
4. 每个出框文件打 `warn`：`case2 data values out of range`，带 `filename`、`kind`、`action`（`clamped` / `dropped`）、`invalidCount`（KPI 另有 `remaining`）。
5. 范围从 `code/server/.env` 读取，缺省用下表；非法配置**启动失败**，不静默改边界。
6. Case3/Case4 只在 `.env.example` 留注释位，**不改** Case3 现有拒绝逻辑。

默认范围：

| 指标 | 热力（init+cali） | KPI（init+cali） |
|---|---|---|
| RSS | \-500～500 | \-1000～1000 |
| 有效路径数 | 0～500 | 0～50000 |
| 首径时延 | 0～1000 | 0～10000 |

对 `06dataTest` Calibrated：时延热力 `-4166.67` 掐成 0（哨兵不再拉爆色轴）；时延 KPI >10000 的点丢掉；RSS `-120` 仍在 \-500～500 内，色轴仍会被它拉开。

词法不变：UTF-8、十进制、禁止科学计数、热力非空矩形、KPI 非空。Web 仍不二次校验范围，只画 Node 下发后的数。

## 如何配置

模板：`code/server/.env.example`。本地复制为 `code/server/.env`（已 gitignore，不提交）。`npm start` / `npm run dev` 会先加载该文件；**已有非空环境变量优先，不会被 `.env` 覆盖。**

格式：`min,max` 或 `min~max` / `min～max`。改完**重启 Node**。

```bash
# code/server/.env
CASE2_RANGE_HEATMAP_RSS=-500,500
CASE2_RANGE_HEATMAP_EFFECTIVE_PATH_NUM=0,500
CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY=0,1000
CASE2_RANGE_KPI_RSS=-1000,1000
CASE2_RANGE_KPI_EFFECTIVE_PATH_NUM=0,50000
CASE2_RANGE_KPI_FIRST_PATH_DELAY=0,10000
```

也可以不写 `.env`，在启动命令里注入，例如：

```bash
CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY=-5000,1200 npm start
```

| 要改什么 | 改哪一个键 | 效果 |
|---|---|---|
| RSS 热力上下界 | `CASE2_RANGE_HEATMAP_RSS` | 越界掐到新 min/max |
| 路径数热力 | `CASE2_RANGE_HEATMAP_EFFECTIVE_PATH_NUM` | 同上 |
| 时延热力 | `CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY` | 同上（哨兵 `-4166.67` 若仍要掐成 0，保持下界 0） |
| RSS KPI | `CASE2_RANGE_KPI_RSS` | 越界样本丢弃 |
| 路径数 KPI | `CASE2_RANGE_KPI_EFFECTIVE_PATH_NUM` | 同上 |
| 时延 KPI | `CASE2_RANGE_KPI_FIRST_PATH_DELAY` | 同上（>10000 的点会被丢，均值/CDF 会变） |

校验启动是否生效：日志里若出现 `case2 data values out of range`，看 `min`/`max`/`invalidCount`。把 `CASE2_RANGE_HEATMAP_RSS` 写成 `500,-500` 或 `foo` 会启动报错，进程不起来。

Case3/Case4：`.env.example` 里的 `CASE3_RANGE_*` / `CASE4_RANGE_*` **尚未接线**。Case3 仍是 Cost 0～100、beam 0～255 等代码内拒绝。

## 实现位置

- `code/server/src/cases/case2/value-ranges.mjs` — 默认范围与 env 解析
- `code/server/src/cases/case2/numeric-file.mjs` — 掐位 / 丢弃
- `code/server/src/cases/case2/data-files.mjs` — 读文件时按指标取范围并打日志
- `code/server/src/shared/env-file.mjs`、`scripts/run.mjs` — 加载 `.env`
- `code/server/.env.example`

契约同步：`doc/case2/SERVER-SPEC.md`、`API-CONTRACT.md`、`WEB-SPEC.md`、`BACKEND-API-HANDOFF.md`、`AGENTS.md`、`state.md`、`code/server/README.md`。

## 验收

- [x] 热力越界掐位、不删格；KPI 越界丢弃；滤完为空 422
- [x] 行内空格/末尾逗号不当无效
- [x] `CASE2_RANGE_*` 可覆盖默认；非法 min>max 启动失败
- [x] 出框文件有 `invalidCount` 日志
- [x] `code/server npm test` 70/70

## 本单不做

- 不改 Web 色标/CDF/柱图算法（仍按当批 min/max）
- 不把 422 与 409 在 Web 侧重试路径里拆开（仍是 BF 后续）
- 不换 `06dataTest` 的 Initial 打桩样
- 不接线 Case3/Case4 的 `.env` 范围键
