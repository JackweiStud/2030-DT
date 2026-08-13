# BF-007 截图 rename 无瞬时锁重试

- Status: open
- Severity: P1
- Area: `code/server` 共享截图
- 一次只修这一条

## 现象

Windows / 共享盘上控制文件写入已对 `EPERM`/`EACCES`/`EBUSY` 做 rename 重试；截图 PNG 的 `rename` 仍只试一次，失败 → `SCREENSHOT_SAVE_FAILED`。Web 重试可能再占一个序号。

## 关键代码

- `code/server/src/shared/png-screenshot.mjs`：约 141 行 `fsOps.rename(temporaryPath, finalPath)`
- 对照：`code/server/src/shared/atomic-write.mjs` 的 `renameWithRetry`（默认 8 次、间隔 25ms，瞬时失败打 warn）

## 建议修法

截图最终 rename 复用同一套瞬时锁重试（含 logger）。不要改序号算法、不要改 PNG 校验。

Case2 清空六个 Calibrated 的 `writeFile("")` **不要**在本工单顺手改（见 BF-015）。

## 验收

- [ ] 单测：第一次 rename `EPERM`，第二次成功，截图 200 且清 flag。
- [ ] 重试耗尽仍 `SCREENSHOT_SAVE_FAILED`，临时文件被删。
- [ ] 成功日志仍有 path/seq。
