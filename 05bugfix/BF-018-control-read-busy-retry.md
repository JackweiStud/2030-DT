# BF-018 控制文件读不对 EBUSY 做短重试

- Status: open
- Severity: P2
- Area: `code/server` 控制文件
- 一次只修这一条

## 现象

`readControlDocument` 只对 JSON/形状/`ERR_ENCODING_INVALID_ENCODED_DATA` 重试 3 次。共享盘瞬时 `EBUSY`/`EAGAIN`/`EACCES` 直接 `CONTROL_READ_FAILED`。控制写的 rename 已有锁重试，读侧没有，轮询会被抖成 500。

## 关键代码

- `code/server/src/shared/control-file-store.mjs`：约 58–75

## 建议修法

对 `EBUSY`/`EAGAIN`/`EACCES`（以及现有 parse 瞬时错误）做短重试，次数/间隔与 rename 或现有 50ms×3 对齐。重试耗尽再 500。打 warn 需带 code/attempt。

## 验收

- [ ] 第一次 read EBUSY、第二次成功 → GET control 200。
- [ ] 非瞬时错误（ENOENT）不重试或按现有语义快速失败。
- [ ] 单测覆盖。
