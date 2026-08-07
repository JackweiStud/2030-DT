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
| `case3.with-completed` | `get_screenshot` | 双侧地图 + Cost(%)/Throughput/BA 三列就绪；Tab=DT for Comm |
| `case3.initial` | `get_screenshot` | With Start 禁用语义、BA 基线占位可见 |
| `case3.failed` | `get_screenshot` | 红色失败横幅 + Without 重试；KPI 区存在 |
| 其余 5 态 | 由 with-completed Copy 后差异化 | 已改徽标/按钮/动态层；需用户再目视扫一眼 |

## problemsOnly / layout

| 检查 | 结果 |
|---|---|
| with-completed（忽略导航背景装饰溢出） | 0 |
| 其余态 BA `{baseOk}` 等长占位 | 曾出现正确/错误次数文字部分裁切；拟改为短占位 `{ok}/{er}`（MCP 断连后待补修） |
| failed + 失败横幅 | KPI 面板曾轻微裁切；已计划下调测试/KPI 高度（待补修确认） |
| 导航背景 `2328×111` 相对 Header | 继承 Shell 装饰溢出，与 case2 同类，**minor** |

## 与 UX 主要差异

| 区域 | 差异 | 严重度 | 是否已修 | 是否需用户拍板 |
|---|---|---|---|---|
| Cost 文案 | UX 为 dB；设计源改为 `Cost (%)` | blocking（契约） | 已修 | 否（契约已确认） |
| 点位进度 | UX 固定 P1–P12；设计源标注「最新 12 / 总 N」 | important | 已修（代表态） | 滚动边缘样式可再确认 |
| Beam Accuracy 数字 | UX 样例 89%/18/2；设计源用 `{a}%/{ok}/{er}` | blocking（契约） | 已修 | 否 |
| 地图画质/构图 | UX 高保真 3D；Pencil 嵌入 `ue_comm_map` + 矢量叠加代表态 | important | 部分 | 接受代表态即可 |
| 波束扇区光效 | UX 有长/短波束贴图光效；Pencil 用点阵+折线代表 | important | 代表态 | 前端实现细节 |
| 吞吐曲线形态 | UX 样条与样例点；Pencil 示意折线 | minor | 代表态 | 否 |
| Cost 表盘造型 | UX 双半圆凹槽；Pencil 椭圆环近似 | minor | 近似 | 可接受或再精修 |
| failed / resetting | UX 无独立图 | important | 已补建 | 需视觉审阅 |
| Header 品牌文案 | 沿用 Shell「云上外场 / IMT-2030…」 | minor | 沿用 | 与 case2 一致即可 |

## 图层命名抽查

- 通过：`测试对比面板`、`Without侧面板`、`点位进度窗口`、`开销卡片`、`波束准确率卡片`、`失败横幅` 等语义命名。
- 波束点阵子节点使用 `beam-1…16`（可接受）；禁止出现的无语义堆叠未作为主结构。

## 结论

- 结构与 8 业务态已具备评审条件。
- 残留 **important**：BA 短占位裁切修复、failed 高度微调需在 Pencil 重新打开本文件后确认。
- 不阻塞 `REVIEW_READY`；阻塞最终 `APPROVED` 的是用户视觉审阅。

## 续修阻塞（2026-08-06 续）

Pencil MCP 已认证，但报错 `transport not connected to app: cursor`，无法对 `03-design/case3/case3-dt-com.pen` 执行修改/截图。  
待 Cursor 内 Pencil 画布会话恢复后继续：

1. 缩短 BA `{ok}/{er}/{a}%` 占位并复检裁切  
2. 下调 `case3.failed` 测试区/KPI 高度  
3. 8 frame `problemsOnly` + 关键态截图复检
