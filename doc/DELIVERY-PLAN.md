# 交付计划

## 顺序

| 阶段 | Case | 目标 | 进入条件 | 项目级回归 |
|---|---|---|---|---|
| 当前 | case2 / DT Calibration | 本地打桩闭环已完成；保留真实后端/真实挂载验收入口 | Gate 4 三端实现完成，自动测试与人工联调通过 | Shell 视觉基线、1920×1080 缩放、其他 Tab 占位、case2 单活跃生命周期 |
| 当前新增 | case3 / DT for Comm | 完成 Gate 0/2 草案，锁定多 txt -> Node normalized point model、单侧重置、动态 N 与 Cost(%) | 用户已确认主线和 8 条关键契约边界 | Shell 单活跃、CSS 作用域、Node 适配服务可扩展性 |
| 后续 | case4 | 完成 Gate 0，并判断派生复用或独立业务 | case2/case3 的 Shell/文档/验收节奏已有证据 | 全 Tab 视觉冒烟、CSS 作用域、单活跃生命周期 |
| 最后 | case1 | 独立完成自身 Gate 0 至 Gate 5 | 业务故事与材料已提供 | 同上 |

case3 已进入草案阶段；case4 的业务主线和复用判断尚未提供，不提前创建空壳文档。

## case2 交付节奏

1. Gate 1 已完成：`case2-dt-calibration.pen` 的 initial、calibrating、completed Pencil frame 已冻结；failed 为后续 HTML 视觉派生态，边界见 `Freeze_Note.md`。
2. Gate 1.5 已完成：四态静态 HTML 已由用户人工检查接受，Shell 与 case2 运行资源已按所有权拆分。
3. Gate 2 已完成：API 契约 v1、数据来源清单与后端交接文档已冻结。
4. Gate 3 已完成：`SERVER-SPEC.md`、`WEB-SPEC.md` 与 `realback_no.md` 已定稿。
5. Gate 4 已完成本地实现：`code/web/` 正式 Web、`code/server/` Node 文件适配服务、`code/back/case2/` 模拟后端打桩均已落地。
6. Gate 5 本地证据已补齐：自动测试、本地 build、用户人工联调与截图输出见 `doc/case2/QA-EVIDENCE.md`；真实后端/真实挂载验收仍是后续外部环境事项。

## case3 当前节奏

1. Gate 0 草案：主线为 Without DT 通信基线 -> With DT 数字孪生辅助通信 -> Cost/Throughput/Beam Accuracy 对比。
2. Gate 2 草案：正式后端文件层先沿用多 txt；Node `/api/case3/*` 收编为结构化点位；Web 主路径 `GET /api/case3/side` 单侧全量快照（points + costPct）；调试 JSONL 整文件替换落盘 `out/case3/points/`。
3. 进入实现前仍需：Gate 1 设计源冻结、Gate 2 契约批准、Gate 3 `SERVER-SPEC.md` / `WEB-SPEC.md`。

## 项目级停止规则

- 不因 case2 已推进而推测 case1/3/4 的字段、状态或视觉。
- 未取得目标 case 的 Gate 1 人工冻结前，不进入 Gate 1.5 或正式 Web 实现。
- 每个 case Gate 变化后，必须同步 `state.md` 与 `CASE-STORY-MATRIX.md`。
- case2 本地打桩结果不得表述为真实业务采集结果；真实后端接入后需新增 QA 证据再关闭真实环境验收。
