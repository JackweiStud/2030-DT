# Case3V1 Gate 1.5 静态页验收记录

- 静态页：`web-static/case3-v2/index.html`
- 设计源：`03-design/case3V1/case3V1-dt-com.pen`
- 状态：`READY_FOR_MANUAL_REVIEW`
- 冻结输入：用户确认 `视觉冻结 YES`

## 范围

本页只做 Gate 1.5 视觉静态验收：不接 `/api/case3/*`，不读 `DT_SHARED_DIR`，不启动 Node，不实现正式状态机。页内切换只用于查看六个 Pencil 视觉状态。

## 六个状态

| Hash | Pencil Frame | 节点 |
|---|---|---|
| `#initial` | `case3V1.初始态` | `HPx45` |
| `#without-running` | `case3V1.无DT运行中` | `tfJjd` |
| `#without-completed` | `case3V1.无DT运行完成` | `wtnmr` |
| `#with-running` | `case3V1.有DT运行中` | `k04bc` |
| `#with-completed` | `case3V1.有DT运行完成` | `b7CzAn` |
| `#site-env` | `case3V1.点击现场环境` | `Gs5ws` |

打开 `?controls=1` 会显示左下角评审切换控件；无参数时页面只显示干净画面。键盘 `1` 到 `6` 也可切换状态。

## 已确认边界

- 初始态右下 BA `75.0% / 正确75 / 错误25` 是基线占位，不是后端结果。
- `case3V1.有DT运行中` / `case3V1.有DT运行完成` 的正确/错误只是代表态，不扩展业务状态机。
- 三杠只是装饰，不设计菜单交互。
- 静态页显示开发期五 Tab 与新版共享导航；正式 React 阶段应单独实现 Shell 顶栏，并回归 case2 / 旧 case3。
- Pencil 导出包含少量嵌入 WebP 背景，这是静态验收产物；正式运行资源需重新落到运行时资产目录。

## 复用边界

资源说明见 `web-static/case3-v2/assets/SOURCE.md`。正式 React 可参考切图尺寸、命名和视觉构成，但不能直接依赖 `web-static/` 目录。

## 资产库经验已应用

- 保持设计源、静态验收、运行时资源三轨分离。
- 业务样式只服务静态页，不进入共享 Shell 或正式 case 目录。
- 新导航使用不透明顶栏素材，避免地图/视频内容透色到导航交界。
- SVG 线条关键属性保留在元素内，降低截图/导出时样式丢失风险。

## 人工验收步骤

1. 打开 `web-static/case3-v2/index.html?controls=1`。
2. 按六个状态逐一比对 Pencil 六帧。
3. 重点看新版共享导航、地图裁切、底部五态回放、三张 KPI 卡、现场环境弹窗。
4. 人工确认后，把本文件状态改为 `ACCEPTED`，再进入 P4 React 新皮。
