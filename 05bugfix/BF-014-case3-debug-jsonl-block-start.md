# BF-014 Case3：调试 JSONL 清空失败会挡住 Start/ReInit

- Status: open
- Severity: P1
- Area: `code/server` Case3
- 一次只修这一条

## 现象

`writeIfChanged` 失败只 warn，不影响 REST。但 `clear()` 失败会让 `clearSide` → `SIDE_CLEAR_FAILED`，控制文件不推进，业务命令发不出去。调试镜像不应成为开轮硬依赖。

## 关键代码

- `code/server/src/cases/case3/debug-jsonl.mjs`：`clear()` vs `writeIfChanged()`
- `code/server/src/cases/case3/control-file.mjs`：start/reinit `beforeWrite` 里的 `clearSide`

## 建议修法

`clear()` 与 `writeIfChanged` 一样：失败打 warn，不抛给控制路径。侧业务 txt 清空失败仍应挡住开轮（那是真数据，不要和 JSONL 混在一起放宽）。

## 验收

- [ ] JSONL 目录只读/rename 失败：start 控制写仍 200，侧 txt 仍被清空。
- [ ] 侧 txt 清空失败：仍 500，控制不推进。
- [ ] 单测覆盖。
