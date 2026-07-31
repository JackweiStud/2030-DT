# 交付计划

## 顺序

| 阶段 | Case | 目标 | 进入条件 | 项目级回归 |
|---|---|---|---|---|
| 当前 | case2 / DT Calibration | 建立设计冻结、静态验收和文件适配契约基线 | Gate 0 已批准 | Shell 视觉基线、1920×1080 缩放、其他 Tab 占位 |
| 后续 | case3、case4 | 各自完成 Gate 0，并判断派生复用或独立业务 | case2 的 Shell/文档/验收节奏已有证据 | 全 Tab 视觉冒烟、CSS 作用域、单活跃生命周期 |
| 最后 | case1 | 独立完成自身 Gate 0 至 Gate 5 | 业务故事与材料已提供 | 同上 |

case3 与 case4 的先后顺序、业务主线和复用判断尚未提供；不提前创建空壳文档。

## case2 Gate 1 节奏

1. Gate 1 已完成：`case2-dt-calibration.pen` 的 initial、calibrating、completed Pencil frame 已冻结；failed 为后续 HTML 视觉派生态，边界见 `Freeze_Note.md`。
2. Gate 1.5 已完成：四态静态 HTML 已由用户人工检查接受，Shell 与 case2 运行资源已按所有权拆分。
3. Gate 2 已获授权并开始：已起草 API 契约与数据来源清单；只确认文件控制、结果发布、重放和截图语义，不连接共享目录、不运行真实状态机、不实现 Node 适配服务。P0 外部事实确认并获用户批准 v1 后，才可进入 Gate 3。

## 项目级停止规则

- 不因 case2 已推进而推测 case1/3/4 的字段、状态或视觉。
- 未取得 case2 Gate 1 人工冻结前，不进入 Gate 1.5、Gate 2 或实现。
- 每个 case Gate 变化后，必须同步 `state.md` 与 `CASE-STORY-MATRIX.md`。
