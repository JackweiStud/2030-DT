# code/web

正式 React Web（Vite + React 18 + TypeScript）。Shell 负责 Tab / 1920×1080 缩放 / 公共弹层 / 跨 Case 导航锁；业务实现 `case2`（DT Calibration）与 `case3`（DT for Comm）。

## 常用命令

```bash
cd code/web
npm install
npm run dev          # http://127.0.0.1:5173 （host:true，另打局域网地址）
npm run typecheck
npm test             # Vitest（含 case2 + case3）
npm run test:e2e     # Playwright；Case2 经 scripts/e2e-case2-stack.sh；Case3 全栈依赖 Node/stub
npm run build
```

## 与适配服务

- 开发时 Vite 把 `/api` 代理到 `DT_ADAPTER_HOST`:`DT_ADAPTER_PORT`（默认 `127.0.0.1:3102`）；旧 `CASE2_ADAPTER_*` 仅 fallback。
- Case2 API 前缀写死 `/api/case2`；Case3 写死 `/api/case3`。
- 推荐一键：`./code/scripts/dev-web-server.sh`（或 Windows 的 `dev-web-server.bat`）同时起 Web + Node 适配服务；打桩另开 `cd code/back && npm run start:case2` 或 `npm run start:case3`。

## 配置

- Case2 `VITE_CASE2_*` 只在 `src/cases/case2/metrics/heatmapConfig.ts` 读取。
- Case3 `VITE_CASE3_*` 只在 `src/cases/case3/config/case3RuntimeConfig.ts` 读取（非法则启动失败，不钳制回退）。
- 静态资源在 `assets/shell/`、`assets/case2/`、`assets/case3/`；构建不依赖仓库外路径。
- 「现场环境」弹窗为 Shell 级共用：case 页只调 `useSiteEnvWindow().open()`。

## 规格

- Case2：[../../doc/case2/WEB-SPEC.md](../../doc/case2/WEB-SPEC.md)
- Case3：[../../doc/case3/WEB-SPEC.md](../../doc/case3/WEB-SPEC.md) / [API-CONTRACT.md](../../doc/case3/API-CONTRACT.md)
