# case3V1 Gate 1.5 静态资源说明

## 来源

- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- Pencil 设计资产：`03-design/case3V1/assets/`
- 现场环境占位图：复用旧 Gate 1.5 的 `web-static/case3/assets/video-*.png`

## 两份 HTML

| 文件 | 角色 | 验收 |
|---|---|---|
| `../index.html` | Pencil 导出像素视觉基准 | 已人工 YES |
| `../case3-v2.html` | 工程可复用底稿（`shell-nav-v2.css` 共享顶栏 + `case3-v2.css` 业务页） | 2026-08-24 视觉 YES |

本目录只服务 `web-static/case3-v2/` 静态验收页。正式 React 可参考切图、尺寸、命名、视觉构成和工程页分区，但不得直接从 `web-static/` 引用资源。`_qa/` 仅为本地对照截图，不提交。

## 迁移边界

- 可迁移：`nav-bg.png`、`cloud-site.png`、`huawei-logo.png`、`site-2d.jpg`、按钮态、波束点、回放格、开销/BA 视觉素材。
- 需重新落运行时目录：正式前端使用的资源应进入 `04-runtime-assets/case3-v2/` 或后续合回的 `04-runtime-assets/case3/`。
- 不可迁移为业务契约：样例数字、Pencil 代表态、静态页 hash/键盘切换逻辑、`case3-v2.js`。
- 现场环境弹窗视觉可参考；正式弹窗仍归共享 Shell，不从 case 页 import 静态 Overlay 实现。

## 导航栏注意

新版导航是共享 Shell 视觉资产。静态页先在 `DT for Comm new` 五 Tab 开发期入口中验收；正式 React 阶段应单独实现 Shell 导航提交，并对 case2 / 旧 case3 做视觉回归。
