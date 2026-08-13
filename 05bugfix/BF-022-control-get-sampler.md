# BF-022 控制 GET 降噪 key 不含 command/case

- Status: open
- Severity: P2
- Area: `code/server` 访问日志
- 一次只修这一条

## 现象

`createControlGetSampler` 只用 `status + save_picture_flag` 当 key。`init → start` 若 status/flag 仍为空，成功 GET 可能被静音，联调看不出开轮。Case3 SPEC 写明按 case/command/status/flag 变化记摘要。

## 关键代码

- `code/server/src/app.mjs`：`createControlGetSampler` 约 192–200

## 建议修法

key 纳入 `case`、`command`、`dt_type`、`status`、`save_picture_flag`。不要把高频不变 GET 重新打满 info。

## 验收

- [ ] 仅 flag/status 不变的重复 GET 仍静音。
- [ ] command 从 init 变 start（status 仍空）会打一条摘要。
- [ ] 现有降噪单测更新。
