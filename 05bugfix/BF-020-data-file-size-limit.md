# BF-020 数据文件无大小/行数上限

- Status: open
- Severity: P2
- Area: `code/server` Case2 data-files / Case3 side + init-data
- 一次只修这一条

## 现象

整文件 `readFile`。共享根被写入超大 txt 时可打满适配进程内存。Case3 行数也可无限增长。这是防护，不是当前样本的功能 bug。

## 关键代码

- `code/server/src/cases/case2/data-files.mjs`
- `code/server/src/cases/case3/side-files.mjs`
- `code/server/src/cases/case3/init-data.mjs`

## 建议修法

stat 后超过上限（建议先定一个保守值，例如单文件数 MiB + Case3 最大完整行数）返回 413/422，不要读进内存。上限写进 SERVER-SPEC 或 README 一句即可，不要当成真实后端合同新字段。

现有参考样本必须仍能通过。

## 验收

- [ ] 现有 comdatafiles 样本 GET 仍 200。
- [ ] 超大文件（可用假 fs）被拒绝且不把整个内容 parse 完。
- [ ] 错误码稳定，Web 会走现有失败路径而不是挂死浏览器。
