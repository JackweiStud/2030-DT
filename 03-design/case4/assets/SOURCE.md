# case4 设计源资产

运行时不要直接读本目录。Pencil 内相对路径 `./assets/...`。

本目录多数切图与 case3 V2 同源（同场地、同 Shell）。case4 只用其中地图、导航、点位、按钮和吞吐壳相关文件；波束 / 开销 / BA 切图保留在目录中以免破坏已有 case3V1 基线帧，**不要**用进 case4 业务区。

| 文件 | 来源 | case4 用途 |
|---|---|---|
| `site-2d.jpg` | case3 场地 2D 压缩版；与 `code/web/assets/case3-v2/site-2d.jpg` 同源 | 等轴测底图。禁止 AI 重绘 |
| `nav-bg.png` `menu-bars.png` `cloud-site.png` `huawei-logo.png` | case3 导航 | 全站顶栏 |
| `ue-2d.png` `ue-pin-idle.png` `ue-pin-lit.png` | case3 UE/点位 | 终端与预置点 |
| `btn-play.png` `btn-play-disabled.png` `btn-playing.png` `btn-reset.png` `btn-reset-disabled.png` | case3 测试按钮 | 单次开始/重置。完成态不用暂停图标 |
| `cursor-car.png` | case3 点位进度 | 误差窗当前列 |
| `top-mask.png` | case3 HUD | 顶蒙版 |
| `compare-icon.png` | case3 | 「测试对比」 |
| `c4-slot-empty.png` | UX `测试误差一个点的填充背景.png`（同文件） | `槽-P*` 空壳底图 |
| `c4-label-line.png` | UX `图标直线.png`（原样拷贝，不做处理） | 地图侧标竖线 |
| `c4-label-live.png` | UX `实际轨迹图标背景.png`（原样拷贝，不做处理） | 「测试方案」侧标底 |
| `c4-label-plan.png` | UX `计划轨迹图标背景.png`（原样拷贝，不做处理） | 「计划轨迹」侧标底 |
| `beam-*` `cost-*` `ba-*` `cell-*` | case3 波束/开销/BA | **仅供文件内旧 case3V1 帧**；case4 不用 |

禁止把本目录或 UX 上的数字当成 API 契约。CEP / NLOS / 吞吐 / 逐点误差的示意值只服务审阅。
