# case1 RF / case2 热力图：无效格 `-1` 功能微调 Spec

> 状态：需求已确认，**实现进行中 / 主代码已落地**（见 `code/web`、`code/server`；正式 Gate 文档回写待补）。case1 Node 两位小数归一与越界计数日志为后续 TODO。
>
> 范围：
> - **case2**：三张热力矩阵（Initial / Calibrated；RSS / 有效径数 / 时延）
> - **case1**：RF 层热力矩阵（`heatmap_rss.txt` → RF map），显示机制与 case2 **相同**
>
> KPI `-1` 仍不进入 CDF、均值或降幅。本 Spec 的热力图改造不定义 KPI 的 Node 范围处理；后续已确认当前三个 KPI 下限均为 `-1`，Node 将低于下限的值钳为 `-1` 并保留给 Web，Web 再排除该哨兵。细则见 `doc/case2/SERVER-SPEC.md` 与 `WEB-SPEC.md`。
> 配置：Web 根 `code/web/.env`；Node `code/server/.env`
> 说明：本文优先于旧文档中「矩阵出现 `-1` 则整张不画热力」的口径。实现后回写 `doc/case1/*`、`doc/case2/WEB-SPEC.md` / `SERVER-SPEC.md` 等。

---

## 1. 背景与目标

### 1.1 旧行为（废弃 · case2）

- Web：热力矩阵**任一格**为 `-1` → 该张卡**整张不画**热力叠层，只留底图空槽。
- Node：按指标范围双边掐位。RSS 范围含负值时 `-1` 能下发；有效径数 / 时延下限为 `0` 时，文件中的 `-1` 被钳成 `0` → 三张卡行为不一致。

### 1.2 新目标（case1 RF + case2 热力共用）

1. Node 相关热力门限下限为 `-1`。Node 不增加哨兵专用分支：字面 `-1` 落在正常范围内原样通过；低于 `-1` 的值按普通下限掐位变成 `-1`，由 Web 再按无效格规则显示。
2. Web **按格**处理 `-1`：默认透明（可配 RGBA），**不**再因存在 `-1` 整张取消热力。
3. `-1` **不参与**本张热力的 min/max 统计与配色；若 UI 展示数值 min，**不含** `-1`。
4. **case1 RF map 与 case2 热力同一套机制**（判定、着色、统计排除一致）。case1 已复用 `cases/case2/metrics/heatmap` 绘制时，应走同一算法入口，避免两套实现漂移。

### 1.3 无效格判定（已确认）

**唯一判据：**

```text
round(value, 2) === -1
```

含义：先按热力语义精度四舍五入到 **2 位小数**，再判断结果是否**严格等于** `-1`。

| 约定 | 说明 |
|---|---|
| Web 命中 | Node 下发值为 `-1`；在 Web 直接调用算法且未经过 Node 掐位时，round 到 2 位后等于 `-1` 的值也命中 |
| Web 不命中 | 例如 `-0.99`；按普通数参与统计、采样与配色 |
| 禁止 | 容差带（如 `-1.001 < · ≤ -0.999`）、`value < 0`、模糊 `ε` 比较 |
| 信任路径 | 若适配保证下发已是 2 位，可用 `value === -1`；推荐封装同一函数，内部仍「先 round 2 位再比」 |
| Node 与 Web | Node 只按 2 位小数语义归一并执行普通范围掐位，不判断哨兵；归一后 `< -1` 的值会被 Node 钳成 `-1`，Web 收到后按本条识别为无效格 |
| case1 / case2 | **同一判据**，不得 case 分叉 |

---

## 2. Node / 适配服务

### 2.1 热力范围配置

修改 `code/server/.env`（及 `.env.example` 默认值）为：

```env
# case2
CASE2_RANGE_HEATMAP_RSS=-1,500
CASE2_RANGE_HEATMAP_EFFECTIVE_PATH_NUM=-1,500
CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY=-1,1000

# case1 RF（与 case2 RSS 热力对齐）
CASE1_RANGE_HEATMAP_RSS=-1,500
```

| 键 | 新范围 |
|---|---|
| `CASE2_RANGE_HEATMAP_RSS` | `-1`～`500` |
| `CASE2_RANGE_HEATMAP_EFFECTIVE_PATH_NUM` | `-1`～`500` |
| `CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY` | `-1`～`1000` |
| `CASE1_RANGE_HEATMAP_RSS` | `-1`～`500` |

- 代码默认值（无 env 时）同步改为上述区间（当前 case1 代码默认仍为 `-500,500` 时需改掉）。
- 本文热力图改造不调整 case2 KPI 范围；后续已单独确认当前三个 KPI 范围下限为 `-1`，低于下限由 Node 钳为 `-1` 并保留，Web 从统计中排除 `-1`。

### 2.2 掐位规则（沿用现有双边掐位）

对**已按 2 位小数语义归一**后的每个热力格执行普通范围掐位，不增加 `-1` 哨兵专用处理：

| 条件 | 结果 |
|---|---|
| `value < min`（即 `< -1`） | 钳为 `min`（`-1`） |
| `value > max` | 钳为 `max` |
| `min ≤ value ≤ max` | 原样下发（含字面 `-1`） |

不因 `-1` 删格、不因出现 `-1` 判文件非法。越界仍记 `invalidCount` warn。

因此，按 2 位语义归一后仍 `< -1` 的值（例如 `-1.01`）会按下限规则变成 `-1` 并计入越界 `invalidCount`；Web 收到该格后将其作为无效格。归一后等于 `-1` 的值则在范围内，不记越界。

### 2.3 去除冗余

- 不再为「热力 `-1` → 整张作废」保留 Node 侧特殊分支（若有）。
- `-1` 在 Node 出口仅是区间内数值；**语义解释完全交给 Web**。
- 不区分「文件故意写的 `-1`」与「被钳到 `-1` 的值」。

### 2.4 验收（Node）

- case2 三热力文件写入字面 `-1` → data-files 对应格仍为 `-1`。
- case1 `heatmap_rss.txt` 写入字面 `-1` → RF 数据接口矩阵对应格仍为 `-1`。
- 写入 `< -1` → 响应为 `-1`，并有越界掐位日志。
- 写入 `> max` → 仍钳到 max。

---

## 3. Web 显示规则（case1 RF + case2 共用）

### 3.1 废弃规则（case2）

- 「矩阵含任意 `-1` → 不渲染 canvas、只显示底图空槽」整卡短路。
- 「含 `-1` 则色标两端一律 `—`」且不画有效格（改为按有效格统计）。

### 3.2 新规则（两边一样）

#### （1）`-1` 格着色（可配置）

- 若 `round(value, 2) === -1`：该格用独立 RGBA，**不走**伪彩插值。
- 默认：`RGBA(255,255,255,0)`（白 + 全透明，露底图）。
- 配置在 `code/web/.env`，改完需重启 Vite / rebuild。

**case2：**

```env
VITE_CASE2_HEATMAP_INVALID_R=255
VITE_CASE2_HEATMAP_INVALID_G=255
VITE_CASE2_HEATMAP_INVALID_B=255
VITE_CASE2_HEATMAP_INVALID_A=0
```

**case1：**

```env
VITE_CASE1_HEATMAP_INVALID_R=255
VITE_CASE1_HEATMAP_INVALID_G=255
VITE_CASE1_HEATMAP_INVALID_B=255
VITE_CASE1_HEATMAP_INVALID_A=0
```

- 两组键默认值相同；**case 隔离命名**，不互相覆盖，但语义与默认必须一致。
- `R/G/B/A` 均使用 RGBA 通道整数，范围 `0～255`，配置入口必须严格校验整数及范围。默认 `A=0`，即全透明。
- 无效格 alpha 按 `A / 255` 写入离屏 RGBA；绘制时仍乘以现有热力层透明度（case2 默认 `0.38`），即最终 alpha 为 `(A / 255) × 热力层透明度`。默认全透明不受热力层透明度影响。
- 绘制：case1 `RfView` 已调用 case2 `paintHeatOverlayOnCanvas` 时，应把 INVALID RGBA 纳入共享 `HeatmapConfig`（或等价参数），由**同一套** mosaic/paint 逻辑着色，禁止 case1 另写一套 `-1` 分支。

#### （2）统计、双线性采样与无效邻点（算法钉死）

**现状问题：** 现实现 `matrixMinMax` / `sampleBilinear` 会把无效值当普通数参与 min/max 与四角加权（见 `heatmap.ts`）。仅写「屏蔽 -1」不够：须规定有效邻点权重如何归一、以及四角全无效时输出什么。

##### （2.1）本张范围统计

- `eMin` / `eMax`：**只遍历** `round(v,2) !== -1` 的格。
- 有效格为空：不定义配色用的 `eMin/eMax`；离屏像素凡需伪彩的路径都不走，按（2.3）无贡献处理（整幅 INVALID / 透明）。
- 有效格恰好 1 个，或全部有效值相等：沿用现规则，伪彩 `t = 0.5`。

##### （2.2）双线性：有效邻点权重重新归一化

离屏像素 `(x,y)` 仍按现映射得到连续坐标 `(gx,gy)` 与四角下标 `(x0,y0)/(x1,y0)/(x0,y1)/(x1,y1)` 及分数 `fx,fy`（与现 `sampleBilinear` 相同，不改拓扑）。

四角原始双线性权重（与现式一致）：

| 角 | 矩阵值 | 原始权重 `w` |
|---|---|---|
| 00 | `v00` | `(1-fx)(1-fy)` |
| 10 | `v10` | `fx(1-fy)` |
| 01 | `v01` | `(1-fx)fy` |
| 11 | `v11` | `fx·fy` |

对每个角：

1. 若该角 `round(v, 2) === -1`（无效）：**丢弃**该角，不把 `-1` 代入数值。
2. 若有效：保留原始权重 `w`。

令有效角权重和 `W = Σ w_valid`。

| 情况 | 采样结果 |
|---|---|
| `W > 0` | `ê = Σ (v_i · w_i) / W`（仅有效角）；再 `normalizeScalar(ê, eMin, eMax)` → 伪彩 RGB，马赛克色块 alpha 仍按现规则（色块 255 / 缝 0） |
| `W === 0`（四角皆无效，或退化到同一无效格） | **无有效贡献** → 该像素不走伪彩，写入 **INVALID RGBA**（默认 A=0，即透明露底图） |

说明：

- 1～3 个角有效时，相当于在剩余角上做**重归一双线性**（或退化为线性 / 最近点），有效值不会被 `-1` 拉歪。
- **禁止**用 `0`、`eMin` 或任意哨兵替代值去「填」无效角再做原双线性。
- 判定无效用 §1.3；与 Node 下发的 `-1` 对齐。

##### （2.3）空间覆盖（本 Spec 选定：矩阵格硬切）

马赛克色块像素先按等分矩形映射到所属矩阵格 `(row, col)`（`floor(x * cols / rangeW)` / `floor(y * rows / rangeH)`，右/下边界钳到末格）：

1. 若该格 `round(v,2) === -1` → **整格**写 INVALID RGBA，**不**再走双线性伪彩。
2. 否则再按（2.2）双线性采样着色（有效角重归一；`W === 0` 仍写 INVALID）。

因此：连续无效行/列在视觉上是完整挖空（默认透出底图），有效色不会渗进无效格矩形。有效格内部仍用双线性平滑。

##### （2.4）与马赛克缝的关系

- `CELL` / `GAP` 马赛克周期逻辑不变：缝像素 alpha=0；色块像素按（2.2）着色。
- 色块内若 `W === 0`，写 INVALID RGBA（默认全透明），不是伪彩。

#### （3）色标 / 示图（case1 与 case2 拉齐）

**废弃 case1 现网错误图例：**「信号强度 / 强 / 弱」+ 仅色条（无有效数据 min/max）。RF 图例应按 **case2 热力卡色标**拉齐。

统一结构（小卡 / RF 底栏均可按视觉比例缩放，语义一致）：

| 从左到右 | 内容 |
|---|---|
| 标题 | 指标名（case2 如「有效径数」；case1 RF 如「接收信号强度」或现网「信号强度」文案以视觉稿为准，但**不要**再用「强」「弱」两端） |
| 左侧数字 | 本张**有效格** min，**1 位小数**；**不含 `-1`** |
| 色条 | 与 case2 相同语义的分段/渐变示意（实现可复用 case2 色条样式） |
| 右侧数字 | 本张**有效格** max，**1 位小数**；**不含 `-1`** |

- 有效格全空（整张皆无效格）→ 两端显示 `—`；canvas 仍可画满 INVALID 色。
- case1 `c1-legend` 需改 DOM/样式以承载上述结构；不再使用 `强` / `弱` 文案作为色轴两端。

### 3.3 影响范围

| Case | 代码触点（预期） |
|---|---|
| case2 | `HeatmapCard`、`heatmap.ts`、`heatmapConfig.ts`；拆除整卡短路 |
| case1 | `RfView` + 共享 heatmap 绘制；`config.ts` 读 `VITE_CASE1_HEATMAP_INVALID_*`；**重做 `c1-legend`**（去掉强/弱，改为与 case2 一致的数值色标） |
| 共享 | `isHeatmapInvalid`（round2===-1）、`matrixMinMax` 排除无效、`sampleBilinear` 有效权重重归一 / `W===0`→INVALID、mosaic/paint |

### 3.4 验收（Web）

| 场景 | case2 | case1 RF |
|---|---|---|
| 无 `-1` | 现网一致 | 现网一致 |
| 部分格 `-1` | 有热力；无效格透明；色标 min/max 不含 `-1` | 同左；图例为数值 min/max（非强/弱） |
| 全 `-1` | 叠层默认不可见；色标 `—` | 同左 |
| 改对应 `VITE_*_HEATMAP_INVALID_*` | 无效格颜色/透明度变化 | 同左 |

---

## 4. 配置清单汇总

### 4.1 Node（`code/server/.env`）

```env
CASE2_RANGE_HEATMAP_RSS=-1,500
CASE2_RANGE_HEATMAP_EFFECTIVE_PATH_NUM=-1,500
CASE2_RANGE_HEATMAP_FIRST_PATH_DELAY=-1,1000
CASE1_RANGE_HEATMAP_RSS=-1,500
```

### 4.2 Web（`code/web/.env`）

```env
VITE_CASE2_HEATMAP_INVALID_R=255
VITE_CASE2_HEATMAP_INVALID_G=255
VITE_CASE2_HEATMAP_INVALID_B=255
VITE_CASE2_HEATMAP_INVALID_A=0

VITE_CASE1_HEATMAP_INVALID_R=255
VITE_CASE1_HEATMAP_INVALID_G=255
VITE_CASE1_HEATMAP_INVALID_B=255
VITE_CASE1_HEATMAP_INVALID_A=0
```

---

## 5. 非目标 / 不做

- 不做「仅靠双线性 `W===0` 软边」作为无效区唯一覆盖（已改为 §3.2.2.3 矩阵格硬切；有效格内部仍双线性）。
- 不用容差带判定 `-1`。
- 不把钳位 `-1` 与字面 `-1` 分成两个协议字段。
- case2 KPI 的 `-1` 仍不进入统计；Node 当前低于 KPI 下限时钳为 `-1` 并保留，Web 排除该哨兵。
- 不保留 case1「强/弱」图例（已判定为错误，须改成与 case2 一致的数值色标）。
- 不改色标色序相对 case2 热力卡的既有约定（除非另开需求）；case1 与 case2 **同序同语义**。
- 不把联调输出默认提交。

---

## 6. 实现顺序建议

1. Spec 口径冻结（本文）。
2. Node：四门限 + 代码默认值 + 例测（case2 三文件 + case1 `heatmap_rss`）。
3. 共享算法：`round2 === -1` 判定、min/max 排除、INVALID 上色；拆除 case2 整卡短路。
4. case2 / case1 配置入口与 env 示例。
5. 单测 + 本地文件埋 `-1` 目视。
6. 回写 case1 / case2 正式 Gate 文档。

---

## 7. 决策记录

| 项 | 结论 |
|---|---|
| 无效格判定 | `round(value, 2) === -1`（已确认） |
| 双线性遇无效邻点 | **有效角权重重新归一化**；`W===0` → 该像素 INVALID RGBA（默认透明） |
| 无效格空间覆盖 | **矩阵格等分矩形硬切**：所属格为 `-1` 则整格 INVALID；有效格内仍双线性（有效角重归一） |
| Web 配置路径 | `code/web/.env` |
| case2 配置前缀 | `VITE_CASE2_HEATMAP_INVALID_*` |
| case1 配置前缀 | `VITE_CASE1_HEATMAP_INVALID_*`（默认同 case2） |
| 默认 INVALID 色 | 白 + 透明度 0 |
| INVALID RGBA 通道 | `R/G/B/A` 均为 `0～255` 整数；实际离屏 alpha 为 `A/255`，再乘现有热力层透明度 |
| 旧「有 `-1` 整张不画」 | 废弃 |
| case1 RF | **与 case2 同一机制**（本次纳入） |
| case1 RF 图例 | **废弃「强/弱」**，拉齐 case2：标题 + 有效 min + 色条 + 有效 max（1 位小数；不含 `-1`） |
| Node 门限 | case2 三热力 + case1 RF 下限均为 `-1`；只按普通范围掐位，不做哨兵专用分支；归一后低于 `-1` 的值钳为 `-1` 并由 Web 显示为无效格 |
| case2 KPI `-1` | 不进入 CDF / 均值 / 降幅；当前默认下限为 `-1`，Node 低侧钳位后保留，Web 按哨兵排除 |
