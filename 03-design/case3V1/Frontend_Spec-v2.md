# Frontend Spec — case3V1（设计评审稿，不可当生产唯一输入）

- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- Viewport：1920×1080，Shell 等比缩放，页面不滚
- 开发期 Tab：id `case5`，文案 `DT for Comm new`；接口仍是 `/api/case3/*`
- 冻结前还要你视觉 YES

## Frame / 状态

| Frame | 前端态 |
|---|---|
| `case3v2.initial` | 双侧 idle |
| `case3v2.without-running` | Without running |
| `case3v2.without-completed` | Without complete，With 可 Start |
| `case3v2.with-running` | With running；地图已清过再跑 |
| `case3v2.with-completed` | 双侧 complete |

未画：resetting、failed、现场环境弹窗。逻辑仍要留。

## 组件树

与 `doc/case3/前端改造/02-新旧对照.md` §0.3 同一棵。禁止把 `PointBeamReplay` 拆成三条无关控件。

## 布局契约

- Page：纵向 Header（约 72–80px）+ 地图铺满 + 底栏 hug 钉底覆盖地图。
- MapStage：唯一 transform；Hud/Dock 不跟地图缩放。
- 场地图：`cover` + `overflow: hidden`。
- 回溯表：行头 hug，20 列 fill；N>20 时窗口滑动，不增第 21 列。
- KPI：三列 `1fr`。
- 窗口变化不重排，只走 Shell 缩放。

## 关键规则

1. 地图/路线/UE 只有一份。点下一侧 Start 时先把地图回初始再跑；底栏历史不清。
2. 列头不可点回看；波束矩阵只跟当前点。
3. 无 DT 矩阵：扫描波 + 最优波，轴 0–15。完成态同样保留扫描+最优。
4. 有 DT 矩阵：同一 `no` 叠最优+预测，无扫描点，轴 0–15。`BeamID = row*16+col`。
5. 格子只显示「最优波|预测波」+ BeamID。禁止 X/Y。
6. 运行中播放键是忙态图标，不发 pause。互斥侧用「启动禁止」。
7. 2D 选中，3D 可见禁用。三杠装饰不可点。
8. 切图数字（50%、75%、P20、BeamID 122）只是代表态。

## 动态层

| 层 | 技术 | 参数 |
|---|---|---|
| 预置路线/点亮/拖尾/UE | SVG | `baseRoute`、本轮 `points[].ue`、当前 `no` |
| 16×16 | DOM/canvas 网格 | `scanBeamIds`、`selectedBeamId`、match |
| 开销梯形 | SVG | `costPct`、delta=`(with-without)/without` |
| 吞吐折线 | SVG | `throughputGbps`，缺点不补 0 |
| BA 横条 | SVG | 基线+同 `no` 增量 |

## 禁止

- 不把 UX PNG 当运行时底图（场地原图 51MB；设计源用压缩 JPEG）。
- 不把样例数字写死。
- 不改 Node / 控制文件契约。
- 业务 CSS 根在 case-local（如 `.case3v2-page`）。
