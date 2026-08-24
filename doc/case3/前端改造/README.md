# case3 前端改造

本目录是 case3 **新 UX 改造** 的现行说明，不是已冻结的 Gate 2 契约。

## 已锁定

- 路径 **B**：新 Pencil → Gate 1.5 静态 HTML → React。
- 业务脑不动：`/api/case3/*`、reducer、controller、Node、打桩默认不改。case2 业务页不改。
- 开发期临时 Tab **`case5`**，文案 **`DT for Comm new`**；现有 `DT for Comm` 业务区保持旧皮。两边都走 case3 接口。稳定后合回 case3，删除 case5。
- 新 UX 源：`02-ux/case3-V1/`。P1 已完成。P2 分析/计划见 `03-design/case3V1/`；设计源 `case3V1-dt-com.pen`。
- P3 Gate 1.5：`web-static/case3-v2/index.html` 像素基准已 YES；`case3-v2.html` 工程底稿已于 2026-08-24 人工视觉 YES。验收记录见 [`../STATIC-HTML-ACCEPTANCE-v2.md`](../STATIC-HTML-ACCEPTANCE-v2.md)。下一步 P4 React 新皮。

## 本目录文件

| 文件 | 用途 |
|---|---|
| [00-决策与行动路线.md](00-决策与行动路线.md) | 现行决策 + 分阶段路线 |
| [01-现状-业务逻辑与状态机.md](01-现状-业务逻辑与状态机.md) | 改造前业务脑基线 |
| [02-新旧对照.md](02-新旧对照.md) | 已按 `02-ux/case3-V1` 填写的保留/换皮/删除/新增 |

契约与旧视觉档案仍在 `doc/case3/`、`03-design/case3/`，不搬进本目录。
