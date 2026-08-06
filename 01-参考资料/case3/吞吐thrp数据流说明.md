# Case3 吞吐量文件（ue_comm_*_thrp.txt）说明

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）

---
![[Pasted image 20260805142502.png|361]]
## 1. 是什么

| 文件 | 用途 |
|------|------|
| `data/c3/ue_comm_without_dt_thrp.txt` | Without DT 每步吞吐量 |
| `data/c3/ue_comm_with_dt_thrp.txt` | With DT 每步吞吐量 |

前端读这两个文件，绘制 KPI 面板 **Throughput Comparison** 折线图（红=Without，青=With）。

**格式**：每行一个浮点数，单位 Gbps，无表头。

**与 coordinates 的对应关系**（同侧：without 对 without，with 对 with）：

- 第 i 行 thrp = 第 i 个轨迹点的吞吐量
- 对应文件：`ue_comm_{without|with}_dt_coordinates.txt`（每行 `x,y,z`）
- 两者行数应相同，例如 coordinates 第 2 行是 `(1,14,0)`，则 thrp 第 2 行就是该点的 Gbps 值

---

## 2. 怎么产生（后端）

系统通过 **本地文件** 交换数据，不经 HTTP 写 thrp。

### 生产环境

主控/算法监听 `case_control.json`：

1. 收到 `{ case: "case3", command: "start", dt_type: "without dt" | "with dt" }`
2. 回写 `status: "execute success"`
3. 算法每跑完一个轨迹点，**追加一行**到对应 thrp 文件（同时写 coordinates、sel_beam 等同侧文件）
4. 结束后主控回写 `status: "case complete"`

算法直接写磁盘 `data/c3/`，UI 仓库内无算法代码。

### case3打桩后端

`TstAgent/dt_assistant.py` 模拟主控：

1. 收到 `start` → 写 `execute success`
2. 将 `TstAgent/backup/case3/` **整包复制**到 `data/c3/`（含 thrp 预制数据）
3. 等待 40 秒 → 写 `case complete`

打桩是一次性复制，不是逐行 append；前端用定时器模拟"逐点播放"。

---

## 3. 怎么消费（前端）

核心模块：`js/tab-comm.js`（`APP.Comm`）  
路径配置：`js/dt-config.js` → `DT_CONFIG.comm.withoutDT/withDT.throughput`

### 流程

```
用户点 Start（without 或 with 各有一个按钮）
  → DELETE 清空该侧 txt（含 thrp）
  → PUT case_control.json { case3, start, dt_type }
  → 轮询等待 status == "execute success"
  → 启动两个 1s 定时器：
       ① 读文件增量 → 放入 dataBuffer.throughput
       ② 每次从 buffer 取一行 → parseFloat → 推入 commKPI → 刷新 Chart.js
  → 轮询到 status == "case complete" → 停定时器，显示 Complete
```

### 关键机制

| 机制 | 说明 |
|------|------|
| 增量读取 | `readNewDataFromFile` 用行号记录已读位置，只取新增行；`?t=timestamp` 防缓存 |
| 双定时器 | 读文件（pollingInterval）与逐点展示（pointProcessInterval）分离，默认均 1s |
| 双曲线合图 | 同一张 Chart（`#comm-throughput-chart`），without/with 需 **分别点 Start** 才有两条线 |
| 同步消费 | 每 1s 从 thrp、coordinates 等各取第 i 行一起处理：地图画第 i 个点，折线图加第 i 个吞吐值 |

---

## 4. 重写时不能改的契约

- 文件路径与格式不变（一行一浮点，Gbps）
- Start 前前端会清空该侧 thrp
- `case_control.json` 必须回写 `execute success` 和 `case complete`
- thrp 与 coordinates 按行号对应，行数相同（第 i 行 thrp 对应第 i 个轨迹点）
- Canvas ID：`comm-throughput-chart`

---

