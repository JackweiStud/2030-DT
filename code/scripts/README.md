# code/scripts

## `dev-web-server.sh`

一键启动 **Web + Node 适配服务**，**不**启动打桩。

```bash
./code/scripts/dev-web-server.sh
```

默认：

- 共享根：`code/comdatafiles`（可用 `CASE2_SHARED_DIR` 覆盖）
- 适配服务：`127.0.0.1:3102`
- Web：`http://127.0.0.1:5173`（Vite 代理 `/api` → 3102）

`Ctrl+C` / `SIGTERM` 会结束两个子进程。

需要打桩时另开终端：

```bash
cd code/back && npm run dev
```
