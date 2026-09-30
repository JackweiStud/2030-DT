# Case4 3D 定位视图与共享场景配置 SPEC

日期：2026-09-29。本文为 case4 3D 与 case3/case4 共享 Three 基建的实现契约；**代码已落地**（Web / Node / 本地自动测试与真实 GLB＋模拟业务 Chrome 检查），用户最终视觉、目标 PC 性能、真实后端／挂载仍待确认。项目进度只记录于 `state.md`。

参考：`case3-3d-view-spec.md`、`../case4/WEB-SPEC.md`、`../case4/REFLECTION-SPEC.md`。本文覆盖既有“case4 3D 禁用／不做 3D Reflection”的范围限制；其余控制、数据归一、完成门槛与指标语义沿用当前 case4 实现和最新契约。历史文档中的旧命令值不因本增量恢复。

## 1. 目标与范围

正式 case4（DT辅助定位）启用 2D/3D 切换；3D 展示预期路线、编号与完成进度、UE 图标、三种实时定位轨迹以及当前 Pi 的 LOS／多条独立反射路径。使用与 case3 相同的几何 GLB；场景速度／背景／公共 BS 与共享模块共用，**相机与 debug 按 case 独立配置**。

不新增定位算法、仿真、模型求交、后端业务字段、共享文件、轮询、命令或历史反射回放；不修改误差、CEP、吞吐、CDF 和最终统计来源。保留 Shell 1920×1080 等比缩放与单活跃 case 规则。

## 2. 共享与隔离

- 共用文件：`code/web/assets/case1/3D/Beijing_Geometry.glb`。不复制 case4 模型，不修改 GLB；部署必须包含该文件。
- case4 增加固定只读 `GET /api/case4/models/geometry`，读取同一文件并返回 `model/gltf-binary`；禁止任意路径参数与写入，不调用 case3/case1 业务 API，不访问控制文件。支持 ETag／Last-Modified 条件 304；客户端取消流后不再写错误响应。
- 可复用能力在 `code/web/src/cases/shared/three/`：`ThreeViewport.tsx`（加载／相机／光照／截图句柄／debug）、`config.ts`（env 解析与坐标换算）、`overlay.ts`（空间线／图钉／气泡）。case3-v2／case4 各自 `components/map/MapRenderer3D.tsx` + `threeOverlay.ts` 提供业务叠加；禁止 case4 使用 case3 controller、业务类型或单反射规则。
- 模型与公共配置共享不代表共享活跃场景、相机实例或业务数据。**初始化相机／debug 按 case 各自 `.env` 键**；进入后交互独立，case3 不会立刻改变 case4。不新增跨 case 全局视角持久化或常驻 GPU 缓存。
- case4 业务状态、叠加、错误提示与 CSS 保持 case-local（根作用域 `.case4-page`），公共模块不承担业务轮询。

## 3. 坐标契约

- 模型及业务 XYZ 均以米为单位，按 1:1 尺度使用；统一转换 `(x,y,z) → (x,z,-y)`（`businessToModel`）。
- 保留模型原生场景坐标与节点变换；不居中、不做最长边归一化，不自动吸附地面，不修改实际高度。
- 不使用 2D 的 origin、unitsPerPx、图片旋转或平移；不新增 3D 原点、旋转和像素比例标定参数。
- 三轨迹、base、UE 图标、DT 波束端点、BS、所有 Ri 都只应用一次同一轴向转换。
- 当前原点和平面方向的用户视觉核对见 case3 规格 §3.1；同模型可复用其坐标约定，但不把它扩大为 case4 实际轨迹或测量精度验收。

## 4. 配置（以代码为准）

配置由 `code/web/.env` 提供，解析在 `cases/shared/three/config.ts` 的 `loadCase3ThreeConfig(env, "case3"|"case4")` 与 `normalizeThreeEnv`。修改后重启开发服务或重新构建，不引入浏览器／Node 写配置接口。

### 4.1 按 case 独立（相机／debug）

| 键 | 含义 |
| --- | --- |
| `VITE_CASE3_3D_DEBUG_INFO` / `VITE_CASE4_3D_DEBUG_INFO` | 默认 false；接受 true/false、1/0 |
| `VITE_CASE3_3D_CAMERA_POSITION` / `VITE_CASE4_3D_CAMERA_POSITION` | GLB XYZ 三项有限数，与 TARGET 成对 |
| `VITE_CASE3_3D_CAMERA_TARGET` / `VITE_CASE4_3D_CAMERA_TARGET` | GLB XYZ 观察目标 |
| `VITE_CASE3_3D_CAMERA_ZOOM` / `VITE_CASE4_3D_CAMERA_ZOOM` | 正有限数，默认 1 |

当前仓库初值（可独立修改）：case3 沿用既有相机；case4 为独立相机初值（见 `.env`）。**Case4 不读取 Case3 的相机／debug 键。**

解析优先级：对应 `VITE_CASE{N}_3D_*` 存在则用之；仅当该 case 键不存在时，才兼容回退同名旧公共键 `VITE_DT_3D_DEBUG_INFO|CAMERA_*`。键已存在但为空：POSITION/TARGET 空 → 自动取景；ZOOM 空或非法 → 3D 配置错误。显式空值不回退到另一 case 或旧值掩盖。

### 4.2 两 case 共用

| 键 | 含义 |
| --- | --- |
| `VITE_DT_3D_PAN_SPEED` | 正有限数，默认 1 |
| `VITE_DT_3D_ROTATE_SPEED` | 正有限数，默认 1 |
| `VITE_DT_3D_ZOOM_SPEED` | 正有限数，默认 1 |
| `VITE_DT_3D_BACKGROUND_COLOR` | 带引号的 `#RRGGBB`；缺失／非法回退 `#202832` |
| `VITE_DT_3D_BS_XYZ` | 业务 XYZ（m）；可留空 |

兼容：未迁移环境仍可读旧 `VITE_CASE3_3D_PAN_SPEED|ROTATE_SPEED|ZOOM_SPEED|BACKGROUND_COLOR|BS_XYZ`（经 `normalizeThreeEnv` 映射）。`.env`／`.env.example` 活跃赋值以 case 相机键 + 公共速度／背景／BS 为准。

- BS 未配置／留空：case3 3D 回退 `CASE3_BS_XYZ`，case4 3D 回退 `CASE4_BS_XYZ`。显式公共 BS 对两者 3D 生效；2D 各自仍用原 BS。
- 反射开关仍分别使用 `CASE3_REFLECTION_ENABLE`／`CASE4_REFLECTION_ENABLE`。
- POSITION/TARGET 均为空时自动适配模型；只配一项、重合、格式非法或非正 zoom/speed 时提示当前 case 的 3D 配置错误，不阻断 2D 与业务流程。
- case1 几何／电磁层背景读取 `VITE_DT_3D_BACKGROUND_COLOR`，兼容旧 `VITE_CASE3_3D_BACKGROUND_COLOR`；case1 相机与业务配置不迁移。
- debug 仅当前 case 的 3D 视图可见；复制输出为当前 case 的四项相机／debug 键 + 公共 `VITE_DT_3D_` 速度／背景（不含 BS 回退值）。支持手工复制，过滤业务截图，不写 localStorage。

模板示例（与 `.env.example` 对齐）：

```ini
VITE_CASE3_3D_DEBUG_INFO=false
VITE_CASE4_3D_DEBUG_INFO=false
VITE_CASE3_3D_CAMERA_POSITION=
VITE_CASE4_3D_CAMERA_POSITION=
VITE_CASE3_3D_CAMERA_TARGET=
VITE_CASE4_3D_CAMERA_TARGET=
VITE_CASE3_3D_CAMERA_ZOOM=1
VITE_CASE4_3D_CAMERA_ZOOM=1
VITE_DT_3D_PAN_SPEED=1
VITE_DT_3D_ROTATE_SPEED=1
VITE_DT_3D_ZOOM_SPEED=1
VITE_DT_3D_BACKGROUND_COLOR="#202832"
VITE_DT_3D_BS_XYZ=
```

## 5. 进入预加载与生命周期

- 进入 case4 默认展示 2D；`MapRenderer3D` 在 2D 下仍挂载（隐藏），`ThreeViewport` 进页即请求／解析 GLB，不等待点击 3D。
- 预加载不阻塞初始化、Start/ReInit、2D 操作或业务截图顺序。默认 2D 不显示阻断式 3D 加载层。
- 同次停留复用已解析模型；首次显示 3D 时绘制最新业务快照。StrictMode 不得导致重复大文件下载。
- 隐藏 3D 时停止动画与相机响应，保留本次视角；恢复时绘制最新数据。视图切换不清业务结果。
- 预加载失败不影响 2D；进入 3D 后显示错误、可回 2D 与显式重试，无无限自动下载重试。
- 切离 case4 取消在途请求、忽略迟到结果并释放资源；再进入重新初始化并预加载；刷新恢复配置初值。
- 模型体积／性能以目标 PC 实测为准，不提前承诺帧率。

## 6. 页面与相机交互

- `ViewModeToggle` 为可操作 button，带 `aria-pressed` 选中语义；切换只替换地图层，HUD／图例／底部面板／全屏数据与 Shell 保持。
- Start/ReInit 等待期间允许 2D/3D 切换；仅截图采集临界区 `captureLocked` 禁用切换。其他 case Tab 继续受忙碌锁约束。
- 左键旋转、右键平移、滚轮缩放；Y 向上、限制翻到地下；按 Shell 显示比例修正手势速度。
- 复位钮沿用现有样式与位置，仅交互后显示；恢复初始化相机，不触发 ReInit。
- 2D/3D 分别保留本次视角；业务 ReInit 清动态业务叠加，不承担相机复位。
- 光照：RoomEnvironment + PMREM、ACES、sRGB；背景独立于环境光。不要求与 Blender 像素级一致。

## 7. 路线与三种实时轨迹

- 消费同一 case4 `baseRoute` 与已收齐 `livePoints`，不另建进度或数据请求（见 `case4OverlayInput`）。
- 预置路线、编号 idle/lit、完成进度和 UE 图标保持 2D 语义。UE 图标位于当前已展示 Pi 对应的 base XYZ，不跟随 DT。
- 三轨迹分别使用 `traditional`、`commercial`、`dt` 的实际 XYZ；颜色：传统 `#97AAC4`、商用 `#F0A12E`、DT `#5ABFFB`。
- 线宽／点标识保持逻辑屏幕像素尺寸；不随相机距离夸张放大。
- 65535 分量替代由 Node 归一完成，Web 不二次修复。误差回溯／悬停不因 3D 失效，不新增三维误差计算。
- 新轮、失败、ReInit 与最终结果沿用现有 case4 reducer。

## 8. case4 反射语义

- 3D 使用当前 Pi 的 `dt` 作为波束 UE 端点，允许与 base 上的 UE 图标不重合。
- 方向严格沿用 case4 2D：LOS `UE → BS`；每个有效 Ri 为独立 `UE → Ri → BS`（`buildReflectionPaths`）。不得复制 case3 的 BS→UE 方向。
- `los=true` 同时显示直达及所有有效反射；`los=false` 仅反射；零反射无路径。保留 Ri 原编号。
- `ready/invalid/missing` 规则沿用 2D；新 Pi 替换旧路径；无效／缺失不画路径。
- 运行中白色亮段从 UE 流向 BS；完成后静态波纹。LOS 绿、反射紫青。
- BS 为蓝色「基站」气泡；显隐沿用 case4 2D ready 条件（`bsXyz3d ?? bsXyz`）。
- 完成仍不等待反射补齐；不改变 `/trajectory` 共同前缀或 `/result` 门槛。

## 9. 截图一致性

- `MapStage` 按当前视图委托 2D／3D `prepareCapture`／`finishCapture`；采集期间 `captureLocked` 冻结视图切换。
- 保存当前可见 2D 或 3D；3D 含模型、三轨迹、点号、当前反射、HUD 及指标，过滤 debug。
- 3D 未就绪／失败不得生成空白成功图；沿用有限重试，不影响业务终态。默认 2D 截图不等待模型预加载完成。

## 10. 最小验收与交接

1. 配置：case 相机／debug 优先、公共速度／背景／BS、旧键兼容、空值与非法值规则；两 case 运行时相机独立；case1 背景无回归。
2. 模型：case4 GET 字节与共享文件一致；进页预加载；StrictMode／切换不重复下载；退出释放正确。
3. 轨迹：三轨迹 XYZ／颜色／点号／进度与 2D 一致；UE 在 base。
4. 反射：LOS+多 Ri、NLOS、方向、invalid/missing；DT 端点可与 base 图标不同。
5. 交互：缩放窗口下手势／复位、2D/3D 切换保留、Start/ReInit、全屏与 Esc。
6. 截图：真实 GLB PNG 含轨迹与反射、无 debug。
7. 回归：case3 仍为 BS→UE／单反射；case4 2D 业务规则不变。

证据写入 `doc/case4/QA-EVIDENCE.md`（及 case3 回归条目），进度写入 `state.md`。本地 GLB + 模拟数据不宣称真实后端、真实挂载或真实采集已由本仓库独立验收。
