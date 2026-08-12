# 2030-DT case2/case3 技术掌握讲义

> 面向：项目负责人、演示负责人、联调负责人。目标是你即使一行代码都没看，也能判断系统怎么跑、哪里可能坏、该找谁处理。
>
> 当前状态：截至 2026-08-11，case2 与 case3 均已完成本地 Web、Node 文件适配服务、本地打桩后端的开发闭环。真实后端 PC、真实共享挂载路径、真实采集数据仍未验收。

## 0. 先记住一句话

这个项目不是“前端直接读后端接口”的普通 Web 项目，而是：

```text
Web 前端
  -> 调本机 Node REST
  -> Node 读写共享目录文件
  -> 后端业务进程也读写同一共享目录
```

所以项目的核心不是某个页面，而是三件事：

1. 控制文件 `case_control.json` 的状态机。
2. Node 适配服务对共享目录文件的读写和保护。
3. Web 什么时候可以展示结果、什么时候必须等待。

## 1. 全项目技术地图

### 1.1 三层责任

| 层 | 你可以怎么理解 | 负责 | 不负责 |
|---|---|---|---|
| Web 前端 | 演示屏幕和用户操作层 | Tab、按钮、地图、KPI、截图生成、浏览器日志 | 直接读写共享目录、决定业务是否完成 |
| Node 文件适配服务 | 前端 PC 上的文件代理和锁 | REST、控制文件读写、数据文件解析、截图落盘、跨 Case busy guard | 后端算法、真实采集、伪造业务终态 |
| 后端业务进程 / 本地打桩 | 共享目录另一端 | 读控制命令、执行业务、写结果文件、写 `status` 和截图 flag | 浏览器 UI、REST、前端截图编码 |

### 1.2 关键路径

| 内容 | 路径 |
|---|---|
| 项目当前状态 | `state.md` |
| 共享架构 | `doc/ARCHITECTURE-DRAFT.md` |
| 文档索引 | `doc/DOC-STRUCTURE.md` |
| case2 契约 | `doc/case2/API-CONTRACT.md` |
| case2 Web 施工规格 | `doc/case2/WEB-SPEC.md` |
| case2 Node 施工规格 | `doc/case2/SERVER-SPEC.md` |
| case2 QA 证据 | `doc/case2/QA-EVIDENCE.md` |
| case3 契约 | `doc/case3/API-CONTRACT.md` |
| case3 Web 施工规格 | `doc/case3/WEB-SPEC.md` |
| case3 Node 施工规格 | `doc/case3/SERVER-SPEC.md` |
| case3 后端打桩规格 | `doc/case3/realback_no.md` |
| case3 QA 证据 | `doc/case3/QA-EVIDENCE.md` |
| 启动脚本说明 | `code/scripts/README.md` |

## 2. 你必须掌握的 6 个词

### 2.1 `init`

空闲态，也是撤销旧轮写入权的信号。

Web 进入页面、刷新页面、完成一轮收尾后，都会通过 Node 写回 `command=init`。后端看到 `init` 后，应停止旧 Case 或旧侧继续写文件。

### 2.2 `start`

启动一次业务测试。

- case2 只有 `with dt` 启动。
- case3 有两侧：`without dt` 与 `with dt`。

### 2.3 `reinit`

重置。

注意：正式文档里叫“重置”，不要再叫“清除”。case3 的 Without/With 重置是独立的，不能联动清另一侧。

### 2.4 `execute success`

只表示命令执行成功，不表示业务完成。

这是最容易误判的点。Web 看到它后只能继续等，不能读最终结果。

### 2.5 `case complete`

启动轮业务完成。

case2 看到它后，Node 才允许读取完整 Calibrated 六文件。case3 看到它后，Node 还要做最终快照门槛，确认没有半点、缺 Cost 或读写漂移。

### 2.6 `reinit complete`

重置完成。

Web 看到它后，才能清目标侧 UI 并回到可启动状态。

## 3. 控制文件是项目心跳

控制文件来自共享目录根：

```text
{DT_SHARED_DIR}/case_control.json
```

核心字段：

| 字段 | 谁写 | 含义 |
|---|---|---|
| `case` | Web 经 Node 写 | 当前控制命令属于哪个 case，例如 `case2` / `case3` |
| `command` | Web 经 Node 写 | `init` / `start` / `reinit` |
| `dt_type` | Web 经 Node 写 | case2 用 `with dt`；case3 用 `without dt` / `with dt` |
| `status` | 后端写业务终态；Node 只在开轮/init 时清空 | `""` / `execute success` / `execute fail` / `case complete` / `reinit complete` |
| `save_picture_flag` | 后端置 `1`，Node 清 `0` | 请求 Web 截图 |

关键纪律：

- Web 请求体不直接带业务终态。
- Node 不伪造 `execute success`、`case complete`、`reinit complete`。
- `start` / `reinit` 开新轮时，Node 会先清目标数据并把 `status=""` 写进去，避免旧轮终态污染新轮。
- `POST init` 永远允许，用于退出旧轮写入权。
- 任一 Case 正在 Start/ReInit，另一个 Case 的 Start/ReInit 会被 busy guard 拒绝。

## 4. case2 怎么跑

case2 是“整批结果”模型。

```text
进入 case2
  -> GET control
  -> POST init
  -> GET initial data
  -> initial

点击启动
  -> POST start + with dt
  -> Node 清 status=""
  -> 后端写 execute success
  -> Web 继续等
  -> 后端写完 6 个 Calibrated 文件
  -> 后端最后写 case complete
  -> Web 读取 calibrated 六文件
  -> 渲染完成态
  -> 如有截图 flag，截图并落盘
  -> POST init 收尾

点击重置
  -> POST reinit
  -> 后端写 execute success
  -> 后端写 reinit complete
  -> Web 清 Calibrated
  -> POST init 收尾
```

case2 的结果文件是整批读取。缺一个文件、文件变化、格式非法，都不能展示半套结果。

### 4.1 case2 你要盯的风险

| 现象 | 该怀疑什么 |
|---|---|
| 一直校准中 | 后端是否没写 `case complete`，或 Web 没先看到 `execute success` |
| 看到 `execute success` 但没结果 | 正常，`execute success` 不是完成 |
| 完成后不显示 Calibrated | 六文件可能缺失、格式非法或读取期间变化 |
| 截图没生成 | `save_picture_flag` 是否置 1，或截图 POST 是否失败 3 次 |
| 重置后还显示旧结果 | Web 是否没消费 `reinit complete`，或完成收尾时序错 |

## 5. case3 怎么跑

case3 是“逐点实时 + 双侧配对”模型。

它有两条业务侧：

- Without DT：无 DT。
- With DT：有 DT。

每侧都独立启动、独立完成、独立重置。

```text
进入 case3
  -> GET control
  -> POST init
  -> GET init-data
  -> initial

Start Without
  -> Node 清 without 侧实时文件
  -> POST start + without dt + status=""
  -> 后端写 execute success
  -> Web 每 500ms GET side?side=without
  -> 有 1 个点就显示 1 个点
  -> 后端写完该侧数据和 Cost
  -> 后端写 case complete
  -> Node 做最终快照门槛
  -> Web 渲染 Without completed
  -> 截图收尾
  -> POST init

Start With
  -> Node 清 with 侧实时文件
  -> POST start + with dt + status=""
  -> 后端写 execute success
  -> Web 每 500ms GET side?side=with
  -> 有 1 个点就显示 1 个点
  -> 后端写完该侧数据和 Cost
  -> 后端写 case complete
  -> Web 渲染 With completed
  -> 如果 Without/With 都有效，计算对比 KPI
  -> 截图收尾
  -> POST init
```

### 5.1 case3 为什么比 case2 更复杂

case2 是一轮完成后读整批文件。case3 是运行中持续 append 多个 txt 文件。

Node 要做这几件事：

1. 按侧清空旧文件。
2. 把多 txt 的第 N 行收编成第 N 个点。
3. 如果某些文件已经写了第 N+1 行，另一些还没写，就标记 `pendingTail`，不能把半点给 Web 当完整点。
4. 运行中返回完整前缀点，允许 Web 实时显示。
5. `case complete` 后执行最终门槛：必须有点、无 pending、Cost 存在、读取期间控制没有漂移。

### 5.2 `pairValid` 是什么

`pairValid` 表示当前 Without 和 With 是否属于同一轮可比较结果。

它不是后端字段，是 Web 本地派生状态。

为什么需要它：

- 用户可以只重置 Without。
- 这时 With 旧结果仍要保留显示。
- 但 Without 已经失效，不能再拿旧 With 和新的/空的 Without 算“开销变化”“吞吐提升”“Beam Accuracy 对比”。

所以规则是：

| 状态 | 单侧显示 | 跨侧对比 |
|---|---|---|
| 只有 Without 完成 | 显示 Without | 不计算对比 |
| 只有 With 历史完成 | 显示 With | 不计算对比 |
| Without/With 都完成且属于当前配对 | 两侧都显示 | 可以计算对比 |
| 重置任一侧后 | 另一侧继续显示 | `pairValid=false`，中间对比值失效 |

一句话：`pairValid` 是防止 UI 把“不属于同一轮”的两侧结果硬凑成结论。

### 5.3 case3 你要盯的风险

| 现象 | 该怀疑什么 |
|---|---|
| 点只在 complete 后一次性出现 | Web 没消费 live points，或 Node 运行中返回被挡住 |
| With 曲线运行中不可见 | With live 曲线和 `pairValid` 被错误绑定 |
| 重置 Without 后 With 消失 | Web 把目标侧重置做成了级联清理 |
| 中间开销变化在单侧完成时显示 | `pairValid` 门槛失效 |
| `RESULT_NOT_READY` 一直出现 | 后端 complete 太早、Cost 缺失、存在半点、读取期间文件还在变 |
| 浏览器日志看不懂代次 | 要区分 `entryGeneration` 和 `roundGeneration` |

## 6. 截图机制

case2 与 case3 的截图同构。

```text
后端在 Start 路径 success -> complete 窗口置 save_picture_flag=1
  -> Web 观察到 flag 0→1
  -> Web 截 Stage
  -> POST /api/caseN/screenshot
  -> Node 写临时 PNG
  -> Node rename 成最终 PNG
  -> Node 清 save_picture_flag=0
```

限制：

- ReInit 不截图。
- 同一截图任务最多尝试 3 次。
- 第 3 次仍失败，Web 允许放弃本张截图并让 Node 清 flag。
- 截图失败不能阻塞业务状态。
- case2 输出到 `out/case2/calibrated-{seq}.png`。
- case3 输出到 `out/case3/case3-{seq}.png`。

## 7. 本地打桩和真实后端的边界

本地打桩只是为了演示和开发闭环。

| 项 | 本地打桩 | 真实后端 |
|---|---|---|
| 目的 | 让 Web + Node 在无真实后端时跑通 | 真实业务执行和采集 |
| 数据 | synthetic/stub 或 replay | 真实采集结果 |
| control | 模拟后端读写 | 后端 PC 读写 |
| 可对外宣称 | 本地打桩链路通过 | 只有真实联调后才能宣称 |

不能说：

- “真实后端已经验收”。
- “真实采集已经完成”。
- “本地截图就是正式采集证据”。

可以说：

- “case2/case3 本地开发闭环完成”。
- “Web、Node 适配服务、本地打桩和自动测试已通过”。
- “真实后端和真实共享挂载需要下一阶段验收”。

## 8. 如何启动和验证

### 8.1 本地演示启动

终端 1：启动 Web + Node。

```bash
cd /Users/jackwl/Code/2030-DT
./code/scripts/dev-web-server.sh
```

终端 2：启动对应打桩。

```bash
cd /Users/jackwl/Code/2030-DT/code/back
npm run start:case2
```

或：

```bash
cd /Users/jackwl/Code/2030-DT/code/back
npm run start:case3
```

浏览器访问：

```text
http://127.0.0.1:5173
```

### 8.2 自动测试命令

```bash
cd /Users/jackwl/Code/2030-DT/code/server
npm test
```

```bash
cd /Users/jackwl/Code/2030-DT/code/back
npm test
```

```bash
cd /Users/jackwl/Code/2030-DT/code/web
npm run typecheck
npm test
npm run build
npm run test:e2e -- --workers=1
```

注意：当前 Case3 Playwright 是前端隔离 E2E，mock `/api/case3/*`。仓库还没有 `e2e-case3-stack.sh`，不能把它说成 Case3 Web + Node + stub 三进程一键 E2E。

## 9. 维测时先看什么

### 9.1 浏览器控制台

case2 / case3 都会输出结构化日志。

case3 重点看：

| 日志 | 含义 |
|---|---|
| `entry.begin` | 进入 case3 初始化 |
| `entry.init_reset_ok` | init 写回成功 |
| `entry.init_data_ok` | baseRoute 和基线读取成功 |
| `command.start_click` | 用户点击启动 |
| `command.start_ok` | start 控制写入成功 |
| `poll.status_edge` | status 状态变化 |
| `side.live_progress` | 点位实时增长 |
| `side.final_ready` | complete 后最终快照通过 |
| `round.completed_rendered` | 完成态已渲染 |
| `screenshot.*` | 截图生成、上传、落盘链路 |
| `completion.init_ok` | 完成收尾 POST init 成功 |

如果日志里只有 `execute success`，不要急着找前端问题。先确认后端是否写了 `case complete`。

### 9.2 Node 服务日志

Node 负责把文件错误翻译成 REST 错误。

常见错误：

| code | 代表什么 |
|---|---|
| `CONTROL_BUSY` | 有未消费的活动轮或完成终态，拒绝新 Start/ReInit |
| `RESULT_NOT_READY` | complete 后最终读取不完整，Web 应继续等 |
| `DATA_FILE_MISSING` | 必需文件不存在 |
| `SIDE_DATA_INVALID` | case3 侧文件格式或数值非法 |
| `SCREENSHOT_NOT_REQUESTED` | 截图 flag 不匹配或已被清零 |
| `CONTROL_READ_FAILED` | 控制文件不可读或 JSON 非法 |
| `CONTROL_WRITE_FAILED` | 控制文件原子写失败 |

### 9.3 共享目录

本地默认共享根：

```text
/Users/jackwl/Code/2030-DT/code/comdatafiles
```

重点目录：

```text
case_control.json
case2/
case3/
out/case2/
out/case3/
```

原则：运行产物不是源码，不默认提交。

## 10. 真实后端联调时要问的 10 个问题

1. 后端是否只通过共享目录和 `case_control.json` 对接？
2. 后端看到 `command=init` 后，是否会停止旧轮继续写文件？
3. 后端是否接受 Node 在 `start/reinit` 时清 `status=""`？
4. 后端是否保证先写 `execute success`，并保持至少 3000ms？
5. 后端是否保证完整写完结果文件后，最后才写 `case complete`？
6. case2 六文件是否同批次发布，且 complete 后不再变化？
7. case3 多 txt 是否按同一行号对应同一个点？
8. case3 Cost 是否在 complete 前可读，且范围和精度符合契约？
9. `save_picture_flag=1` 是否只在 Start 路径 success→complete 窗口出现？
10. 真实共享挂载上，双方整文件写控制时是否保留未知字段？

如果这 10 个问题没有答案，不能宣布真实后端验收完成。

## 11. 你该怎么快速掌握这个项目

### 第一小时：只掌握运行故事

读：

1. 本讲义。
2. `doc/ARCHITECTURE-DRAFT.md`。
3. `doc/CASE-STORY-MATRIX.md`。

目标：能说清 Web、Node、后端、共享目录各自干什么。

### 第二小时：掌握状态机

读：

1. `doc/case2/API-CONTRACT.md` 的控制状态部分。
2. `doc/case3/API-CONTRACT.md` 的状态流程和合法动作矩阵。
3. `doc/case3/WEB-SPEC.md` 的状态图。

目标：看到 `execute success`、`case complete`、`reinit complete` 时，知道 Web 应该做什么。

### 第三小时：掌握排障

读：

1. `doc/case2/QA-EVIDENCE.md`。
2. `doc/case3/QA-EVIDENCE.md`。
3. `code/scripts/README.md`。

目标：现场卡住时，知道先看浏览器日志、Node 日志还是共享目录。

## 12. 当前项目还缺什么

| 事项 | 为什么重要 | 建议 |
|---|---|---|
| Case3 三进程一键 E2E | 现在 Case3 Playwright 是前端隔离，不是 Web+Node+stub 一键栈 | 后续补 `code/scripts/e2e-case3-stack.sh` |
| 真实后端联调记录 | 当前只证明本地打桩，不证明真实采集 | 接真实后端后追加到 QA-EVIDENCE |
| 真实共享挂载压力验证 | 控制文件双端读写在真实挂载上可能有延迟或字段覆盖风险 | 设计最小压测脚本和日志留痕 |
| 现场值班手册 | 演示人员不该读 SPEC 排障 | 单独写启动、观察、常见故障、恢复步骤 |
| 3D 地图替换计划 | case3 未来要从 2D 图片换 Three.js 模型 | 保持 renderer 边界，不把 2D 假设写进业务状态 |

## 13. 最小判断口诀

- 看到 `execute success`：继续等，不读最终结果。
- 看到 `case complete`：先过完整性门槛，再展示。
- 看到 `reinit complete`：先让 UI 消费重置，再 POST init。
- 重置 case3 一侧：只清目标侧，另一侧历史可以显示，但不能参与对比。
- 截图 flag：只在 Start 路径处理，失败最多 3 次，不阻断业务。
- 本地打桩通过：不等于真实后端通过。

## 14. 延伸阅读顺序

如果你只读 5 个文件，按这个顺序：

1. `doc/ARCHITECTURE-DRAFT.md`
2. `doc/case3/API-CONTRACT.md`
3. `doc/case3/WEB-SPEC.md`
4. `doc/case3/QA-EVIDENCE.md`
5. `code/scripts/README.md`

如果你要检查 case2，再读：

1. `doc/case2/API-CONTRACT.md`
2. `doc/case2/WEB-SPEC.md`
3. `doc/case2/QA-EVIDENCE.md`
