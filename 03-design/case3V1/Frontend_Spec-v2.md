# Frontend Spec — case3V1（设计评审稿，不可当生产唯一输入）

- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- Viewport：1920×1080，Shell 等比缩放，页面不滚
- 开发期 Tab：id `case5`，文案 `DT for Comm new`；接口仍是 `/api/case3/*`
- 冻结前还要你视觉 YES

## Frame / 状态

| Frame（设计源现名） | 节点 | 前端态 |
|---|---|---|
| `case3V1.初始态` | `HPx45` | 双侧 idle |
| `case3V1.无DT运行中` | `tfJjd` | Without running |
| `case3V1.无DT运行完成` | `wtnmr` | Without complete，With 可 Start |
| `case3V1.有DT运行中` | `k04bc` | With running；地图已清过再跑。画面**代表态=预测正确**，不是独立状态分支 |
| `case3V1.有DT运行完成` | `b7CzAn` | 双侧 complete。画面**代表态=预测错误**，不是独立状态分支 |
| `case3V1.点击现场环境` | `Gs5ws` | Overlay 弹层（非流程分支）。设计底图=有 DT 运行中；关闭回到打开前流程态 |

未画：resetting、failed。逻辑仍要留。帧名只表流程/交互，不要因为代表态画了对错就再补两帧；也不要为每个流程态各补一张现场环境弹层帧。

波束卡组件/实例名：`波束矩阵卡-无DT` / `波束矩阵卡-有DT-预测正确` / `波束矩阵卡-有DT-预测错误`。有 DT 卡顶栏徽章：`预测徽章-正确` / `预测徽章-错误`。回放对勾在 `对勾角标层`（Overlay），不是第三行数据。播放/重置看图层后缀：`可启动` / `忙态` / `启动禁止`，`可用` / `禁用`。

现场环境 Overlay 树：`现场环境浮层` → `整页蒙版` + `现场环境弹窗`（`弹窗标题行` / `关闭按钮` / `视频双列` → `视频列-基站视角` | `视频列-集装箱视角`）。

## 组件树

与 `doc/case3/前端改造/02-新旧对照.md` §0.3 同一棵。禁止把 `PointBeamReplay` 拆成三条无关控件。

## 布局契约

- Page：纵向 Header（约 72–80px）+ 地图铺满 + 底栏 hug 钉底覆盖地图。
- MapStage：唯一 transform；Hud/Dock 不跟地图缩放。
- 场地图：`cover` + `overflow: hidden`。
- 地图舞台子层（自下而上）：`场地底图 → 预置路线层 → 路线点位组 → 已走路线层 → 终端标记`。
- 回溯表：行头 hug，20 列 fill；N>20 时窗口滑动，不增第 21 列。
- KPI：三列 `1fr`；`吞吐率对比卡` / `开销对比卡` / `波束预测准确率卡` 均为组件实例。
- 现场环境：整页 Overlay，蒙版铺满；弹窗居中约 `1120×520`（设计稿 `x:400 y:280`）。
- 有 `gap`/`alignItems` 但未显式写出 `layout` 的 frame，按 Pencil 默认视为 `horizontal`；设计源在对应节点 `context` 标了 `layout=horizontal|vertical` 供交接。
- 窗口变化不重排，只走 Shell 缩放。

## 交互规则

1. 地图/路线/UE 只有一份。点下一侧 Start 时先把地图回初始再跑；底栏历史不清。
2. 列头不可点回看；波束矩阵只跟当前点。
3. 无 DT 矩阵：扫描波 + 最优波，轴 0–15。完成态同样保留扫描+最优。
4. 有 DT 矩阵：同一 `no` 叠最优+预测，无扫描点，轴 0–15。`BeamID = row*16+col`。
5. 格子只显示「最优波|预测波」+ BeamID。禁止 X/Y。
6. 运行中播放键是忙态图标，不发 pause。互斥侧用「启动禁止」。
7. 2D 选中，3D 可见禁用。三杠装饰不可点。
8. 切图数字（50%、75%、P20、BeamID 122）只是代表态。
9. 点「现场环境 >」打开 Overlay；点关闭/蒙版关闭，回到打开前流程态（设计代表底图为有 DT 运行中）。

## 动态层

| 层 | 技术 | 参数 |
|---|---|---|
| 预置路线/点亮/拖尾/UE | SVG | `baseRoute`、本轮 `points[].ue`、当前 `no` |
| 16×16 | DOM/canvas 网格 | `scanBeamIds`、`selectedBeamId`、match |
| 开销梯形 | SVG | `costPct`、delta=`(with-without)/without` |
| 吞吐折线 | SVG | `throughputGbps`，缺点不补 0 |
| BA 横条 | SVG | 基线+同 `no` 增量 |
| 现场环境双视频 | 视频/占位图 | 基站视角、集装箱视角（设计稿为静态图代表） |

## 禁止

- 不把 UX PNG 当运行时底图（场地原图 51MB；设计源用压缩 JPEG）。
- 不把样例数字写死。
- 不改 Node / 控制文件契约。
- 业务 CSS 根在 case-local（如 `.case3v1-page`；若代码仍用 `.case3v2-page` 历史类名，迁移前保持双名兼容说明）。
