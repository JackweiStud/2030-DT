# case1 本地验证与冻结复核

## 2026-09-22 开发冻结（覆盖下方历史口径）

**case1 当前功能范围开发冻结。** 用户明确确认当前前端全部开发完成、人工验证通过，随后授权修复代码复核发现。RF坐标问题及旧脚本断言已关闭；本轮只作代码修复与非浏览器验证，不使用CDP、不启动浏览器、不看图。冻结指当前本地工作区的case1开发基线，不代表全项目构建/部署验收通过；未创建提交或Git tag。

- 修复后 Web 受影响单测32/32通过（含新增6项RF交互）；上一轮Node case1及共享配置测试7/7通过，本轮未修改服务端。日志 `/tmp/case1-rf-green.log`、`/tmp/case1-freeze-server.log`。
- 冻结时的case4类型阻塞已在2026-09-22用户后续授权下修复：反射几何9项测试及完整Web `npm run build`（tsc + Vite）通过。日志 `/tmp/case4-types-tests.log`、`/tmp/case4-types-build.log`；此前20处错误日志仅保留追溯。
- 已核对三层切换、数据按页缓存/中止、GLB顺序准备与迟到释放、case卸载与视角恢复、只读名单路由、CSS隔离。
- 当前代码与旧文档差异已同步：RF进入即叠加并可交互/恢复初值；TXT从DT_SHARED_DIR/case1读取；GLB为正式assets/case1/3D固定名单；默认进入“DT构建”。当前RF效果按用户人工PASS记录，不冒充本轮独立地图/硬件验收。

### 冻结前发现已关闭

1. **P2已修复：RF屏幕坐标转换为舞台布局像素。** wheel使用frame的clientWidth/屏幕width（Y同理）换算鼠标锚点；pan在按下时记录该比例，换算拖动增量；旋转继续按可见宽度归一，不重复换算。新增组件事件测试覆盖100%、75%、150%舞台缩放，含非零初始偏移和旋转。修复前6项中4项失败，修复后6项全通过，证据 `/tmp/case1-rf-red.log` / `/tmp/case1-rf-green.log`。测试文件 `code/web/test/case1/rfInteraction.test.tsx`。
2. **P3已同步：** `check-case1-browser.mjs` 改为断言一个热力叠加层；本轮未运行该浏览器脚本，旧浏览器PASS仍只属于历史版本。

冻结后仅处理明确缺陷或新授权需求，不继续视觉微调或扩展功能。case4类型错误已在本日后续修复；目标设备独立性能测量和真实数据来源验证不冒充已通过；不阻断本次用户已验收的case1功能范围冻结。

## 2026-09-21 历史实现与验证记录

以下测试和截图属于此前版本，保留追溯；最新人工验收与代码审阅以上文为准。

## 已交付与复用

- 现有 Shell 的 case1 已挂正式页；复用静态左右分栏、四视图、文案、导航图、首页切图、材质图例和配色。静态 Shell 不迁移；正式 CSS 全部限定 case1-page，资源复制到 code/web/assets/case1，不直接依赖静态/设计/参考 UX 目录。
- 三个原生按钮控制局部视图；当前层再次点回首页；其余四图 .35，暗图仍可点，后两层不交互。
- 预置 GLB 串行准备并实际 Three.js 渲染；保留模型自带材质，两层独立视角。本次停留内保留，切 case/刷新回 env 初值。按需绘制，隐藏不持续动画；切离中止请求、释放 controls/renderer/geometry/material。
- 九 TXT 按页读取、缓存成功结果；KPI 数字、柱高和方向随实际标量变化。错误只作用到对应层，切出再进入可重新读取失败数据，无轮询或后台建模。
- Debug 默认关闭；开启时可复制当前配置，由用户手工更新 .env。不写本地存储、文件或控制命令；两层3D无 Reset，RF有恢复当前配置按钮。

## 独立验证

环境：本机 macOS，Node 26.4.0，Playwright 启动本机 Chrome headless（GLB 验证启用 SwiftShader）；不是目标演示 PC 性能验收。

| 项目 | 命令 / 证据 | 结果 |
|---|---|---|
| 静态交互/缩放 | 8091；geometry→home→material→rf，Space/Enter，1440×900 | PASS，scale=.75，无 pageerror；见 STATIC-HTML-ACCEPTANCE |
| Node 回归 | code/server 下 `npm test` | 116/116；含 case1 parser、只读方法、固定路径、缺文件、非法数值、二进制流 |
| Web 受影响回归 | code/web 下 `npx vitest run test/case1 test/heatmap.test.ts test/app/App.test.tsx test/shell/Shell.test.tsx` | 26/26；含缓存/取消、迟到 GLB 释放、材质失败隔离、导航卸载、热力算法 |
| 实际浏览器 | code/web 下 `node scripts/check-case1-browser.mjs`；需 debug 开启的独立 Vite | PASS：两 GLB、旋转/缩放/平移、复制参数、内部保留/切 case 恢复、键盘、缩放点击、KPI、无持久化/写请求；pageerror=0 |
| 默认关闭调试 | 5181 四视图截图 | PASS，调试面板隐藏，两模型可见；真实提供的 GLB 内容与 Pencil 占位截图不同，不重造模型 |
| 正式构建检查 | `npm run build` / `npm run typecheck` | 未通过：既有 case4 reflectionGeometry.ts 的20处数组索引类型错误；另将 HEAD 的 Web源码/测试提取到临时目录并复用当前依赖，独立 tsc 复现相同20处（baseline-typecheck.log）；未修改该文件，不称全项目构建通过 |
| Vite 打包 | `npx vite build` | PASS；Three.js 独立异步 chunk 约705KB，首次进入 case1 后加载 |
| 差异检查 | `git -c core.whitespace=cr-at-eol diff --check` | PASS；package文件沿用原有CRLF，无行尾大范围格式改动 |

本地复放证据目录 `/tmp/case1-qa/`（临时证据，重启或清理后可能消失，不默认入库）：`home.png`、`geometry.png`、`material.png`、`rf.png`、两张 interaction.png，`browser-check.log`、`default-browser.log`、`server-tests.log`、`web-tests.log`、`build.log`、`vite-build.log`。可用上方仓库脚本重新产生交互证据。

参考输入 → 浏览器实际显示：

| KPI | off | on | 变化 |
|---|---:|---:|---:|
| 几何保真度 | 0.85 | 0.90 | ↑5.9% |
| 重构覆盖率 | 0.82 | 0.91 | ↑11.0% |
| 电磁信道保真度 | 0.88 | 0.92 | ↑4.5% |
| RSS 误差 | 1.20 | 0.80 | ↓33.3% |

数据来自用户提供的离线参考文件，不是本次后端计算。矩阵当前30×50，解析与渲染不写死此维度。

## 运行与配置

通常分别在 code/server / code/web 下 `npm run dev`，重启已有 Node 后端以加载 case1 新路由。此轮为不替换用户原有3102/5173进程，使用只读验证服务3111、预览5181；访问 `http://127.0.0.1:5181/` 后点击 **DT Construction**。

Web `.env` 的 `VITE_CASE1_GEOMETRY_*` / `VITE_CASE1_MATERIAL_*`：CAMERA_POSITION、CAMERA_TARGET 为归一化模型坐标（模型居中、最长边=1），CAMERA_ZOOM 为投影缩放；MODEL_ROTATION 为 XYZ 弧度，MODEL_SCALE 为统一倍率；PAN_SPEED / ROTATE_SPEED / ZOOM_SPEED 为交互速度。`VITE_CASE1_DEBUG=true` 开启调试；默认false，参数需手工复制到 .env 后重启开发或重建。

文本与 case2/3/4 一样放在 `DT_SHARED_DIR/case1`，不另设 `CASE1_DATA_DIR`。GLB 固定为 `code/web/assets/case1/3D` 下的 `Beijing_Geometry.glb`、`Beijing_Material.glb`，不另设 `CASE1_GEOMETRY_GLB` / `CASE1_MATERIAL_GLB`。

复放交互脚本：启动 `VITE_CASE1_DEBUG=true DT_ADAPTER_PORT=3111 npm run dev -- --port 5182 --strictPort`，再执行脚本。脚本屏蔽其他 case 的 API 防止验收过程触发已有控制文件写入。

## 未完成项

1. **RF 纯底图与标定**：底图 `rf-map.png` 铺满主视图。热力与 case2 相同，按底图原始像素锚区绘制后再一起拉伸，进入 RF 层即叠加，不再单独开关。参数为 `VITE_CASE1_HEATMAP_X0/Y0/X1/Y1/CELL/GAP/ALPHA`。锚区必须落在底图像素内。图例为蓝青黄红。当前RF显示效果已由用户整体人工验证通过；本轮未独立测量地图坐标标定误差。
2. **全项目构建已通过**：2026-09-22后续修复case4类型错误，完整Web npm build（含tsc）通过。
3. **人工动态视觉与目标硬件**：当前前端人工验收已由用户于2026-09-22确认通过；现场PC加载耗时、显存与流畅度未由本轮独立测量。

未修改 Pencil / UX 输入 / GLB，未提交或推送，用户原有暂存内容保持。
