# BF-012 Case2：轮询不校验控制文件归属

- Status: open
- Severity: P1
- Area: `code/web` Case2
- 一次只修这一条

## 现象

Case3 有 `controlMatchesAction`，轮询只认本轮 `case/command/dt_type`。Case2 `pollOnce` 对任意 `status`/`flag` 边沿都可能触发 complete / screenshot / execute fail。共享控制文件被其它 Case 写入时，Case2 可能误读完成或误开截图。

## 关键代码

- `code/web/src/cases/case2/hooks/useCase2Controller.ts`：`pollOnce`
- `code/web/src/cases/case2/state/case2Reducer.ts`：`shouldFetchCalibrated` / `shouldStartScreenshot` / `reduceControlPoll`
- 对照：`code/web/src/cases/case3/hooks/useCase3Controller.ts` `controlMatchesAction`

## 建议修法

在 `calibrating` 要求 `case==="case2" && command==="start" && dt_type==="with dt"`。
在 `resetting` 要求 `case==="case2" && command==="reinit"`。
不匹配则 ignore + warn，不要改 UI 相、不要开截图、不要拉 Calibrated。

进页 handshake 的 GET 仍只做探活，不要用历史 status 改相（现有语义保留）。

## 验收

- [ ] calibrating 时控制文件变成 Case3 start：Case2 不进入 completed、不开截图。
- [ ] 本轮元组匹配时行为与现在一致。
- [ ] 单测覆盖 mismatch ignore。
