# case3 Gate 1 设计冻结

## 结论

status: `APPROVED`

case3 Gate 1 已于 2026-08-09 经用户确认冻结。冻结设计源为：

- `03-design/case3/case3-dt-com.pen`

## 冻结输入

- 唯一设计源：`03-design/case3/case3-dt-com.pen`
- UX 输入：`02-ux/case3/`
- Gate 1 设计交接：`03-design/case3/Design_Analysis.md`、`Pen_Plan.md`、`Visual_Diff.md`、`Frontend_Spec.md`、`Freeze_Note.md`

## 冻结范围

Gate 1 设计源覆盖 case3 的核心视觉与状态表达：

- 初始界面
- 无 DT 运行中
- 无 DT 完成态
- 有 DT 运行中
- 有 DT 完成态
- 点击现场环境弹窗

设计源中 reset / failed 等扩展态保留为后续前端实现参考；本轮 Gate 1.5 静态 HTML 的明确范围以上述核心状态为准。

## 关键语义

- `02-ux/case3/` 只是 UX 输入，不是最终视觉契约。
- Gate 1.5 静态 HTML 以 `03-design/case3/case3-dt-com.pen` 为唯一参考。
- 点位进度为动态 `N` 的窗口表达，不把 P1-P12 或 P1-P20 当作点位总上限。
- Cost 文案固定为 `Cost (%)`，不沿用 dB。
- Beam Accuracy 在进入 case3 / 刷新 / 切回时显示文件基线；With 完成后由 Web 基于同 `no` 点位 `selectedBeamId` 对比增量刷新。
- With reflection / LOS 示意依赖完整点 `reflection` 字段。

## 下一步

进入 Gate 1.5 静态 HTML：

- 目录：`web-static/case3/`
- 共享资源：`web-static/shared/`
- 边界：只还原视觉和假交互，不接 `/api/case3/*`，不读共享目录，不实现正式状态机，不启动 Node。
