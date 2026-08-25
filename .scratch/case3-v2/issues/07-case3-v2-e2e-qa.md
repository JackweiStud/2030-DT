# 07: 完成 Case3 V2 三进程 E2E 与验收证据

**What to build:** 用可重复执行的自动化证明 Case3 V2 不只是静态换皮，而是完整复用了现有 Web、Node 和 Case3 打桩后端业务链；同时提供足够的截图和记录供用户完成最终视觉验收。

**Blocked by:** 06: 覆盖 Case3 V2 失败、连接异常与恢复。

**Status:** human-accepted

## 2026-08-25 收口决策

- 用户确认已完成人工测试，明确决定不再新增 Ticket 07 自动化测试，并批准本 Ticket 直接通过。
- 至此 Case3 V2 Ticket 01–07 的**功能验收全部完成**，B 阶段停止；不在本 Ticket 替换旧 Case3，也不删除临时第五 Tab。
- 本 Ticket 按用户范围决策关闭，不把下方原计划中未执行的三进程自动化写成已完成事实。
- 已有自动证据沿用 Ticket 06：Web 33 个测试文件 / 258 项、typecheck、生产构建及 5 条 Case3 前端隔离 E2E 通过；用户另行完成人工主链与异常回退检查。
- **证据边界保留**：仓库仍没有可重复执行的 Case3 Web + Node + stub 三进程 E2E 脚本，因此“功能人工验收完成”不等于“三进程自动证据可复放完成”，也不代表真实后端、真实挂载或真实采集已验收。

以下 checklist 保留为原始计划记录；未勾项表示被用户明确豁免，而不是已执行：

- [ ] 单元测试、组件测试、前端隔离 Playwright、类型检查、构建和 `git diff --check` 全部通过。
- [ ] 隔离 Playwright 覆盖初始、Without 运行/完成、With 运行/完成、现场环境、ReInit、明确失败、结果不完整和适配连接异常。
- [ ] 新增可重复执行的 Web + Case3 Node + Case3 stub 三进程 E2E，并使用独立临时共享目录，禁止污染项目现有联调数据和截图。
- [ ] 三进程成功链跑通 Without Start -> complete -> With Start -> complete，并验证真实控制文件、逐点结果、配对 KPI 和截图 flag 收尾。
- [ ] 三进程恢复链覆盖至少一侧 ReInit、`execute fail` 后重新启动和结果不完整自动回退。
- [ ] 验证运行与 roundClosing 期间全部 Tab 被锁定，完成或失败收尾后恢复。
- [ ] 验证 Without 与 With 都可触发完整 Stage 截图；文件继续写入 `out/case3/case3-{seq}.png`，像素尺寸为 3840x2160。
- [ ] 验证现场环境弹窗打开时会进入截图，关闭、拖拽、Esc 和切 Tab 自动关闭行为正常。
- [ ] 旧 `DT for Comm` 页面仍可独立初始化并完成现有回归测试；Case2 和共享 Shell 不出现视觉或行为回归。
- [ ] 静态扫描确认不存在 `/api/case5`、`case:"case5"`、`out/case5`、Case5 Node、Case5 reducer 或独立后端状态链。
- [ ] 形成包含命令、环境、结果和截图索引的 QA 证据，并提供 1920x1080 关键状态截图供用户人工对照已验收静态稿。
- [x] 用户人工确认后，本 ticket 完成；B 阶段到此停止，不替换旧 Case3，不删除临时第五 Tab。
