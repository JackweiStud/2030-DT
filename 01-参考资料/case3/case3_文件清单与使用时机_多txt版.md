# Case3 文件清单与前端使用时机（多 txt 版 · 现网）

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）  
> 数据目录：`data/c3/`  
> 说明：**json 收编前**的分散 txt 协议（对应当前/参考代码实现）

---

## 1. 文件总览

| 序号  | 文件                                                 | 刷新方式（协议）   | 作用                      |
| --- | -------------------------------------------------- | ---------- | ----------------------- |
| 1   | `ue_comm_map.png`                                  | 读初始化       | 试验区俯视图，地图 canvas 背景     |
| 2   | `ue_comm_coordinates_base.txt`                     | 读初始化       | 预置 UE 完整路线（虚线参考轨迹）      |
| 3   | `ue_comm_without_dt_coordinates.txt`               | 每点实时       | Without DT 定位坐标         |
| 4   | `ue_comm_without_dt_beams.txt`                     | 每点实时       | Without DT 测量波束集合（多 ID） |
| 5   | `ue_comm_without_dt_sel_beam.txt`                  | 每点实时       | Without DT 选择波束 ID      |
| 6   | `ue_comm_without_dt_cost.txt`                      | 实时         | Without DT 测量开销（%）      |
| 8   | `ue_comm_without_dt_thrp.txt`                      | 每点实时       | Without DT 通信吞吐（Gbps）   |
| 9   | `ue_comm_with_dt_coordinates.txt`                  | 每点实时       | With DT 定位坐标            |
| 10  | `ue_comm_with_dt_sel_beam.txt`                     | 每点实时       | With DT 选择波束 ID         |
| 11  | `ue_comm_with_dt_cost.txt`                         | 实时         | With DT 测量开销（%）         |
| 13  | `ue_comm_with_dt_thrp.txt`                         | 每点实时       | With DT 通信吞吐（Gbps）      |
| 14  | `ue_comm_with_dt_beam_accuracy_rate.txt`           | 读初始化 / 测试后 | 波束预测正确率基线               |
| 15  | `ue_comm_with_dt_coordinates_reflection_point.txt` | 协议：读初始化    | 反射点坐标 + LOS 标志          |
| —   | `data/case_control.json`                           | 全程         | case3 启停与状态（上级目录）       |

---

## 2. 按刷新方式分组

### 2.1 读初始化（进 Tab 读一次，不轮询）

| 文件 | 格式 / 维度 | 前端用途 | 开始使用 | 停止使用 |
|------|-------------|----------|----------|----------|
| `ue_comm_map.png` | 图片 | 底图 | 进入 Comm Tab | 离开 Tab |
| `ue_comm_coordinates_base.txt` | N×3，`x,y,z` 米 | 青色虚线预置路线 | 进入 Comm Tab | 不更新 |
| `ue_comm_with_dt_beam_accuracy_rate.txt` | 1×2，成功次数,总次数 | 波束正确率饼图基线 | 进入 Tab / ReInit | 不轮询；With 完成后与运行时合并重算 |

**反射点文件（协议 vs 现网）**：

| 文件 | 协议 | 现网前端 |
|------|------|----------|
| `ue_comm_with_dt_coordinates_reflection_point.txt` | N×4，`x,y,z,flag`（1=LOS 0=NLOS） | **Case3 未读取、未绘制**；With Start 时仅 DELETE 清空 |

---

### 2.2 实时上报（Start 后轮询，complete 后停）

**公共规则**：

```
Without / With 各点 Start
  → DELETE 清空该侧实时 txt（beam_accuracy、base 不清）
  → PUT case_control { start, dt_type }
  → 等待 status == execute success
  → 1s 轮询增量读文件 + 1s 逐点消费 buffer
  → status == case complete → 停轮询
```

#### Without DT 侧（点击 Without Start）

| 文件                                   | 格式           | 前端消费                            | Start 前清空 |
| ------------------------------------ | ------------ | ------------------------------- | --------- |
| `ue_comm_without_dt_coordinates.txt` | 每行 `x,y,z`   | 地图实时轨迹（橙/红点）                    | 是         |
| `ue_comm_without_dt_beams.txt`       | 每行多 ID（逗号分隔） | Beam Info 蓝色候选波束                | 是         |
| `ue_comm_without_dt_sel_beam.txt`    | 每行 0~255     | Beam Info 橙色选中波束；coordBeamPairs | 是         |
| `ue_comm_without_dt_thrp.txt`        | 每行 Gbps      | Throughput 折线（without）          | 是         |
| `ue_comm_without_dt_cost.txt`        | 单行 %         | Cost 柱图左柱；轮询取 **末行**            | 是         |

#### With DT 侧（点击 With Start）

| 文件                                                 | 格式              | 前端消费                     | Start 前清空 |
| -------------------------------------------------- | --------------- | ------------------------ | --------- |
| `ue_comm_with_dt_coordinates.txt`                  | 每行 `x,y,z`      | 地图实时轨迹                   | 是         |
| `ue_comm_with_dt_sel_beam.txt`                     | 每行 0~255        | Beam Info；coordBeamPairs | 是         |
| `ue_comm_with_dt_thrp.txt`                         | 每行 Gbps         | Throughput 折线（with）      | 是         |
| `ue_comm_with_dt_cost.txt`                         | 单行 %            | Cost 柱图右柱；取 **末行**       | 是         |
| `ue_comm_with_dt_coordinates_reflection_point.txt` | 每行 `x,y,z,flag` | BS--折射点--UE<br>波束示意图     | 是         |

---

## 3. 逐点文件行号对应

以下文件 **第 i 行表示第 i 个轨迹点**，行数应一致：

```
coordinates  ←→  sel_beam  ←→  thrp  ←→  mse
     ↑
  (without 另有 beams 第 i 行)
```

前端 `processOnePoint` 每 1s 从各 buffer 各取第 i 行，同步更新地图、波束、KPI。

**cost** 不参与逐点对齐，标量 KPI，轮询时取文件最新一行。

---

## 4. 各文件开始使用 / 停止使用（汇总）

| 文件                                                 | 开始使用                      | 停止使用                  |
| -------------------------------------------------- | ------------------------- | --------------------- |
| `ue_comm_map.png`                                  | 进 Comm Tab                | 离 Tab                 |
| `ue_comm_coordinates_base.txt`                     | 进 Comm Tab                | 不轮询                   |
| `ue_comm_with_dt_beam_accuracy_rate.txt`           | 进 Tab / ReInit            | 不轮询                   |
| `ue_comm_*_coordinates.txt`                        | 该侧 execute success 后      | 该侧 case complete      |
| `ue_comm_without_dt_beams.txt`                     | Without execute success 后 | Without case complete |
| `ue_comm_*_sel_beam.txt`                           | 该侧 execute success 后      | 该侧 case complete      |
| `ue_comm_*_thrp.txt`                               | 该侧 execute success 后      | 该侧 case complete      |
| `ue_comm_*_cost.txt`                               | 该侧 execute success 后      | 该侧 case complete      |
| `ue_comm_with_dt_coordinates_reflection_point.txt` | 该侧 execute success 后      | 该侧 case complete      |
| `case_control.json`                                | 全程                        | —                     |

---

## 5. 一次 Run 时间线（Without DT 示例）

```
1. DELETE  without 侧 6 个 txt（含 coordinates/beams/sel_beam/cost/mse/thrp）
2. PUT     case_control { case3, start, "without dt" }
3. 等待    execute success
4. 开始    1s 轮询读  文件 → buffer；1s processOnePoint 逐点画图
5. 等待    case complete
6. 停止    轮询；PUT case_control init
```

With DT 类似，清空文件含 `reflection_point`，**complete 后额外触发波束正确率重算**。

---

## 6. 与 json 收编方案对照

| 多 txt（本文） | json 收编后 |
|----------------|-------------|
| coordinates + sel_beam + thrp + 反射/LOS 分散多文件 | `*_points.jsonl` 一行聚合 |
| cost 仍单独 txt | 仍单独 txt |
| beam_accuracy、base、map | 不变 |
| beams.txt（扫描集合） | 废弃 |
| mse.txt | 废弃 |

详见：`case3_文件清单与使用时机.md`（json 版）
