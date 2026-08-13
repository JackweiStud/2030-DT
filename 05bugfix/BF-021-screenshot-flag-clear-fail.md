# BF-021 PNG 已落盘但清 flag 失败缺少孤儿日志

- Status: open
- Severity: P2
- Area: `code/server` 截图
- 一次只修这一条

## 现象

rename 成功后 `clearPictureFlag` 失败 → 500 `SCREENSHOT_SAVE_FAILED`。磁盘已有 PNG，flag 仍为 1。Web 重试会再写新序号。规格允许极端窗口丢/重图，但错误路径没有记下孤儿 PNG 的 path/seq，联调难查。

## 关键代码

- `code/server/src/shared/png-screenshot.mjs`：约 141–156

## 建议修法

清 flag 失败时 error 日志必须带 `path`、`seq`、`caseId`。可选：清 flag 做与控制写相同的短重试后再失败。不要为孤儿 PNG 做删除回滚（避免误删已给演示看过的图），除非你能证明安全。

## 验收

- [ ] 单测：rename 成功、clearFlag 抛错 → 500，日志字段含 seq/path。
- [ ] Web 重试仍按现有 3 次语义工作。
