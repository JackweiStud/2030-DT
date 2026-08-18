# case3 前端改造

本目录是 case3 **新 UX 改造** 的现行说明，不是已冻结的 Gate 2 契约。

## 已锁定

- 路径 **B**：新 Pencil → Gate 1.5 静态 HTML → React。
- 业务脑不动：`/api/case3/*`、reducer、controller、Node、打桩默认不改。
- 开发期临时 Tab **`case5`** 挂新皮；现有 `DT for Comm` 保持稳定旧皮。两边都走 case3 接口。稳定后合回 case3，删除 case5。
- 未拿到新 UX 源、未 YES 画 Pencil 前：不改设计源、静态页、Shell、正式 Web。

## 本目录文件

| 文件 | 用途 |
|---|---|
| [00-决策与行动路线.md](00-决策与行动路线.md) | 现行决策 + 分阶段路线 |
| [01-现状-业务逻辑与状态机.md](01-现状-业务逻辑与状态机.md) | 改造前业务脑基线 |
| [02-新旧对照.md](02-新旧对照.md) | 一致 / 会变 / 待新 UX 核验 |

契约与旧视觉档案仍在 `doc/case3/`、`03-design/case3/`，不搬进本目录。
