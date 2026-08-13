# BF-019 绑定非 loopback 无鉴权、启动无强警告

- Status: open
- Severity: P2
- Area: `code/server` 启动配置
- 一次只修这一条

## 现象

默认 `127.0.0.1` 合理。`DT_ADAPTER_HOST=0.0.0.0` 时适配服务无 token、无 CORS 策略，局域网可 POST 控制文件和截图。Vite 开发服务器也是 `host: true`。这是演示平台的暴露面，不是远程代码执行。

## 关键代码

- `code/server/src/shared/config.mjs`：host 默认与 env
- `code/server/src/index.mjs`：listen 后日志
- `code/web/vite.config.ts`：`server.host: true`

## 建议修法

host 不是 loopback（`127.0.0.1` / `::1`）时：启动 **error 级警告**（或直接拒绝，若你判断演示不需要绑 0.0.0.0）。在 `code/server/README.md` 写一句：不要绑公网。不要为此做 OAuth。

Vite host 是否收紧由你判断；若改，注明开发机如何用 localhost 打开。

## 验收

- [ ] 默认 127.0.0.1 行为不变。
- [ ] 0.0.0.0 启动有醒目日志（或被拒绝，二选一写进 README）。
