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

## 人工验收步骤

1. 打开 `web-static/case3/index.html`。
2. 依次点击右下角状态按钮：`初始`、`无DT运行中`、`无DT完成`、`有DT运行中`、`有DT完成`。
3. 点击页面内“现场环境 >”，确认 shared 弹窗可打开、拖拽和关闭。
4. 检查 1920×1080 舞台缩放、顶部 Shell、双侧地图、波束卡片、点位窗口、Cost、Throughput、Beam Accuracy 是否与 Pencil 设计意图一致。

## 当前结论

status: `READY_FOR_REVIEW`

自动检查只覆盖文件结构和基础静态渲染；最终 Gate 1.5 通过仍需用户人工视觉确认。
