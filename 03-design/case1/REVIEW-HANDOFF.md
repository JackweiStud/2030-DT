# case1 REVIEW-HANDOFF（Cursor → Codex / 用户）

## 结论

case1 Gate 1 Pencil 设计源已达到 **REVIEW_READY**，可供人工视觉评审与 Codex 独立回查。  
**未**标记 APPROVED / frozen；**未**进入静态 HTML 或正式实现。

## 设计源

- 路径：`03-design/case1/case1-dt-construction.pen`
- 四主帧 ID：
  - home `NATU1`
  - geometry `J9nVp3`
  - material `ag2DF`
  - rf `JsMgu`
- 局部状态样板：`sft2y`
- 组件：Shell `VRFL0`、左导航 `EabWc`、KPI `k5buD9`、工具 `d3LPp`、反馈 `ttrUa`

## 入库路径（精简后）

```text
03-design/case1/case1-dt-construction.pen
03-design/case1/assets/          # 设计引用资产 + 少量用户自留备用图
03-design/case1/assets/SOURCE.md
03-design/case1/Visual_Diff.md
03-design/case1/Frontend_Spec.md
03-design/case1/REVIEW-HANDOFF.md
```

已删除：`03-design/case1/_qa/`（过程截图与 JSON 不入库）；以及未引用的重复资产拷贝（根目录中文副本、`home-*` ASCII 别名、`nav/`、`geometry/` 等）。

## 评审方式

1. 在 Pencil 中打开 `.pen`，按四主帧 ID 目视核对 Shell、左右分栏、Layer3=RF、KPI 数值。
2. 对照 `Frontend_Spec.md` 中的 node id；需要时可再用 Pencil MCP `Get` / problems 复检，不依赖已删除的 `_qa`。
3. 对照 `doc/case1/UX-STATE-MAP.md` 与本目录 `Visual_Diff.md`。
4. 更新 `state.md` / `doc/case1` 时写明：REVIEW_READY，用户尚未冻结。

## 重要差异（相对 UX）

1. 顶栏 = 当前 Shell，不是 UX 旧顶栏。
2. Layer 3 文案 = **RF 层**。
3. KPI = TXT 离线样例与真实升降方向，不是 UX 0.2/0.3/+50%。
4. RF 色标 = 蓝→青→黄→红；地图资产仍含旧热力色块，待纯底图。
5. 新增 3D Reset / 视角保存反馈；无 Start/ReInit。

## 分层与 Flex

- 页面：Shell + 内容区 horizontal flex（左固定 / 右 fill）。
- 右侧：vertical flex（标题 hug / 内容 fill）。
- 首页行与详情概述：horizontal flex；KPI/配图可编辑拆分。
- 五层菱形堆叠：仅在导航组内局部定位；全页未改成绝对定位堆叠。
- 图层中文语义命名；组件树接近未来前端树。

## 剩余风险

- RF 纯底图与坐标标定未到位 → 热力最终色/投影不可验收。
- 3D 仅为代表图 → 旋转缩放平移与 `.env` 持久化需正式实现验收。
- 左堆叠与 UX 透视间距可能仍有像素差，需用户视觉拍板。
- 材质图例现为色块/源图示意，可再替换。
- `bg-left-*`、多余 swatch、备用 icon 仍留在 `assets/`，由用户自行决定去留。
