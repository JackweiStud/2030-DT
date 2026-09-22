# case1 Gate 1.5 静态 HTML 验收记录

状态：Gate 1.5 PASS。2026-09-21 用户已确认视觉验收通过；Codex 独立代码/浏览器复核通过（非正式动态功能验收）。

## 设计源与入口

- 设计源：`03-design/case1/case1-dt-construction.pen`
- 四帧：home `NATU1`、geometry `J9nVp3`、material `ag2DF`、rf `JsMgu`
- 设计截图（2026-09-21）：`web-static/case1/_qa/pencil/NATU1.png`、`J9nVp3.png`、`ag2DF.png`、`JsMgu.png`
- 页面：`web-static/case1/index.html`
- 启动：在 `web-static/case1` 执行 `python3 -m http.server 8091 --bind 127.0.0.1`
- 本次地址：`http://127.0.0.1:8091/index.html`（进程仍在，端口 8091）
- 浏览器：Cursor 内置 Chromium，Chrome/148.0.7778.280，Electron/42.10.0
- 验证日期：2026-09-21

未改 Pencil。未补 Reset、保存提示、失败态、3D 交互或热力融合。KPI 保持稿面示意 `0.2` / `0.4` / `50%` / `RF off` / `RF on`，不是正式业务常量。设计里还没对齐的文案和行结构按稿保留，等设计 gap 消除后再改。

## 三项阶段目标

| 目标 | 证据 | 结论 |
|---|---|---|
| 高保真对照 Pencil | 四帧设计 PNG 与 `web-static/case1/_qa/browser/` 下 home、geometry、material、rf | 四页可浏览。首页右栏实测 `x=560` 宽 `1340`，详情右栏 `x=570` 宽 `1320`，与稿一致。主视图按稿裁切。左导航上下矩形同左缘、同宽；右侧连接虚线在两框外侧，见偏差 |
| 结构能承载数据变化 | 几何页把 off 数字改成 `123.456` 再清空 | 灰柱高保持 40px，变化徽标高保持 48px，空数字槽高保持 29px。测完写回 `0.2`。未做完整数值映射 |
| 可迁入正式前端 | `.case1-page` 作用域、顶栏与业务分离、`case1.js` 里的 `DEMO`、`assets/SOURCE.md` | 静态假交互和示意数字不得原样进 `code/web` |

## 点击、缩放、资源

在 1920×1080 实测：

- 首页五图原色。点几何进入几何页，再点几何回首页。
- 点电磁、RF 可互相切换。当前图原色，其余四图 `opacity: 0.35`。变暗的几何/电磁/RF 仍能点。
- 知识图谱、应用层是 `div`，不在 Tab 顺序里，没有弹窗。
- Space、Enter 作用在三个菱形按钮上：打开详情，再按一次回首页。刷新回首页，不写 localStorage。
- 顶栏其他 case 是静态文字，没有跳转。
- 资源请求没有 404。没有业务网络请求。

在 1440×900 实测：舞台 `scale(0.75)`，`html/body` 为 `overflow: hidden`，`scrollWidth/scrollHeight` 为 1440×900。RF 按钮命中区仍在，点击能进入 RF 页。

## 偏差

### 本阶段修复

- 隐藏详情曾仍是 flex 项，把首页右栏挤成约 320px。已让 `[hidden]` 退出布局。
- KPI 的 `0.2` 一度贴在灰柱上。数字槽和柱形已分开，两条数字同一基线。

### 下阶段验收

- 几何/电磁 3D 交互、初始相机、调试面板。
- TXT、RSS 热力融合、纯底图替换。当前 `rf-map.png` 仍带旧色块。
- 稿面未对齐的文案：首页「电常数」对详情「介电常数」；首页 RSSI 对 RF 页 RSS；首页与详情的电磁、RF 描述不同。静态页按各自画面保留。
- 首页知识图谱行、应用层行的结构和裁切按稿保留，没有收成同一种行。

### 用户已接受（本轮整体视觉通过）

- 左导航：上四层矩形与下应用层矩形已按稿同左缘、同宽（内容区 x=193、宽 286）。左右侧虚线收到第 4 层菱形中线（y=627）。右括号回勾从矩形右缘外侧起笔，不压上框背景；下端在下框中线（y=871）向左收回，不落到框底。用户已整体接受当前画面。
- 色标按当前 Pencil 节点：强红、较高橙、较低黄、弱绿。不是后续文档里的蓝青黄红。

两项按本轮用户已通过当前静态画面的决定接受；动态矩阵的图例必须与实际配色同步。

## 可迁移与必须丢弃

可迁移：`case1.css` 里 `.case1-page` 的布局、颜色、字号；`assets/` 中设计引用过的图；KPI/标签/图例的独立 DOM。

必须丢弃，不能进正式运行路径：`DEMO` 示意数字、静态脚本事件绑定（页面切换行为本身保留并以 React 状态实现）、顶栏假 Tab、为对照钉死的主视图像素偏移。正式 Shell 仍由 `code/web` 拥有，本页顶栏只是静态参考。

## 修改文件

- `web-static/case1/index.html`
- `web-static/case1/case1.css`
- `web-static/case1/case1.js`
- `web-static/case1/assets/` 与 `assets/SOURCE.md`
- `web-static/case1/_qa/pencil/`、`web-static/case1/_qa/browser/`（过程证据，默认不提交）
- `doc/case1/STATIC-HTML-ACCEPTANCE.md`

未改 `03-design/`、`01-参考资料/`、`code/`、`state.md`。

## Codex 独立复核证据

2026-09-21，通过 Playwright 启动本机 Chrome，在 8091 页面复测 geometry→home→material→rf、Space→home、Enter→rf；详情 opacity 分别为当前1、其他0.35，首页全1；1440×900 舞台矩阵 scale=0.75，pageerror=0。

结构结论：左右两栏与详情组件可迁移；数字/空数字的结构验证足够本阶段，不能当成正式图表映射测试。源码中的裸 .c1-*、:root 和全局 reset 实际未全限定 case1-page，因此正式迁移必须收紧作用域并移除静态 Shell。KPI 的硬编码柱高在正式实现替换；不列为本阶段阻塞。
