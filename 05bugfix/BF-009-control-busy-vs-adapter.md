# BF-009 Case2：CONTROL_BUSY 被当成连接异常

- Status: open
- Severity: P1
- Area: `code/web` Case2
- 一次只修这一条

## 相关工单

用户复现的「Case2 刚完成就点重置」主因是按钮过早可点，见 **BF-023**。本单只改 409 的文案/回滚，不要在这里改 `canReset`。

## 现象

控制文件被另一端占用（Case3 未完成、或本轮未消费）时，Case2 启动/重置 POST 返回 `409 CONTROL_BUSY`。前端走 `START_POST_FAIL` / `RESET_POST_FAIL`，徽标变成「case2文件服务器连接异常」，并可能启动错误探活语义。

Case3 对 `CONTROL_BUSY` 有专用分支。

## 关键代码

- `code/web/src/cases/case2/hooks/useCase2Controller.ts`：`onStart` / `onReset` 的 catch
- `code/web/src/cases/case2/api/case2Api.ts`：`Case2ApiError.code`
- 对照：`code/web/src/cases/case3/hooks/useCase3Controller.ts` 约 1220–1233

## 建议修法

识别 `code === "CONTROL_BUSY"`：回滚到点击前 UI 相，**不要**设 `adapterError`。徽标可用短文案「控制文件忙」或保持原相并 console.warn。允许用户稍后手动再点（不做自动重试队列）。

## 验收

- [ ] 409 CONTROL_BUSY：不是「文件服务器连接异常」；启动/重置可再次点击（回到 canStart/canReset 为 true 的相）。
- [ ] 真正的网络失败仍走 adapterError。
- [ ] 单测覆盖。
