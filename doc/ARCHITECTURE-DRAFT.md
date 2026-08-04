# 共享架构草案

> 本文冻结 Gate 0 的责任边界，不是实现规格；已批准接口见 `doc/case2/API-CONTRACT.md`，具体端口、目录注入与控制写入算法见 Gate 3 SPEC；本地实现与 QA 证据见 `doc/case2/QA-EVIDENCE.md`。

## 项目模式

- 多并列 case 项目，单一 Web 入口，四个顶部 Tab。
- 当前仅 case2 可进入业务内容；其他 Tab 进入统一“建设中”占位，不读取共享目录。
- case2 是独立业务 case，不可因同属 IMT-2030 而继承其他 case 的指标、状态机或字段。

## 责任边界

| 层 | 负责 | 不负责 |
|---|---|---|
| 共享 Shell | 导航、当前 Tab、1920×1080 等比缩放、公共 token、建设中占位 | case 业务状态、结果文件、图表、截图、业务 CSS |
| case2 Web | case2 视觉状态、按钮、热力图/CDF/均值的派生展示、截图触发 UI | 直接访问共享目录、持有文件锁、写本地输出文件 |
| Node 本地适配服务（前端 PC） | 唯一文件 I/O、锁、控制文件读写、稳定结果读取、截图 PNG 落盘、截图标志回写 | 后端业务采集、其他 case 的业务决策 |
| 后端业务进程（后端 PC） | 读取控制、执行 `with dt` 校准、发布结果、回写 `status` 与截图请求标志 | 浏览器 UI、前端截图编码 |
| 本地模拟后端（打桩） | 在无真实后端时扮演共享目录另一端，推进状态并发布 synthetic/stub Calibrated 文件 | 真实采集、真实算法、REST 接口 |

## 目标数据流

```text
Chrome case2
  -> 本机 REST（默认 127.0.0.1:3102）
  -> 前端 PC Node 适配服务
  <-> 已挂载共享目录（CASE2_SHARED_DIR 注入）
  <-> 后端 PC 业务进程

后端：status=case complete + save_picture_flag=1
  -> 适配服务向 Web 暴露稳定状态
  -> Web 产生完成态 PNG
  -> 适配服务保存 PNG 到 {CASE2_SHARED_DIR}/out/case2/
  -> 适配服务持锁将 save_picture_flag 写回 0
```

## Shell 合同

- 设计基准：1920×1080。`scale = min(viewportWidth / 1920, viewportHeight / 1080)`；固定舞台整体等比缩放、居中。
- Shell 是唯一缩放所有者；case 页面不得实现第二套全页缩放。
- 单活跃生命周期：切离 case2 时卸载 case-local 状态、停止轮询、清理计时器；切回时按当前适配服务状态重新初始化。
- CSS：`shell.css` 只包含 Shell；业务选择器必须有 `.caseN-page` 前缀或使用 CSS Modules；全 Tab 视觉冒烟是后续验收项。
- 运行资源：`04-runtime-assets/shell/` 只归 Shell 所有，提供 `--shell-*` 与品牌/导航资产；`04-runtime-assets/caseN/` 只归对应 case 所有。case 页面可消费 Shell 注入的公共 token，但不得拥有或直接引用 Shell 资产。

## case2 文件结果边界

当前 UX 仅消费六类 Calibrated 输出：三张热力图（RSS、有效路径数、首径时延）和三组 KPI 样本。AOA/ZOA 不进入当前 UI。

后端必须先完成当批结果发布，再以 `status="case complete"` 允许前端读取。真实后端采用“六文件关闭后最后写完成状态”的最小规则；本地无真实后端时的打桩行为见 `doc/case2/realback_no.md`。前端文件适配服务见 `doc/case2/SERVER-SPEC.md`。

截至 2026-08-04，正式 Web、Node 适配服务和本地模拟后端已完成本地打桩联调。该结论只覆盖仓库内 `code/comdatafiles` 与本机进程，不覆盖真实后端 PC、真实挂载路径或真实采集数据。

## 不纳入本草案

- 本草案不重复记录 WebSocket、Node 服务端口、REST 资源路径、数据缓存等施工细节；以 case2 API 契约和两份 SPEC 为准。
- 真后端算法、文件格式升级、截图文件命名、共享目录部署脚本。
- case1、case3、case4 的业务复用判断。
