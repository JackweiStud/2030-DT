# BF-009 Case2：CONTROL_BUSY 被当成连接异常

- Status: done
- Severity: P1
- Area: `code/web` Case2
- 落地：2026-08-13。只改 Case2 Web 对 `CONTROL_BUSY` 的 POST 失败分流；未改 `canReset`、Server busy 判定、未加自动重试队列。

## 0. 结论速览

| 问题 | 结论 |
| --- | --- |
| 问题是什么 | Case2 Start/Reset 收到合法业务码 `409 CONTROL_BUSY` 时，UI 误报「case2文件服务器连接异常」 |
| 还存在吗 | **已修** |
| 修法 | catch 识别 `Case2ApiError.code === "CONTROL_BUSY"` → `COMMAND_CONTROL_BUSY`：回滚点击前相、`adapterError=false`；无新可见徽标 |
| 用例 | ✅ reducer + controller Start/Reset busy + 真连接失败回归 |

---

## 1. 原问题（已关闭）

共享控制文件被占用时，Node 正确返回 `409 CONTROL_BUSY`。Case2 API 已保码，但 controller catch 一律 `*_POST_FAIL` → reducer `adapterError=true` → 误报连接异常并可能开 5s probe。

根因：Case2 未区分「控制文件忙」与「适配连接失败」。Case3 此前已有专用分支。

### 触发场景（修前）

- Case3 占用控制文件时 Case2 点启动
- Case2 终态未消费 / 未写回 init（多窗口、脚本、异常路径）
- 并发第二命令

### 修前时序

```text
乐观 calibrating/resetting → POST 409 → 无分流 → *_POST_FAIL → adapterError
→ 「文件服务器连接异常」+ 按钮双禁（initial 时还开 probe）
```

---

## 2. 落地改动

| 文件 | 改动 |
| --- | --- |
| `code/web/src/cases/case2/state/case2Reducer.ts` | 新增 `COMMAND_CONTROL_BUSY`：回滚 `phaseBeforeCommand`，`adapterError=false`，保留 calibratedData |
| `code/web/src/cases/case2/hooks/useCase2Controller.ts` | `onStart`/`onReset` catch 分流 `CONTROL_BUSY` → warn `command.control_busy` + 上述 action |
| `code/web/test/case2Reducer.test.ts` | busy 回滚且不置 adapterError（含 Reset 保留 completed） |
| `code/web/test/useCase2Controller.entry.test.ts` | Start/Reset 遇 busy；Start 真 `TypeError` 仍 adapterError |
| `doc/case2/WEB-SPEC.md` | §6.1 / §6.2 及旁路表：`CONTROL_BUSY` 例外口径 |

### 修后时序

```text
T0  用户点 Case2 启动/重置
T1  Web 乐观进入 calibrating/resetting
T2  POST 返回 409 CONTROL_BUSY
T3  controller 识别 Case2ApiError.code
T4  dispatch COMMAND_CONTROL_BUSY
T5  UI 回到点击前相；adapterError=false
T6  不显示连接异常；不开 adapter probe
T7  占用释放后可再次点击
```

---

## 3. 验收

- [x] Case2 Start 遇 `409 CONTROL_BUSY`：无连接异常文案、无 adapter probe，回到 `initial`，启动可再点
- [x] Case2 Reset 遇 `409 CONTROL_BUSY`：无连接异常文案，回到 `completed`，保留 Calibrated
- [x] 真网络失败（`TypeError`）：仍走 `START_POST_FAIL` +「case2文件服务器连接异常」
- [x] Case3 `CONTROL_BUSY` 分支未改
- [x] Server `assertCommandAvailable` 未改
- [x] 单测：`vitest run test/case2Reducer.test.ts test/useCase2Controller.entry.test.ts` 通过

---

## 相关工单

- BF-023：完成态过早点重置（已 done）；本单未改 `canReset`
- BF-006 / BF-011 / BF-012：正交，未混修
- BF-004：Case3 CONTROL_BUSY 对照实现
