# 02: 接入 Case3 V2 初始页与真实初始化握手

**What to build:** 用户点击临时第五个 `DT for Comm new` Tab 后，看到与已验收静态稿一致的 Case3 V2 初始页面，而不是建设中占位；页面通过现有 Case3 控制链完成初始化，并展示真实动态路线、基线 BA 和可操作的 2D 场地。

**Blocked by:** 01: 提取 Case3 共享展示模型并保持旧页面不变。

**Status:** completed

- [x] `case5` 仅作为临时 Shell Tab ID；页面、组件、样式、资产和测试统一归属 `case3-v2`。
- [x] 页面复用现有 Case3 controller，并按 `GET control -> POST init -> GET init-data` 完成进入、刷新和切回初始化；不得新增 Case5 API、controller、reducer或后端状态链。
- [x] 新旧 Case3 页面互斥挂载；切换后目标页面回初始态，不共享同一轮本地结果，也不会同时轮询同一 Case3 控制链。
- [x] V2 正式资源进入运行时资产目录；禁止运行时读取 `web-static`、Pencil 或设计源目录。
- [x] 使用冻结的 V2 等轴测底图，并通过 V2 专属纯投影将动态 `baseRoute` 映射为预置路线和真实编号点位，不写死 20 点。
- [x] 投影至少以起点、转折点和终点断言路线走向及可视范围；旧 Case3 卫星底图和原投影配置不变。
- [x] 2D 视图为选中态，3D 视图可见但禁用；不引入 Three.js、3D 模型、全屏或猜测参数。
- [x] 保留滚轮缩放、左键旋转、右键平移和手动复位；地图内容共用 transform，HUD 和底栏不随地图变换。
- [x] “现场环境”只调用现有 Shell 弹窗；打开、拖拽、关闭和切 Tab 关闭行为保持现状。
- [x] 初始 Cost 和 Throughput 为空；BA 使用 `init-data` 动态基线，不写死 `75/75/25`。
- [x] 页面在 1920x1080 舞台内无滚动、无重叠，旧 Case3 与其他 Tab 回归通过。
