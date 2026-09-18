# 交付计划

## 顺序

| 阶段 | Case | 目标 | 进入条件 | 项目级回归 |
|---|---|---|---|---|
| 已完成本地开发 | case2 / DT Calibration | 本地打桩闭环已完成；保留真实后端/真实挂载验收入口 | Gate 4 三端实现完成，自动测试与人工联调通过 | Shell 视觉基线、1920×1080 缩放、case2 单活跃生命周期 |
| 已完成本地开发 | case3 / DT for Comm | 完成正式 Web、Node 适配服务和本地模拟后端；保留真实后端/真实挂载验收入口 | Gate 1/1.5/2/3 均已冻结，Gate 4 三端实现完成，自动测试和本地打桩/前端隔离验证通过 | Shell 单活跃、CSS 作用域、共享 control、截图隔离、Node 适配服务多 case 扩展性 |
| 已完成本地开发 | case4 / DT for positioning | 除 3D 外功能已完成本地开发；保留真实后端/真实挂载验收入口 | Gate 1/1.5/2/3 已冻结，Gate 4 三端实现完成，2D Reflection / CEP / 悬停已落地 | Shell 单活跃、CSS 作用域、共享 control、截图隔离、反射不挡 `/result` |
| 最后 | case1 | 独立完成自身 Gate 0 至 Gate 5 | 业务故事与材料已提供 | 同上 |

case2、case3、case4 已完成本地开发闭环；case4 剩余产品功能仅 3D。case1 业务故事尚未提供，不提前创建空壳文档。

## case2 交付节奏

1. Gate 1 已完成：`case2-dt-calibration.pen` 的 initial、calibrating、completed Pencil frame 已冻结；failed 为后续 HTML 视觉派生态，边界见 `Freeze_Note.md`。
2. Gate 1.5 已完成：四态静态 HTML 已由用户人工检查接受，Shell 与 case2 运行资源已按所有权拆分。
3. Gate 2 已完成：API 契约 v1、数据来源清单与后端交接文档已冻结。
4. Gate 3 已完成：`SERVER-SPEC.md`、`WEB-SPEC.md` 与 `realback_no.md` 已定稿。
5. Gate 4 已完成本地实现：`code/web/` 正式 Web、`code/server/` Node 文件适配服务、`code/back/case2/` 模拟后端打桩均已落地。
6. Gate 5 本地证据已补齐：自动测试、本地 build、用户人工联调与截图输出见 `doc/case2/QA-EVIDENCE.md`；真实后端/真实挂载验收仍是后续外部环境事项。

## case3 交付节奏

1. Gate 1 已完成：`03-design/case3/case3-dt-com.pen` 已由用户确认冻结。
2. Gate 1.5 已完成：`web-static/case3/` 的核心状态和现场环境弹窗已由用户人工接受，仅作视觉/假交互验收。
3. Gate 2 已完成：API 契约 v1 与真实后端交接材料已冻结，多 txt 正式协议、共享 control、单侧 Start/ReInit、截图与数值边界已明确。
4. Gate 3 已完成：`WEB-SPEC.md`、`SERVER-SPEC.md`、`realback_no.md` 已作为实现基线。
5. Gate 4 已完成本地实现：`code/web/` Case3 正式 Web、`code/server/` Case3 Node 文件适配、`code/back/case3/` 模拟后端均已落地。
6. 本地验证已补齐：server/back/web 分层测试、Web build、串行 Playwright 均通过；Case3 现有 Playwright 为前端隔离主线，三进程真实后端 E2E 仍需后续脚本或现场联调补证据。

## case4 交付节奏

1. Gate 1 已完成：`03-design/case4/case4.pen` 已由用户确认冻结。
2. Gate 1.5 已完成：`web-static/case4/` 静态视觉与结构已由用户接受。
3. Gate 2 已完成：`API-CONTRACT.md` v1 已授权定稿。
4. Gate 3 已完成：`WEB-SPEC.md`、`SERVER-SPEC.md`、`realback_no.md`、`REFLECTION-SPEC.md` 已作为实现基线。
5. Gate 4 已完成本地实现：正式 Web、Node `/api/case4/*`、`code/back/case4` 打桩均已落地。
6. 2026-09-18 用户确认：除 3D 外功能全部开发完成（含 2D Reflection、CEP 百分比、误差/吞吐/CDF 悬停、`/result` 反射不挡完成）。3D 仍不做。真实后端/真实挂载独立验收不在本条关闭范围内。

## 项目级停止规则

- 不因 case2 已推进而推测 case1/3/4 的字段、状态或视觉。
- 未取得目标 case 的 Gate 1 人工冻结前，不进入 Gate 1.5 或正式 Web 实现。
- 每个 case Gate 变化后，必须同步 `state.md` 与 `CASE-STORY-MATRIX.md`。
- case2/case3/case4 本地打桩结果不得表述为真实业务采集结果；真实后端接入后需新增 QA 证据再关闭真实环境验收。
