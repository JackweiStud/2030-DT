# Case3 选择波束文件（ue_comm_*_sel_beam.txt）说明

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）

---
![[Pasted image 20260805144937.png|333]]![[Pasted image 20260805144959.png|289]]
## 1. 是什么

| 文件 | 用途 |
|------|------|
| `data/c3/ue_comm_without_dt_sel_beam.txt` | 无 DT 辅助时，每个轨迹点的选择波束 ID |
| `data/c3/ue_comm_with_dt_sel_beam.txt` | 有 DT 辅助时，每个轨迹点的选择波束 ID |

前端读对应侧文件，在 **Beam Info** 面板的 16×16 波束网格上高亮当前选中波束（橙色），并记录「坐标→波束」供波束正确率计算。

**格式**：每行一个整数，范围 **0~255**，无表头。  
第 i 行 = 第 i 个轨迹点选中的 1 个波束 ID。

**与 coordinates 的对应关系**（同侧 without 对 without，with 对 with）：

- 第 i 行 sel_beam ↔ 第 i 行 `ue_comm_{without|with}_dt_coordinates.txt`（`x,y,z`）
- 行数应相同（打桩数据各 31 行）

打桩样例：从 `0` 起按 4 递增（0, 4, 8, …），表示逐点切换波束。

---

## 2. 怎么产生（后端）

系统通过 **本地文件** 交换数据，不经 HTTP 写 sel_beam。

### 生产环境

主控/算法监听 `case_control.json`：

1. 收到 `{ case: "case3", command: "start", dt_type: "without dt" | "with dt" }`
2. 回写 `status: "execute success"`
3. 每完成一个轨迹点，**追加一行**波束 ID 到对应 sel_beam 文件（与 coordinates 同步追加）
4. 结束后回写 `status: "case complete"`

### 打桩后端

收到 case3 的 `start` 后，将 `TstAgent/backup/case3/` **整包复制**到 `data/c3/`（含 sel_beam 预制数据），等待 40 秒后写 `case complete`。一次性复制，非逐行 append。

---

## 3. 怎么消费（前端）

核心模块：`js/tab-comm.js`（`APP.Comm`）  
路径配置：`js/dt-config.js` → `DT_CONFIG.comm.withoutDT/withDT.selBeam`

### 何时开始读

```
用户点 Start（without 或 with）
  → DELETE 清空该侧 sel_beam（及 coordinates 等）
  → PUT case_control.json
  → 轮询等到 status == "execute success"
  → 启动 startKPIChartUpdate：
       commKPIUpdateTimer（1s）开始增量读 sel_beam 文件
       commChartTimer（1s）开始逐点消费
```

**开始读的时刻**：`execute success` 之后，与 coordinates/thrp 同时启动。

### 何时停止读

```
轮询 case_control.json
  → status == "case complete"
  → 清除 commKPIUpdateTimer、commChartTimer
  → 该侧不再读 sel_beam
```

**停止读的时刻**：该侧 case 完成；状态变为 Complete。

### 消费与绘图机制

| 步骤 | 说明 |
|------|------|
| 读入 | 增量读新增行 → 放入 `dataBuffer.selBeam` |
| 逐点 | 每 1s 从 buffer 取一行 → `parseInt` → 更新 `currentSelBeam` |
| 绑点 | 同 tick 再消费一行 coordinates → 以坐标为 key 写入 `coordBeamPairs`（坐标→波束 ID） |
| 绘图 | `updateBeamInfo` → 在 `#comm-without-beam-info` 或 `#comm-with-beam-info` 的 16×16 网格上，将 **当前 sel_beam 对应格子** 填橙色 |

**顺序要点**：同一 tick 内先处理 sel_beam 行，再处理 coordinates 行，保证第 i 个点的波束与第 i 个坐标配对。

**后续用途**：With DT 跑完后，用 without/with 两侧的 `coordBeamPairs` 对比同坐标波束是否一致，参与波束正确率计算（见 beam_accuracy 说明）。

---

## 4. 重写时不能改的契约

- 文件路径与格式不变（一行一整数，0~255）
- Start 前前端会 DELETE 清空该侧 sel_beam
- sel_beam 与 coordinates 按行号一一对应，行数相同
- 读文件：`execute success` 后起，`case complete` 止
- 展示：当前选中波束 ID 高亮在对应侧 Beam Info 网格（Canvas ID：`comm-without-beam-info` / `comm-with-beam-info`）

---
