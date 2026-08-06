# Case3 测量开销文件（ue_comm_*_cost.txt）说明

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）

---
![[Pasted image 20260805141818.png|407]]
## 1. 是什么

| 文件 | 用途 |
|------|------|
| `data/c3/ue_comm_without_dt_cost.txt` | 无 DT 辅助的测量开销 |
| `data/c3/ue_comm_with_dt_cost.txt` | 有 DT 辅助的测量开销 |


前端读这两个文件，绘制 KPI 面板 **Cost Comparison** 柱状图（左柱=Without，右柱=With）。

**格式**：每行一个浮点数，单位 **COST (%)**，无表头--整数。  
打桩样例：without = `10`，with = `5`（各 1 行）。

**与 thrp/coordinates 的区别**：cost 是 **单侧标量 KPI**，不是按轨迹点逐行播放的时序曲线。**算法只写 1 行最终结果，也可运行中多次追加**；前端始终取 **本次读到的最后一行** 作为该侧当前值。

---

## 2. 怎么产生（后端）

系统通过 **本地文件** 交换数据，不经 HTTP 写 cost。

### 生产环境

主控/算法监听 `data/case_control.json`：

1. 收到 `{ case: "case3", command: "start", dt_type: "without dt" | "with dt" }`
2. 回写 `status: "execute success"`
3. 算法将测量开销写入对应 cost 文件（追加或覆盖均可；前端只认最新一行数值）
4. 结束后主控回写 `status: "case complete"`

算法直接写磁盘 `data/c3/`，UI 仓库内无算法代码。

### 打桩后端

`TstAgent/dt_assistant.py` 模拟主控：

1. 收到 `start` → 写 `execute success`
2. 将 `TstAgent/backup/case3/` **整包复制**到 `data/c3/`（含 cost 预制数据）
3. 等待 40 秒 → 写 `case complete`

打桩数据为各 1 行的固定值，随 case3 备份一并复制，无单独 append 逻辑。

---

## 3. 怎么消费（前端）

核心模块：`js/tab-comm.js`（`APP.Comm`）  
路径配置：`js/dt-config.js` → `DT_CONFIG.comm.withoutDT/withDT.cost`

### 流程

```
用户点 Start（without 或 with 各有一个按钮）
  → DELETE 清空该侧 txt（含 cost）
  → PUT case_control.json { case3, start, dt_type }
  → 轮询等待 status == "execute success"
  → 启动读文件定时器（默认 1s）：
       增量读 cost → 取新增内容中最后一行 parseFloat
       → 写入 latestCostValue[without|with] → 刷新柱状图
  → （同一次 Start 还会并行读 coordinates/thrp 等，由另一定时器逐点驱动地图与吞吐折线）
  → 轮询到 status == "case complete" → 停定时器，显示 Complete
```

### 关键机制

| 机制    | 说明                                                                         |
| ----- | -------------------------------------------------------------------------- |
| 取末行   | 每次读到新内容时，用 **最后一行** 更新该侧 cost                                              |
| 内存字段  | `latestCostValue.without` / `.with` 各存一个数；                                 |
| 双柱合图  | 同一张 Chart（`#comm-symbol-chart`），两根柱分别来自 without/with；需 **分别点 Start** 两侧都有值 |
| Y 轴   | 固定 0~100，标签 `COST (%)`                                                     |


---

## 4. 重写时不能改的契约

- 文件路径与格式不变（一行一浮点，百分比）
- Start 前前端会清空该侧 cost
- `case_control.json` 必须回写 `execute success` 和 `case complete`
- 前端语义：该侧 cost = 文件中 **最新一行** 的数值
- Canvas ID：`comm-symbol-chart`（面板标题 Cost Comparison）

---

