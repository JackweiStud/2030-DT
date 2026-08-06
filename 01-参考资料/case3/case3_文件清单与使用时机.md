# Case3 文件清单与前端使用时机

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）  
> 数据目录：`data/c3/`  
> 说明：收编后协议（2 个 jsonl + 若干 txt + 1 张地图）

---

## 1. 文件总览

| 文件                                       | 类型   | 作用                              |
| ---------------------------------------- | ---- | ------------------------------- |
| `ue_comm_map.png`                        | 静态资源 | 卫星底图；UE / 反射点坐标映射到该图            |
| `ue_comm_coordinates_base.txt`           | 预置数据 | 完整参考路线（虚线）；非算法实时上报              |
| `ue_comm_without_dt_points.jsonl`        | 实时上报 | Without DT 逐点：UE、波束、反射、LOS、thrp |
| `ue_comm_with_dt_points.jsonl`           | 实时上报 | With DT 逐点：字段同上                 |
| `ue_comm_without_dt_cost.txt`            | 实时上报 | Without DT 测量开销（单行，%）           |
| `ue_comm_with_dt_cost.txt`               | 实时上报 | With DT 测量开销（单行，%）              |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | 基线数据 | 波束预测正确率基线（成功次数,总次数）             |
| `../case_control.json`                   | 控制   | case3 启停与状态（不在 c3 目录内）          |

字段定义见：`case3/ue_comm_points_schema.md`（工程外参考文档，前端不读）。

---

## 2. 各文件说明与使用时机

### 2.1 `ue_comm_map.png`

| 项 | 说明 |
|----|------|
| 作用 | Comm 地图 canvas 背景 |
| 开始使用 | 进入 **DT for Comm** Tab，初始化地图时加载 |
| 停止使用 | 离开该 Tab 或关闭页面（内存释放，无轮询） |

---

### 2.2 `ue_comm_coordinates_base.txt`

| 项 | 说明 |
|----|------|
| 作用 | 预置 UE 路线；画 **青色虚线** 参考轨迹 |
| 格式 | 每行 `x,y,z`（米） |
| 开始使用 | 进入 Comm Tab，`init` 时 **读一次** |
| 停止使用 | 不轮询；离开 Tab 后不再更新 |

---

### 2.3 `ue_comm_without_dt_points.jsonl`

| 项 | 说明 |
|----|------|
| 作用 | Without DT 侧实时逐点数据（一行一点） |
| 含 | no、ue、beamId、reflection、los、thrp |
| 开始使用 | 点击 **Without DT → Start**，且 `case_control.status == execute success` 后，**1s 轮询**增量读行 |
| 停止使用 | 该侧 `case_control.status == case complete`，清除轮询与逐点定时器 |
| Start 前 | **DELETE 清空**本文件 |

消费内容：地图轨迹点、Beam Info 高亮、Throughput 折线（without 曲线）、波束正确率对比（需 with 侧也跑完）。

---

### 2.4 `ue_comm_with_dt_points.jsonl`

| 项 | 说明 |
|----|------|
| 作用 | With DT 侧实时逐点数据，字段与 without 相同 |
| 开始使用 | 点击 **With DT → Start**，且 `execute success` 后，**1s 轮询** |
| 停止使用 | 该侧 `case complete`，停轮询 |
| Start 前 | **DELETE 清空**本文件 |

消费内容：地图轨迹、Beam Info、Throughput（with 曲线）、**With DT 完成时**触发波束正确率重算。

---

### 2.5 `ue_comm_without_dt_cost.txt` / `ue_comm_with_dt_cost.txt`

| 项 | 说明 |
|----|------|
| 作用 | 该侧测量开销；Cost Comparison **柱状图** 单柱数值 |
| 格式 | 单行浮点，单位 **%**；前端取 **最新一行** |
| 开始使用 | 对应侧 Start → `execute success` 后，随 jsonl **同一轮询** 读取 |
| 停止使用 | 对应侧 `case complete` |
| Start 前 | **DELETE 清空** |

---

### 2.6 `ue_comm_with_dt_beam_accuracy_rate.txt`

| 项 | 说明 |
|----|------|
| 作用 | 波束正确率 **基线**（成功次数,总次数） |
| 格式 | 一行两整数，如 `222,235` |
| 开始使用 | 进入 Comm Tab 或 **ReInit** 时 **读一次**；With DT **case complete** 后与运行时对比结果 **合并重算** |
| 停止使用 | 不轮询；Clear/ReInit 可重置内存中的基线 |
| Start 前 | **不清空**（与逐点 jsonl 不同） |

---

### 2.7 `data/case_control.json`

| 项 | 说明 |
|----|------|
| 作用 | UI ↔ 主控：case、command、dt_type、status |
| 前端写 | Start/ReInit → `command: start/reinit`，`case: case3`，`dt_type` |
| 前端读 | 轮询 `status`：`execute success` 开始读数据；`case complete` 停止 |
| 完成后 | 前端写回 `command: init`，`status` 清空 |

---

## 3. 一次完整 Run 的时间线（单侧）

以 **With DT Start** 为例：

```
1. DELETE  with_dt_points.jsonl、with_dt_cost.txt
2. PUT     case_control { case3, start, dt_type: "with dt" }
3. 等待    status == execute success
4. 开始    1s 轮询 jsonl + cost；1s 逐点消费 → 地图 / 波束 / 吞吐
5. 等待    status == case complete
6. 停止    轮询；With 侧触发波束正确率重算
7. PUT     case_control { command: init }
```

Without DT 流程相同，仅文件与 canvas 不同；**Throughput 双柱/双线需两侧各 Start 一次**。

---

## 4. 收编后不再使用的旧 txt

以下由 `*_points.jsonl` 替代，**新 Case3 不再读写**：

- `ue_comm_*_coordinates.txt`
- `ue_comm_*_sel_beam.txt`
- `ue_comm_*_coordinates_reflection_point.txt`
- `ue_comm_*_thrp.txt`
- `ue_comm_*_mse.txt`
- `ue_comm_without_dt_beams.txt`

---

