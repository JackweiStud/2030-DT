# case2 视觉格式说明

> 只描述视觉格式与层级；不描述接口字段、算法或业务数据格式。
> 设计源：`03-design/case2/case2-dt-calibration.pen`

## 1. Shell 依赖与画布

- 基准画布：`1920×1080`（frame：`EMJd9` / `RCHHQ` / `rdP2e`）。
- Shell 规则：浏览器窗口变化时，整页舞台等比缩放并居中；case2 内部不做业务重排。
- Shell 资产与公共 token 位于 `../shell/`；本文件仅记录 case2 在该 Shell 中的视觉占位。
- 页面底色：`#191a1a`。

## 2. 布局边界（测量）

| 区域 | 尺寸 / 规则 |
|---|---|
| ShellHeader | 高 78，宽 1920；品牌区宽 540；Tab 区 x=607、宽 689、gap 20 |
| 主内容区 | 高 fill（1002），padding 10，内部垂直 gap 12 |
| 主内容行 | 1900×987，水平，gap 30，padding `[10,20]` |
| 校准对比面板（左） | 1066×970，圆角 12，padding 15，垂直 gap 10 |
| KPI 对比面板（右） | 764×970，圆角 12，padding 15，垂直 gap 10 |
| 热力对比行 | 高 278，两卡横排，实例 gap 25 |
| 热力卡 | 圆角 8，描边 `#334155` 1px；指标标签 absolute 左上 |
| KPI 行 | 上标题 hug + 下图表行；图表行：CDF 400×260 + 柱图 291 宽，gap 12 |

## 3. 地图底图与热力层

```
HeatmapCard
├── MapBase          固定静态资源（maps/heatmap-map-base.png）
├── HeatRepresent    未来运行时动态绘制（Gate 1.5 仅代表色块/代表态切图）
└── MetricTag        固定标签底图 + 文案
```

- Initial / Calibrated 两卡共用同一场景底图填充模式（`fill`）。
- Initial 代表层：绿色矩形 `#22c55e66`（`83,51` / `333×176`）。
- completed 的 Calibrated 代表层：`maps/heatmap-calibrated-represent.png`（`40,39` / `400×200`，`opacity: 0.6`），对齐 `rdP2e` 对 `vnGTY` 的实例覆盖；非完成态 Calibrated 不显示代表层。
- 上述均为代表态，不是业务热力烘焙结果。

## 4. CDF / 柱图 / 指标卡视觉约束

### CDF（`CDF对比区`）

- 区域约 400×260，内边距 `[8,10]`，圆角 8。
- 网格线 `#ffffff33`；轴标 `#939393`，字号 9。
- Initial 曲线 `#939393`；Calibrated 曲线 `#22D3EE`；线宽 2。
- 阶梯路径为设计代表几何；正式前端按样本重算。

### 平均值对比（`平均值对比区`）

- 宽约 291，圆角 8，内边距 10。
- Initial 柱使用纹理填充资源；Calibrated 柱纯色 `#22D3EE`。
- Ghost 框描边 `#9CA3AF`；降幅徽章使用底图资源，文案模板 `↓ {reductionPct}%`（数值不冻结）。

### 指标标题

- RSS / Effective Path Num / First Path Delay 三色体系：`#3B82F6` / `#A855F7` / `#EAB308`。
- KPI 标题格式：`英文 (中文)`，副中文层在设计中 `enabled:false`。

## 5. 固定静态资源 vs 运行时动态

| 固定静态资源 | 未来运行时动态绘制 |
|---|---|
| 品牌 Logo、导航底图 | 热力色场插值与马赛克掩膜 |
| 面板标题装饰条、列头图标 | CDF 经验分布曲线 |
| 指标标签底图、KPI 指标图标 | 均值柱高、均值数字 |
| 地图场景底图 | 降幅百分比 |
| 按钮 Lucide 图标 SVG | 状态机驱动的徽章文案切换（数据侧） |
| `tokens.css` | 截图落盘、文件轮询等（非视觉） |

## 6. 状态视觉差异（以 Pencil 实读为准）

| 状态 | Frame ID | 状态徽章 | Calibrated KPI |
|---|---|---|---|
| initial | `EMJd9` | 「等待启动测试」muted | Calibrated CDF/柱/降幅关闭 |
| calibrating | `RCHHQ` | 「测试运行中」cyan | 同上（进行中，无完成结论） |
| completed | `rdP2e` | 「已完成」success + 绿底 | 双曲线 + 双柱 + 降幅代表态 |
| failed | **设计源无独立 frame** | 静态原型按 error token 补建 | 同 initial：保留 Initial，不展示完成结论 |

## 7. 禁止写入本文件的内容

热力图数值、CDF 点位、均值、降幅算法、接口字段、锁与轮询周期——均属 Gate 2/3。
