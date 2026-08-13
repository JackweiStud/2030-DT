# BF-008 HTTP 超时：Case2 没有；Case3 截图共用 5s

- Status: open
- Severity: P1
- Area: `code/web` Case2 API + Case3 API
- 一次只修这一条

## 现象

1. Case2 `fetch` 无超时。适配服务或 Vite 代理挂起时，`pollOnce` 一直等，Tab 锁不解。
2. Case3 所有请求默认 5s，含 `POST /screenshot`。舞台 1920×1080 且 `pixelRatio: 2`（3840×2160 PNG），上传+落盘容易 `REQUEST_TIMEOUT`，吃掉 3 次截图配额。

## 关键代码

- `code/web/src/cases/case2/api/case2Api.ts`：`request()` 无 timeout
- `code/web/src/cases/case3/api/case3Api.ts`：`DEFAULT_REQUEST_TIMEOUT_MS = 5000`
- 截图像素：Case2 `useCase2Controller.ts` `pixelRatio: 2`；Case3 `CASE3_SCREENSHOT_PIXEL_RATIO = 2`

## 建议修法

- Case2：control / data 请求加超时（建议 5–8s），超时走现有 `CONTROL_POLL_FAIL` / 命令 POST fail，不要自己发明业务重试。
- Case3：screenshot POST 单独更长超时（建议 15–30s）；其它 GET/控制写可保持 5s。
- 超时错误码要能和 abort 区分（Case3 已有 `REQUEST_TIMEOUT`）。

不要为了超时去降低截图像素比（那是 BF-UI 的可选优化）。

## 验收

- [ ] Case2 单测：假 fetch 永不 resolve，超时后抛错且可被 controller 当成 poll fail。
- [ ] Case3 单测：普通 GET 仍 5s；screenshot 超时阈值更大。
- [ ] 调用方 abort 仍表现为 abort，不当成 timeout。
