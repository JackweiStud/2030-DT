# case1 静态资产来源

复制自 `03-design/case1/assets/`，只包含当前 Pencil 四帧实际引用的文件。未改原图。

| 静态路径 | 设计源 |
|---|---|
| `nav-bg.png` `cloud-site.png` `huawei-logo.png` | 共享顶栏参考 |
| `bg-right.png` | RF 层右侧面板底 |
| `geometry-3d.png` | 几何层主视图 |
| `rf-map.png` | RF 层主视图（含旧热力色块，本阶段不替换） |
| `material/地图.png` | 电磁层主视图 |
| `material/玻璃.png` `木材.png` `金属.png` `其他.png` `swatch-concrete.png` | 材质图例缩略图 |
| `layer-*.png` | 左侧五层菱形图 |
| `icon-*.png` | 标题与 KPI 图标 |
| `home/*+new.png` | 首页说明行配图 |

未复制未引用的备用图。正式 `code/web` 资源不在本目录，后续迁移时按职责另拷。
