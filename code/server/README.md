# case2 Node 文件适配服务

本服务运行在前端 PC，向 Web 提供 `/api/case2/*` REST，并独占浏览器侧的共享目录文件 I/O。

## 运行

```bash
npm start
```

本地默认把 `CASE2_SHARED_DIR` 解析为仓库内 `code/comdatafiles` 的绝对路径（与打桩服务共用）。该默认由 **`npm start` / `npm run dev` 脚本注入**（见 `package.json`），**不是** `config.mjs` 静默回退：配置层仍要求环境变量为绝对目录。正式部署或换共享根时再显式覆盖：

```bash
CASE2_SHARED_DIR=/absolute/path/to/shared npm start
```

默认监听 `127.0.0.1:3102`。可通过 `CASE2_ADAPTER_HOST`、`CASE2_ADAPTER_PORT` 覆盖。

## 测试

```bash
npm test
```

## 边界

- 只实现 case2 文件适配，不推进业务 `status`。
- 不启动模拟后端，不读取 `01-参考资料/`。
- `src/shared/` 只放通用基础能力；case2 字段、文件名和截图规则位于 `src/cases/case2/`。
