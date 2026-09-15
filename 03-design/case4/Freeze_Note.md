# Freeze Note — case4 DT for positioning

status: **FROZEN（Gate 1 设计源）**
version: case4 Pencil 定稿
date: 2026-09-15

## 定稿原则

- **`03-design/case4/case4.pen` 是视觉与图层合同的唯一定稿件。**
- 本目录其余 md（含本文）只做索引与实现提醒；与 Pencil 冲突时以 Pencil 为准。
- UX PNG 不是最终视觉契约；示意数字不得写入运行代码。

## Source Files

- UX：`02-ux/case4/`（历史参考）
- 规则：`doc/case4/`（接口/范围；后端未决项不阻塞静态页）
- 设计源：`03-design/case4/case4.pen`
- 辅助说明：`Design_Analysis.md`、`Pen_Plan.md`、`Visual_Diff.md`、`Frontend_Spec.md`

## Final Pencil File

`03-design/case4/case4.pen`

## 交付帧（请在 Pencil 中打开）

| 名称 | ID | 说明 |
|---|---|---|
| Case4-空闲态（同构·仅显隐与进度） | `mEyG6` | 未开始；实测/误差/进度层 `enabled=false` |
| Case4-测试中（同构·仅显隐与进度） | `YFD1U` | 运行代表态（进度约至 P13） |
| Case4-完成态（同构·仅显隐与进度） | `iVPf8` | 满窗误差 + 最终统计展示 |
| case4.现场环境 | `PyHHC` | 与测试中同构底稿 + `现场环境浮层`（蒙版+弹窗） |

三业务态 **同名分层树**；差异靠显隐与进度坐标，不靠复制第三套结构。

### 本定稿不包含的独立整页帧

以下曾出现在审阅稿中，**当前 `.pen` 已不存在**；静态 Gate 1.5 / 正式 Web 按 `Frontend_Spec.md` 用同构树 + 运行时态实现，勿再找这些 Node ID：

- 完成悬停（原 `yGo26`）
- 等待最终统计（原 `A6SO8`）
- 异常状态板（原 `kmDkq`）
- case3V1 基线整页（已从本文件移除）

## 可复用组件（均有引用）

| ID | 名称 |
|---|---|
| `HeJpZ` | 共享顶栏 |
| `B6761` | 视图切换 |
| `c0EO9c` | 路线点位 |
| `QCplU` | 列头 |
| `X607U` | 回溯控制列 |
| `wYizf` | 误差Y轴 |
| `Fcn8x` | 定位误差卡 |
| `P6EMJ` | NLOS卡 |
| `fYdoo` | 吞吐率对比卡 |
| `bfpB8` | 轨迹图例 |

已删除未使用组件 `图例项`、画布游离层 `轴体`。

## Known Gaps（不阻塞静态开发）

- 地图三色轨迹为示意路径；实现须走 case3 V2 投影与运行时坐标。
- `连线（示意·非实现源）`、小数像素网格/刻度：前端用 SVG/canvas 计算，禁止照抄 left。
- 悬停浮层 / 等待统计 / 异常横幅：无独立定稿帧，见 `Frontend_Spec.md`。
- 后端四项遗留与重置清结果时点：见 `doc/case4/`，不改本视觉冻结。

## Handoff

| 项 | 状态 |
|---|---|
| Pencil Gate 1 | **已冻结**，可开 case4 静态 Web |
| Frontend_Spec | 与定稿同步；静态页以 Pencil + 本文合同为准 |
| 正式 API / 真实后端 | 未验收；静态页用示意数据即可 |

## Approval

- Approved by: 用户（视觉满意 + 图层交接清晰化完成 + 定稿确认）
- Approval note: 2026-09-15 起 `case4.pen` 作为 Gate 1 设计源冻结；后续改视觉须显式解冻并改 `.pen`
