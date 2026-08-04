# code/web

正式 React Web（Vite + React 18 + TypeScript）。Shell 负责 Tab / 1920×1080 缩放 / 公共弹层；业务只实现 `case2`。

## 常用命令

```bash
cd code/web
npm install
npm run dev          # http://127.0.0.1:5173 （host:true，另打局域网地址）
npm run typecheck
npm test             # Vitest
npm run test:e2e     # Playwright；经 scripts/e2e-case2-stack.sh 起隔离栈
npm run build
```

## 与适配服务

- 开发时 Vite 把 `/api` 代理到 `CASE2_ADAPTER_HOST`:`CASE2_ADAPTER_PORT`（默认 `127.0.0.1:3102`）。
- 推荐一键：`./code/scripts/dev-web-server.sh`（或 Windows 的 `dev-web-server.bat`）同时起 Web + Node 适配服务；打桩另开 `cd code/back && npm run dev`。
- 说明见 [`../scripts/README.md`](../scripts/README.md)、[`../server/README.md`](../server/README.md)。

## 配置

- 业务 `VITE_*` **只**在 `src/cases/case2/metrics/heatmapConfig.ts` 读取（非法则启动失败，不钳制回退）。
- 静态资源在 `assets/shell/`、`assets/case2/`；构建不依赖仓库外路径。
- 「现场环境」弹窗为 Shell 级共用：`src/shell/SiteEnvWindow*` + `assets/shell/site-env/`；case 页只调 `useSiteEnvWindow().open()`。

## 规格

施工权威：[../../doc/case2/WEB-SPEC.md](../../doc/case2/WEB-SPEC.md)。接口语义见同目录 API-CONTRACT / SERVER-SPEC。
