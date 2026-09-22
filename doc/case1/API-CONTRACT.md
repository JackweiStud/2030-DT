# case1 离线读取契约

2026-09-21。依据用户已确认的离线浏览范围及本轮“复核合格后开发正式前端”授权，收敛最小只读接口；不改变任何外部后端协议。

- `GET /api/case1/data/{geometry|material|rf}`：首次进入对应详情读取一次，本次 case1 停留内缓存，切 case 取消并丢弃。返回 `{ok:true,kpis:[{id,off,on}],matrix?:number[][]}`。geometry 两项 fidelity/recon，material 一项 fidelity，rf 一项 rss 与矩阵。文件映射见服务端 `cases/case1/routes.mjs`。
- `GET /api/case1/models/{geometry|material}`：固定名单映射的 GLB 二进制流；首页绘制后几何、电磁依次准备。无浏览器传入文件路径。
- 文本在共享根 `case1/`，与 case2/3/4 相同，不另设 `CASE1_DATA_DIR`。GLB 固定为 `code/web/assets/case1/3D/Beijing_Geometry.glb` 与 `Beijing_Material.glb`，不另设 `CASE1_GEOMETRY_GLB`、`CASE1_MATERIAL_GLB`。本地演示使用用户提供的参考模型，不冒充本次生成结果。
- TXT 空/非有限/非矩形/标量数量错误：422；缺文件或模型：404；未知 URL：404；非 GET：405；JSON 错误 `{ok:false,error:{code,message}}`，不泄露绝对路径。失败只影响当前层，切出重进允许重读失败数据；无轮询、自动重试、控制文件写入或 Start/ReInit。
- 比例 KPI 验证 0..1，RSS 误差非负。显示两位小数；变化 `(on-off)/off*100`，一位小数；off=0 或相等不显示变化。保留实际上升/下降方向，不硬编码改善。
- matrix 按文件原始数值经 `CASE1_RANGE_HEATMAP_RSS`（默认 `-500,500`，与 case2 RSS 热力一致）双边掐位后返回；行上至下、列左至右，不取负、不转置；尺寸动态。RSS KPI 来自独立标量文件，不由矩阵重算。
- RF 层进入后即将离线矩阵叠加到底图，使用 case2 的逐图 min/max、双线性与蓝青黄红透明网格；按底图原始像素校验 VITE_CASE1_HEATMAP_X0/Y0/X1/Y1，再与底图共同拉伸。支持视图缩放、旋转、平移、恢复配置初值及独立 RF 参数调试。不存在旧 VITE_CASE1_RF_OVERLAY 开关。
