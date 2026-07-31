# case2 Gate 1.5 静态 HTML 验收

## 1. Pencil 设计源

`/Users/jackwl/Code/2030-DT/03-design/case2/case2-dt-calibration.pen`

## 2. Pencil MCP 读取摘要（成功）

| 类型 | ID | 名称 | 尺寸 |
|---|---|---|---|
| 可复用组件 | `V5nR3F` | 状态反馈 | hug |
| 可复用组件 | `wwZ1i` | 热力对比行 | 999×280 |
| 可复用组件 | `m3I4rD` | KPI对比行 | 723×308 |
| 状态 frame | `EMJd9` | case2.初始状态 | 1920×1080 |
| 状态 frame | `RCHHQ` | case2.测试中 | 1920×1080 |
| 状态 frame | `rdP2e` | case2.完成状态 | 1920×1080 |
| 状态 frame | — | **case2.failed 当前设计源中不存在** | — |

关键结构（completed `rdP2e`）：

- `ShellHeader` `htvcs` 高 78
- `主内容区` → `主内容行` `pkVbv`（1900×987，gap 30）
- 左 `校准对比面板` `EM3U1` 1066×970
- 右 `KPI对比面板` `XNGat` 764×970
- 状态徽章文案：initial「等待启动测试」/ calibrating「测试运行中」/ completed「已完成」

Pencil 变量按所有权拆分：Shell 公共 token 在 `04-runtime-assets/shell/tokens.css`，case2 业务 token 在 `04-runtime-assets/case2/tokens.css`。

## 3. 静态原型入口与打开方式

```bash
cd /Users/jackwl/Code/2030-DT
python3 -m http.server 8765
```

浏览器打开：

- 默认 initial：`http://127.0.0.1:8765/web-static/case2/index.html`
- 指定状态：`?state=initial|calibrating|failed|completed`
- 其他 Tab：「建设中」`?tab=case1`（或 case3 / case4）

右下角 Gate 1.5 验收控件可切换四态；「启动」「重置」仅驱动视觉切换。

资源引用：Shell mock 使用 `../../04-runtime-assets/shell/**`，case2 页面使用 `../../04-runtime-assets/case2/**`；两者均不复制到 `web-static/`。

字体：静态入口不依赖 Google Fonts/CDN；使用 Shell 与 case2 token 中声明的本地 fallback 栈。目标设备若未安装 Inter/Geist，需按实际 fallback 结果复核字体细节。

## 4. 四态验收检查表

| 检查项 | initial | calibrating | failed | completed |
|---|---|---|---|---|
| Shell 四 Tab，默认 DT Calibration 激活 | ✓ | ✓ | ✓ | ✓ |
| 左「测试对比」+ 右「KPI对比」双栏 | ✓ | ✓ | ✓ | ✓ |
| Initial 三热力卡有底图与指标标签 | ✓ | ✓ | ✓ | ✓ |
| Calibrated 无完成结论 / 有等待或失败反馈 | ✓ | ✓ | ✓ | — |
| KPI 仅 Initial 代表曲线/柱，无降幅徽章 | ✓ | ✓ | ✓ | — |
| 状态徽章文案正确 | 等待启动测试 | 测试运行中 | 测试失败 | 已完成 |
| 完整 Initial + Calibrated 对比（双 CDF/双柱/降幅代表态） | — | — | — | ✓ |
| 非 case2 Tab 仅「建设中」 | ✓ | ✓ | ✓ | ✓ |

## 5. 1920×1080 与窗口缩放

- 舞台固定 `1920×1080`，`transform: scale(min(vw/1920, vh/1080))` 居中。
- 验收：缩小/放大浏览器窗口，整页等比缩放、不出现业务重排；1920×1080 视口下应为 1:1。

## 6. `04-runtime-assets/case2/` 资源与可复用状态

详见同目录 `ASSET-MANIFEST.md` / `VISUAL-FORMAT.md` / `tokens.css`。

## 7. 正式前端可直接使用

Shell：

- `../shell/tokens.css`
- `../shell/brand-logo.png`
- `../shell/shell-nav-background.png`

case2：

- `tokens.css`
- `icons/*`（列头、KPI 指标图标、降幅底/箭头、柱纹理、play/rotate SVG）；指标标签使用 `tokens.css` 颜色 token，不使用 PNG 底板
- `maps/heatmap-map-base.png`（有条件：由 Pencil 导出还原）

## 8. 仅属静态验收、不得进入正式前端

- `web-static/case2/case2.js` 假状态机与 URL 切换
- 页面内写死的代表态均值 `5.0`/`3.0`、降幅 `40%`、CDF path 几何
- `maps/heatmap-calibrated-represent.png`（completed 热力叠加代表态）
- 右下角 review-dock
- failed 态补建文案（设计源无独立 frame）

## 9. 与 Pencil 设计源的已知偏差

1. **failed 是 HTML 派生态**：当前 `.pen` 仅三态；failed 按 error token + 规格语义补建，用户已人工检查并接受。
2. **地图底图**：`heatmap-map-base.png` 由 `ol7yg` 导出后去除代表层/标签区还原，标签区为近似修补。
3. **非完成态 Calibrated 卡**：原型叠加「等待/失败」遮罩以明确无完成结论；Pencil 实例仍可能保留底图可见。
4. **按钮**：设计源启动/重置无填充色，原型保持透明底以贴合测量。
5. ~~面板底图近似纹理~~：已按 `EM3U1`/`XNGat` 的 image fill 源文件更正为正确左右面板背景图。

## 10. 结论

`ACCEPTED：用户已人工检查四态 HTML，确认符合预期；Gate 1.5 静态验收完成，尚未进入 Gate 2。`
