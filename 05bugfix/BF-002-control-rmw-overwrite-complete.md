# BF-002 适配服务：清 flag 整文件写可能盖掉 case complete

- Status: open
- Severity: P0
- Area: `code/server` 共享控制文件
- 一次只修这一条

## 现象

后端已写 `status=case complete`，Web 却一直停在「测试中」，Calibrated / Case3 终态读不到。适配服务日志里可能出现截图成功后的控制写。

## 为何重要

`doc/case2/SERVER-SPEC.md` 已要求：截图清零 **不得改写 `status`**，且必须在共享队列内 **重读最新控制**。当前实现仍是「读整份 → 合并 patch → 整文件原子写」。后端不走适配服务队列，读与写之间的窗口可以把后端终态盖回去。

## 机制

1. 适配服务读到 `status=execute success, save_picture_flag=1`
2. 后端写入 `status=case complete, save_picture_flag=1`
3. 适配服务按步骤 1 的快照写回 `status=execute success, save_picture_flag=0`

`status` 被倒退，Web 等不到完成门沿。

## 关键代码

- `code/server/src/shared/control-file-store.mjs`：`update()` 读-改-写
- `code/server/src/shared/png-screenshot.mjs`：保存成功后 `clearPictureFlag()`
- Case2/Case3 `clearPictureFlag` / `{save_picture_flag:0}` HTTP 路径

## 建议修法

在共享队列内清 flag 时：

- 写前再读一次最新文档；
- 只改 `save_picture_flag`，**保留刚读到的 `status` 及其余字段**；
- 若 ownership 已变（不是本 Case 的 start 截图）→ `409 SCREENSHOT_NOT_REQUESTED`，不要用陈旧快照写回；
- 最好对「读到的 `status` + command 元组」做冲突重试（短次数），避免盖掉 `case complete`。

不要引入版本字段/manifest 去要求真实后端配合，除非现有契约已有该字段。

## 验收

- [ ] 单测：读时 `execute success`，写前文件已变成 `case complete`，清 flag 后磁盘上仍是 `case complete` 且 `save_picture_flag=0`。
- [ ] 清 flag 仍不改未知字段。
- [ ] ownership 不匹配仍 409，不写脏文件。
- [ ] Case2 / Case3 截图成功路径都覆盖。

## 测试入口

`code/server` 控制文件 store / screenshot 单测。对照 `doc/case2/SERVER-SPEC.md` § 截图清零。
