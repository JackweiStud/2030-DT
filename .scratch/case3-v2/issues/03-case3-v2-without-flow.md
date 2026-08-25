# 03: 跑通 Case3 V2 Without DT 主链

**What to build:** 用户能在新页面启动 Without DT，看到真实点位逐步驱动单地图、波束矩阵、回溯、Cost 和 Throughput，直至完成并按现有 Case3 协议完成截图收尾。

**Blocked by:** 02: 接入 Case3 V2 初始页与真实初始化握手。

**Status:** awaiting-human-acceptance

- [x] Without Start 完整复用现有 Case3 Start 命令、轮询、generation 防陈旧响应和最终快照门槛。
- [x] 点击 Start 后目标侧旧结果立即失效，单地图和波束矩阵回初始内容；用户当前缩放、旋转和平移视角保持不变。
- [x] 运行中按最新完整点逐点更新已走轨迹、点位点亮、UE 位置、当前点位和 BeamID，不硬编码点数或演示数值。
- [x] Without 波束矩阵使用 0-15 坐标轴：`scanBeamIds` 使用冻结稿灰色实心圆角方块，`selectedBeamId` 使用现有 `beam-best.png` 白色圆角描边框加中心白点；最优波优先覆盖同格扫描波，不得改成蓝色；完成后保留最后完整点的扫描波与最优波。
- [x] 回溯表 Without 行按真实 `point.no` 显示“最优波”和 `selectedBeamId`，空点显示 `--`，不显示或反造业务 X/Y。
- [x] Without Cost 与 Throughput 按现有实时快照规则更新；吞吐缺点不补 0、不平滑、不丢数据点，坐标轴按真实路线和最大值计算。
- [x] BA 在 Without 运行和完成期间继续显示动态文件基线，不累计单侧结果。
- [x] 运行和 roundClosing 期间四个业务按钮与所有 Tab 按现有 busy 规则锁定，结束后正确恢复。
- [x] Start 后状态主文案为“测试中”，右侧使用独立固定宽度省略号槽复用旧 Case3 动效：1.2s `steps(4)` 展开、状态区域 1.6s 轻脉冲且文字不左右抖；`prefers-reduced-motion` 时静态显示完整省略号。
- [x] 截图触发、3840x2160 Stage 捕获、有限重试、flag 清理、文件命名和 `out/case3` 路径完全复用现有 Case3。
- [x] 补齐 Without 成功链的 reducer/selectors、组件和 Playwright 测试，旧 Case3 回归通过。
