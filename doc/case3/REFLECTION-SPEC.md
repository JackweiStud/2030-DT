# Case3 Reflection / LOS 增量规格

来源：GitHub Issue #5 及用户对单反射点绘制语义的确认。

## 范围

- Case3 V2 仅在 With 2D 地图显示当前完整点的 Reflection。
- 使用现有 Case3 `points[].reflection = { x, y, z, los }`，不增加 API、文件字段或业务状态。
- UE、R1、BS 使用 Case3 V2 的业务坐标投影；底图缩放、旋转、平移继续由地图原图层统一处理。
- 当前 Pi 更新后只保留最新点的路径；地图交互不被覆盖层拦截。
- 运行中显示沿波纹移动的白色亮段；完成态保留静态波纹，适用于截图。
- Without、初始空图、失败清图及 Reset/ReInit 均不显示 Reflection。

## 路径规则

| 当前点 `los` | 绘制路径 | 标签 |
| --- | --- | --- |
| `true` | UE → BS 直达 | BS、LOS |
| `false` | UE → R1 → BS | BS、NLOS R1 |

Case3 当前数据只有一个 R1。二维投影使用 XYZ 中的 X/Y，Z 保留在数据中但不影响底图像素位置。

## 配置

在 `code/web/.env` 配置：

```dotenv
CASE3_REFLECTION_ENABLE=true
CASE3_BS_XYZ=(x,y,z)
```

BS 坐标必须是三个有限数值，且不能使用 `65535` 哨兵值。未开启时 Reflection 默认关闭；开启但没有合法 BS 坐标时配置解析失败。Vite 只对白名单中的两个 Case3 Reflection 字段做构建注入。

## 验证

- `npm run build`：通过。
- 本次未运行 Vitest 或真实后端联调；真实 BS 标定值及真实 Reflection 数据来源尚未验证。
