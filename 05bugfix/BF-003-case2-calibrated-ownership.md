# BF-003 Case2：Calibrated 读取只认 status、不认 case 归属

- Status: open
- Severity: P0
- Area: `code/server` Case2 data-files
- 一次只修这一条

## 现象

共享 `case_control.json`。Case3 已经 `case complete` 时，`GET /api/case2/data-files?phase=calibrated` 仍可能 200，返回上一轮 Case2 Calibrated（或被清空后的非法批次，视文件内容而定）。

## 为何重要

Case3 终态读要求 `case/command/dt_type/status` 四元组。Case2 只看 `status === "case complete"`，跨 Case 门禁不对称，误轮询或竞态会把别人的完成态当成自己的结果批次。

## 关键代码

- `code/server/src/cases/case2/data-files.mjs`：约 140–147、180–187（首尾两次控制快照都只查 status）
- 对照：`code/server/src/cases/case3/side-files.mjs` 终态四元组

## 建议修法

Calibrated 首尾两次控制快照都要求：

`case === "case2" && command === "start" && dt_type === "with dt" && status === "case complete"`

不匹配视为 `409 RESULT_BATCH_INCOMPLETE`（或明确的 ownership 409），不要 200。Initial 读取不要套这条（Initial 不是完成门禁）。

## 验收

- [ ] 控制文件是 Case3 `case complete` 时，Case2 calibrated GET 不得 200。
- [ ] Case2 本轮 `start` + `with dt` + `case complete` 且六文件合法时仍 200。
- [ ] 读期间 status/归属变化仍 409。
- [ ] 单测覆盖上述三条。

## 测试入口

`code/server` Case2 data-files 测试。
