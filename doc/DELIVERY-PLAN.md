# 交付计划

## 顺序

| 阶段 | Case | 目标 | 进入条件 | 项目级回归 |
|---|---|---|---|---|
| 当前 | case2 / DT Calibration | 建立设计冻结、静态验收和文件适配契约基线 | Gate 0 已批准 | Shell 视觉基线、1920×1080 缩放、其他 Tab 占位 |
| 后续 | case3、case4 | 各自完成 Gate 0，并判断派生复用或独立业务 | case2 的 Shell/文档/验收节奏已有证据 | 全 Tab 视觉冒烟、CSS 作用域、单活跃生命周期 |
| 最后 | case1 | 独立完成自身 Gate 0 至 Gate 5 | 业务故事与材料已提供 | 同上 |

case3 与 case4 的先后顺序、业务主线和复用判断尚未提供；不提前创建空壳文档。

## case2 Gate 1 节奏

1. Gate 1 已完成：用户确认 `03-design/case2/case2-dt-calibration.pen` 的四个 frame 符合预期，冻结证据见 `Freeze_Note.md`。
2. 下一步经授权进入 Gate 1.5：按冻结设计源制作静态 HTML 原型并逐状态截图验收。
3. Gate 1.5 不连接共享目录、不运行真实状态机、不实现 Node 适配服务。

## 项目级停止规则

- 不因 case2 已推进而推测 case1/3/4 的字段、状态或视觉。
- 未取得 case2 Gate 1 人工冻结前，不进入 Gate 1.5、Gate 2 或实现。
- 每个 case Gate 变化后，必须同步 `state.md` 与 `CASE-STORY-MATRIX.md`。
