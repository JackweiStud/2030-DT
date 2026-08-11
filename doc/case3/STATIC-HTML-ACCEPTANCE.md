# case3 Gate 1.5 静态 HTML 验收

## 范围

静态原型目录：`web-static/case3/`

唯一视觉参考：`03-design/case3/case3-dt-com.pen`

本 Gate 1.5 只还原视觉和假交互：

- 不接 `/api/case3/*`
- 不读共享目录
- 不实现正式状态机
- 不启动 Node
- 不把静态评审脚本带入正式 React

## 已实现状态

- 初始界面
- 无 DT 运行中
- 无 DT 完成态
- 有 DT 运行中
- 有 DT 完成态
- 点击现场环境弹窗

## 资源边界

- `web-static/shared/`：case1/2/3/4 可复用的静态验收资源；当前复用现场环境弹窗。
- `web-static/case3/assets/`：从 `03-design/case3/assets/` 复制的 Gate 1.5 静态资源副本。
- 后续正式运行资源仍应落入 `04-runtime-assets/case3/`，正式 React 不直接引用 `02-ux/` 或 `web-static/`。

## 正式实现复用边界

- `web-static/case3/` 的 `.case3-*` 视觉规则、尺寸关系、SVG/DOM 视觉结构和资源可作为正式前端的复用输入；正式实现应选择性迁移或重写为 case-local CSS Module 和组件。
- 不得直接导入 `web-static/case3/case3.css` 或 `case3.js`：其中的 `html/body`、舞台/Shell、评审 dock、URL 状态切换和假数据只属于 Gate 1.5 静态页。
- 正式 Shell 继续拥有顶部导航、1920×1080 缩放和公共 token；Case3 只拥有业务组件和 `.case3-*` 视觉规则。

## 人工验收步骤

1. 打开 `web-static/case3/index.html`。
2. 依次点击右下角状态按钮：`初始`、`无DT运行中`、`无DT完成`、`有DT运行中`、`有DT完成`。
3. 点击页面内“现场环境 >”，确认 shared 弹窗可打开、拖拽和关闭。
4. 检查 1920×1080 舞台缩放、顶部 Shell、双侧地图、波束卡片、点位窗口、`开销(%)`、`吞吐(Gbps)`、`波束预测准确率` 是否与 Pencil 设计意图一致。

## 当前结论

status: `ACCEPTED`

2026-08-10 用户已人工检查并接受：初始、Without DT 运行/完成、With DT 运行/完成和现场环境弹窗。静态页的 20 槽点位窗口仅表达动态 `N` 的最近 20 条窗口，不表示总点位上限。

自动检查覆盖文件结构和基础静态渲染；用户人工视觉确认已完成。With `reflection` 仍是完整点必需字段，但 Reflection/LOS 可视化延后至后续独立实现，不属于本 Gate 1.5 已接受的五态范围。

2026-08-10 语义纠正：静态代表值 Without=25、With=15 时，按 `(25-15)/25*100` 将开销变化从错误的 `66.7%` 修正为 `40.0%`；未改变布局、状态范围或运行边界。
