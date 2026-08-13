# BF-016 Case2：刷新/关页缺少 keepalive init

- Status: open
- Severity: P2
- Area: `code/web` Case2
- 一次只修这一条

## 现象

Case3 在 `pagehide` 上 `POST {command:"init"}` + `keepalive`，尽量释放控制文件。Case2 只靠下次进页 handshake 才 init。刷新或关页后，后端窗口里会更久地看到未完成的 `start`/`reinit`。

## 关键代码

- Case3：`code/web/src/cases/case3/hooks/useCase3Controller.ts` 约 1283–1301
- Case2：无对等逻辑

## 建议修法

Case2 同样在 `pagehide`（或 `pagehide` + `visibility` 按现有 Case3 口径）best-effort POST init。失败只 warn。不要在 visibility hidden 时打断仍在前台的演示（只跟 Case3 已冻结行为对齐）。

进页 handshake 的 init 保留，作为 pagehide 失败的兜底。

## 验收

- [ ] 卸载/刷新路径会尝试 keepalive init。
- [ ] 失败不抛到 UI。
- [ ] 与 Case3 不要重复注册两次冲突逻辑。
