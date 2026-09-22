# case1 Frontend Spec（Gate 1 设计交接）

状态：`REVIEW_READY`  
设计源：`03-design/case1/case1-dt-construction.pen`  
Viewport：固定 1920×1080；由共享 Shell 等比缩放，case1 不做第二套断点重排。  
本文件不发明 REST 字段或 GLB 相机坐标；接口候选见 `doc/case1/TECHNICAL-PRECHECK.md`（未冻结）。

## Frame / Node

| Frame | Node ID | 评审方式 |
|---|---|---|
| case1-home | `NATU1` | Pencil 打开该帧目视 |
| case1-geometry | `J9nVp3` | 同上 |
| case1-material | `ag2DF` | 同上 |
| case1-rf | `JsMgu` | 同上 |
| 局部状态样板区 | `sft2y` | 同上 |

过程截图目录 `_qa/` 已删除、不入库；node id 以本表与 `.pen` 为准。

可复用组件：

| 组件 | Node ID | 职责 |
|---|---|---|
| 共享Shell参考 | `VRFL0` | 顶栏参考；运行时由 Shell 拥有，不在 case1 重实现所有权 |
| 左侧分层导航 | `EabWc` | 五层入口；图块 id：geometry `jIKDT` / material `YNPu7` / rf `OdA4l` / kg `HLEwM` / app `gZLfc` |
| KPI对比卡 | `k5buD9` | 标题/图标/off·on 柱与数值/变化徽标可分别绑定 |
| 标签胶囊 | `laWDU` | 描述标签 |
| 模型工具区 | `d3LPp` | 交互提示 + Reset |
| 局部反馈条 | `ttrUa` | 保存中/成功/失败短文案 |

KPI 子节点（实例内路径 `instanceId/<id>`）：标题 `z63n4b`、off 值 `lvH99`、on 值 `UrWuf`、off 柱 `V6utN1`、on 柱 `SLAsQ`、变化 `vwp31`、图标 `B5KAGV`。

## 组件树（接近前端）

```text
Stage 1920×1080
├─ Shell（共享）
└─ Case1Page
   └─ 内容区 horizontal flex（高 = 1080 - header）
      ├─ LayerNav fixed width≈500
      │  ├─ 标题
      │  └─ 五层组（局部定位堆叠图 + 标签）
      └─ RightPane fill vertical flex
         ├─ 区域标题 hug
         └─ HomeRows | DetailGroup fill
            ├─ OverviewRow horizontal（描述 + KPI/图例）
            └─ MainView fill（代表图/热力 + 绝对浮层工具/反馈）
```

## 布局契约

| 区域 | 父级 | 规则 |
|---|---|---|
| Stage | Shell | fixed 1920×1080；overflow hidden |
| 内容区 | Stage | horizontal；gap 20；padding 20；height fill |
| 左导航 | 内容区 | width fixed ~500；height fill；内部标题 hug + 五层组 fill；图块局部 x/y |
| 右内容 | 内容区 | width fill；vertical；gap 12；padding 16；圆角 panel |
| 首页说明行 | 右内容 | height 均分 fill；horizontal；描述固定宽 ~320–360；配图组 fill |
| 详情概述 | 右内容 | horizontal；描述 hug/fixed；KPI fill 或 fixed；材质图例 fill |
| 主视图 | 右内容 | fill；clip + 圆角；图像 cover；工具/反馈 absolute 右下/右上，不被裁切语义上属于浮层 |
| KPI 卡 | 概述 | vertical；绘图区 fill；柱高表达量级；0～1 指标与 RSS 误差轴域分离 |
| 溢出 | 全页 | 不出现页面滚动条；长文案在描述容器内换行 |

暗态：未选图块 `opacity ≈ 0.35`，尺寸与点击区不变。几何/电磁/RF 始终可点；知识图谱/应用层 `pointer-events: none`（或等价禁用），不可进入详情。

## 交互映射

| 用户动作 | UI 结果 |
|---|---|
| 首页点几何/电磁/RF | 切对应详情；当前层亮、其余暗 |
| 详情再点当前层 | 回首页；五图全亮 |
| 详情点其他可点层 | 切详情，不弹窗 |
| 点知识图谱/应用层 | 无动作 |
| 3D 拖拽/滚轮/右键 | 旋转/缩放/平移（实现）；设计仅代表图 |
| 交互结束 | 保存最近视角；反馈 pending/success/error |
| Reset | 恢复该层初始视角并持久化；非业务 ReInit |
| 资源/数据失败 | 局部重试；不锁左导航 |

## Token（设计变量）

颜色：`page-bg` `#1A1C1E`、`panel-bg` `#2A2C2E`、`card-bg` `#323436`、`text-primary/secondary/muted`、层强调 `accent-geo/em/rf/kg/app`、热力 `heatmap-low/mid1/mid2/high`（蓝青黄红）、`bar-off/on`。  
数值：`radius-panel/card/tag`、`gap-page/section/card`、`pad-panel`、`dim-unselected=0.35`。  
字体：设计稿 `Inter`（运行 Shell 仍可用 Inter + 中文回退栈）。

## 数据绑定（设计样例，非正式硬编码）

| 指标 | RF off | RF on | 变化 |
|---|---:|---:|---|
| 几何保真度 | 0.85 | 0.90 | ↑5.9% |
| 重构覆盖率 | 0.82 | 0.91 | ↑11.0% |
| 电磁信道保真度 | 0.88 | 0.92 | ↑4.5% |
| RSS 误差 | 1.20 | 0.80 | ↓33.3% |

规则：变化率 `(on-off)/off×100%` 一位小数；前三项升为改善，误差降为改善；off=0 隐藏百分比；相等隐藏徽标。标注为离线样例，非现场测试。

RF 热力（正式实现）：参考 case2——矩阵动态 Nx×Ny、min/max 归一化、双线性插值、蓝→青→黄→红马赛克透明叠加。当前底图旧色块不可验收。

## 局部状态变体

见样板区 `sft2y`：模型准备中/失败、数据读取中/失败、视角保存中/成功/失败、Reset。失败含重试控件；文案短、不撑版、不挡主视图主体。

## 资产与三轨边界

- 设计资产：`03-design/case1/assets/`（见 `SOURCE.md`）
- UX 源：`01-参考资料/case1/ux/`（只读）
- 运行资源：后续独立迁入 web case1 目录；GLB 不进设计源冒充可交互 3D
- Shell 品牌/顶栏资产属 Shell，不由 case1 改所有权

## 明确禁止

- 用整张 UX PNG 当可编辑页面背景
- 把旧 KPI 0.2/0.3/+50% 或旧 RF 绿橙红色标带进实现
- Layer 3 再写成「电磁层」
- 把 Reset 做成业务 ReInit / 写 control 文件
- 在缺少纯底图时宣称热力数据叠加已验收
- 发明未批准的 REST 字段名或相机坐标默认值
