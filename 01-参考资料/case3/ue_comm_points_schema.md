# Case3 UE 逐点数据 — 字段说明（Schema）

> 适用文件：`ue_comm_without_dt_points.jsonl`、`ue_comm_with_dt_points.jsonl`  
> 版本：1.0  
> cost 仍使用单独 txt，见 `ue_comm_*_cost.txt`

---

## 1. 文件约定

| 项 | 说明 |
|----|------|
| 格式 | JSON Lines：每行一个 JSON 对象，一行一条点位记录 |
| 编码 | UTF-8 |
| 侧别 | without / with 各一个文件，字段结构相同 |
| 写入 | 算法每完成 1 个点位 **append 1 行**；禁止插删中间行 |
| 读取 | 前端增量按行解析；`no` 应与追加顺序一致 |

---

## 2. 点位对象（point）

每行一个对象，字段如下：

| 字段             | 类型      | 单位   | 范围 / 取值                  | 说明                        |
| -------------- | ------- | ---- | ------------------------ | ------------------------- |
| `no`           | integer | —    | ≥ 1，从 1 递增               | 点位序号--最大多少点xx             |
| `ue`           | object  | m    | —                        | UE 坐标                     |
| `ue.x`         | number  | m    | 精度 **0.01**，**2 位小数**    | UE 东向或场景 X                |
| `ue.y`         | number  | m    | 精度 **0.01**，**2 位小数**    | UE 北向或场景 Y                |
| `ue.z`         | number  | m    | 精度 **0.01**，**2 位小数**    | UE 高度                     |
| `beamId`       | integer | —    | 0 ~ 255                  | 该点位选择波束 ID                |
| `reflection`   | object  | m    | —                        | 反射点坐标（Without / With 均上报） |
| `reflection.x` | number  | m    | 精度 **0.01**，**2 位小数**    | 反射点 X                     |
| `reflection.y` | number  | m    | 精度 **0.01**，**2 位小数**    | 反射点 Y                     |
| `reflection.z` | number  | m    | 精度 **0.01**，**2 位小数**    | 反射点 Z                     |
| `los`          | integer | —    | **1** = LOS，**0** = NLOS | 视距标志                      |
| `thrp`         | number  | Gbps | ≥ 0                      | 吞吐量，**保留 2 位小数**          |

---

## 3. 示例（单行）

```json
{"no":1,"ue":{"x":1.00,"y":15.00,"z":0.00},"beamId":0,"reflection":{"x":5.00,"y":7.00,"z":0.00},"los":1,"thrp":8.50}
```

---

## 4. 地图映射（UE / 反射点共用）

算法坐标 → 底图 `ue_comm_map.png` 像素：

```
mapPixelX = origin_x + ue.y / coor_scaling_factor
mapPixelY = origin_y + ue.x / coor_scaling_factor
```

默认：`origin_x=905`，`origin_y=445`，`coor_scaling_factor=0.11`（米/像素）。  
反射点坐标使用 **同一公式**（将 `ue` 换为 `reflection`）。

---

## 5. 不在本 schema 内的数据

| 数据        | 文件                                                         | 说明            |
| --------- | ---------------------------------------------------------- | ------------- |
| 测量开销 cost | `ue_comm_without_dt_cost.txt` / `ue_comm_with_dt_cost.txt` | 单行浮点，单位 %     |
| 波束正确率基线   | `ue_comm_with_dt_beam_accuracy_rate.txt`                   | 成功次数,总次数      |
| 预置UE路线    | `ue_comm_coordinates_base.txt`                             | Tab 初始化加载，非实时 |
新增2个json文件收编之前的txt文件
ue_comm_with_dt_points.json、ue_comm_without_dt_points.json



---

## 6. 校验建议

- 每行必须是合法 JSON，且仅含上述字段（可扩展版本号后再增字段）
- `no` 从 1 起连续递增
- `ue.*`、`reflection.*` 序列化建议固定 **2 位小数**（精度 0.01 m，如 `1.00`，避免 `1` 或 `1.0`）
- `thrp` 序列化建议固定 **2 位小数**（如 `8.50`）
- `los` 仅允许 0 或 1
