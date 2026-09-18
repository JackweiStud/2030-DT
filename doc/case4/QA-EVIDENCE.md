# case4 2D 本地完成与真实后端联调记录

## 完成口径与证据

2026-09-16 用户明确确认：“case4 2D 场景的所有功能已完成，自测测试完成，准备和后端联调”。项目状态以根目录 `state.md` 为准。

- 正式 React、Node 文件适配服务、独立 case4 打桩均已实现；打桩支持 replay / random。接口基线见 `API-CONTRACT.md`。
- 用户本次提供的完成态截图可见预期路径、三方案轨迹、点位误差回溯及悬停浮层、CDF、CEP50/90、NLOS 和两路吞吐率。
- 仓库核对基线：`ee35d4e`（误差回溯悬停）、`b821bc5`（正式 Web 主线）；本次更新前工作区干净。当前代码已兼容实时坐标空白分隔及单行 `65535`。
- 本条完成结论来源为用户自测确认；本次仅核对代码与文档并收尾，未重新运行自动化测试或真实后端联调，不将此前 agent 的测试数量作为当前版本复测结果，也不据此声明此前每条审查发现均已独立复验。
- 用户截图为会话证据，未复制临时目录中的图片入库；后续真实联调证据应登记实际路径、版本、时间与用途。

## 当前范围与增量

初始、运行、完成与现场环境弹窗；开始/重置、等待与失败反馈；2D 地图、三方案同步点位、XYZ 欧氏误差；完成后的 CDF/CEP/NLOS；两路独立吞吐。共享导航及单活跃控制机制沿用现有应用。

悬停不再后置：当前 `ErrorReplay` 对有数据槽显示点号与三方案 XYZ 误差，精度三位小数、单位米；移出或拖动时收起。当前实现运行中已有数据槽也可悬停，并未限定 completed。这是相对早期“仅完成后”的实现差异，随本次用户整体验收记录保留，后续专项验收应显式覆盖。

CEP 增减百分比、2D Reflection、误差/吞吐/CDF 悬停均已纳入本地交付。**仅 3D 不纳入本阶段。** 真实后端反射样本与实际 BS 标定仍未由本仓库独立验收。设计和静态文档保留历史验收范围，不因正式 Web 增量重写原冻结设计。

## 真实后端联调最小检查

1. **环境切换**：停止同一共享根上的所有模拟后端；核对前端 PC 的 `DT_SHARED_DIR`、挂载读写权限、真实后端输出目录及 base。Web 只经本机 Node REST 访问文件。
2. **正常两轮**：进页初始化 → Start → `execute success` → 实时更新 → `case complete` → 最终统计及截图收尾 → Reset → 再 Start。核对 `dt_type="all"`、开轮空 status、无旧轮残留和跨 Tab 锁。
3. **数据边界**：三轨迹实时只展示共同前缀，完成时必须同长且不超过 base；38 预期/30 收齐可完成，不补造后8点。吞吐独立、不必同长，存在但为空可完成。最终三份 CDF 与 CEP/NLOS 汇总全部合法后才提交结果。
4. **实际文件格式**：用真实样本核对分隔符、换行、完整行 append、单行/分量 `65535`。无效分量回填同方案前一点；P1 回填 base；保留点号及诊断日志。单行 `65535` 当前按整点 XYZ 无效处理。
5. **失败与收尾**：核对缺失/半写统计的有限重试与回退、Start/ReInit 失败、截图落盘清 flag、刷新撤权，记录期望和实际。最终写完并关闭结果文件，再发布 complete。

每次联调记录代码版本、真实后端版本、共享路径、用例、预期/实际、关键日志与截图路径。完成正常两轮和上述核心边界、问题关闭后，才能将“待真实后端联调”更新为对应环境验收通过；当前尚无该证据。

## 2026-09-17 后续增量

- 用户提供：真实后端、真实共享挂载、真实采集数据验证 PASS；本轮未独立复验这些环境。
- `dt_type` 硬切换已由用户确认修改、验证并上库，提交 `5067ffd`、`831984a`；Start/ReInit 为 all，init 为空，旧值非法。
- XYZ 公式此前已存在，本轮只修正文档和函数注释；CEP 百分比现已实现（c4382a3，见下方收口记录）。本条覆盖上方此前“待联调”的阶段状态，不回写历史测试结果。

## CEP 百分比交付收口（2026-09-17）

- 实现提交：`c4382a3`。本地已核对提交及新增避让实现；用户报告已推送 main，[Issue #2](https://github.com/JackweiStud/2030-DT/issues/2) 已关闭，远端状态本轮未独立查询。
- 用户确认效果与意图满意，并提供修复后截图。CEP50/90按各自传统值计算，使用原始统计、一位小数；传统值为0或原值相等时隐藏。下降绿色箭头、上升红色箭头，显示绝对百分比。
- 前次审查的P2遮挡问题已加入数值避让实现与回归用例；传统虚线保留，气泡抬高避开DT数值。未重做整套视觉或Pencil。
- 本次未修改业务代码、打桩配置或共享数据；完整截图上传及真实后端流程不在本次复验范围。
- 本次独立验证：`cd code/web && npm test -- --run test/case4/case4Metrics.test.ts test/case4/charts.empty.test.tsx test/case4/SvgCaptureCompatibility.test.tsx`：3文件、45测试通过；`npm run typecheck`通过。验证对象为c4382a3代码，不等于完整浏览器截图联调复测。

## 2026-09-18 Reflection 本地三端

范围：React Web + Node 文件服务 + case4 打桩；隔离共享根 `code/.tmp/case4-e2e-shared`。未改 Pencil/静态页/真实参考反射文件/comdatafiles 运行数据。未 git add/commit/push，未关 Issue #3。

### 命令与结果

| 命令 | 结果 |
|---|---|
| `cd code/server && npm test` | 111/111 通过（含 case2/case3 共享适配与新增 `test/case4/reflection.test.mjs`） |
| `cd code/back/case4 && npm test` | 41/41 通过 |
| `cd code/web && npm run typecheck` | 通过 |
| `cd code/web && npm test -- --run test/case4` | 18 文件、112 测试通过 |
| `cd code/web && npm run build` | 通过 |
| `cd code/web && npm test -- --run test/case3 test/case3-v2 test/case2` | 28 文件、223 测试通过 |
| `cd code/web && npm run test:e2e:case4` | 2/2 通过（进页不读旧完成态；Start 完成→截图→重置→再 Start） |
| `cd code/back && npm test` | case2 29/29 通过；case4 41/41 通过；**case3 17/21 失败 4**，见下方既有失败 |

### 联调证据（运行输出，不入库）

- 运行中：Playwright 等到 `[data-reflection-state=ready]` 且 `.c4-reflection__beam` 可见；请求含 `reflection=true`。
- 完成静态：`.c4-reflection.is-static`，亮段为 0；截图 `case4-000.png` / `case4-001.png` 可见 BS、R1/R2 与完成态路径（无移动亮段）。
- 落盘：`code/.tmp/case4-e2e-shared/out/case4/case4-000.png`、`case4-001.png`（PNG 签名、>10KB）。
- JSONL：`code/.tmp/case4-e2e-shared/out/case4/points/trajectory.jsonl` 21 行；P1 `los=false`，P21 `los=true`，均含有效 Ri。

### 既有失败（未改预期掩盖）

`code/back npm test` 中 case3 stub 4 项断言 `21 !== 31`（`ue_comm_without_dt_coordinates` 等当前为 21 行，测试仍期望 31）。本轮未改 `code/back/case3/`；与 Reflection 实现无关，保持基线记录。

### 未解决问题

- 实际 BS 标定：当前 `(1.0,5.0,7.0)` 仅为模拟配置。
- 真实后端、真实挂载、真实反射样本未在本轮验证；不得宣称已验收。
- 参考目录 `01-参考资料/case4/data/ue_position_with_dt_coordinates_reflection_point.txt` 保持原文件，未自动补齐。

## 2026-09-18 功能收口（除 3D）

用户确认：case4 除 3D 外全部功能已开发完成。本条收口文档口径，不把打桩数据称为真实采集。

已交付（相对 09-16 2D 主线之后的增量）：

- CEP 百分比（`c4382a3`）
- 2D Reflection（运行中四路前缀、完成尽力附加、截图静态路径）
- 误差回溯悬停；吞吐率悬停（两路 Gbps）；CDF 悬停（水平概率线、1 位小数米）
- `/result` 不以 Reflection 文件漂移返回 409；漂移只 warn 并尽力附加

明确仍不做：3D 视图 / 3D 轨道相机 / 真开 3D 开关。HUD 3D 文案可见且 `aria-disabled`。

