# 2030-DT

IMT-2030 DT 测试演示系统：以 **共享目录 + 控制文件**（`case_control.json`）为契约，由 Web 前端、Node 文件适配服务与本地模拟后端三个进程协作完成 Case2（DT Calibration）与 Case3（DT for Comm）的联调演示。

## 模块总览

| 目录 | 角色 | 说明 |
|---|---|---|
| `web/` | 正式 React Web | Vite + React 18 + TypeScript；Shell 负责 Tab / 1920×1080 缩放 / 公共弹层 / 跨 Case 导航锁；业务实现 Case2 与 Case3 |
| `server/` | Node 文件适配服务 | 运行在前端 PC，向 Web 提供 `/api/case2/*`、`/api/case3/*` REST，独占浏览器侧的共享目录文件 I/O |
| `back/` | 本地模拟后端打桩 | 无真实后端时联调用；只扮演共享目录另一端，不提供 REST，不并入 server 默认启动路径 |
| `scripts/` | 开发辅助脚本 | 一键启动 Web + 适配服务；Playwright E2E 专用栈 |
| `comdatafiles/` | 共享目录 | 各进程间交换的共享根（控制文件 + Case2/Case3 数据文件 + 截图输出） |

进程关系：

```text
浏览器 (web/) ──REST──> Node 适配服务 (server/) ──文件 I/O──> 共享目录 (comdatafiles/)
                                                              ^
模拟后端打桩 (back/) ──────────────文件 I/O──────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
cd web && npm install
cd ../server && npm install
cd ../back && npm install
```

### 2. 一键起 Web + 适配服务（不打桩）

```bash
# macOS / Linux
./code/scripts/dev-web-server.sh

# Windows（cmd / PowerShell）
code\scripts\dev-web-server.bat
```

- 共享根：`comdatafiles/`（可用 `DT_SHARED_DIR` 覆盖）
- 适配服务：`127.0.0.1:3102`
- Web：`http://127.0.0.1:5173`（Vite 把 `/api` 代理到 3102）

### 3. 另开终端起打桩

```bash
cd back
npm run start:case2   # Case2（DT Calibration）
npm run start:case3   # Case3（DT for Comm）
```

Case2 与 Case3 打桩互斥：同一共享根上一次只跑一个。

## 各模块文档

- [web/README.md](web/README.md) — Web 常用命令、E2E 说明、环境变量、动效排查
- [server/README.md](server/README.md) — 适配服务运行/测试、数值范围、Case2/Case3 终态门槛
- [back/README.md](back/README.md) — 打桩运行/测试、数据模式、截图与日志开关
  - [back/case2/README.md](back/case2/README.md) — Case2 打桩细节
  - [back/case3/README.md](back/case3/README.md) — Case3 打桩细节
- [scripts/README.md](scripts/README.md) — 一键启动脚本与 E2E 栈说明

## 测试

```bash
cd server && npm test    # Node 适配服务（shared + case2 + case3）
cd back && npm test      # 打桩（case2 + case3）
cd web && npm test       # Vitest（case2 + case3）
cd web && npm run test:e2e -- --workers=1   # Playwright E2E（必须串行）
```

注意：现有 Playwright webServer 是测试进程级共享栈，跑全部 E2E 时应使用 `--workers=1`，否则 Case2/Case3 两个 E2E 会竞争同一个 Case2 临时栈。

## 注意事项

- 打桩产物仅供本地联调，**不得表述为真实后端采集结果**（日志统一标注 `synthetic` / `fixture-replay`）。
- 真实后端联调时停止打桩进程，并确保 `CASE3_STUB_SEED_INIT=0`。
- `CASE2_SHARED_DIR` 仅为旧脚本兼容 fallback，新配置统一使用 `DT_SHARED_DIR`。
