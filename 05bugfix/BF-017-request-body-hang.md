# BF-017 超限 body 无限排空、无请求超时

- Status: open
- Severity: P2
- Area: `code/server` HTTP
- 一次只修这一条

## 现象

`readJsonBody` 在超过 20MiB 后仍 `continue` 读到 EOF，没有 request timeout。故障或恶意客户端可挂住连接；`server.close` 也会被拖住。默认虽本机，仍影响适配进程。

## 关键代码

- `code/server/src/shared/http.mjs`：约 25–32
- `code/server/src/index.mjs` / `app.mjs`：无 `request.setTimeout` / `server.timeout`

## 建议修法

超限后 `request.destroy()`（或再读一个很小的上限就断开），仍返回 413。为 server/request 设超时（例如 30–60s）。不要改 20MiB 语义本身。

## 验收

- [ ] 超过 20MiB：413 `PAYLOAD_TOO_LARGE`，连接被结束。
- [ ] 合法小于 20MiB 的截图 JSON 仍 200。
- [ ] 单测覆盖超限。
