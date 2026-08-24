# Case3V1 Gate 1.5 静态页验收记录

- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- 状态：`ACCEPTED`
- 冻结输入：用户确认 Pencil `视觉冻结 YES`
- 像素视觉基准：`web-static/case3-v2/index.html` — 用户已确认与 Pencil 一致，`YES`
- 工程可复用底稿：`web-static/case3-v2/case3-v2.html`（+ `shell-nav-v2.css` / `case3-v2.css` / `case3-v2.js`）— 2026-08-24 用户视觉验收 `YES`
- 评审入口：两页均支持 `?controls=1` 与键盘 `1`–`6` 切六态

## 范围

本目录只做 Gate 1.5 视觉静态验收：不接 `/api/case3/*`，不读 `DT_SHARED_DIR`，不启动 Node，不实现正式状态机。页内切换只用于查看六个 Pencil 视觉状态。

| 产物 | 角色 | P4 用法 |
|---|---|---|
| `index.html` | Pencil 导出高保真像素基准 | 截图对照 / 视觉回归；不拆组件 |
| `case3-v2.html` + 两份 CSS | 工程可复用底稿：共享顶栏与 case 业务已拆文件 | 按 `data-region` 拆 React 组件、抄几何与切图 |
| `case3-v2.js` | 假状态机（hash / 键盘 / 写死代表态） | **禁止**迁入正式 Web |

旧皮 `web-static/case3/` 的 Gate 1.5 验收仍见 `STATIC-HTML-ACCEPTANCE.md`，不被本记录覆盖。

## 六个状态

| Hash | Pencil Frame | 节点 |
|---|---|---|
| `#initial` | `case3V1.初始态` | `HPx45` |
| `#without-running` | `case3V1.无DT运行中` | `tfJjd` |
| `#without-completed` | `case3V1.无DT运行完成` | `wtnmr` |
| `#with-running` | `case3V1.有DT运行中` | `k04bc` |
| `#with-completed` | `case3V1.有DT运行完成` | `b7CzAn` |
| `#site-env` | `case3V1.点击现场环境` | `Gs5ws` |

打开 `?controls=1` 显示评审切换控件；无参数时页面只显示干净画面。

## 已确认边界

- 初始态右下 BA `75.0% / 正确75 / 错误25` 是基线占位，不是后端结果。
- `case3V1.有DT运行中` / `case3V1.有DT运行完成` 的正确/错误只是代表态，不扩展业务状态机。
- 三杠只是装饰，不设计菜单交互。
- 静态页显示开发期五 Tab 与新版共享导航；正式 React 阶段应单独实现 Shell 顶栏，并回归 case2 / 旧 case3。
- Pencil 导出 `index.html` 含少量嵌入 WebP 背景，只属像素基准；正式运行资源需重新落到运行时资产目录。
- Cost 左右 fill 与演示数字跟 `data-state`，不跟真实 `costPct`（见 `前端改造/00-决策与行动路线.md` D18）。
- 吞吐折线拐点圆点已纳入工程底稿；正式端按 `throughputGbps` 重算，不抄写死 path。
- `Frontend_Spec-v2.md` 曾写开销用 SVG；工程底稿与 D18 默认用固定 PNG 梯形，P4 以本工程页 + D18 为准。

## 复用边界

资源说明见 `web-static/case3-v2/assets/SOURCE.md`。

**可参考 / 选择性迁移**

- `shell-nav-v2.css`：1920×1080 舞台 + 80px 五 Tab 顶栏（P4 进共享 Shell，开发期 Tab `case5` / 文案 `DT for Comm new`）。
- `case3-v2.css` 中挂在 `.case3v2-page` 下的业务规则、尺寸、切图命名。
- `case3-v2.html` 的 `data-layer` / `data-region` 分区：MapStage、MapHud、BeamMatrixCard、PointBeamReplay、三张 KPI、现场环境入口。

**必须重构，不得直接 import**

- 不得 `import` `web-static/` 下任何 CSS/JS。
- 不得把 `case3-v2.js` 的 hash、键盘、评审条、写死数字/path 带进正式路径。
- 现场环境弹窗在静态稿里写在 case 页内；正式实现仍归 **Shell**（与现网 `SiteEnvWindow` 一致），case 页只保留「现场环境 >」入口。
- 正式资源先入 `04-runtime-assets/case3-v2/`，P5 再合回 `04-runtime-assets/case3/`。

## 资产库经验已应用

- 保持设计源、静态验收、运行时资源三轨分离。
- 业务样式只服务静态页，不进入共享 Shell 或正式 case 目录。
- 新导航使用不透明顶栏素材，避免地图/视频内容透色到导航交界。
- SVG 线条关键属性保留在元素内，降低截图/导出时样式丢失风险。
- `_qa/` 截图只作本地对照，不提交。

## 人工验收步骤

1. 像素对照：打开 `web-static/case3-v2/index.html?controls=1`，按六态比对 Pencil 六帧。
2. 工程底稿：打开 `web-static/case3-v2/case3-v2.html?controls=1`，同样走六态。
3. 重点看新版共享导航、地图裁切、底部五态回放、三张 KPI 卡（含吞吐拐点、开销梯形、BA 色条不溢出）、现场环境弹窗。
4. 人工确认后进入 P4 React 新皮（先挂 case5）。
