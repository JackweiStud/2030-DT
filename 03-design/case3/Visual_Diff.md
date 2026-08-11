# Visual Diff — case3 Gate 1

## 比对基线

| 源 | 路径 |
|---|---|
| UX 整页 | `02-ux/case3/case3整体.png` |
| UX 上半 | `02-ux/case3/上部分/上部分整体.png` |
| UX 下半 | `02-ux/case3/下部分/下部分整体.png` |
| Pencil | `03-design/case3/case3-dt-com.pen` |

## 截图验证记录

| Frame | 工具 | 结果摘要 |
|---|---|---|
| `case3.with-completed` | `get_screenshot` | 双侧地图 + 开销(%)/吞吐/波束预测准确率三列就绪；Tab=DT for Comm |
| `case3.initial` | `get_screenshot` | With Start 禁用语义、BA 基线占位可见 |
| `case3.failed` | `get_screenshot` | 红色失败横幅 + Without 重试；KPI 区存在 |
| 其余 5 态 | 由 with-completed Copy 后差异化 | 已改徽标/按钮/动态层；2026-08-09 用户确认 8 业务态冻结 |

## problemsOnly / layout

| 检查 | 结果 |
|---|---|
| with-completed（忽略导航背景装饰溢出） | 0 |
| 其余态 BA 占位 | 已使用短占位并完成最终视觉确认 |
| failed + 失败横幅 | 已完成布局调整并纳入 Gate 1 冻结 |
| 导航背景 `2328×111` 相对 Header | 继承 Shell 装饰溢出，与 case2 同类，**minor** |

## 与 UX 主要差异

| 区域 | 差异 | 严重度 | 是否已修 | 是否需用户拍板 |
|---|---|---|---|---|
| Cost 文案 | UX 为 dB；冻结设计与静态页改为 `开销(%)` | blocking（契约） | 已修 | 否（用户已确认） |
| 点位进度 | UX 固定 P1–P12；冻结设计使用最近 20 条窗口 | important | 已修（代表态） | 否（用户已确认） |
| Beam Accuracy 数字 | UX 样例 89%/18/2；设计源用 `{a}%/{ok}/{er}` | blocking（契约） | 已修 | 否 |
| 地图画质/构图 | UX 高保真 3D；Pencil 嵌入 `ue_comm_map` + 矢量叠加代表态 | important | 部分 | 接受代表态即可 |
| 波束扇区光效 | UX 有长/短波束贴图光效；Pencil 用点阵+折线代表 | important | 代表态 | 前端实现细节 |
| 吞吐曲线形态 | UX 样条与样例点；Pencil 示意折线 | minor | 代表态 | 否 |
| Cost 表盘造型 | UX 双半圆凹槽；Pencil 椭圆环近似 | minor | 近似 | 可接受或再精修 |
| failed / resetting | UX 无独立图 | important | 已补建 | 否（用户已确认冻结） |
| Header 品牌文案 | 沿用 Shell「云上外场 / IMT-2030…」 | minor | 沿用 | 与 case2 一致即可 |

## 图层命名抽查

- 通过：`测试对比面板`、`Without侧面板`、`点位进度窗口`、`开销卡片`、`波束准确率卡片`、`失败横幅` 等语义命名。
- 波束点阵子节点使用 `beam-1…16`（可接受）；禁止出现的无语义堆叠未作为主结构。

## 结论

- status: `APPROVED`
- 2026-08-09 用户确认 `case3-dt-com.pen` 的 8 个业务态完成并冻结。
- 2026-08-10 Gate 1.5 静态 HTML 的 initial、Without/With 运行与完成态、现场环境弹窗已由用户人工接受。
- 地图/波束的代表态差异和 Gate 1.5 未覆盖 reset/failed 已作为冻结边界记录，不构成未完成项；正式行为由 Gate 2/3 继续约束。
