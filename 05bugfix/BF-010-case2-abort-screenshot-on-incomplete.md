# BF-010 Case2：结果不完整回退时未真正取消截图

- Status: open
- Severity: P1
- Area: `code/web` Case2
- 一次只修这一条

## 现象

`case complete` 后六文件连续 10 次不过关，会 `failed-start` +「结果不完整已自动回退」+ `POST init`。此时只把 `screenshotBusyRef` 设 false，**不 abort** 正在进行的 `toPng`/上传。截图随后可能 409、再重试，或把 `screenshotPhase` 设回 `saving`/`waitClear`，Tab 在「已回退」后仍锁一会儿。

Case3 `noteFinalNotReady` 会 `screenshotAbortRef.abort()`。

## 关键代码

- `code/web/src/cases/case2/hooks/useCase2Controller.ts`：`CALIBRATED_FAIL_EXHAUSTED` 分支约 429–440；`runScreenshotTask` 无 AbortController
- 对照：`code/web/src/cases/case3/hooks/useCase3Controller.ts` `noteFinalNotReady`

## 建议修法

截图任务加 AbortSignal；结果不完整 / execute fail / 卸载时 abort。耗尽路径不要只清 ref。`CALIBRATED_FAIL_EXHAUSTED` 已把 `screenshotPhase` 设 idle，要保证 in-flight 任务结束后不会再 dispatch `SCREENSHOT_UPLOAD_OK`。

## 验收

- [ ] 不完整回退后，迟到的截图成功响应不得把相位打回 waitClear，也不得再 POST 截图。
- [ ] Tab busy 在回退后尽快解开。
- [ ] 正常截图 3 次重试语义不变。
