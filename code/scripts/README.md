# code/scripts

## `dev-web-server.sh`

一键启动 **Web + Node 适配服务**，**不**启动打桩。

```bash
./code/scripts/dev-web-server.sh
```

默认：

- 共享根：`code/comdatafiles`（可用 `CASE2_SHARED_DIR` 覆盖）
- 适配服务：`127.0.0.1:3102`
- Web：`http://127.0.0.1:5173`（Vite `host:true`，启动时另打印局域网 Network 地址；代理 `/api` → 3102）

`Ctrl+C` / `SIGTERM` 会结束两个子进程。

需要打桩时另开终端：

```bash
cd code/back && npm run dev
```

## `e2e-case2-stack.sh`

供 Playwright 自动使用：准备隔离的 `code/.tmp/case2-e2e-shared`，同时启动 **Web + Node 适配服务 + case2 打桩**。

```bash
cd code/web
npm run test:e2e
```

默认端口：

- Web：`127.0.0.1:55173`
- 适配服务：`127.0.0.1:33102`

结束测试后会关闭全部子进程，不污染 `code/comdatafiles`。
