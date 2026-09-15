# Visual Diff — case4 Pencil 审阅稿

## Summary

- Source：`02-ux/case4/` 三态整页 + 局部切图；规则以 `doc/case4/` 为准
- Pencil：`03-design/case4/case4.pen`
- Overall status：**needs iteration**（可审阅，非冻结）
- 2026-09-13 已从整页 UX 切图改为 **HPx45/szvkN 可编辑组件树**；CDF+柱参考 case2 `ii9XW` 新建 `Fcn8x`

未宣称 Gate 1 冻结。数字均为示意。交付帧 ID：`mEyG6` / `YFD1U` / `iVPf8` / `yGo26` / `A6SO8` / `PyHHC` / `kmDkq`。

## Pencil MCP 验证证据

| Frame/Node | Tool | Check | Result | Evidence/Notes |
|---|---|---|---|---|
| `mEyG6` case4.初始 | get_screenshot | 整页 | 航拍地图+可编辑 path/点位+空底栏 | 空槽、CDF/CEP `--`、NLOS `--`、开始可用 |
| `YFD1U` case4.测试中 | get_screenshot | 整页 | 三色误差点 P1–P13+等待统计+吞吐曲线 | 不用暂停键 |
| `iVPf8` case4.完成 | get_screenshot | 整页 | CDF 阶梯 + CEP 三柱 + NLOS 90% + 已完成 | 无增减百分比 |
| `yGo26` case4.完成悬停 | get_screenshot | 整页+浮层 | 浮层「P13定位误差」三方案+m | `z3YAGC` |
| `A6SO8` case4.等待最终统计 | get_screenshot | 整页 | 轨迹/误差/吞吐保留；统计等待 | 双禁 |
| `PyHHC` case4.现场环境 | get_screenshot | 整页 | 蒙版+双路视频弹窗 | Copy `S36cr` |
| `kmDkq` case4.异常状态板 | get_screenshot | 五变体 | MCP 中文可能缺字 | 请在 Pencil 打开 |
| `mEyG6` 地图舞台 | Get | 场地底图 cover 裁切 | 与 szvkN 相同，属预期 | — |

## 结构问题

| Frame/Node | Problem | Severity | Fix | Recheck result |
|---|---|---|---|---|
| 点位 20 槽 | 未用可复用实例（Pencil 在复制帧内对 **新** ref 不合成） | important | 用实体 Copy；实现仍应按组件做 | 运行/完成帧可见色点 |
| 异常板 | MCP screenshot 发黑 | important | 用户在编辑器内审；必要时再改成与主帧相同的 Copy 合成 | Get 布局完整 |
| case3V1 旧帧 | 仍留在文件左侧 | minor | 有意保留复用基线 | 未改组件定义 |

## Diff Table

| Frame | Area | Issue | Severity | Suggested fix | Needs approval |
|---|---|---|---|---|---|
| 全部 | 完成文案/按钮 | 相对 UX 完成图去掉暂停和「测试中」 | 有意偏差 | 保持 | 审阅是否接受 |
| 全部 | CEP | 分标 CEP50% / CEP90%，无 Δ% | 有意偏差 | 保持 | 否 |
| 全部 | CDF 轴 | 米级 0–10，非 UX 0.003–0.015 | 有意偏差 | 保持 | 否 |
| 全部 | 吞吐 X | 样点 1–8，非时钟 | 有意偏差 | 保持 | 否 |
| 完成 | NLOS | 示意 90%（样本 0.897），不用 UX 60 | 有意偏差 | 保持 | 否 |
| 完成 | CDF 折线 | 线偏弱，故事主要靠 CEP 柱 | important | 若审阅要更强折线再加粗 | 否 |
| 初始 | 点位 P 号 | 对比偏低 | minor | 可加亮 `$muted` | 否 |
| 顶栏 | DT for positioning | 下划线在浅色区不够抢 | important | 已用 `#22D3EE`；请看实机 | 否 |
| 地图 | 三色轨迹 | 代表折线，未按 38 点投影 | important | 实现必须用 case3 V2 投影 | 否 |
| 悬停 | 浮层位置 | 在地图区而非贴着 P13 槽 | minor | 可再贴槽 | 否 |

## Structure / Layout / Dev Feasibility

| Frame | Problem | Why it matters for frontend | Fix |
|---|---|---|---|
| 底栏 | Pencil 用绝对坐标叠在 1920×1080 上 | 实现应 Dock flex：控制 hug + 20 列 fill + KPI 三卡 | Frontend_Spec 已写契约 |
| 点位窗 | 设计画 20 槽 | 实现 N 动态、最新 20 | 脚注已写示意 N=38 |

## Asset Source / Dynamic Graphic Issues

| Frame | Asset/Layer | Problem | Correct decision | Fix |
|---|---|---|---|---|
| 地图 | site-2d.jpg | 无 | 复用 case3 底图 | — |
| 轨迹/CDF/CEP | path | Pencil 代表态 | 前端 SVG | 规格已写 |
| 波束/开销/BA | 未进 case4 业务帧 | 正确 | 不要用 | — |

## Blocking Issues

无（不阻塞审阅）。无用户拍板项来自设计结构；后端四项遗留不在本文件决定。

## Important Issues

1. 异常状态板请在 Pencil 里打开 `T1BeaL`，不要只看 MCP 缩略图。
2. CDF 完成态折线偏弱。
3. 地图轨迹是示意，不是投影结果。

## Minor Issues

P 号对比、浮层锚点、顶栏下划线粗细。

## Next Iteration Plan

用户视觉审阅 → 按批注改 `.pen` → 再冻结。未经确认不写 `APPROVED`。
