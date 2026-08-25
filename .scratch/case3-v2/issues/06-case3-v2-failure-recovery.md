# 06: 覆盖 Case3 V2 失败、连接异常与恢复

**What to build:** 当业务命令失败、结果不完整、文件服务暂时不可达或共享控制冲突时，新页面给出与旧 Case3 一致的明确反馈，并允许用户按现有规则恢复，而不会显示陈旧结果或闪烁清图。

**Blocked by:** 05: 跑通 ReInit、单侧历史与新一轮重跑。

**Status:** human-accepted

- [x] Start `execute fail` 显示红色“执行失败”，目标侧数据、地图和矩阵回初始，只开放现有规则允许的同侧 Start。
- [x] ReInit `execute fail` 显示红色“重置失败”，地图和矩阵保持初始，只开放现有规则允许的同侧 ReInit。
- [x] 最终结果经过现有重试门槛仍不完整时，显示“结果不完整已自动回退”，目标侧失效，尝试写回 init，并释放 busy。
- [x] Start/ReInit POST 失败沿用“case3文件服务器连接异常”或现有对应错误文案，不伪装成业务 `execute fail`。
- [x] 运行中的短暂轮询连接异常保留当前地图、矩阵和实时数据；达到现有连续失败阈值后显示“重试中”，成功轮询后清除提示但继续本轮。
- [x] `CONTROL_BUSY` 继续表示共享控制冲突，不被归类为适配服务不可达，也不新增自动业务重试或命令队列。
- [x] 明确业务失败后不得恢复目标侧旧结果；另一侧历史是否保留继续遵循共享展示模型和 `pairValid`。
- [x] 失败与连接异常只使用行内状态，不新增模态框、Toast 或整页错误。
- [x] 失败后重新 Start/ReInit 能开启全新 generation，陈旧响应和陈旧文件不得污染恢复后的轮次。
- [x] 补齐 execute fail、POST 失败、结果不完整、短暂轮询异常、CONTROL_BUSY 和失败恢复测试。

## 2026-08-24 对齐前检查结论

### 已有能力（本 Ticket 不重做）

- 共享 Case3 reducer / controller 已支持：Start/ReInit `execute fail`、结果不完整自动回退、POST 失败、连续 3 次轮询失败后连接异常、成功轮询自动恢复、同侧重试、新 generation 隔离和 `CONTROL_BUSY` 不自动重发。
- 目标侧数据在动作开始时即失效；失败后不会恢复目标侧旧结果，另一侧历史仍按 `pairValid=false` 保留。
- 旧 Case3 已把 `withoutBadgeError` / `withBadgeError` 和 `withoutRetryHint` / `withRetryHint` 接入界面。

### V2 当前缺口

1. `BottomDock -> PointBeamReplay` 只传状态文案，未传错误标记和“重试中”标记，因此“执行失败 / 重置失败 / 结果不完整 / 文件服务器连接异常”在 V2 不是红色，运行中连接异常也看不到“重试中”。
2. V2 的 `mapHoldEmpty` 只在 ReInit 点击时置空。Start With 失败、结果不完整或 POST 失败后，单地图可能重新显示保留的 Without 历史，与“本轮目标地图和矩阵保持初始”不一致。
3. 共享层已有大部分状态机单测，但还缺 controller 级 POST 失败、`CONTROL_BUSY` 以及失败后新 generation 恢复的成组覆盖；V2 也缺失败视觉和清图测试。

## 建议实现口径：方案 A（最小 V2 接入）

- 不改 API、Node、stub、共享 reducer 的业务状态枚举或现有恢复规则。
- V2 透传并渲染已有错误标记：错误状态使用红色文字；忙态仍显示“测试中…”/“重置中…”，连续失败达到阈值后在同一行追加次要文案“重试中”，恢复后自动消失。
- Start 与 ReInit 点击都立即把单地图和矩阵置为 Initial；只有该次新 Start 收到首个完整点后解除置空。若 POST、`execute fail`、结果不完整或 `CONTROL_BUSY` 终止本轮，继续保持 Initial，绝不回闪目标侧旧结果或另一侧历史地图。
- 底栏另一侧已完成的历史、KPI 和回溯继续保留；失败目标侧只开放共享规则允许的同侧 Start/ReInit。
- `CONTROL_BUSY` 沿用现状：只作为共享控制冲突记录，不冒充“文件服务器连接异常”，不自动重试、不排队，也不新增专用弹窗/Toast。方案 A 不新增一套 control-busy UI 状态。

## 2026-08-25 实施记录

方案 A 已落地，并于 2026-08-25 获用户人工验收通过。

### 修改文件

- `code/web/src/cases/case3-v2/components/PointBeamReplay.tsx`
- `code/web/src/cases/case3-v2/components/BottomDock.tsx`
- `code/web/src/cases/case3-v2/v2SideStatus.ts`
- `code/web/src/cases/case3-v2/case3v2.css`
- `code/web/src/cases/case3-v2/Case3V2Page.tsx`
- `code/web/test/case3-v2/PointBeamReplay.test.tsx`
- `code/web/test/case3-v2/Case3V2Page.with.test.tsx`
- `code/web/test/case3-v2/Case3V2Page.failure.test.tsx`（新增）
- `code/web/test/case3/useCase3Controller.failure.test.ts`（新增）
- `code/web/e2e/case3-v2-reinit.spec.ts`
- `.scratch/case3-v2/issues/06-case3-v2-failure-recovery.md`（本文档）

未改 API / Node / stub / 共享 reducer 业务枚举。`code/comdatafiles/case_control.json` 为开始前已有运行态，未恢复、未暂存。

### 关键实现

- V2 行内状态透传 `withoutBadgeError` / `withBadgeError` / `withoutRetryHint` / `withRetryHint`。错误用 `#f87171`；忙态仍为“测试中…”/“重置中…”，`retryHint` 时同一行追加共享常量 `CASE3_ADAPTER_RETRY_HINT`（“重试中”）。忙态即使误传 error 也不变红。
- `case3V2StatusIsRunning` 覆盖“重置中”，与 Start 共用省略号和 `prefers-reduced-motion`。
- `mapHoldEmpty`：四个动作点击立即置空；`activeAction` 或 `failure` 时保持 Initial；仅该次 Start 的首个完整点解除置空。已出点后的 `execute fail` 也会重新置空，避免回闪另一侧历史。
- `mapCleared` 同步合并当前 action / failure 派生态，不等待 `useEffect` 才清图，避免失败切态时出现单帧历史回闪。
- `CONTROL_BUSY` 仍走共享 `CLEAR_ACTIVE`，不设 `adapterError`，无专用 UI。
- ReInit E2E 把“点击后 Initial”收敛为同一次 DOM 快照断言，避免多条异步断言跨过首点到达边界而产生假失败。

### 自动验证

在 `code/web`：

- `npm test -- --run` → **33 files / 258 tests passed**
- `npm run typecheck` → **passed**
- `npm run build` → **passed**
- `npm run test:e2e -- --workers=1 e2e/case3-mainline.spec.ts e2e/case3-v2-without.spec.ts e2e/case3-v2-with.spec.ts e2e/case3-v2-reinit.spec.ts` → **5 passed**

仓库根目录：`git diff --check` 无输出。验证完成时尚未提交、未 push。

E2E 曾改写 `code/back/.env` 为隔离共享目录；已按 HEAD 恢复（该文件开始前相对 HEAD 干净）。`case_control.json` 开始前即已脏，保持不动。

已有共享测试未复制：

- `useCase3Controller.lifecycle.test.ts`：`动作中单次 control GET 失败不置 adapterError`；`动作中连续 3 次 control GET 失败才 adapterError，成功一次清除且不解 busy`
- `useCase3Controller.entry.test.ts`：`Start POST 成功后轮询看到 fail 进入失败态`
- `selectCase3Presentation.test.ts` / `case3Reducer.test.ts`：徽标错误样式与忙态重试中语义

### 人工验收记录

用户于 2026-08-25 手动验证以下关键异常路径并确认符合预期、允许提交：

- 业务 `execute fail` 后进入失败状态，目标侧数据、地图和矩阵按约定回退。
- `case complete` 后最终数据不完整，达到门槛后显示“结果不完整已自动回退”，释放本轮并允许恢复。

连接中断、`CONTROL_BUSY`、连续轮询失败和 generation 隔离继续以自动测试作为主证据；本次未把未执行的手工步骤写成已验证事实。

### 可选扩展人工检查

1. 使用 `CASE3_STUB_OUTCOME=fail` 分别触发 Start、ReInit：确认失败侧红色“执行失败”或“重置失败”，地图/矩阵为空，只能点击同侧恢复按钮。
2. 停止适配服务后点击 Start/ReInit：确认显示红色“case3文件服务器连接异常”，不显示“执行失败/重置失败”，地图/矩阵不回闪旧结果。
3. 正常运行中短暂停止适配服务直至达到阈值：确认已绘制地图、矩阵和实时数据不被清空，并出现“重试中”；恢复适配服务后提示消失且本轮继续。
4. 结果不完整、`CONTROL_BUSY`、陈旧响应隔离由自动测试作为主证据；人工只复核页面无弹窗、Toast 或整页错误。

## 验收方法

### 自动检查（必须全过）

1. V2 组件测试：四类错误文案为红色；忙态连接异常显示“测试中…/重置中…”和“重试中”，恢复后提示消失。
2. V2 页面测试：Start/ReInit 点击立即清地图和矩阵；Start/ReInit `execute fail`、POST 失败、结果不完整、`CONTROL_BUSY` 后仍保持 Initial；重试首个完整点到达后才恢复绘制。
3. 共享 controller 测试：POST 普通失败与 `CONTROL_BUSY` 分类正确、无自动重发；连续 1～2 次轮询失败保留实时数据，第 3 次显示重试提示，成功一次即清提示且本轮继续；失败后重试使用新 generation，旧响应不能落入新轮。
4. 回归：现有 Case3 主线、V2 Without/With/ReInit E2E、Vitest、typecheck、build 与 `git diff --check` 全通过。

### 人工检查（聚焦视觉，不手工伪造全部技术分支）

1. 使用 `CASE3_STUB_OUTCOME=fail` 分别触发 Start、ReInit：确认失败侧红色“执行失败”或“重置失败”，地图/矩阵为空，只能点击同侧恢复按钮。
2. 停止适配服务后点击 Start/ReInit：确认显示红色“case3文件服务器连接异常”，不显示“执行失败/重置失败”，地图/矩阵不回闪旧结果。
3. 正常运行中短暂停止适配服务直至达到阈值：确认已绘制地图、矩阵和实时数据不被清空，并出现“重试中”；恢复适配服务后提示消失且本轮继续。
4. 结果不完整、`CONTROL_BUSY`、陈旧响应隔离由自动测试作为主证据；人工只复核页面无弹窗、Toast 或整页错误。

## 停止条件

- 自动检查全部通过，用户完成关键失败/自动回退路径人工验收并允许提交；其余技术异常分支以自动测试为主证据。不顺带改连接重试阈值、业务命令重试、控制队列、API 契约或旧 Case3 皮肤。
