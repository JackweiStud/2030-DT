# Case3 UE 逐点数据 — 聚合 JSON 协议草案

> 状态：讨论稿  
> Schema 详见：**[ue_comm_points_schema.md](./ue_comm_points_schema.md)**  
> 参考样例：**[ue_comm_without_dt_points.jsonl](./ue_comm_without_dt_points.jsonl)**、**[ue_comm_with_dt_points.jsonl](./ue_comm_with_dt_points.jsonl)**（各 12 点）

---

## 1. 文件一览

| 文件 | 侧 | 内容 |
|------|-----|------|
| `ue_comm_without_dt_points.jsonl` | Without DT | 逐点 JSON，每行一条 |
| `ue_comm_with_dt_points.jsonl` | With DT | 同上 |
| `ue_comm_points_schema.md` | 共用 | 字段含义、单位、范围、映射说明 |
| `ue_comm_*_cost.txt` | 分侧 | **不变**，单行 COST (%) |

**不纳入**：mse、beams 扫描集合。

---

## 2. 每行字段（摘要）

`no` · `ue{x,y,z}`（m，0.01 精度，2 位小数）· `beamId` · `reflection{x,y,z}`（m，0.01 精度，2 位小数）· `los` · `thrp`（Gbps，2 位小数）

Without / With 字段相同；反射点与 LOS **两侧均上报**。

---

## 3. 后端

- 生产：按 `dt_type` append 对应 jsonl，每点位一行；cost 仍写 txt
- 打桩：预制 jsonl 随 backup 复制，或由旧 txt 合并生成

---

## 4. 前端（相对现网）

| 现网 | 新协议 |
|------|--------|
| 多 txt 多 buffer 对齐 | 单 jsonl 单 buffer |
| 多文件轮询 | 仍 1s 增量读行，`JSON.parse` 每行 |
| cost | 仍单独读 txt 末行 |

**读停时机不变**：`execute success` 开始 → `case complete` 停止。

---

## 5. 旧文件迁移

| 旧逐点 txt | jsonl 字段 |
|------------|------------|
| coordinates | `ue` |
| sel_beam | `beamId` |
| reflection_point | `reflection` + `los` |
| thrp | `thrp` |
| cost.txt | **保留** |
