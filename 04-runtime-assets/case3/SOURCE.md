# case3 正式运行资源清单

本目录是 Gate 4 正式运行资源；由设计输入复制而来，再同步到 `code/web/assets/case3/`。
React 只允许 import `code/web/assets/case3/`。

| 文件 | 来源 | 用途 |
| --- | --- | --- |
| `ue_comm_map.png` | `03-design/case3/assets/` | 双侧地图底图 |
| `ue-vehicle.png` | 同上 | UE 标记 |
| `bs-antenna.png` | 同上 | BS 标记 |
| `icon-without.png` / `icon-with.png` | 同上 | 侧栏图标 |
| `icon-ok.png` / `icon-err.png` | 同上 | 预测正确/错误 |
| `icon-point.png` | 同上 | 点位进度装饰 |
| `icon-bs-beam.png` | 同上 | 波束卡标题图标 |
| `icon-cost-thrp.png` / `icon-predict.png` | 同上 | KPI 标题图标 |
| `beam-*.png` / `ba-*.png` / `ring-accuracy.png` | 同上 | 波束/BA 装饰底图 |
| `bg-page.png` / `bg-upper.png` / `bg-lower.png` / `bg-side-panel.png` | 同上 | 页面分区背景 |
| `背景底图.png` | 同上 | 页面底图备用 |
| `icon-play.svg` / `icon-rotate-ccw.svg` | `web-static/case3/assets/` | Start / 地图复位 |

未复制 `video-feed-*.png` / `video-icon.png`：现场环境弹窗由 Shell `SiteEnvWindow` 使用既有 shell/case2 资产。
