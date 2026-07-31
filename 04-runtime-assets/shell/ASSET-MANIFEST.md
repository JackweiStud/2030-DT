# Shared Shell 运行时资源清单

> 所有者：项目 Shell，而非任何 `caseN`。
> 消费者：Shell 入口。case 页面可读取 `--shell-*` 公共 token，但不得直接拥有、复制或重定义这些资源。

| 路径 | 来源节点 | 语义用途 | 格式/尺寸 |
|---|---|---|---|
| `brand-logo.png` | `L70zre` 品牌图标 | Shell 品牌标识 | PNG RGBA 64×64（逻辑 32×32@2×） |
| `shell-nav-background.png` | `M1hmPU` 导航背景 | Shell 顶部导航装饰底图 | PNG RGBA 4656×222（逻辑 2328×111@2×） |
| `tokens.css` | Pencil 变量和 Shell 测量 | 固定舞台、Header、Tab、公共文字与颜色 token | CSS 自定义属性 |

## 交接规则

1. 正式 Shell 入口加载本目录的 `tokens.css`，并引用本目录静态资源。
2. 正式 `caseN` 只加载各自 `04-runtime-assets/caseN/` 的业务资源；若需公共视觉值，只消费已由 Shell 注入的 `--shell-*`。
3. `web-static/case2/index.html` 是 Gate 1.5 组合验收夹具，包含 Shell mock；其引用本目录不代表 case2 拥有 Shell。
