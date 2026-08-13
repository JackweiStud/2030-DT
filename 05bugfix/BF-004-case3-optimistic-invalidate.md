# BF-004 Case3：POST 失败前已清空本侧结果；连接异常仍可点按钮

- Status: open
- Severity: P0
- Area: `code/web` Case3
- 一次只修这一条（按钮禁用 + 失败回滚是同一缺陷的两面）

## 现象

1. 徽标已是「case3文件服务器连接异常」，启动/重置按钮仍可点。
2. 点重置或启动后，本侧地图/KPI 结果先消失；若 POST 失败，结果不会回来。后端文件可能根本没被清。

## 为何重要

演示中途适配服务闪断，点一次重置会把已完成的无 DT/有 DT 画面清掉，只能重跑。Case2 用 `phaseBeforeCommand` 在 POST 失败时回滚 UI。

## 关键代码

- `code/web/src/cases/case3/state/case3Reducer.ts`
  - `canStartWithout` / `canStartWith` / `canReinit`：不看 `adapterError`
  - `ACTION_BEGIN`：立刻 `invalidateSide`
  - `ACTION_POST_FAILED`：注释写明「不得恢复」
- `code/web/src/cases/case3/hooks/useCase3Controller.ts`：`beginAction` 先 `setBusy(true)` 再 POST；`CONTROL_BUSY` 对 start 只 `CLEAR_ACTIVE`

## 建议修法

1. 三个 `can*` 在 `adapterError === true` 时返回 false（与 Case2 `canStart`/`canReset` 对齐）。
2. 不要在 POST 成功前丢掉可回滚的本侧快照：推迟 `invalidateSide`，或 POST 失败时恢复 begin 前的 `results`/`live`/`pairValid`。
3. `CONTROL_BUSY` 的 start 路径不要静默丢结果；至少回到可重试且数据还在的状态。

不要因此实现命令队列或自动重试业务命令。

## 验收

- [ ] `adapterError` 时双侧启动/重置均 disabled。
- [ ] 已有 Without 结果时，ReInit POST 失败（网络/`CONTROL_BUSY`），Without 结果仍在。
- [ ] Start POST 失败不把对侧已完成结果清掉。
- [ ] reducer / controller 单测覆盖。

## 测试入口

`code/web/test/` Case3 reducer 与 controller。
