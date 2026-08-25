# 05: 跑通 ReInit、单侧历史与新一轮重跑

**What to build:** 在不改变现有 Case3 controller、reducer、REST 契约和业务权限的前提下，让 Case3 V2 在任一侧 ReInit 后把主地图与波束矩阵保持为空，同时在底栏保留另一侧可用历史；随后可以开启新一轮且不混入旧轮结果。点位超过 20 个时，回溯区支持整体拖动查看更早窗口。

**Blocked by:** 04: 跑通 Case3 V2 With DT 与配对 KPI（已人工验收）。

**Status:** human-accepted

## 已核对事实

- 现有 reducer 在 `ACTION_BEGIN(reinit)` 时已经立即清除目标侧 result/live，并令 `pairValid=false`；另一侧结果保留。
- `ReInit execute fail` 不恢复目标侧旧结果，只允许同侧 ReInit 重试；完整失败反馈与恢复场景归 Ticket 06。
- `Start execute fail` 按现有规则重试同侧 Start，不允许改成 ReInit；不纳入本 Ticket。
- 现有 `pointProgressRouteNos()` / `pointProgressWindowRange()` 已支持 `windowStart`；旧 Case3 的 `PointProgressWindow` 已有可复用的 Pointer Events 拖动、缩放换算和 follow-latest 逻辑。
- 当前 V2 在 ReInit With 完成后会回退显示保留的 Without 地图；这不符合“重置后主地图持续初始”的新皮肤口径，需要在 V2 展示层修正。
- 当前 V2 回溯直接复用主地图的 `v2LiveMapSide()`：Reset Without 后即使保留 31 点 With 历史，窗口仍由空 Without 驱动并停在 `P1–P20`，不能显示保留侧最新 `P12–P31`。
- 当前 V2 `PointBeamReplay` 尚未接入 Pointer Events，不能拖动回看；因此回溯不能从 Ticket 05 完全排除。

## 回溯修改结论

- ReInit 的目标侧清除、另一侧数据保留、`pairValid=false` 和缺 peer 中性态已经由 reducer/presentation 支持，本 Ticket 不重写这些业务逻辑。
- Ticket 05 只给 V2 增加独立的回溯驱动侧选择：运行中跟随当前 Start 侧；重置中和重置后跟随仍有历史的一侧；两侧都没有数据时回到 Without 空窗口。
- Ticket 05 在 V2 `PointBeamReplay` 复用旧 Case3 的拖动算法。除此之外，不新增重置专用回溯状态、接口或文案。

## 实现边界

- [x] 只改 Case3 V2 展示适配、`BottomDock` / `PointBeamReplay` 和测试；不改 controller、reducer、Node、共享文件协议和旧 Case3 页面。
- [x] V2 将“主地图当前轮焦点”和“底栏保留历史”分离：点击任意 ReInit 后，主地图六项内容及波束矩阵立即回初始，并持续保持初始，直到下一次合法 Start 产生首个完整点。
- [x] 主地图清空只清业务点、轨迹、点位和波束，不重建地图实例，不改变用户缩放、旋转和平移；只有手动“复位地图”恢复默认视角。
- [x] ReInit 目标侧历史立即失效；另一侧历史只在底栏保留，不得自动回填主地图或波束矩阵。
- [x] 底栏回溯侧别独立于主地图选择：运行中跟随当前 Start 侧；空闲、ReInit 中或 ReInit 后优先跟随仍保留历史的一侧。
- [x] `pairValid=false` 时 Cost 变化显示 `--`；只显示仍有效侧的 Cost/Throughput 单侧数据；Beam Accuracy 回到文件基线；With 缺 peer 时使用中性 PNG 且不显示勾叉。
- [x] 新一轮 Without/With Start 继续立即清目标侧地图和矩阵；首个完整点到达后只绘制本轮数据，旧 With 与新 Without 不形成跨代对比。
- [x] 回溯窗口按动态 N 工作：`N<=20` 固定前 20 槽并补空；`N>20` 默认跟随最新 20 个已完成点。
- [x] `N>20` 时复用旧 Case3 的 Pointer Events 方案，在整个回溯表面横向拖动窗口；列头、Without 行、With 行、PNG 背景和勾叉图标必须作为同一窗口同步移动。
- [x] 用户拖到较早窗口后，新点到达时保持用户窗口；拖回最右端后恢复 follow-latest。切换当前 Start 侧或开始新一轮时恢复 follow-latest。
- [x] 回溯列头不可点击；拖动窗口不得改变地图、UE、波束矩阵当前点或业务状态，不新增滚动条、分页按钮和可见文案。
- [x] Start/ReInit 期间按钮、状态文字、动画省略号、Tab busy 锁和 `roundClosing` 保持现有 Case3 行为。

## 人工检查

1. 完成 Without + With，记录当前地图缩放/旋转；点击“重置有 DT”。
   - 点击瞬间地图轨迹、点位、UE、当前点位和矩阵 BeamID 清空，地图视角不跳回默认。
   - 底栏保留 Without 历史；With 数据消失；Cost 变化为 `--`、吞吐只剩 Without、BA 回基线。
   - `reinit complete` 后主地图仍为空，不重新绘制保留的 Without。
2. 重新跑 With，确认首个完整点前地图为空，之后只绘制新 With；完成后重新形成同 `no` 配对 KPI。
3. 再点击“重置无 DT”。
   - 主地图和矩阵继续为空；底栏保留 With 历史，但因缺 peer 使用中性 PNG、无勾叉、无跨侧结论。
   - 新跑 Without 时旧 With 不参与比较；新 Without 完成后按现有权限重新跑 With。
4. 使用 31 点数据完成一侧：默认显示 `P12–P31`；向右拖到最早显示 `P1–P20`，两行与勾叉严格对齐，主地图仍停在当前最新点；拖回最右恢复最新窗口。
5. 使用少于或等于 20 点数据，确认补空槽正确且回溯区不可拖动。

## 自动检查

- [x] 组件测试覆盖 ReInit Without/With 点击即清图、完成后不回填另一侧地图，以及地图 transform handle 不被重建。
- [x] 展示测试覆盖单侧历史、`pairValid=false` 的 Cost/Throughput/BA、With 缺 peer 中性态。
- [x] 回溯测试覆盖 N<20、N=20、N=31、拖动边界、follow-latest、两行和勾叉同步、拖动不触发点位选择。
- [x] Playwright 覆盖双侧完成后分别 ReInit、保留另一侧历史、新一轮重跑和 31 点拖动回看。
- [x] 旧 Case3 回归、Ticket 03/04 V2 主线、类型检查、构建和 `git diff --check` 全部通过。

## 不做

- 不在本 Ticket 处理 `execute fail`、POST 失败、结果不完整、连接异常或 `CONTROL_BUSY` 的完整恢复体验；这些属于 Ticket 06。
- 不增加取消、队列、自动业务重试、自动超时、历史持久化、回溯点击联动地图或新的接口字段。
