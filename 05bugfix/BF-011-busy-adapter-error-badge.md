# BF-011 忙态中连接失败盖住「测试中」

- Status: open
- Severity: P1
- Area: `code/web` Case2 + Case3
- 一次只修这一条（两边徽标选择器一起改，保持文案一致）

## 现象

测试/重置进行中若单次 control GET 失败：

- Case2：`adapterError` 优先，徽标变成「case2文件服务器连接异常」；`statusBusy` 因 `adapterError` 为 false，省略号停掉。轮询其实还在，Tab 仍锁。
- Case3：`sideStatusBadge` 同样 adapter 文案优先，busy 省略号因 badge 不再是「测试中」而停。

演示看起来像已经失败，其实后端可能仍在跑。

## 关键代码

- `code/web/src/cases/case2/state/case2Reducer.ts`：`statusFeedbackText`
- `code/web/src/cases/case2/Case2Page.tsx`：`statusBusy`
- `code/web/src/cases/case3/state/case3Reducer.ts`：`sideStatusBadge` / `sideStatusBadgeIsError`
- `code/web/src/cases/case3/components/SidePanel.tsx`：`isBusyBadge`

## 建议修法

忙态（calibrating/resetting/activeAction）时保留「测试中/重置中」+ busy 样式；连接问题用次要文案或 title（例如「连接重试中」），不要拆掉 `is-busy`。恢复后去掉次要文案。

不要在忙态因一次 poll 失败就解 Tab 锁或自动撤权。

## 验收

- [ ] calibrating 期间 poll 失败：仍显示测试中/省略号，Tab 仍锁。
- [ ] poll 恢复：adapterError 清除，文案恢复正常忙态或完成态。
- [ ] idle 下的连接失败仍显示连接异常并禁用按钮（Case2 已有；Case3 见 BF-004）。
