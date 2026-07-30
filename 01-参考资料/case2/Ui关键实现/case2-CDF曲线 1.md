# Case2 CDF — 数据读取与计算原理（AI 精简版）

> Case2 / DT Calibration / KPI 面板  
> 用途：对比 **Initial DT** 与 **Calibrated DT** 的误差累积分布（CDF）

---

## 1. 数据文件

### 1.1 与热力图分离

| 类型 | 文件示例 | 形状 | 用途 |
|------|----------|------|------|
| 热力图 | `heatmap_init_rss.txt` | 20×20 | 空间误差分布 |
| **KPI CDF** | `heatmap_init_kpi_rss.txt` | 4×5（20 值） | 统计 CDF |

### 1.2 KPI 文件清单

```
data/c2/
├── heatmap_init_kpi_rss.txt
├── heatmap_cali_kpi_rss.txt
├── heatmap_init_kpi_effective_path_num.txt
├── heatmap_cali_kpi_effective_path_num.txt
├── heatmap_init_kpi_first_path_delay.txt
├── heatmap_cali_kpi_first_path_delay.txt
├── heatmap_init_kpi_first_path_aoa.txt      # debug
├── heatmap_cali_kpi_first_path_aoa.txt
├── heatmap_init_kpi_first_path_zoa.txt      # debug
└── heatmap_cali_kpi_first_path_zoa.txt
```

命名规则：`heatmap_{init|cali}_kpi_{指标}.txt`

---

## 2. 数据读取原理

### 2.1 文件格式

- 纯文本，每行一行数据
- 行间：`\\n` 分隔
- 行内：逗号或空白分隔的浮点数

```
3 4 5 6 7
3 4 5 6 7
3 4 5 6 7
3 4 5 6 7
```

### 2.2 解析伪代码

```
function loadHeatmapFile(filePath) -> Matrix[R][C]:
    text = readFile(filePath)
    lines = trim(text).split("\n")
    matrix = []
    for line in lines:
        row = trim(line).split(/[\s,]+/).map(parseFloat)
        matrix.append(row)
    return matrix
```

### 2.3 展平为一维样本

CDF 输入必须是一维数组：

```
samples = matrix.flat()   // 4×5 → 长度 20 的 float[]
```

示例：

```
init:  [3,4,5,6,7, 3,4,5,6,7, 3,4,5,6,7, 3,4,5,6,7]   // 20 个
cali:  [1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5]   // 20 个
```

### 2.4 读取时机

| 阶段 | 读取文件 |
|------|----------|
| 初始化 | `heatmap_init_kpi_*.txt` |
| 校准完成 | 追加读取 `heatmap_cali_kpi_*.txt` |

算法/TstAgent 在校准结束后写入 `heatmap_cali_kpi_*.txt`。

---

## 3. CDF 计算原理

### 3.1 定义

给定 \(n\) 个误差样本 \(x_1, x_2, \ldots, x_n\)，**经验累积分布函数**：

\[
F(x) = \frac{1}{n} \sum_{i=1}^{n} \mathbf{1}(x_i \le x)
\]

即：误差 **不超过** \(x\) 的样本占比。

### 3.2 计算步骤

1. 排序：\(x_{(1)} \le x_{(2)} \le \cdots \le x_{(n)}\)（升序）
2. 对每个排序位置 \(k = 1, 2, \ldots, n\)：

\[
F(x_{(k)}) = \frac{k}{n}
\]

3. 得到 \(n\) 个台阶点：\((x_{(k)},\ k/n)\)

### 3.3 本项目采样方式

从 \(n\) 个台阶点中 **均匀抽取 51 个点** 作为曲线坐标（\(t = 0, \frac{1}{50}, \frac{2}{50}, \ldots, 1\)）：

\[
\text{idx} = \lfloor t \cdot (n - 1) \rfloor
\]

\[
x = x_{(\text{idx}+1)}, \quad y = \frac{\text{idx} + 1}{n}
\]

（代码中 idx 从 0 起，故 \(x = x_{(\text{idx}+1)}\) 等价于取排序数组第 idx 个元素）

### 3.4 手算示例（n=5）

样本：`[5, 2, 8, 2, 5]`

| k | 排序后 \(x_{(k)}\) | \(F(x) = k/n\) |
|---|-------------------|----------------|
| 1 | 2 | 0.20 |
| 2 | 2 | 0.40 |
| 3 | 5 | 0.60 |
| 4 | 5 | 0.80 |
| 5 | 8 | 1.00 |

含义：20% 样本误差 ≤ 2；100% 样本误差 ≤ 8。

### 3.5 双曲线对比

| 曲线 | 输入 |
|------|------|
| Initial DT | `samples_init` → CDF → 点集 \(\{(x_i, y_i)\}\) |
| Calibrated DT | `samples_cali` → CDF → 点集 \(\{(x'_j, y'_j)\}\) |

**判读**（误差越小越好）：同一 \(y\) 下 \(x\) 更小 → 更好；Calibrated 曲线相对 Initial **左移** → 校准有效。

---

## 4. CDF 计算伪代码

```
function generateCDFCurve(samples: float[]) -> Point[]:
    n = length(samples)
    if n == 0: return []

    sorted = sortAscending(samples)
    points = 50
    cdfData = []

    for i = 0 to points:
        t = i / points                    // 0, 0.02, 0.04, ..., 1.0
        idx = floor(t * (n - 1))          // 0 .. n-1
        x = sorted[idx]                   // 误差值
        y = (idx + 1) / n                 // 累积概率 ∈ (0, 1]
        cdfData.append({x, y})

    return cdfData
```

### 4.1 完整流程伪代码

```
// 1. 读数据
initMatrix  = loadHeatmapFile("data/c2/heatmap_init_kpi_rss.txt")
caliMatrix  = loadHeatmapFile("data/c2/heatmap_cali_kpi_rss.txt")

initSamples = flatten(initMatrix)   // len = 20
caliSamples = flatten(caliMatrix)   // len = 20

// 2. 算 CDF
cdfInit = generateCDFCurve(initSamples)   // 51 个点
cdfCali = generateCDFCurve(caliSamples)   // 51 个点

// 3. 统计量（可选）
avgInit = sum(initSamples) / len(initSamples)
avgCali = sum(caliSamples) / len(caliSamples)

// 4. 输出
// cdfInit, cdfCali → 每条为 [(x,y), ...]，x=误差，y=累积概率
// 对比：cdfCali 整体 x 偏小 → 校准改善
```

---

## 5. 五个指标（同一算法）

| 指标 | init 文件 | cali 文件 |
|------|-----------|-----------|
| RSS | `heatmap_init_kpi_rss.txt` | `heatmap_cali_kpi_rss.txt` |
| Effective Path Num | `heatmap_init_kpi_effective_path_num.txt` | `heatmap_cali_kpi_effective_path_num.txt` |
| First Path Delay | `heatmap_init_kpi_first_path_delay.txt` | `heatmap_cali_kpi_first_path_delay.txt` |
| First Path AOA | `heatmap_init_kpi_first_path_aoa.txt` | `heatmap_cali_kpi_first_path_aoa.txt` |
| First Path ZOA | `heatmap_init_kpi_first_path_zoa.txt` | `heatmap_cali_kpi_first_path_zoa.txt` |

---

## 6. 备注

- **方法**：经验 CDF（Empirical CDF），**非** Sigmoid 解析曲线
- **配置项** `cdfSigmoidSteepness` / `cdfSigmoidOffset` 存在于 `dt-config.js`，**当前 KPI CDF 未使用**
- **与 Case4 区别**：Case4 可用预生成 `*_cdf.txt`；Case2 由 KPI 矩阵 **前端实时** 算 CDF（算法只需写 KPI 矩阵即可）

---

## 7. 一句话

> 读 `heatmap_*_kpi_*.txt` → 展平为样本 → 排序 → \(F(x_{(k)})=k/n\) → 51 点采样 → Initial / Calibrated 两条 CDF 对比。
