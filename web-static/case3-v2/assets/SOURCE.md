# case3V1 Gate 1.5 静态资源说明

## 来源

- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- Pencil 设计资产：`03-design/case3V1/assets/`
- 现场环境占位图：复用旧 Gate 1.5 的 `web-static/case3/assets/video-*.png`

## 用途

本目录只服务 `web-static/case3-v2/` 静态验收页。后续正式 React 可参考这些切图、尺寸和命名，但不得直接从 `web-static/` 引用资源。

## 迁移边界

- 可迁移：`nav-bg.png`、`cloud-site.png`、`huawei-logo.png`、`site-2d.jpg`、按钮态、波束点、回放格、开销/BA 视觉素材。
- 需重新落运行时目录：正式前端使用的资源应进入 `04-runtime-assets/case3-v2/` 或后续合回的 `04-runtime-assets/case3/`。
- 不可迁移为业务契约：样例数字、Pencil 代表态、静态页 hash/键盘切换逻辑。

## 导航栏注意

新版导航是共享 Shell 视觉资产。静态页先在 `DT for Comm new` 五 Tab 开发期入口中验收；正式 React 阶段应单独实现 Shell 导航提交，并对 case2 / 旧 case3 做视觉回归。
