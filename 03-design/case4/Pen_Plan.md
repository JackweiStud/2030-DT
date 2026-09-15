# Pencil Plan — case4 DT for positioning

## Target

- Output `.pen`：`/Users/jackwl/Code/2030-DT/03-design/case4/case4.pen`
- Canvas：1920×1080，每业务态一帧；异常用状态板，避免无必要整页复制
- Quality：标准重建
- Existing `.pen` handling：原地修改已授权；**保留**全部现有 case3V1 帧与可复用组件

## 修改基线与变更集

| 类别 | 节点/区域 | 处理 | 验证方式 |
|---|---|---|---|
| 保留 | 全部 `case3V1.*` 帧、HeJpZ/B6761/c0EO9c/fYdoo/波束/开销/BA 等组件 | 不删、不改组件定义 | 顶层仍在；case3 截图不被这次改动 |
| 新增 | `case4.*` 帧与 case4 专用组件 | 放在现有帧右侧空位 | FindEmptySpace + snapshot_layout |
| 更新 | 仅 case4 帧内的顶栏 **实例** descendants | 高亮 `DT for positioning` | 基线帧仍高亮 Comm new |
| 禁止触碰 | `03-design/case3/**`、`03-design/case3V1/**`、正式 Web/Node、参考 TXT | 不写 | git 不提交 |

## Pencil MCP 执行规则

- Schema：`get_app_state({include_schema:true, include_canvas_design:true, include_scripts_and_shaders:false, include_browser:false})`
- 现有结构：`Get` 分批；变量 `GetVariables` 后 **merge** 新增，不 `replace:true`
- 批次：token → 专用组件 → 复制初始骨架改 Dock/HUD → 派生其余帧 → 异常板 → 校验
- 失败先 `Get` 现状，不整批重放
- 新根帧全程 `placeholder:true`，完成再关掉
- 图片只作参考；与 `doc/case4/` 冲突时以文档为准

## Frames

| Frame | State | 源图 | 差异要点 |
|---|---|---|---|
| `case4.初始` | 初始 | 初始效果图 | 预期轨迹+未跑点；无实时线；误差空槽；KPI 空态 `--`；开始可用 |
| `case4.测试中` | 测试中 | 运行中整体效果 | 三线到 P13；误差填 1–13；当前列+光标；吞吐有线；CDF/CEP/NLOS「等待最终统计」；双禁，播放用执行中切图，**不用暂停** |
| `case4.完成` | 完成 | 完成效果 | 满窗误差+完整轨迹；CDF 三线；CEP50/90 有值无增减%；NLOS 有值；开始灰重置可用；文案「已完成」 |
| `case4.完成悬停` | 完成+悬停 P13 | 完成+浮层规则 | P13 列高亮；浮层标题「P13定位误差」 |
| `case4.等待最终统计` | complete 信号已到、四文件未齐 | 无 | 地图/误差/吞吐同完成；底部统计仍等待；双禁 |
| `case4.现场环境` | 弹窗 | 复用 case3V1.点击现场环境 | 仅改 Tab 高亮；弹窗内容不改 |
| `case4.异常状态板` | 五个变体 | 无 | 控制条+横幅组合，非整页五开 |

不画：3D 真开、反射路径、单方案显隐、CEP 增减%。

## Component Tree

```text
Case4Frame
├── 共享顶栏（ref HeJpZ，Tab=DT for positioning）
└── Case4Page
    ├── 地图舞台
    │   ├── 场地底图
    │   ├── 变换层
    │   │   ├── 预期轨迹
    │   │   ├── 传统基站轨迹
    │   │   ├── 商用方案轨迹
    │   │   ├── DT辅助轨迹
    │   │   ├── 路线点位组
    │   │   └── 终端标记
    ├── 地图浮层
    │   ├── 顶部蒙版
    │   ├── 测试对比
    │   ├── 视图切换
    │   ├── 现场环境入口
    │   └── 轨迹图例
    └── 底栏
        ├── 定位误差回溯
        │   ├── 控制条
        │   ├── 误差Y轴
        │   └── 点位窗口（20 槽）
        └── 指标卡行
            ├── 定位误差（CDF+CEP50+CEP90）
            ├── NLOS占比
            └── 吞吐率对比
```

## Reusable Components

| Component | Props | Usage | Notes |
|---|---|---|---|
| `case4.控制条` | status, play=ready\|busy\|disabled, reset=on\|disabled | 每业务帧一实例 | 切图 `btn-play.png` 等 |
| `case4.点位误差列` | label, current, filled, errs[3] | ×20 | 空槽无点 |
| `case4.轨迹图例项` | color, label, dashed | ×4 | 不可点 |
| `case4.误差浮层` | pointNo, three rows | 悬停帧 | |
| `case4.状态横幅` | tone, title, detail | 异常板 | |
| `case4.定位误差卡` | mode=empty\|wait\|filled | KPI | 含 CDF 与两 CEP |
| `case4.NLOS卡` | mode=empty\|wait\|filled | KPI | |
| `case4.吞吐卡` | mode=empty\|filled | KPI | X=样点；可从 fYdoo 抄结构后独立，避免改原组件 |

## Asset Source Plan

与 `Design_Analysis.md` 同一张表。生成时嵌入 `./assets/site-2d.jpg`、`nav-bg.png`、`ue-*.png`、`btn-*.png`、`cursor-car.png`、`huawei-logo.png`、`cloud-site.png`。

禁止把波束/开销/BA 切图用进 case4 业务区。

## Diagram Decomposition

| Diagram | Static assets | Frontend-rendered layers | Parameters | Reference frames |
|---|---|---|---|---|
| 地图 | site-2d | 4 条 path、点位、UE | 收齐前缀 currentNo | 初始/测试中/完成 |
| 误差窗 | 槽底 | 三色点、当前列、光标 | window=20, errors | 空/P13/满/悬停 |
| CDF | 轴 | 3 polyline | 后端点列，概率单调 | 完成 |
| CEP | 轴、标签 | 柱高 | cep50/90 ×3，单位 m | 完成；无 Δ% |
| NLOS | 环刻度 | 弧、中心% | ratio 0–1 | 完成 |
| 吞吐 | 网格 | 2 polyline | sampleIndex, gbps | 测试中/完成 |

### 地图契约（给前端，不在 Pencil 重标定）

- 坐标系：复用 `code/web/src/cases/case3-v2/mapProjectionV2.ts` 与 `site-2d.jpg`
- 静态层：场地图 cover + hidden
- 动态层顺序：预期轨迹 < 三实时轨迹 < 点位 < UE
- 收齐：三 realtime 同一行到齐才推进 currentNo
- 无效值 65535：本轮不画专用图形

## Layer Naming Rules

- Frame：`case4.{state}`
- 区域：`地图舞台` / `地图浮层` / `底栏`
- 点列：`点位误差列/p{n}`
- 装饰挂组件下，禁止顶层 `Rectangle 128`

## Layout Contract

### Page

- Layout type：固定演示画布
- Primary axis：vertical（Header 叠顶 → 地图 fill → Dock 钉底）
- Breakpoints：无。Shell 等比缩放
- Scroll behavior：页面不滚；仅点位窗口 N>20 时横向滑（实现）；本设计代表窗口不画滚动条

### Regions

| Region | Parent | Sizing | Grid/Flex/Stack | Gap | Padding | Overflow |
|---|---|---|---|---|---|---|
| 共享顶栏 | Frame | 1920×80 | 绝对：左簇 \| 标题 \| 右簇 | — | — | 不换行 |
| 地图舞台 | Page | 1920 × fill | none + 底图 | 0 | 0 | hidden |
| 地图浮层 | Page | 1920 × 地图可视 | none，钉四边 | — | 顶 8–16 | 不压底栏 |
| 底栏 | Page | 1920 × hug ~430 | vertical | 12 | 12 | clip |
| 误差回溯 | 底栏 | fill × hug | horizontal：控制 hug + 轴 hug + 20 列 fill | 4 | 8 | 20 槽固定 |
| 指标卡行 | 底栏 | fill × ~225 | 三列，定位误差更宽 | 12 | 0 | 卡内 clip |

### Components

| Component | Width | Height | Internal layout | Text overflow | Reuse |
|---|---|---|---|---|---|
| 控制条 | ~186 | hug | 标题 / 状态 / 按钮行 | 状态一行 | 各帧实例改 props |
| 点位误差列 | fill | ~110 | 列头 + 槽 | Pn 不换行 | ×20 |
| 定位误差卡 | ~1.4fr | 225 | 水平三图 | `--` 或数字 | |
| NLOS卡 | ~0.8fr | 225 | 中心数值 | | |
| 吞吐卡 | ~1fr | 225 | 标题+图 | X 样点 | |
| 误差浮层 | hug ~240 | hug | 标题+三行 | | 仅悬停帧 |

## Tokens Draft

在现有变量上 **新增**（不覆盖 case3 名）：

| Token | Value | Usage | Confidence |
|---|---|---|---|
| `c4-plan` | `#3DDC97` | 预期轨迹 | 中，吸 UX |
| `c4-bs` | `#5B9BFF` | 传统基站 | 中 |
| `c4-gaode` | `#F0A12E` | 商用 | 中 |
| `c4-dt` | `#7A6BFF` | DT 辅助 | 中 |
| `c4-empty` | `#2A2F38` | 空槽 | 中 |
| `c4-wait` | `#94A3B8` | 等待文案 | 高 |

沿用：`font` Inter、`datafont` Geist Mono、`text`/`muted`、`radius-dock`、`color-panel`、`header-h`。

## 示意数据（非契约）

| 项 | 初始 | 测试中 | 完成 |
|---|---|---|---|
| 窗口 | P1–P20 空 | P1–P13 有点，P13 当前 | P1–P20 满；脚注示意 N=38 |
| CDF | 空 | 等待 | 三单调线；同概率 DT 误差更小（仅示意） |
| CEP50/90 | `--` | 等待 | 约 1.4/3.5、3.3/8.1、0.15/0.47 m 量级 |
| NLOS | `--` | 等待 | 约 90% 量级（样本 0.897，不用 UX 的 60 冒充） |
| 吞吐 | 空 | 双线，样点 1…n | 保留；with 略低于 without（忠实样本） |

## Missing States To Add

| State | Reason | Visual treatment | Needs approval |
|---|---|---|---|
| 等待最终统计 | 完成信号≠统计可展示 | 独立帧 | 否，文档已确认 |
| 异常五变体 | 失败/回退/适配 | 状态板 | 否 |
| 完成悬停 | 新交互 | 独立帧 | 否 |
| 现场环境 | 与 case3 一致 | 复制现帧改 Tab | 否 |

## User Approval Needed

本轮不因结构选择暂停。用户审阅时请重点看：

1. 完成态按钮/文案相对 UX 的纠正是否接受。
2. CDF 米级坐标、CEP90 独立、NLOS 不用 60、吞吐横轴样点是否接受。
3. 异常用状态板而非五张整页是否足够审阅。

后端四项遗留不在本计划决定。
