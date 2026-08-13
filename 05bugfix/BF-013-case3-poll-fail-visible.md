# BF-013 Case3：轮询失败只打日志、用户无感知

- Status: open
- Severity: P1
- Area: `code/web` Case3
- 一次只修这一条

## 现象

Case2 poll 失败会 `CONTROL_POLL_FAIL` → `adapterError`。Case3 轮询失败大约只 `console.warn`，徽标仍是「测试中」，用户不知道适配服务已断。若一直失败，可能直到超时门槛才动。

与 BF-011 的关系：本工单负责 **idle/动作中把失败变成可见的 adapterError**；BF-011 负责 **忙态时不要用连接文案盖掉测试中**。若两条都做，先约定：忙态设 `adapterError` 但徽标仍显示测试中 + 次要「重试中」。

## 关键代码

- `code/web/src/cases/case3/hooks/useCase3Controller.ts`：poll 循环的 catch（约 949–958 一带）
- `code/web/src/cases/case3/state/case3Reducer.ts`：`ADAPTER_ERROR`

## 建议修法

连续 N 次（建议 3 次）control/side GET 失败后 `dispatch({ type: "ADAPTER_ERROR", value: true })`。成功一次清掉。不要因单次失败就 `setBusy(false)` 或 POST init。

可复用 Case3 已有 adapter probe（若仅 idle 有探活，动作中靠轮询恢复即可）。

## 验收

- [ ] 动作中连续失败：`adapterError` 为 true（徽标策略交给 BF-011）。
- [ ] 随后一次成功：`adapterError` 为 false，动作继续。
- [ ] 单次失败不撤权、不解 busy。
