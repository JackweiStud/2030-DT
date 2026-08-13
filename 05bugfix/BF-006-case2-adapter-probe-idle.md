# BF-006 Case2：连接探活只覆盖 initial，失败态会锁死按钮

- Status: open
- Severity: P1
- Area: `code/web` Case2
- 一次只修这一条

## 相关工单

「完成瞬间点重置 → CONTROL_BUSY → adapterError 后只能刷新」的主路径见 **BF-023**。本单只把探活覆盖到空闲可操作相，不改重置按钮何时可点。

## 现象

在 `failed-start`（或 `completed` / `failed-reinit`）点启动/重置，POST 因适配服务不可达失败 → `adapterError=true` 且 UI 回到该相。`canStart`/`canReset` 因 `adapterError` 全 false。探活 effect 要求 `case2UiState === "initial"`，于是 **不会探活**，只能切 Tab 重挂载。

## 关键代码

- `code/web/src/cases/case2/hooks/useCase2Controller.ts`：`runAdapterRecoveryProbe`、`scheduleAdapterProbeLoop`（约 160–165、592–607）
- `code/web/src/cases/case2/state/case2Reducer.ts`：`START_POST_FAIL` / `RESET_POST_FAIL`；`canStart` / `canReset`

## 建议修法

探活覆盖所有「空闲可操作相」：`initial` | `failed-start` | `completed` | `failed-reinit`。恢复后清 `adapterError`，不要因为探活成功就误把 `completed` 打回 Initial（历史 status 仍忽略，但 UI 相应保留，除非现有 handshake 本来就会在进页时 init）。

注意：探活里的 `POST init` 会撤权。在 `completed` 上回退连接时，要确认不会误清 Calibrated 显示。若会，则 completed/failed-reinit 的探活只 GET、不 POST init，或与产品语义对齐后写进工单结论。

## 验收

- [ ] `failed-start` + `adapterError`：5s 内探活，适配恢复后启动可点。
- [ ] `initial` 探活行为保持现有（恢复后可补 Initial）。
- [ ] `completed` 探活恢复后 Calibrated 仍显示（除非你证明必须 init；若必须，在 PR 说明）。
- [ ] 单测或 hook 测试覆盖失败态探活条件。
