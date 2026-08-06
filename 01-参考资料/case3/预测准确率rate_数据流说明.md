# Case3 波束预测正确率文件（ue_comm_with_dt_beam_accuracy_rate.txt）说明

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）

---
![[Pasted image 20260805143402.png|404]]
## 1. 是什么

| 文件 | 用途 |
|------|------|
| `data/c3/ue_comm_with_dt_beam_accuracy_rate.txt` | With DT 波束预测正确率的 **基线统计** |

前端读此文件，初始化 KPI 面板 **Beam Accuracy Rate** 饼图；With DT 跑完后还会叠加本次运行的统计。

**格式**：一行两个整数，逗号（,）分隔：

```
预测成功次数,总波束上报次数
```
 错误预测数 = 总次数-成功次数
 
打桩样例：`222,235` → 初始正确率约 94.5%。

**注意**1：只有这一个文件，没有 without 侧对应文件；文件名带 `with_dt` 表示该 KPI 归属 With DT 场景。
**注意**2：文件中为预置正确率基线（预测成功计数，总计数），初始化或 with DT UI重置操作时显示值；
测试后基于此基线，叠加Case中N个点位计数，刷新计算DT预测波束正确率（%）


---

## 2. 怎么产生（后端）

系统通过 **本地文件** 交换数据，不经 HTTP 写此文件。

### 生产环境

算法/主控在 Case3 运行前或运行中，将 **已累计** 的预测成功数、总上报数写入该文件（通常一行，覆盖或整文件重写均可；前端只读 **第一个非空行**）。

与 thrp/cost 不同：**Start 时前端不会 DELETE 此文件**，算法可按需更新基线。

### 打桩后端

`TstAgent/dt_assistant.py` 在收到 case3 的 `start` 后，将 `TstAgent/backup/case3/` **整包复制**到 `data/c3/`（含本文件，预制 `222,235`）。  
复制时机与其他 case3 文件相同，无单独逻辑。

---

## 3. 怎么消费（前端）

核心模块：`js/tab-comm.js`（`APP.Comm`）  
路径配置：`js/dt-config.js` → `DT_CONFIG.comm.beamAccuracyBaseline`

### 两阶段用法

| 阶段    | 时机                            | 数据来源                                  |
| ----- | ----------------------------- | ------------------------------------- |
| 初始展示  | 进入 Comm Tab / ReInit 后        | 读文件 → `success/total` → 百分比           |
| 运行后更新 | **With DT** 侧 `case complete` | **文件基线 加上 本次 without vs with 波束对比结果** |

### 流程

```
Tab 初始化 / ReInit
  → GET 读 beam_accuracy 文件
  → 解析 success、total → beamAccuracy = success / total
  → 绘制图（#comm-beam-accuracy-chart）

用户分别 Start Without DT、With DT（跑轨迹、写 sel_beam 等）
  → With DT 完成时触发 calculateBeamAccuracyRate：
       对每个 With DT 轨迹点，查同坐标 Without DT 所选波束
       相同则 matchCount++
  → displaySuccess = 文件 success + matchCount
     displayTotal  = 文件 total  + 本次 With 轨迹点数
  → 更新 beamAccuracy → 重绘图
```

### 关键机制

| 机制        | 说明                                              |
| --------- | ----------------------------------------------- |
| 基线 + 增量   | 文件是历史基线；本次正确率 = (基线成功 + 本次匹配数) / (基线总数 + 本次点数)  |
| 依赖两侧数据    | 运行后统计需要 **Without 与 With 都跑过**，否则无法逐点对比波束       |
| 不参与轮询     | 不像 thrp 每秒读文件；只在初始化/ReInit 时读一次，之后靠内存计算         |
| Start 不清空 | Start 只清 coordinates/sel_beam/thrp 等，**不清** 本文件 |
| 图         | 绿色=正确占比，灰色=错误；中心显示百分比；「+」按钮可展开 `(成功/总数)`        |
| 触发时机      | 仅 **With DT** 完成时重算；Without DT 完成不触发            |
|           |                                                 |

---

## 4. 重写时不能改的契约

- 文件路径：`data/c3/ue_comm_with_dt_beam_accuracy_rate.txt`
- 格式：首行 `成功次数,总次数`（整数）
- Start 流程中不要 DELETE 此文件（除非产品明确要求重置基线）
- Canvas ID：`comm-beam-accuracy-chart`
- 语义：文件=基线；With DT 结束后与 without 侧 `coord+selBeam` 对比做增量合并

---

