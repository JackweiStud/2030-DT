# case4 运行时资产说明

## 本目录（来自冻结 Pencil `03-design/case4/assets/`）

| 文件 | 用途 |
|---|---|
| `tokens.css` | case4 颜色/字体 token |
| `point-done.png` | 误差列头已完成态 |
| `c4-label-plan.png` | 地图「预期路径」侧标底 |
| `btn-*.png` / `progress-overlay.png` / `cursor-car.png` | 回溯控制与进度 |
| `ue-pin-*.png` / `ue-2d.png` / `compare-icon.png` / `top-mask.png` | 地图 HUD |

未纳入运行目录（静态未引用）：`c4-label-live.png` / `c4-label-line.png` / `c4-slot-empty.png`（空槽实现用色值 `#2a2a2a99`）；仍保留在 Pencil 资产源。

## 仍复用（不复制）

| 资源 | 路径 | 归属 |
|---|---|---|
| 场地底图 `site-2d.jpg` | `04-runtime-assets/case3-v2/` | 同场地 |
| 导航/品牌/现场环境 | `04-runtime-assets/shell/` | Shell |

静态页不得把 `web-static/` 当作正式 React 依赖；正式端应引用本目录或后续合入路径。
