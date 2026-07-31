# case2 Web 施工规格

> 使用者：正式 React Web 实现 agent。本文把 [API-CONTRACT.md](API-CONTRACT.md) v1、冻结设计和运行时资源转换为施工约束；`web-static/case2/` 只作为 Gate 1.5 视觉参照，不是代码模板或运行依赖。

## 0. 出口条件

- [ ] Shell 独立拥有四 Tab、1920×1080 等比缩放、公共 token 和“建设中”占位。
- [ ] case2 离开 Tab 即卸载，停止轮询并清空本地动作、Calibrated 和截图状态。
- [ ] Initial、calibrating、completed、failed 与 resetting/适配错误行为符合契约。
- [ ] 启动和重置互斥；刷新后一切回 Initial；无自动业务超时、自动重试、取消或队列。
- [ ] 仅在本轮启动后观察到 `execute success -> case complete` 才读取 Calibrated 六文件。
- [ ] 动态 `Nx × Ny` 热力图、动态 `N` CDF/均值/降幅均由当前响应计算，无固定 20 或固定百分比。
- [ ] `save_picture_flag` 的截图状态机独立于业务 `status`，支持反复 `0 -> 1` 和失败重试。
- [ ] 正式代码只消费 `04-runtime-assets/shell/` 与 `04-runtime-assets/case2/`，不引用 UX、Pencil 或静态原型目录。
- [ ] 单元测试、类型检查、构建和 Chrome 1920×1080 主线 E2E 通过。

## 1. 技术选择与目录

### 1.1 技术选择

- React + TypeScript + Vite。
- case2 状态使用 `useReducer` 和 case-local hooks；当前规模不引入 Redux、MobX 或全局业务 store。
- REST 使用原生 `fetch`，不用 WebSocket。
- 热力图使用 Canvas；CDF 使用 SVG；均值柱和降幅使用 React + CSS。
- 截图使用 `html-to-image` 的 `toPng`，截取固定 1920×1080 Stage，`pixelRatio=1`。
- 测试使用 Vitest + React Testing Library；浏览器主线使用 Playwright。

### 1.2 目标目录

```text
web/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── app/
│   │   └── App.tsx
│   ├── shell/
│   │   ├── Shell.tsx
│   │   ├── ScaledStage.tsx
│   │   ├── CaseTabs.tsx
│   │   ├── ComingSoon.tsx
│   │   └── shell.css
│   └── cases/
│       └── case2/
│           ├── Case2Page.tsx
│           ├── api.ts
│           ├── model.ts
│           ├── reducer.ts
│           ├── useCase2Controller.ts
│           ├── screenshot.ts
│           ├── components/
│           │   ├── CalibrationPanel.tsx
│           │   ├── CalibrationControls.tsx
│           │   ├── HeatmapPair.tsx
│           │   ├── HeatmapCanvas.tsx
│           │   ├── KpiPanel.tsx
│           │   ├── KpiComparisonRow.tsx
│           │   ├── CdfChart.tsx
│           │   ├── MeanBars.tsx
│           │   └── StatusFeedback.tsx
│           ├── metrics/
│           │   ├── cdf.ts
│           │   ├── heatmap.ts
│           │   └── statistics.ts
│           └── case2.module.css
└── test/
    ├── reducer.test.ts
    ├── cdf.test.ts
    ├── heatmap.test.ts
    ├── statistics.test.ts
    ├── screenshot.test.tsx
    └── case2.e2e.spec.ts
```

## 2. 运行配置与命令

| 配置 | 默认值 | 规则 |
|---|---|---|
| `VITE_CASE2_API_BASE` | 空字符串 | 默认同源 `/api/case2`；开发服务器代理 `/api` 到 `http://127.0.0.1:3102`。 |
| `VITE_CASE2_POLL_MS` | `250` | 只用于控制快照串行轮询；不得被解释为业务超时。 |

| 命令 | 用途 |
|---|---|
| `npm run dev` | Vite 开发服务器，代理到 Node 适配服务。 |
| `npm run build` | 类型检查后生成正式静态包。 |
| `npm run typecheck` | TypeScript 严格检查。 |
| `npm test` | Vitest 单元/组件测试。 |
| `npm run test:e2e` | Playwright 主线测试，配合 Node 开发打桩。 |

生产部署优先由 Node 适配服务或同机静态服务器托管 `web/dist`，保持 Web 与 `/api` 同源；不依赖 CORS、CDN 或 Google Fonts。

## 3. Shell 与 case2 所有权

### 3.1 组件树

```text
App
└── Shell
    ├── ScaledStage
    │   ├── ShellHeader
    │   │   └── CaseTabs
    │   └── ActiveCase
    │       ├── Case2Page
    │       │   ├── CalibrationPanel
    │       │   │   ├── CalibrationControls
    │       │   │   └── HeatmapPair × 3
    │       │   └── KpiPanel
    │       │       └── KpiComparisonRow × 3
    │       └── ComingSoon
    └── no case-local overlay outside Stage
```

### 3.2 Shell 规则

- `ScaledStage` 固定 `1920×1080`。
- `scale = min(viewportWidth / 1920, viewportHeight / 1080)`，舞台水平、垂直居中。
- Shell 是唯一缩放所有者；case2 内部保持固定布局，不增加第二套响应式重排或缩放。
- 切到 case1/3/4 时只渲染“建设中”，必须卸载 `Case2Page`。
- Shell 只导入 `04-runtime-assets/shell/tokens.css`、品牌 Logo 与导航底图。

### 3.3 case2 规则

- case2 业务样式使用 CSS Modules；若保留全局选择器，根必须是 `.case2-page`。
- case2 只导入 `04-runtime-assets/case2/tokens.css` 与该目录业务资源。
- case2 可以消费 Shell 已注入的 `--shell-*`，不能重定义或复制。
- 指标标签使用 `--case2-color-metric-tag-rss/path/delay` 与 HTML 文案，不复制 PNG 底板。

## 4. 类型与状态归属

### 4.1 REST 类型

```ts
type ControlStatus =
  | ""
  | "execute success"
  | "execute fail"
  | "case complete"
  | "reinit complete";

type MetricKey = "rss" | "effective_path_num" | "first_path_delay";
type DataPhase = "initial" | "calibrated";

type MetricData = {
  heatmap: number[][];
  kpi: number[];
};

type DataFilesResponse = {
  ok: true;
  phase: DataPhase;
  metrics: Record<MetricKey, MetricData>;
};
```

API client必须运行时检查 `ok`、枚举、三项指标和数组 shape，不能只依赖 TypeScript 编译期类型。

### 4.2 case2 reducer

固定状态：

```ts
type ViewPhase =
  | "initial"
  | "calibrating"
  | "resetting"
  | "completed"
  | "failed"
  | "connection-error"
  | "initial-data-error"
  | "result-error"
  | "unknown-control";

type PendingAction = "none" | "start" | "reinit";
```

case-local state 至少包含：

| 状态 | 来源 | 说明 |
|---|---|---|
| `viewPhase` | reducer 派生 | 唯一可见业务态。 |
| `pendingAction` | 用户动作 | 区分同一个 `execute success` 属于启动还是重置。 |
| `seenExecuteSuccess` | 本轮控制快照 | 只有当前 `start` 动作可用它解锁 `case complete` 读取。 |
| `initialData` | Initial REST | 进入 case2 时读取；仅本次挂载有效。 |
| `calibratedData` | Calibrated REST | 每次启动前清空；重置、刷新、切 Tab 时清空。 |
| `lastControl` | 控制 REST | 只供 reducer 和诊断，不作为全局 Shell 状态。 |
| `adapterError` | REST | 与 `execute fail` 分开。 |
| `screenshotState` | 独立小状态机 | 不参与 `viewPhase` 完成判断。 |

不得把定时器句柄、Canvas 上下文、图片对象或截图 Base64 放入 reducer。

## 5. 生命周期与轮询

### 5.1 进入 case2

1. reducer 初始化为 `initial`、`pendingAction=none`、无 Calibrated。
2. 并行请求控制快照与 `GET data-files?phase=initial`。
3. Initial 六文件整体成功后渲染三项基线。
4. 即使控制文件当前已经是 `case complete`，也不自动读取 Calibrated。
5. 首次控制快照若 `save_picture_flag=1`，按上一次观测为 `0` 处理并触发截图。

### 5.2 控制轮询

- 仅当 case2 已挂载且 Tab 活跃时轮询。
- 使用递归 `setTimeout`：上一次 GET 完成后再等待 250ms，禁止 `setInterval` 造成请求重叠。
- 每个挂载实例持有 `AbortController`；卸载时 abort 当前请求并清理 timer。
- 单次网络失败进入 `connection-error` 并继续基础轮询；不自动重发启动/重置命令。
- 若错误发生在待完成动作中，保留 `pendingAction`，服务恢复后继续观察原动作；用户刷新可显式回 Initial。
- 不累计失败次数，不生成前端业务超时，不把连接失败映射为 `execute fail`。

### 5.3 刷新与切 Tab

- 浏览器刷新依靠内存状态自然销毁；不得把 case2 运行状态写入 `localStorage`、`sessionStorage`、URL 参数或 IndexedDB。
- 切离 case2 必须卸载页面、清理轮询/截图任务/临时图片并丢弃 Calibrated。
- 切回后按全新进入处理，不重放控制文件中的旧 `case complete`。

## 6. 状态转换与按钮

| 当前条件 | 可见态 | 启动 | 重置 | Calibrated |
|---|---|---:|---:|---|
| Initial 数据有效，无待处理动作 | `initial` | 可用 | 禁用 | 空 |
| 已提交 start，未完成 | `calibrating` | 禁用 | 禁用 | 空 |
| start 路径读到 `execute success` | `calibrating` | 禁用 | 禁用 | 空 |
| 本轮 start 已见 `execute success`，再见 `case complete`，六文件有效 | `completed` | 禁用 | 可用 | 当前新批次 |
| `case complete` 但未见本轮 `execute success` | `unknown-control` | 禁用 | 可用 | 空 |
| `case complete` 后六文件失败 | `result-error` | 可用 | 可用 | 空 |
| 已提交 reinit，未见 `reinit complete` | `resetting` | 禁用 | 禁用 | 可保留旧完成画面并覆盖“重置中”反馈；成功后清空 |
| reinit 路径见 `reinit complete` | `initial` | 可用 | 禁用 | 清空 |
| 任一路径见 `execute fail` | `failed` | 可用 | 可用 | 空 |
| 适配服务不可达 | `connection-error` | 禁用 | 禁用 | 空 |

### 6.1 启动

1. 防重复 guard：只有按钮可用且无 `pendingAction` 才进入。
2. 立即清空旧 Calibrated、旧结果错误和 `seenExecuteSuccess`，进入 `calibrating`。
3. POST `{case:"case2",command:"start",dt_type:"with dt"}`。
4. POST 成功后设置 `pendingAction=start`；失败则进入连接/写入异常，解除本地动作但不恢复旧 Calibrated。
5. 轮询先观察 `execute success`，再观察 `case complete`。
6. 只请求一次 Calibrated；成功进入 completed，失败进入 result-error。

### 6.2 重置

1. POST `{command:"reinit"}`，立即进入 `resetting`，两按钮都禁用。
2. `execute success` 只更新反馈文案，继续等待。
3. `reinit complete` 后清空 Calibrated、动作、错误和完成结论，回 `initial`。
4. 不等待 `command=init,status=""`。

### 6.3 失败

- `execute fail` 显示固定文案“执行命令失败”，清空当前动作与 Calibrated，解除按钮。
- 用户可手动选择启动或重置；Web 不自动重试。
- 连接/读取异常显示“适配服务连接异常”，结果发布异常显示“结果文件读取失败”，三类错误不得共用“测试失败”。

## 7. API 接入

| 接口 | 调用点 | 成功更新 |
|---|---|---|
| `GET control-file` | 挂载 + 250ms 串行轮询 | 控制状态、当前动作推进、截图 flag。 |
| `POST control-file` start | 启动按钮 | 当前动作进入 start。 |
| `POST control-file` reinit | 重置按钮 | 当前动作进入 reinit。 |
| `GET data-files?phase=initial` | 每次 case2 挂载一次 | Initial 三项。 |
| `GET data-files?phase=calibrated` | 本轮已见 `execute success -> case complete` 后一次 | Calibrated 三项。 |
| `POST screenshot` | 截图状态机生成 Base64 后 | 保存回执与重新武装条件。 |

- 所有请求 `cache:"no-store"`。
- 页面卸载后的响应必须丢弃，不能回写新挂载实例。
- 不对命令 POST 自动 retry。
- GET 轮询只重试读取本身，不重放用户动作。

## 8. 热力图实现

参考 [case2--热力图叠加 1.md](../../01-参考资料/case2/Ui关键实现/case2--热力图叠加%201.md) 的双线性插值、配色、锚定和马赛克方法，但正式输入为动态 `Ny` 行 × `Nx` 列。

### 8.1 固定绘制参数

| 参数 | 值 | 坐标系 |
|---|---:|---|
| 参考地图 | `1974×1100` | 算法说明源坐标 |
| 锚定区 | `(750,400)-(1200,700)` | 参考地图左上角 |
| 热力离屏层 | `450×300` | 锚定区原始像素 |
| 马赛克 | `3px` 色块 + `1px` 缝 | 热力离屏层 |
| Alpha | `0.38` | 热力层叠加 |
| 运行底图 | `maps/heatmap-map-base.png`，`960×560` | 正式 runtime asset |

Canvas 使用运行底图的 `960×560` 内部尺寸。锚定区按归一化坐标映射：

```text
x0 = 750 / 1974 * canvasWidth
x1 = 1200 / 1974 * canvasWidth
y0 = 400 / 1100 * canvasHeight
y1 = 700 / 1100 * canvasHeight
```

先在 `450×300` 离屏 Canvas 上按参考算法生成带马赛克透明缝的 RGBA 热力层，再缩放绘制到运行底图锚定区。DOM 只缩放最终 Canvas，不重新解释矩阵。

### 8.2 动态矩阵边界

- `Nx>1`、`Ny>1`：使用参考双线性插值。
- `Nx=1`：x 方向固定取唯一列，只沿 y 插值。
- `Ny=1`：y 方向固定取唯一行，只沿 x 插值。
- `1×1`：整个锚定区使用同一归一化颜色。
- `max===min`：固定 `t=0.5`，避免除零。
- 每张矩阵按自身 `min/max` 归一化，保持 Initial 首屏渲染不因 Calibrated 到达而变化；热力颜色不单独用于宣称校准有效。

色标固定为蓝 `#2563EB` → 青 `#22D3EE` → 黄 `#FACC15` → 红 `#EF4444`，在 `0/0.33/0.66/1` 间分段线性插值。

Canvas 必须等待底图解码后再绘制；更新矩阵时只重绘对应卡片。Initial 与 Calibrated 不共享可变 Canvas 状态。

## 9. CDF、均值与降幅

### 9.1 CDF

严格采用参考 [case2-CDF曲线 1.md](../../01-参考资料/case2/Ui关键实现/case2-CDF曲线%201.md)：

1. 复制并升序排序 `N` 个样本，不修改 REST 原数组。
2. 对 `i=0..50`：`t=i/50`，`idx=floor(t*(N-1))`，点为 `x=sorted[idx]`、`y=(idx+1)/N`。
3. `N=1` 时 51 个点均为同一 x、`y=1`。
4. SVG 绘制阶梯线，不使用 Sigmoid。
5. Initial 单曲线时 x-domain 由 Initial 推导；completed 双曲线使用两组样本联合 min/max，确保同图可比。
6. min=max 时 x-domain 两侧增加 `max(1, abs(value)*0.05)`；y-domain 固定 `[0,1]`。

### 9.2 均值与柱图

- `mean = sum(samples)/N`。
- completed 的两个柱使用同一 y-domain；domain 必须包含 0，并兼容有限负值。
- Initial 柱只复用 `bar-initial-fill.png` 纹理，柱高由均值计算。
- Calibrated 柱使用 `--case2-color-calibrated`，不得复用静态原型柱高。

### 9.3 降幅与格式

- 仅在 `meanInitial > 0` 且两个均值有限时计算：
  `(meanInitial - meanCalibrated) / meanInitial * 100`。
- 其他情况显示“不可计算”，不显示固定百分比。
- 均值：最多两位小数、至少一位小数，例如 `5.0`、`3.14`。
- 降幅：最多一位小数，整数不显示 `.0`，例如 `40%`、`44.4%`。
- 不强行将负降幅改成正数；变差时保留负号。

## 10. 截图状态机

截图与 `viewPhase` 独立，不检查 `status`：

```text
armed(flag=0)
  -> flag=1
capturing
  -> POST success
awaiting-zero
  -> poll sees flag=0
armed

capturing
  -> capture/POST failure
pending-retry
  -> flag still 1 and no request in flight
capturing
```

规则：

1. 每次挂载把“上一标志”初始化为 `0`，因此首包为 `1` 也会触发。
2. `flag=1` 持续多个轮询周期时只能有一个截图请求在飞行。
3. POST 成功后必须等待轮询确认 `flag=0` 才重新武装，避免同一高电平重复截图。
4. 失败时保留请求；下一次轮询仍为 `1` 时可再次尝试。Node 适配服务负责用事务标记消除 HTTP/进程重启重复落盘。
5. 后端后续再次写 `1` 时生成下一张递增序号截图。

截取对象为 1920×1080 `ScaledStage` 内层节点，包含 Shell 与当前 case2，不包含开发工具、错误堆栈或静态原型 `review-dock`。克隆截图节点时强制：

- `width=1920`、`height=1080`、`pixelRatio=1`；
- 去掉视口缩放 transform；
- 等待 runtime 图片和字体准备完成；
- Canvas 内容必须被序列化进 PNG。

`toPng` 返回值去掉 `data:image/png;base64,` 前缀后作为 `image_base64` 发送。

## 11. 视觉与资源复用边界

### 11.1 正式可用

- `04-runtime-assets/shell/tokens.css`
- `04-runtime-assets/shell/brand-logo.png`
- `04-runtime-assets/shell/shell-nav-background.png`
- `04-runtime-assets/case2/tokens.css`
- case2 面板底图、列头图标、指标图标、按钮 SVG、Initial 柱纹理、降幅徽章/箭头
- `04-runtime-assets/case2/maps/heatmap-map-base.png`

Vite 配置 `@runtime-assets` alias 指向仓库根 `04-runtime-assets/`；源码通过 alias 导入，由构建工具复制/哈希到 `dist`，不在 `web/` 再复制一套资产。

### 11.2 只可参照，不可运行依赖

- `03-design/case2/case2-dt-calibration.pen`：冻结视觉证据。
- `web-static/case2/index.html` 与 `case2.css`：允许对照 DOM 分区、测量和 token 使用。
- `web-static/case2/case2.js`：禁止复用；它是假状态机、URL 状态模拟和 review 控件。
- 静态原型 calibrating 态曾保留重置按钮可用；正式实现以 Gate 2 互斥契约为准，启动或重置命令进行中两按钮均禁用。
- `heatmap-calibrated-represent.png`、静态 CDF path、写死均值/柱高/40%：禁止进入正式运行。
- `02-ux/` 与 `01-参考资料/`：不得被正式 Web bundle 直接读取。

## 12. 测试计划

### 12.1 纯逻辑

- reducer：initial → calibrating → completed；initial/completed → resetting → initial；任一路径 → failed。
- reducer：`execute success` 不完成；未见本轮 `execute success` 的 `case complete` 不读取数据。
- reducer：刷新/重新挂载没有 Calibrated；切 Tab 卸载后旧响应不能回写。
- CDF：`N=1`、动态 `N`、重复值、负值、51 点和不修改输入。
- 统计：均值、正/负降幅、Initial 均值为 0 的不可计算、格式化。
- 热力：`1×1`、`1×N`、`N×1`、`2×3`、常量矩阵、颜色 stop 与 alpha/mask。
- 截图：同一 flag=1 只发一次；见 0 后再次见 1 可发第二次；失败保留并可重试。

### 12.2 组件与视觉

- 四个设计态的文案、按钮状态和 Calibrated 可见性。
- 适配错误、结果错误和 `execute fail` 使用不同文案。
- 三项指标只通过配置映射复用同一组件，不复制三套状态逻辑。
- 1920×1080 为 1:1；其他窗口只整体缩放、居中，无业务重排。
- case1/3/4 只显示“建设中”，不产生 case2 API 请求。
- CSS 扫描确认业务选择器被 CSS Modules 或 `.case2-page` 隔离。

### 12.3 Playwright 主线

1. 进入 case2：Initial 三热力图、CDF/均值基线可见，Calibrated 为空。
2. 点击启动：POST shape 正确，两按钮禁用，无旧 Calibrated。
3. `execute success`：仍处于校准中。
4. `case complete` + 六文件有效：显示新热力图、双 CDF、双均值柱和运行时降幅。
5. 点击重置：两按钮禁用；`reinit complete` 后清空 Calibrated，回 Initial。
6. `execute fail`：显示“执行命令失败”，解除按钮，允许手动重试。
7. 缺一个 Calibrated 文件：整批不显示，进入结果错误。
8. 刷新 completed 页面：回 Initial，不自动读取旧结果。
9. 切到其他 Tab：case2 轮询停止；切回仍从 Initial 开始。
10. 连续两次 `save_picture_flag: 0 -> 1 -> 0 -> 1`：上传两次并得到递增文件。

## 13. 明确不做

- 不将业务状态放进 Shell 或跨 case 全局 store。
- 不实现 WebSocket、Socket.IO、SSE、业务超时、命令自动重试、取消或队列。
- 不读取 AOA、ZOA、`without dt` 或其他 case 数据。
- 不缓存或恢复旧 Calibrated，不把参考文件包装成本轮结果。
- 不用热力颜色单独下“校准有效”结论；结论以当前批次 CDF 和均值为依据。
- 不直接修改 `web-static/` 作为正式实现。
