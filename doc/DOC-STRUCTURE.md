# 文档分层

| 位置 | 放什么 | 不放什么 |
|---|---|---|
| `AGENTS.md` | 全项目长期约束、已确认边界、禁止继承项 | case2 完整算法或接口逐字段定义 |
| `state.md` | 当前 Gate、焦点、风险、下一步、文档链接 | 可复制的完整契约或实现细节 |
| `doc/PHASE0-SCOPE.md` | 范围、主线、数据真实性、状态权属、明确不做 | Gate 1 视觉细节或 Gate 2 字段表 |
| `doc/DELIVERY-PLAN.md` | case 开发顺序、项目级阶段与跨 case 验收 | 单个 case 的字段或视觉细节 |
| `doc/ARCHITECTURE-DRAFT.md` | Shell/适配服务/后端的责任边界 | 端口、代码目录、锁实现、REST 实现细节 |
| `doc/CASE2-CASE3-TECHNICAL-PRIMER.md` | 面向负责人/演示/联调的 case2/case3 技术掌握讲义、状态机速记、排障入口 | 逐行代码解释、替代 API 契约、真实后端未验收结论 |
| `doc/CASE-STORY-MATRIX.md` | case 顺序、简短故事、Gate 索引 | 未启动 case 的假想业务语义 |
| `doc/case2/`（已启动） | case2 主线、UX 状态、设计分析/计划、设计冻结、静态验收、API 契约、UI 数据来源反查、SPEC、QA、复盘 | 其他 case 的业务细节 |
| `doc/case3/`（已完成本地开发） | case3 主线、UX 状态、设计冻结、静态验收、API 契约、UI 数据来源反查、SPEC、QA、真实后端交接 | case2 指标语义、JSONL 草案冒充正式协议、打桩结果冒充真实采集 |
| `03-design/case2/`（Pencil 创建后） | case2 `.pen` 与设计源同级验证产物 | 运行时代码、共享契约 |
| `doc/case2/API-CONTRACT.md`（Gate 2） | case2 文件控制、结果发布、适配服务 REST、字段、异常和重放合同 | 项目级共享协议或其他 case 字段 |
| `doc/case2/API-CONTRACT-REVIEW.md`（Gate 2） | case2 契约中的修/跳/待确认与 Gate 2 批准条件 | 具体 Node/React 实现方案 |
| `doc/case2/BACKEND-API-HANDOFF.md`（真实后端交接） | case2 后端所需接口表、时序、错误形状、检查清单 | Gate 记录、打桩实现、测试命令和 AI 施工过程 |
| `doc/case2/SERVER-SPEC.md` / `WEB-SPEC.md`（Gate 3） | 前端 PC 文件适配服务与正式 Web 的施工边界、测试和验收 | 真实后端团队必须实现的新接口语义；模拟后端打桩见 `realback_no.md` |
| `doc/case2/realback_no.md` | 本地无真实后端时的模拟打桩行为（非真实后端合同） | 适配服务 REST / 截图落盘算法 |
| `doc/case2/QA-EVIDENCE.md` | 本地自动测试、人工联调、截图输出、残余风险 | 未验证的真实后端或真实挂载结论 |
| `doc/case2/RETRO-METHOD.md` | case2 可复用流程、检查清单、下一 case 复用边界 | 具体实现代码或新的业务契约 |

## case4 文档落点

- `doc/case4/PHASE0-SCOPE.md`：用户明确范围、演示主线、职责及数据真实性。
- `doc/case4/UX-STATE-MAP.md`：三态展示意图、图片差异及设计交接依据。
- `doc/case4/INPUT-AND-OPEN-QUESTIONS.md`：接口样本、UI 数据映射与未决事项，不代替冻结契约。
- `03-design/case4/`：由用户安排 Cursor 处理 Pencil；设计文件存在不等于冻结。
- case4 当前 Gate 与下一步只在 `state.md` 记录；后续契约/SPEC/QA 按对应阶段补齐。

## 三轨资源纪律

1. 设计源：Gate 1 冻结使用；UX PNG 是输入，不是最终契约。
2. 静态原型：Gate 1.5 视觉验收使用；不得接共享目录或正式状态机。
3. 运行资源：正式 Web 只依赖稳定的运行时资源路径；`04-runtime-assets/shell/` 归 Shell，`04-runtime-assets/caseN/` 归各 case；不得直接引用 UX 输入或静态验收目录。

## 当前入口

- 范围与主线：`doc/PHASE0-SCOPE.md`
- 共享边界：`doc/ARCHITECTURE-DRAFT.md`
- 技术掌握讲义：`doc/CASE2-CASE3-TECHNICAL-PRIMER.md`
- case 排期：`doc/CASE-STORY-MATRIX.md`
- 当前事实与风险：`state.md`
- case2 业务入口：`doc/case2/MAINLINE.md`
- case3 业务入口：`doc/case3/MAINLINE.md`
- case4 业务入口：`doc/case4/PHASE0-SCOPE.md`

## 创建规则

- case2 Gate 5 本地 QA 证据已创建；后续真实后端/真实挂载验收若发生，应追加到 `doc/case2/QA-EVIDENCE.md`，不得覆盖本地打桩记录。
- case3 已完成本地开发；后续若接真实后端/真实挂载，应追加 `doc/case3/QA-EVIDENCE.md` 的真实环境记录，不覆盖本地打桩证据。
- `03-design/case2/` 只在目标 `.pen` 路径经用户确认、准备进入 Pencil Phase 3 时创建。
- API、施工、QA 文档仅在对应 Gate 获批准后创建；不为“以后可能需要”预建空文档。
- 行为变化必须同步更新相关 case 文档和 `state.md`。
