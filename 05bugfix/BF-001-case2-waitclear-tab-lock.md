# BF-001 Case2：截图 waitClear + 停轮询 → Tab 永久锁

- Status: open
- Severity: P0
- Area: `code/web` Case2
- 一次只修这一条

## 相关工单

用户「已完成瞬间立刻点重置 → 连接异常卡死」见 **BF-023**。本单只修 `waitClear` 停轮询导致 Tab 锁 / init 不发；不要在本单里改 `canReset`。

## 现象

启动测试后，界面可以进入「已完成」并画出 Calibrated，但其它 Case Tab 一直灰、点不了。刷新才能恢复。

## 为何重要

演示中途无法切到 Case3。完成态写回 `init` 也可能永远不发。

## 机制（待核实后修）

规格允许 `save_picture_flag=1` 与 `case complete` 同窗口。截图上传成功且当时仍是 `calibrating` 时，相位会变成 `waitClear`。`SCREENSHOT_FLAG_CLEARED` **只靠后续控制轮询**看到 `flag===0`。

同时 `CALIBRATED_OK` 或 `pollOnce` 看到 `ui === "completed"` 会 `stopPolling()`。若截图在「拉 Calibrated 的 await 期间」完成并进入 `waitClear`，轮询已停，flag 清零观察不到。

`shouldResetCommandAfterCommandCompletion` 要求 `screenshotPhase === "idle"`。`Case2Page` 把 `waitClear` 算 busy，于是 Tab 锁不解。

对照：Case3 在 `waitClear` 期间继续轮询。

## 关键代码

- `code/web/src/cases/case2/hooks/useCase2Controller.ts`：`pollOnce` 里 `CALIBRATED_OK` 后 `stopPolling()`；`SCREENSHOT_FLAG_CLEARED` 分支
- `code/web/src/cases/case2/state/case2Reducer.ts`：`SCREENSHOT_UPLOAD_OK`、`shouldResetCommandAfterCommandCompletion`
- `code/web/src/cases/case2/Case2Page.tsx`：`busy` 含 `screenshotPhase === "waitClear"`

## 建议修法（择一，保持最小）

优先对齐 Case3：业务已完成后，若仍 `waitClear`/`saving`，**继续轮询**直到 flag 清零或截图放弃。
或者：进入 `completed` 且 Node 已清 flag 时，直接把截图相位收成 `idle`（需能证明不会漏截）。

不要为实现「可取消测试」而加暂停按钮。

## 验收

- [ ] 同拍 `case complete` + `save_picture_flag=1`：截图慢于六文件读取时，完成后 Tab 能解锁。
- [ ] 完成后仍会写回 `POST {command:"init"}`（现有收尾语义不变）。
- [ ] 截图失败 3 次放弃路径仍能解锁 Tab。
- [ ] 现有 Case2 单测 / e2e 补一条「completed + waitClear 不得停轮询或必须收尾」的回归。

## 测试入口

`code/web/test/` 下 Case2 controller / reducer 测试；若有 Playwright Case2 主线也跑一遍。
