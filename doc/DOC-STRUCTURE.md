# 文档分层

| 位置 | 放什么 | 不放什么 |
|---|---|---|
| `AGENTS.md` | 全项目长期约束、已确认边界、禁止继承项 | case2 完整算法或接口逐字段定义 |
| `state.md` | 当前 Gate、焦点、风险、下一步、文档链接 | 可复制的完整契约或实现细节 |
| `doc/PHASE0-SCOPE.md` | 范围、主线、数据真实性、状态权属、明确不做 | Gate 1 视觉细节或 Gate 2 字段表 |
| `doc/DELIVERY-PLAN.md` | case 开发顺序、项目级阶段与跨 case 验收 | 单个 case 的字段或视觉细节 |
| `doc/ARCHITECTURE-DRAFT.md` | Shell/适配服务/后端的责任边界 | 端口、代码目录、锁实现、REST 实现细节 |
| `doc/CASE-STORY-MATRIX.md` | case 顺序、简短故事、Gate 索引 | 未启动 case 的假想业务语义 |
| `doc/case2/`（已启动） | case2 主线、UX 状态、设计分析/计划、设计冻结、静态验收、API 契约、UI 数据来源反查、SPEC、QA | 其他 case 的业务细节 |
| `03-design/case2/`（Pencil 创建后） | case2 `.pen` 与设计源同级验证产物 | 运行时代码、共享契约 |
| `doc/case2/API-CONTRACT.md`（Gate 2） | case2 文件控制、结果发布、适配服务 REST、字段、异常和重放合同 | 项目级共享协议或其他 case 字段 |
| `doc/case2/API-CONTRACT-REVIEW.md`（Gate 2） | case2 契约中的修/跳/待确认与 Gate 2 批准条件 | 具体 Node/React 实现方案 |
| `doc/case2/BACKEND-API-HANDOFF.md`（真实后端交接） | case2 后端所需接口表、时序、错误形状、检查清单 | Gate 记录、打桩实现、测试命令和 AI 施工过程 |
| `doc/case2/SERVER-SPEC.md` / `WEB-SPEC.md`（Gate 3） | Node 适配服务、开发打桩与正式 Web 的施工边界、测试和验收 | 真实后端团队必须实现的新接口语义 |

## 三轨资源纪律

1. 设计源：Gate 1 冻结使用；UX PNG 是输入，不是最终契约。
2. 静态原型：Gate 1.5 视觉验收使用；不得接共享目录或正式状态机。
3. 运行资源：正式 Web 只依赖稳定的运行时资源路径；`04-runtime-assets/shell/` 归 Shell，`04-runtime-assets/caseN/` 归各 case；不得直接引用 UX 输入或静态验收目录。

## 当前入口

- 范围与主线：`doc/PHASE0-SCOPE.md`
- 共享边界：`doc/ARCHITECTURE-DRAFT.md`
- case 排期：`doc/CASE-STORY-MATRIX.md`
- 当前事实与风险：`state.md`
- case2 业务入口：`doc/case2/MAINLINE.md`

## 创建规则

- case2 Gate 2 契约 v1 已批准，Gate 3 已创建 `doc/case2/SERVER-SPEC.md` 与 `doc/case2/WEB-SPEC.md`；QA 文档留到 Gate 5。
- `03-design/case2/` 只在目标 `.pen` 路径经用户确认、准备进入 Pencil Phase 3 时创建。
- API、施工、QA 文档仅在对应 Gate 获批准后创建；不为“以后可能需要”预建空文档。
- 行为变化必须同步更新相关 case 文档和 `state.md`。
