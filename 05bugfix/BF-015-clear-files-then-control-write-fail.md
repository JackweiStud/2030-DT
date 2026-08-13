# BF-015 先清结果文件再写控制，写失败会留下空文件

- Status: open
- Severity: P1
- Area: `code/server` Case2 + Case3 控制写
- 一次只修这一条

## 现象

`beforeWrite` 先清空 Case2 六个 Calibrated 或 Case3 单侧文件，再原子写控制。若随后 rename 失败或二次 guard 失败：控制仍是旧状态，结果文件已被掏空。客户端看到 500，画面上的历史结果再也读不回来。

## 关键代码

- `code/server/src/shared/control-file-store.mjs`：`beforeWrite` 后 `atomicReplaceFile`
- `code/server/src/cases/case2/control-file.mjs`：`clearCalibrated`（`writeFile("")`）
- `code/server/src/cases/case3/control-file.mjs`：`clearSide`

## 建议修法（选成本最低的一种并写清）

可选：

1. 文档化「清成功、写失败」并保证 Web 可安全重试同一 start/reinit（控制未开轮时重试会再清一次，可接受）。至少打 **error** 日志（kind/side/files）。
2. 控制写失败后尝试把清空做成可发现：日志必须能把联调者带到「文件已空、命令未发出」。
3. 更稳但更贵：先写控制再清（要评估后端是否会在 status="" 后立刻读到旧结果）。不要引入真实后端才有的事务目录。

Case2 `writeFile("")` 非原子可在本工单一并改成同目录临时文件 + rename 清空，若改动仍聚焦「清空与控制写的失败原子性」。

## 验收

- [ ] 清空成功、控制 rename 失败：有明确 error 日志，含 caseId/kind。
- [ ] 若选择可重试：同一 start payload 再次 POST，busy guard 仍允许（因为命令未写出）。
- [ ] 单测覆盖 beforeWrite 之后写失败。
