# case1 独立技术预检

2026-09-21，Codex 在 Pencil 设计前并行开展的只读资产/现有代码检查。不是正式 API 契约、施工批准或 3D 浏览器验收。不改参考文件、模型或 `.env`。

## GLB 文件检查

来源：`01-参考资料/case1/3d--case1/`。通过读取 GLB 头部和 JSON chunk 检查元数据，未加载渲染、未验证所有二进制 accessor。

| 文件 | 字节 | mesh / node | 材质 | 图片 / 动画 | 必需扩展 / 外部 URI |
|---|---:|---|---:|---|---|
| Beijing_Geometry.glb | 74,957,104 | 112 / 112 | 27 | 0 / 0 | 无 / 无 |
| Beijing_Material.glb | 75,658,032 | 124 / 126 | 8 | 0 / 0 | 无 / 无 |

两文件 magic、版本 2、声明长度与实际大小一致。JSON 未声明外部 buffer/图片依赖或必需压缩扩展；这只能说明没有这些声明，不能据此宣称 Three.js 已加载成功或性能合格。相机位置、实际边界、坐标方向与目标 PC GPU 开销需后续运行验证。

电磁模型材质名：`itu_metal`、`itu_wood`、`itu_concrete`、`itu_brick`、`itu_glass`、`itu_very_dry_ground`、`Material_text`、`Material_Building_glass`。它们不等于 UX 五种图例的一一映射；当前只读说明图例，不新增材质分类算法或模型重染色。默认保留 GLB 自带材质。

## TXT 检查

来源：`01-参考资料/case1/后端接口数据/`，9 个文件逐个按逗号/行读取数值。

- `heatmap_rss.txt`：30 行，每行 50 列，当前样本最小 55、最大 70；正式解析不能写死 30×50。
- 八个 KPI 各为单个标量；几何保真度 off/on=0.85/0.90，重构覆盖率=0.82/0.91，电磁信道保真度=0.88/0.92，RSS 误差=1.2/0.8。
- 保留 TXT 中 `geonetry` 文件名。模型文件实际名与接口截图名不同，正式配置应显式映射，不复制重命名原始模型。

## 现有服务可复用处与缺口

| 现有文件 | 可复用 | 边界 |
|---|---|---|
| `code/server/src/app.mjs` | 多 case router 的组装方式 | case1 不绑定 control store，不写 init/start/reinit |
| `shared/atomic-write.mjs` | 同目录临时写、fsync、原子替换、Windows 短暂 rename 重试 | 不是字段级合并器，也不是跨进程编辑锁 |
| `shared/serial-queue.mjs` | 进程内串行操作 | `.env` 所有 case1 层共用一个文件写队列，不能各层独立并发覆盖 |
| `shared/env-file.mjs` | dotenv 读取与校验习惯 | 解析为对象后重写会丢注释/原排版；需专门只替换白名单键的文本更新器 |
| `shared/http.mjs` | JSON 响应和请求解析 | 视角体积很小，应采用局部更小 body 上限；GLB 用二进制流，不转 Base64/JSON |

文件访问仍由同机 Node 管理。模型路径由服务配置的两个固定映射决定；不能让浏览器提交任意本地路径。原始 UX/GLB 保持不变；部署资源路径及打包方案在正式契约/SPEC 中定稿。

## 待契约阶段使用的最小接口候选（未冻结）

| 能力 | 候选 | 用途 |
|---|---|---|
| 按页离线数据 | GET `/api/case1/data?layer=geometry\|material\|rf` | geometry 四标量、material 两标量、rf 矩阵+两标量；不实时轮询 |
| 预置模型 | GET `/api/case1/models/{geometry\|material}` | 固定文件映射、流式响应；两个模型独立失败 |
| 视角配置 | GET `/api/case1/views/{geometry\|material}` | 仅返回该层初始/最近视角及交互参数，不返回完整 `.env` |
| 保存视角 | PUT `/api/case1/views/{geometry\|material}` | 只保存经校验的最近视角，持久化成功才响应成功 |
| 恢复视角 | POST `/api/case1/views/{geometry\|material}/reset` | 服务端读取该层初始配置、写入最近视角后返回结果 |

不增加独立实时业务后端、模拟建模进程或外部后端 handoff。正式契约需进一步写明错误 shape、保存/Reset 排序、配置读写失败、外部手工编辑冲突和启动默认视角策略，不能把候选路由直接当已批准合同。

## 有针对性的后续验证

1. 解析：合法参考样本、非矩形/非法值、缺失文件、单层失败不拖其他层。
2. 保存：两层写入不互相丢失、保留其他键/注释/行尾、Reset 后无旧请求覆盖、写失败有反馈。现有原子替换只保证完整替换，不承诺与用户编辑器同时写入绝不冲突。
3. 开发环境需实测写 `code/web/.env` 是否触发 Vite 重启/全页刷新；若触发须在实现中处理或明确反馈，不能因持久化造成操作中断。正式构建也须运行时读取最近视角。
4. 3D：实际 GLB 可见、三种鼠标操作、相机恢复、逐次切页和 case 切换的资源释放；预加载是否阻塞首页需真实浏览器证据。
5. RF：纯底图就绪后标定矩阵角点/方向，验证数值→颜色→画面的对应。当前彩色底图不能用于最终数据验收。
