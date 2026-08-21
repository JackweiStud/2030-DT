# Visual Diff — case3V1（评审，未冻结）

- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- 对照：`02-ux/case3-V1/` 两张整页 + `波束面板-层1/无DT.png`
- 状态：`REVIEW_READY`，不是 `APPROVED`

## 五帧

| Frame | 节点 | 对照结论 |
|---|---|---|
| `case3v2.initial` | `wtnmr` | 预置路线未跑、With 启动禁止、格子 `--`、矩阵空 |
| `case3v2.without-running` | `XuClC` | P4、扫描+最优、With 启动禁止、本轮轨迹 |
| `case3v2.without-completed` | `SCs9K` | 地图保留终态；矩阵 **扫描+最优都在**；With 播放可用 |
| `case3v2.with-running` | `wxGbI` | 清图后重跑到 P4；无扫描叠图；Without 历史仍在底栏 |
| `case3v2.with-completed` | `C6BH0` | 只留 With 本轮终态；KPI 双侧；对绿错红 |

## 已拍板、不要当缺陷

| 项 | 说明 | 严重度 |
|---|---|---|
| 五 Tab 高亮 `DT for Comm new` | 切图只有四 Tab | — |
| 格子无 X/Y | 只显示 BeamID | — |
| 有 DT 轴 0–15、无扫描点 | 不跟有 DT 切图 1–16 | — |
| 无 DT 跑时 With 启动禁止 | 不跟切图白播放键 | — |
| 3D 可见灰禁 | 不隐藏 | — |
| 三杠不可点 | 装饰 | — |

## 偏差

| 位置 | 类型 | 严重度 | 建议 |
|---|---|---|---|
| 场地图构图 | 压缩 JPEG + cover 裁切，路线贴白墙，和整页切图的取景不完全同一 | important | 若你要更贴切图，下一步只调 `siteImage` 偏移/缩放 |
| 顶栏字号/间距 | 五 Tab 比切图挤；截图像素对照会糊 | important | 可再收 gap 或略减字号 |
| 开销梯形 | Pencil 代表态，不是切图光效 | minor | 前端 SVG 按切图还原 |
| 吞吐/BA | 代表曲线与 75%/3/1 | minor | 非契约 |
| 重置可用 | 无切图，白圆+旋转图标 | minor | 若 UX 补 PNG 再替换 |
| `siteImage` 部分裁切 | cover 预期 | — | 不修 |

## 结构抽查

- 20 个回溯格、20 个列头、20 个路线点是组件实例，不是散图层。
- 16×16 由循环生成，不是 256 个手摆椭圆。
- 现场环境弹窗帧已删。

请在 Pencil 里看五帧后拍板：要改构图/顶栏，还是可以进 Gate 1.5 静态页。
