# code/web

正式 React Web（Vite + React 18 + TypeScript）。Shell 负责 Tab / 1920×1080 缩放 / 公共弹层 / 跨 Case 导航锁；业务实现 `case2`（DT Calibration）与 `case3`（DT for Comm）。

## 常用命令

```bash
cd code/web
npm install
npm run dev          # http://127.0.0.1:5173 （host:true，另打局域网地址）
npm run typecheck
npm test             # Vitest（含 case2 + case3）
npm run test:e2e -- --workers=1
                      # Playwright；Case2 经 scripts/e2e-case2-stack.sh；Case3 当前为前端隔离主线
npm run build
```

## 与适配服务

- 开发时 Vite 把 `/api` 代理到 `DT_ADAPTER_HOST`:`DT_ADAPTER_PORT`（默认 `127.0.0.1:3102`）；旧 `CASE2_ADAPTER_*` 仅 fallback。
- Case2 API 前缀写死 `/api/case2`；Case3 写死 `/api/case3`。
- 推荐一键：`./code/scripts/dev-web-server.sh`（或 Windows 的 `dev-web-server.bat`）同时起 Web + Node 适配服务；打桩另开 `cd code/back && npm run start:case2` 或 `npm run start:case3`。

## E2E 说明

- 当前 `playwright.config.ts` 的 webServer 会启动 `code/scripts/e2e-case2-stack.sh`，该栈只为 Case2 准备临时共享目录、Node、Case2 stub 和 Web。
- `e2e/case3-mainline.spec.ts` 使用 `page.route` mock `/api/case3/*`，覆盖 Case3 前端状态机、独立重置和重新配对；它不是 Case3 三进程真实后端 E2E。
- 因现有 webServer 是测试进程级共享栈，运行全部 E2E 时应使用 `--workers=1`。默认并行 workers 会让 Case2/Case3 两个 E2E 共享并竞争同一个 Case2 临时栈，可能出现 Case2 控制文件被清理后的误失败。

## 配置

- Case2 `VITE_CASE2_*` 只在 `src/cases/case2/metrics/heatmapConfig.ts` 读取。
- Case3 `VITE_CASE3_*` 只在 `src/cases/case3/config/case3RuntimeConfig.ts` 读取（非法则启动失败，不钳制回退）。
- 静态资源在 `assets/shell/`、`assets/case2/`、`assets/case3/`；构建不依赖仓库外路径。
- 「现场环境」弹窗为 Shell 级共用：case 页只调 `useSiteEnvWindow().open()`。

## 排查：启动/重置后徽标无动态省略号

Case2 / Case3 忙态徽标（「测试中」「重置中」等）的省略号与轻脉冲是纯 CSS 动画；仅当文案进入忙态时挂 `is-busy` 并渲染省略号节点。空闲文案（如「等待启动测试」）本身没有动态省略号。

若本机正常、同事 Windows Chrome 看不到跳动：

1. 在出问题的 Chrome 打开业务页，F12 → Console，执行：

   ```js
   matchMedia('(prefers-reduced-motion: reduce)').matches
   ```

2. 结果为 `true`：系统开了「减少动画」，页面会关闭脉冲与省略号步进，只留静态 `…`。  
   **Windows 11**：设置 → 辅助功能 → 视觉效果 → 打开 **动画效果**。  
   **Windows 10**：设置 → 轻松使用 → 显示 → 打开 **在 Windows 中显示动画**。  
   改完后完全退出并重开 Chrome，再跑上面的命令应变为 `false`。

3. 结果为 `false` 仍无动态：先确认启动/重置后徽标是否已变成忙态文案，再在 Elements 中查是否存在 `.case3-status-ellipsis` / `.status-ellipsis`（无节点 = 未进入忙态，不是动效问题）。

## 规格

- Case2：[../../doc/case2/WEB-SPEC.md](../../doc/case2/WEB-SPEC.md)
- Case3：[../../doc/case3/WEB-SPEC.md](../../doc/case3/WEB-SPEC.md) / [API-CONTRACT.md](../../doc/case3/API-CONTRACT.md)
