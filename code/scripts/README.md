# code/scripts

## `dev-web-server.sh` / `dev-web-server.bat`

一键启动 **Web + Node 适配服务**，**不**启动打桩。

### macOS / Linux

```bash
./code/scripts/dev-web-server.sh
```

### Windows（cmd / PowerShell）

推荐用 bat 启动（会先 `chcp 65001`，再调 UTF-8 BOM 的 ps1，避免中文乱码）：

```bat
code\scripts\dev-web-server.bat
```

或在 PowerShell 中：

```powershell
cd <repo>\code\scripts
.\dev-web-server.bat
# 也可直接：
.\dev-web-server.ps1
```

编码说明：

- `dev-web-server.bat`：**仅 ASCII**，负责切 UTF-8 代码页并调用 ps1
- `dev-web-server.ps1`：**UTF-8 带 BOM**（Windows PowerShell 5.1 识别中文所必需）；勿存成无 BOM 的 UTF-8
- 若仍乱码：确认终端字体支持中文，或改用 Windows Terminal；PowerShell 7+ 对 UTF-8 更友好

默认：

- 共享根：`code/comdatafiles`（可用 `DT_SHARED_DIR` 覆盖；`CASE2_SHARED_DIR` 仅兼容旧脚本）
- 适配服务：`127.0.0.1:3102`
- Web：`http://127.0.0.1:5173`（Vite `host:true`，启动时另打印局域网 Network 地址；代理 `/api` → 3102）

`Ctrl+C` 会结束两个子进程（Windows 上通过 `taskkill /T` 清 npm/node 树）。

需要打桩时另开终端：

```bash
cd code/back && npm run dev
```

Windows：

```bat
cd code\back
npm run dev
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
