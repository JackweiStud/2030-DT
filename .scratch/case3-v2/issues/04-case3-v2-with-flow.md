# 04: 跑通 Case3 V2 With DT 与配对 KPI

**What to build:** 用户完成 Without 后能够启动 With DT，在同一张地图上观察新一轮轨迹与预测波，并在运行和完成过程中看到与当前 Without 配对的回溯、Cost、Throughput 和最终 BA。

**Blocked by:** 03: 跑通 Case3 V2 Without DT 主链。

**Status:** human-accepted

- [x] With Start 权限、命令、轮询、最终快照门槛和截图收尾完整复用现有 Case3 controller。
- [x] 点击 With Start 后单地图与波束矩阵先回初始内容，再只绘制本轮 With 轨迹、点位和 UE；Without 底栏历史继续保留。
- [x] With 波束矩阵不显示扫描波，图例第一项切换为“预测波”并使用 `beam-pred.png`，第二项保持“最优波”并使用 `beam-best.png`；按相同 `point.no` 叠加 Without 最优波和 With 预测波，`BeamID` 显示当前 With 预测值，坐标轴固定 0–15。
- [x] 预测一致时两者同格，显示白色发光预测波、绿色准星叠层和“预测成功”；不一致时分别显示白色描边中心点最优波与白色发光预测波，红色准星锚定预测波并显示“预测失败”。成功/失败由当前点比较决定，不得写死成 running=成功、completed=失败。
- [x] 暂时缺少同 `no` peer 时隐藏“预测成功/失败”徽标，只显示预测波和预测 BeamID，不显示绿/红准星、不新增“待比对”文案；回溯使用中性 PNG，不提前给出结论。
- [x] 波束矩阵只跟随当前点或完成态最后点，拖动回溯窗口不会改变矩阵。
- [x] With 回溯按真实 `point.no` 显示“预测波”和 BeamID，正确/错误/不可比较分别使用 `cell-with-ok.png`、`cell-with-fail.png`、`cell-with-idle.png`，不使用 CSS 重造 PNG。
- [x] Without 和 With 吞吐曲线按现有规则实时增长；新一轮数据不得与上一轮历史形成跨代对比。
- [x] Cost 数字使用真实 `costPct`；空值显示 `--` 并隐藏填充。复用 `ee1a9ff` 已实现的 SVG mask 体积填充，不重新实现或退回拉伸 PNG；底座和边框固定。
- [x] Cost 变化继续使用现有相对变化公式，并根据正负显示“开销增加”“开销减少”或中性结果。
- [x] BA 在 With 运行中仍显示动态文件基线；只有 With 完成且 `pairValid=true` 后，才按相同 `no` 将本轮正确/错误计入基线，绿红填充宽度同步变化。
- [x] With 截图、busy/roundClosing、状态文字和按钮权限保持现有业务规则。
- [x] 复用 `ee1a9ff` 已实现的 `BeamCrosshair` tone/marker 和 Cost 基础，不复制第二套准星/填充逻辑。
- [x] 补齐 With 成功链、预测成功/失败/缺 peer、配对 KPI 和动态视觉绑定测试，旧 Case3 回归通过。
- [x] 人工验收修正：Cost 变化值槽加宽到可容纳 `-99.9`，槽内右对齐，百分号仍紧跟数字。
- [x] 人工验收修正：回溯正确/错误在单元格 PNG 之外，按静态稿交界处显示 `cell-icon-ok.png` / `cell-icon-fail.png` 勾叉；缺 peer 不显示图标。
