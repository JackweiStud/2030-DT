# case2 运行时静态资源清单

> 权威设计源：`03-design/case2/case2-dt-calibration.pen`
> 导出方式：Pencil MCP `export_nodes`（PNG RGBA，2×）+ 矢量图标按 Lucide 节点几何生成 SVG
> 本目录只保存 case2 业务静态资源。Shell 资产和公共 token 见 `../shell/`，不属于 case2。

## 总览

| 路径 | 来源节点 | 语义用途 | 格式/尺寸 | 正式前端可直接使用 |
|---|---|---|---|---|
| `chrome/panel-left-background.png` | `EM3U1` image fill（设计源嵌入路径） | 左栏校准对比面板底图 | PNG RGBA 2102×1914 | 是 |
| `chrome/panel-right-background.png` | `XNGat` image fill（设计源嵌入路径） | 右栏 KPI 对比面板底图 | PNG RGBA 1562×1914 | 是 |
| `icons/column-initial-icon.png` | `eh2tw` Initial图标 | Initial DT 列头图标 | PNG RGBA 48×48（逻辑 24×24@2×） | 是 |
| `icons/column-calibrated-icon.png` | `Ld7eS` Calibrated图标 | Calibrated DT 列头图标 | PNG RGBA 48×48 | 是 |
| `icons/panel-title-accent.png` | `bCe86` 标题装饰条 | 面板标题青竖条装饰 | PNG RGBA 6×36（逻辑 3×18@2×） | 是 |
| `icons/metric-rss-icon.png` | `YkIxz/yIovw` | KPI 行 RSS 图标 | PNG RGBA 48×48 | 是 |
| `icons/metric-path-icon.png` | `ii9XW/yIovw` | KPI 行有效路径数图标 | PNG RGBA 48×48 | 是 |
| `icons/metric-delay-icon.png` | `tX3yA/yIovw` | KPI 行首径时延图标 | PNG RGBA 48×48 | 是 |
| `icons/bar-initial-fill.png` | `zjotG` Initial柱体 | Initial 均值柱填充纹理 | PNG RGBA 80×202（逻辑 40×101@2×） | 是（样式纹理；柱高运行时计算） |
| `icons/reduction-badge-bg.png` | `dcZnV` 降幅徽章 | 降幅徽章底图 | PNG RGBA 170×94（逻辑 85×47@2×） | 是（底图可复用；文案运行时） |
| `icons/reduction-arrow-icon.png` | `NDbrU` 下降图标 | 降幅箭头 | PNG RGBA 48×48 | 是 |
| `icons/icon-play.svg` | 由 `Z1BNp` 升级为圆底徽章 | 启动按钮图标（青底 `#22D3EE` + 白三角） | SVG 14×14（按钮内显示 16×16） | 是 |
| `icons/icon-pause.svg` | 与 `icon-play` 同系 | 运行中图标（灰底 `#475569` + 双竖杠；与 play 互斥显示） | SVG 14×14（按钮内显示 16×16） | 是 |
| `icons/icon-rotate-ccw.svg` | 由 `LWEVT` 升级为圆底徽章 | 重置按钮图标（灰底 `#475569` + 白旋转箭头） | SVG 14×14（按钮内显示 16×16） | 是 |
| `maps/heatmap-map-base.png` | UX `heatmap_map.png` / 算法源同图 | 热力卡场景底图 | PNG RGBA **1974×1100** | **是**（与算法锚定坐标系 1:1；正式前端动态叠加热力层） |
| `maps/heatmap-calibrated-represent.png` | `02-ux/.../calibrated_rss_grid.png`（`rdP2e`/`vnGTY` 完成态叠加） | Calibrated 热力代表层（马赛克色场） | PNG RGBA 999×528 | **否**（Gate 1.5 代表态；正式前端须动态绘制） |
| `tokens.css` | Pencil `GetVariables` + frame 测量 | 颜色/间距/圆角/字号/布局尺寸 | CSS 自定义属性 | 是 |

指标标签采用 CSS 复刻颜色，不使用 PNG 底板：`--case2-color-metric-tag-rss`、`--case2-color-metric-tag-path`、`--case2-color-metric-tag-delay`。标签文字由 HTML 渲染。

## 不可作为正式运行资产的内容

- CDF 阶梯线几何、柱高、均值文案 `5.0`/`3.0`、降幅文案 `40%`：设计源内代表态，属运行时派生。
- 热力代表层色块 `#22c55e66`：代表态，非正式业务热力。
- `web-static/case2/` 内假状态切换与样例绑定逻辑。

## Shell 依赖（不归 case2 所有）

- `../shell/tokens.css`：固定舞台、Header、Tab 与公共字体/颜色 token，由 Shell 入口加载。
- `../shell/brand-logo.png` 与 `../shell/shell-nav-background.png`：仅由 Shell 渲染。
- case2 组件允许消费已注入的 `--shell-*`，但不得复制、重定义或把 Shell 资源写回本目录。

## 交接说明

1. 正式 case2 前端只引用本目录的业务资源，禁止回读 `02-ux/`；Shell 资源只由 `../shell/` 的 Shell 入口引用。
2. 热力：底图用 `maps/heatmap-map-base.png`（或后续更高精度隔离导出）；色场/马赛克由运行时绘制（Gate 1.5 可用 `heatmap-calibrated-represent.png` 代表叠加）。
3. KPI 图表：保留网格/轴样式 token；曲线与柱值由样本计算。
