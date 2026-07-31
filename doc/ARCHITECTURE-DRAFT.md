# 共享架构草案

> 本文冻结 Gate 0 的责任边界，不是实现规格；端口、REST 路由、文件锁和目录路径留到 Gate 2/3。

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

## 目标数据流

```text
Chrome case2
  -> 本机 REST（细节待冻结）
  -> 前端 PC Node 适配服务
  <-> 已挂载共享目录（路径/锁待冻结）
  <-> 后端 PC 业务进程

后端：status=case complete + save_picture_flag=1
  -> 适配服务向 Web 暴露稳定状态
  -> Web 产生完成态 PNG
  -> 适配服务保存 PNG 到 case2/out（位置待冻结）
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

后端必须先完成当批结果发布，再以 `status="case complete"` 允许前端读取；具体“同批”“原子”的锁与发布算法尚未冻结。

## 不纳入本草案

- WebSocket、Socket.IO、Node 服务端口、REST 资源路径、鉴权、数据缓存、后台常驻 case。
- 真后端算法、文件格式升级、截图文件命名、共享目录部署脚本。
- case1、case3、case4 的业务复用判断。
