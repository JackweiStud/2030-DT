# 05bugfix — 2026-08-12 代码检视工单

来源：对 `code/web`、`code/server` 的一轮检视（功能 / 异常 / 安全 / 界面）。
范围只覆盖 **Case2、Case3、Shell、Node 适配服务**。不要把这里的条目写进 `doc/` 当已确认契约。

## Codex 怎么用

1. 打开本目录的索引表，按 **建议顺序** 从上往下取 **一条** `open` 工单。
2. 只读、只改该工单列出的文件与验收范围。禁止顺手重构、禁止改无关 Case、禁止把演示说成真实后端已验收。
3. 修完后：补/跑工单里的测试；把该工单文末 **Status** 改成 `done`，并在本 README 表里勾状态。
4. 若排查后确认不是缺陷（规格如此 / 已被别的工单覆盖），把 Status 改成 `wontfix` 或 `duplicate`，写清理由，不要硬改。
5. 一次一个工单。不要把 P0 和 UI 美化混在同一次提交。

## 约束（每条都适用）

- 业务 CSS 必须 `.caseN-page` 隔离；Shell 只拥有 Tab / 1920×1080 缩放 / 公共 token。
- 不做取消、命令队列、业务命令自动重试（截图有限重试除外）。
- 控制文件五个必填字段；`status` 终态只由后端写；适配服务 `start`/`reinit` 合并时清 `status=""`。
- 截图清 `save_picture_flag` **不得改写** `status`。
- 默认适配监听 `127.0.0.1:3102`；不要为修 bug 改成需要真实后端或真实挂载。

## 建议顺序

先 P0（演示会卡住或丢数据），再 P1，再 P2。UI 单独一轮，不要插在 P0 中间。

| 顺序 | ID | 严重度 | 区域 | 标题 | 状态 |
|---|---|---|---|---|---|
| 1 | [BF-001](BF-001-case2-waitclear-tab-lock.md) | P0 | web/case2 | 截图 `waitClear` + 停轮询 → Tab 永久锁 | ✅ done |
| 2 | [BF-023](BF-023-case2-reset-before-idle.md) | P0 | web/case2 | 完成瞬间重置可点，立即点击后报连接异常并卡死（用户复现） | ✅ done |
| 3 | [BF-002](BF-002-control-rmw-overwrite-complete.md) | P0 | server | 清 flag 的整文件写可能盖掉 `case complete` | ✅ done |
| 4 | [BF-003](BF-003-case2-calibrated-ownership.md) | P0 | server/case2 | Calibrated 读取只认 `status`、不认 case 归属 | open |
| 5 | [BF-004](BF-004-case3-optimistic-invalidate.md) | P0 | web/case3 | POST 失败前已清空本侧结果；连接异常仍可点按钮 | open |
| 6 | [BF-005](BF-005-case2-initial-error-ui.md) | P1 | web/case2 | Initial 加载失败无界面说明 | open |
| 7 | [BF-006](BF-006-case2-adapter-probe-idle.md) | P1 | web/case2 | 连接探活只覆盖 `initial`，失败态会锁死按钮 | open |
| 8 | [BF-007](BF-007-screenshot-rename-retry.md) | P1 | server | 截图 `rename` 无瞬时锁重试 | open |
| 9 | [BF-008](BF-008-http-timeout.md) | P1 | web | Case2 无请求超时；Case3 截图共用 5s | open |
| 10 | [BF-009](BF-009-control-busy-vs-adapter.md) | P1 | web/case2 | `CONTROL_BUSY` 被当成连接异常 | open |
| 11 | [BF-010](BF-010-case2-abort-screenshot-on-incomplete.md) | P1 | web/case2 | 结果不完整回退时未真正取消截图 | open |
| 12 | [BF-011](BF-011-busy-adapter-error-badge.md) | P1 | web | 忙态中连接失败盖住「测试中」 | open |
| 13 | [BF-012](BF-012-case2-poll-control-ownership.md) | P1 | web/case2 | 轮询不校验控制文件归属 | open |
| 14 | [BF-013](BF-013-case3-poll-fail-visible.md) | P1 | web/case3 | 轮询失败只打日志、用户无感知 | open |
| 15 | [BF-014](BF-014-case3-debug-jsonl-block-start.md) | P1 | server/case3 | 调试 JSONL 清空失败会挡住 Start/ReInit | open |
| 16 | [BF-015](BF-015-clear-files-then-control-write-fail.md) | P1 | server | 先清结果文件再写控制，写失败会留下空文件 | open |
| 17 | [BF-016](BF-016-case2-pagehide-init.md) | P2 | web/case2 | 刷新/关页缺少 keepalive `init` | open |
| 18 | [BF-017](BF-017-request-body-hang.md) | P2 | server | 超限 body 无限排空、无请求超时 | open |
| 19 | [BF-018](BF-018-control-read-busy-retry.md) | P2 | server | 控制文件读不对 `EBUSY` 做短重试 | open |
| 20 | [BF-019](BF-019-non-loopback-bind.md) | P2 | server | 绑定 `0.0.0.0` 无鉴权、启动无强警告 | open |
| 21 | [BF-020](BF-020-data-file-size-limit.md) | P2 | server | 数据文件无大小/行数上限 | open |
| 22 | [BF-021](BF-021-screenshot-flag-clear-fail.md) | P2 | server | PNG 已落盘但清 flag 失败缺少孤儿日志 | open |
| 23 | [BF-022](BF-022-control-get-sampler.md) | P2 | server | 控制 GET 降噪 key 不含 `command`/`case` | open |
| — | [BF-UI](BF-UI.md) | UI | web/shell | 界面美化与无障碍（可拆条做） | open |

## 不是本目录的事

- 真实后端、真实挂载、真实采集验收。
- case1 / case4 业务实现。
- 为修 bug 引入 `CASE2_DATA_MODE`、manifest、batch_id、原子目录切换。
