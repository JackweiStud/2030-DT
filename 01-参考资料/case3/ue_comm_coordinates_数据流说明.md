# Case3 UE 坐标相关文件说明

> UI 工程：`Digital_Twin_Software_UI_V1.0yyl`  
> Tab：DT for Comm（case3）

本文档覆盖两个文件：**Without DT 的 UE 坐标**（前端已消费）与 **With DT 的反射点坐标**（后端/打桩会写，Case3 前端当前未读未画）。

---

## 1. 文件一览

| 文件 | 侧 | 含义 |
|------|-----|------|
| `data/c3/ue_comm_without_dt_coordinates.txt` | Without DT | 每个轨迹点的 UE 坐标 |
| `data/c3/ue_comm_with_dt_coordinates_reflection_point.txt` | With DT | 每个轨迹点对应的反射点坐标 |

**补充**：With DT 侧 **UE 轨迹** 实际由 `ue_comm_with_dt_coordinates.txt` 驱动（格式与 without 相同）。反射点文件是 With DT 独有上报，与 UE 坐标按行对应。

---

## 2. 文件格式

### Without DT — UE 坐标

每行 `x,y,z`（逗号分隔，单位：米），无表头。  
打桩样例：先沿 y 从 15→2 下行，再沿 x 从 2→17 右行（共 31 行）。

### With DT — 反射点

每行 `x,y,z,flag`（逗号分隔）。  
打桩样例：`5.0,7.0,0,1` 重复 31 行（Flag含义1:los  0:nlos）。

**行号对应**：第 i 行反射点 ↔ 第 i 行 `ue_comm_with_dt_coordinates.txt` ↔ 第 i 行 sel_beam/thrp 等。

---

## 3. 怎么产生（后端）

系统通过 **本地文件** 交换，不经 HTTP 写入。

### 生产环境

监听 `case_control.json`，收到 case3 `start` 后：

- **without**：每完成一个轨迹点，追加一行到 `ue_comm_without_dt_coordinates.txt`
- **with**：同步追加 UE 坐标到 `ue_comm_with_dt_coordinates.txt`，并追加一行反射点到 `ue_comm_with_dt_coordinates_reflection_point.txt`

### 打桩（TstAgent）

case3 `start` 时将 `TstAgent/backup/case3/` **整包复制**到 `data/c3/`，40 秒后写 `case complete`。

---

## 4. 前端消费与绘图

地图背景：`ue_comm_map.png`；虚线参考轨迹：`ue_comm_coordinates_base.txt`（Tab 初始化时一次性加载，非算法实时文件）。

坐标换算（算法 xy → 地图像素，再画到 canvas）：

```
mapPixelX = origin_x + y / coor_scaling_factor
mapPixelY = origin_y + x / coor_scaling_factor
```

（x/y 与文件列顺序有交换，重写时需保持一致。）

### 4.1 Without DT 坐标 — **已消费**

| 项 | 说明 |
|----|------|
| 读哪个文件 | `ue_comm_without_dt_coordinates.txt` |
| 画在哪 | `#comm-without-dt` 地图 canvas |
| 怎么画 | 已走过的点：橙色小圆点；当前点：红色稍大；逐点累积成轨迹 |
| 同步 | 与 sel_beam/thrp 等同 tick 逐点处理；坐标写入 `coordBeamPairs` 供波束正确率使用 |

### 4.2 With DT 反射点 — **当前未消费**

| 项 | 说明 |
|----|------|
| 配置 | `DT_CONFIG.comm.withDT.reflectionPoint` 已声明路径 |
| Start 时 | 会 DELETE 清空该文件 |
| 运行中 | **不轮询、不读入、不绘制** |
| With DT 地图 | 实际读 `ue_comm_with_dt_coordinates.txt`，绘制方式与 Without 侧相同（`#comm-with-dt`） |

后续 AI 若要在 Case3 展示反射点，需新增读取与绘制逻辑；Case4 定位 Tab 已有反射点消费可参考。

---

## 5. 何时开始 / 停止读取

仅对 **实际被读的坐标文件**（without → `without_dt_coordinates`；with → `with_dt_coordinates`）：

```
开始：Start → 等到 execute success → startKPIChartUpdate 启动 1s 轮询
停止：该侧 case complete → 清除轮询与逐点定时器
```

反射点文件：**不参与** 上述读流程（仅 Start 时被清空）。

---

## 6. 坐标如何映射到地图（ue_comm_map.png）

### 6.1 涉及文件

| 文件 | 作用 |
|------|------|
| `ue_comm_map.png` | 卫星底图（1974×1100 px），canvas 背景 |
| `ue_comm_coordinates_base.txt` | **预置完整路线**，Tab 初始化读一次，画青色虚线 |
| `ue_comm_with_dt_coordinates.txt` | **With DT 实时点**（without 侧同理用 `without_dt_coordinates.txt`），Run 中逐行读，画橙/红点 |

预置路线与实时点 **共用同一套换算公式**；打桩数据里 base 与 with/without coordinates 前几行通常一致，实时点按行逐步追加到 `realTimeCoords`。

### 6.2 算法坐标 → 地图像素

文件每行 `x,y,z`（米）。**z 不参与 2D 映射**，只用 x、y。

配置项（`DT_CONFIG.comm`）：

| 参数 | 值 | 含义 |
|------|-----|------|
| `origin_x` | 905 | 地图像素系原点的 X（px） |
| `origin_y` | 445 | 地图像素系原点的 Y（px） |
| `coor_scaling_factor` | 0.11 | 1 像素 = 0.11 米 |

换算（注意 **文件 x→像素 Y，文件 y→像素 X**）：

```
mapPixelX = origin_x + y / coor_scaling_factor
mapPixelY = origin_y + x / coor_scaling_factor
```

**示例**（点 `1,15,0`）：

```
mapPixelX = 905 + 15/0.11 ≈ 1041
mapPixelY = 445 + 1/0.11  ≈ 454
```

预置路线形状：x=1 时 y 从 15→2（竖段），再 y=2 时 x 从 2→25（横段），在底图上呈「┐」形路径。

### 6.3 地图像素 → Canvas 像素

底图按 canvas 宽高 **等比缩放** 居中绘制，再叠加用户缩放/平移/旋转：

```
imgScaleX = drawWidth  / 图片宽度
imgScaleY = drawHeight / 图片高度
canvasX = centerX + mapPixelX × imgScaleX
canvasY = centerY + mapPixelY × imgScaleY
```

`centerX/centerY` 为缩放后图片在 canvas 内的偏移；之后还可乘 `commScale`、加 `commTranslate`、绕中心 `commRotation`（地图控件交互）。

### 6.4 两类轨迹如何画

| 类型 | 数据来源 | 绘制样式 | 时机 |
|------|----------|----------|------|
| 预置路线 | `coordinates_base.txt` → `pathPoints` | 青色虚线 + 终点箭头 | 进入 Comm Tab 即加载，每帧重绘 |
| 实时轨迹 | `with_dt_coordinates.txt` 等 → `realTimeCoords` | 历史点橙色、当前点红色 | Start 后逐点追加，约 1s 一点 |

**With DT 实时点**与 **Without DT 实时点**映射公式完全相同，仅读不同文件、画在不同 canvas（`comm-with-dt` / `comm-without-dt`）。

### 6.5 重写要点

- 勿改 x/y 与像素 XY 的交叉关系，否则轨迹与底图错位
- `origin_*` 与 `coor_scaling_factor` 是针对 `ue_comm_map.png` 标定的，换图需重新标定
- 实时点与预置路线应在同一像素系下重合（同坐标应落在同位置）

---

