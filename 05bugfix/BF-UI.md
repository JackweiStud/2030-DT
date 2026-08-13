# BF-UI 界面美化与无障碍

- Status: open
- Severity: UI（不挡主线，P0/P1 完成后再做）
- Area: `code/web` Shell / Case2 / Case3
- 可按下面子项 **一次一条** 提交；不要和 P0 功能修复混在一次 diff

每条子项修完后把该行改成 `done`。

## 约束

- 业务样式仍必须挂在 `.caseN-page`（热力 lightbox 若必须 portal 到 `document.body`，类名保持 `case2-` 前缀，避免和 Case3 撞车）。
- 固定 1920×1080 舞台，不要做第二套响应式。
- 尊重已有 `prefers-reduced-motion`（忙态省略号在 reduce 时停动画、仍显示静态省略号）。
- 不做「暂停/取消测试」（P0-2）。Case2 校准中的暂停图标是误导，应拿掉而不是做成真暂停。

---

### UI-01 Tab 锁定无视觉、无说明 — open

`code/web/src/shell/Shell.tsx`、`code/web/src/shell/shell.css`

其它 Tab `disabled` 后几乎仍像可点，无 `title`。建议 opacity、`cursor: not-allowed`、`title="测试进行中，完成后可切换"`。

---

### UI-02 Case2 启动钮在校准中变成暂停图标 — open

`code/web/src/cases/case2/Case2Page.tsx`、`case2.css`（`.ctrl-icon--pause`）

规格不能取消。建议忙态保持 play 禁用，或换成 spinner，不要用暂停图标。

---

### UI-03 错误徽标弱、长文案易挤布局 — open

- Case2 `status-feedback.is-error` 只改字色；Case3 有红底 `#ef444433`。对齐。
- 「结果不完整已自动回退」可与「执行命令失败」用不同点色（例如不完整琥珀、执行失败红）。
- Case3 长徽标 `nowrap` 在 32px 标题行：`max-width` + 省略，全文放 `title`。

---

### UI-04 无障碍：焦点、aria-live、lightbox — open

- Case3「现场环境」链接补 `:focus-visible`（Case2 已有）。
- 状态徽标加 `aria-live="polite"`。
- 热力全屏（`HeatmapCard.tsx` portal 到 `document.body`）：打开时 focus 关闭钮、Tab 循环锁在 dialog、Esc 已有则保留。
- Shell 锁定 Tab 用 `aria-disabled` 语义（原生 `disabled` 已有则补说明即可）。

---

### UI-05 空态 / 加载 / 建设中 / 色标 — open

- 进页 handshake 期间热力/地图加低对比 skeleton 或「正在读取基线」，避免像数据丢失。
- CDF/吞吐无数据时加一行 muted「等待测试结果」。
- `ComingSoon` 不要只有一句「建设中」：加与舞台同色的暗底 + 副标题「本 Tab 不加载业务数据」。
- Case2 热力卡或全屏加一条蓝→青→黄→红色标（每张图独立 min/max，标尺标明相对本图）。
- `App.tsx` 配置错误页：Case3 的 `case3-config-error` 目前几乎无样式；可加「检查 `.env` 中 VITE_CASE*_」指向 `code/web/README.md`。

---

### UI-06 可选观感（更后做） — open

- 进入 completed / Case3 pairValid 时 KPI 区 150–200ms fade-in（reduce-motion 则无动画）。
- 截图前可隐藏 busy 省略号一帧，减少 PNG 边缘残影（不要改截图契约）。
- Case2 截图 base64 从 React state 改到 ref（对齐 Case3），减少 DevTools/内存；这偏实现卫生，可单独提交。

## 验收（每条子项）

- [ ] 1920×1080 舞台无重排、无跨 Case 样式泄漏。
- [ ] reduced-motion 下无新的强制动画。
- [ ] 不引入可取消测试。
