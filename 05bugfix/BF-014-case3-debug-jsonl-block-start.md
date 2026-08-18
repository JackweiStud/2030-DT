# BF-014 Case3：调试 JSONL 清空失败会挡住 Start/ReInit

- Status: deferred（先不处理）
- Severity: P2（原 P1，2026-08-18 用户降级）
- Area: `code/server` Case3
- 一次只修这一条（若升级再修）
- 排查：2026-08-18，代码缺口仍在。用户判定：Web 与 Node **同机**（Chrome → `127.0.0.1:3102`，共享根本地 `comdatafiles`），`out/case3/points` 默认可写，`clear()` 失败**极低**；降级、先不处理。不改代码。不要把本条写进 `doc/` 当契约。

## 1. 这个问题还存在么

**存在。** 调试 JSONL 不是业务结果，却被绑进开轮硬路径。

| 面 | 现状 |
| --- | --- |
| 点位镜像写入 | `writeIfChanged` 失败只 `warn`，REST 仍成功 |
| 开轮清空 | `clear()` 失败会抛出 → `clearSide` → `SIDE_CLEAR_FAILED` 500，控制文件不推进 |

每次 Case3 Start/ReInit 的 `beforeWrite` 都会走 `clearSide` → `debugJsonl.clear()`（`mkdir` + 把 `{DT_SHARED_DIR}/out/case3/points/{side}.jsonl` 原子换成空文件）。侧业务 txt 清空失败仍应挡住开轮；JSONL 失败本不该。

## 2. 什么场景出现

要炸必须是这次本地写 JSONL 失败，例如：

- `out/` 或 `out/case3/points` 只读，但 `case3/` 业务 txt 仍可写（人工 chmod / 把 `out` 建成普通文件）
- 磁盘满、配额用尽（这时侧 txt、控制写也往往会一起挂）

**同机前提下，这些都不是常规演示条件。** 共享根与控制文件、Case3 侧 txt 同一块可写盘；目录不存在时 `mkdir({ recursive: true })` 会建出来。没有「点一次启动、JSONL 就容易失败」的机制，也不是 loopback 会断。

Windows/SMB 上文件锁更接近 BF-007，不是本场 Web+Node 共主机口径。

```text
T0  点 Case3 Start / ReInit
T1  beforeWrite → 侧 txt 清空成功
T2  debugJsonl.clear() 抛错（目录只读 / rename 失败）
T3  SIDE_CLEAR_FAILED 500，command 未写出，status 仍是旧值
T4  画面：启动失败；调试镜像本可丢，业务开轮却被挡住
```

## 3. 出现后的问题是什么

若真走到：Case3 点启动/重置直接 500，本轮命令发不出去。伤的是开轮，不是 Web 回读（Web 本来就不读 JSONL）。

共主机健康目录上**几乎不会被点到**。逻辑上成立，不能当演示主路径必现。

## 4. 后续可选修改（升级时再做，当前不落地）

`clear()` 与 `writeIfChanged` 一样：失败打 warn，不抛给控制路径。侧业务 txt 清空失败仍 500，控制不推进。不要把两种失败混在一起放宽。

验收（仅升级时）：

- [ ] JSONL 目录只读/rename 失败：start 控制写仍 200，侧 txt 仍被清空。
- [ ] 侧 txt 清空失败：仍 500，控制不推进。
- [ ] 单测覆盖。

## 关键代码

- `code/server/src/cases/case3/debug-jsonl.mjs`：`clear()` vs `writeIfChanged()`
- `code/server/src/cases/case3/control-file.mjs`：start/reinit `beforeWrite` 里的 `clearSide`

## 升级条件

- 现场复现：`out/case3/points` 写失败挡住 Start/ReInit。
- 演示机把 `out/` 与 `case3/` 分成不同权限。
- 改到真实挂载 / Windows 共享盘，JSONL rename 开始出现瞬时锁。
