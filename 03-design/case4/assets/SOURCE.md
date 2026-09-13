# case3V1 设计源资产

运行时不要直接读本目录。Pencil 内相对路径 `./assets/...`。

| 文件 | 来源 | 用途 |
|---|---|---|
| `site-2d.jpg` | 由 `02-ux/case3-V1/主页面--层0/元素/场地2D.png` 压到宽 1920 | 等轴测场地图。原 PNG 约 51MB，仅设计源用压缩版 |
| `nav-bg.png` 等导航切图 | `02-ux/case3-V1/导航栏/元素/` | 全站顶栏 |
| `ue-2d.png` | `主页面--层0/元素/2D/UE图标2D.png` | UE |
| `ue-pin-idle.png` | `主页面--层0/元素/UE轨迹/UE位置初始.png` | 未走过点位（气泡 52×62 + 地面光点 16×16，整图 70×83） |
| `ue-pin-lit.png` | `主页面--层0/元素/UE轨迹/UE位置点亮.png` | 已走过点位，同上尺寸 |
| `ue-bubble-pin.png` | `主页面--层0/元素/UE轨迹/UE位置气泡-上.png` | 仅气泡切图，已被上面两张整图取代，保留备查 |
| `ue-ground-dot.png` | `主页面--层0/元素/UE轨迹/位置气泡点-下.png` | 仅地面光点切图，同上 |
| `btn-*.png` | `KPI面板-层1/测试按钮/元素/` | 播放/禁止/执行中。无「重置可用」切图，Pencil 用白底+图标代替 |
| `beam-*.png` | `波束面板-层1/元素/` | 矩阵图例参考；含 `beam-vector-success.png` / `beam-vector-fail.png`（预测成功/失败矢量叠图） |
| `cell-with-ok.png` | `KPI面板-层1/点位波束回溯/元素/局部/有DT对.png` | 有 DT 正确格底 |
| `cell-with-fail.png` | `KPI面板-层1/点位波束回溯/元素/局部/有DT错.png` | 有 DT 错误格底 |
| `cell-icon-ok.png` | `KPI面板-层1/点位波束回溯/元素/局部/对.png` | 正确角标 |
| `cell-icon-fail.png` | `KPI面板-层1/点位波束回溯/元素/局部/错.png` | 错误角标 |
| `cursor-car.png` | `点位进度条/元素/小车光标.png` | 当前列光标 |
| `ba-ok-fill.png` | `KPI面板-层1/波束预测准确率/元素/正确绿色矩形填充.png` | BA 卡正确区铺底。Pencil 代表态；前端按准确率拉宽 |
| `ba-bad-fill.png` | `KPI面板-层1/波束预测准确率/元素/错误红色矩形填充.png` | BA 卡错误区铺底。同上 |
| `ba-ok-bar.png` | `KPI面板-层1/波束预测准确率/元素/正确绿色栅格条.png` | BA 底栏正确实心条 |
| `ba-bad-bar.png` | `KPI面板-层1/波束预测准确率/元素/错误红色栅格条.png` | BA 底栏错误齿条的视觉源；Pencil 用重复矩形画齿，避免缩放糊掉 |

禁止把本目录样例数字当 API 契约。 75% / 正确 3 / 错误 1 只是代表态。
