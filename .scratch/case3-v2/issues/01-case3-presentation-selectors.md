# 01: 提取 Case3 共享展示模型并保持旧页面不变

**What to build:** 在不改变旧 `DT for Comm` 页面视觉和业务行为的前提下，提取一套可被旧皮肤与 Case3 V2 同时使用的纯展示模型。它统一解释 controller 状态，避免新页面复制当前快照选择、单侧历史、配对有效性、按钮权限、状态文案和 KPI 输入等规则。

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] 共享展示模型能够从现有 Case3 controller 状态派生当前动作、当前侧快照、单侧历史、配对有效性、按钮权限、状态文字、地图输入、回溯输入和 KPI 输入。
- [x] 展示模型明确区分实时快照、完成快照、保留的单侧历史和不可跨轮比较的数据，不恢复已经被新 Start 或 ReInit 失效的目标侧结果。
- [x] 旧 Case3 页面改为消费共享展示模型后，DOM 语义、视觉、按钮行为、状态文案、截图和 busy 锁保持不变。
- [x] 不修改 Case3 API、controller 对外接口、reducer 状态机、metrics 公式、Node 路由或后端协议。
- [x] 为初始、Without/With 运行与完成、单侧历史、未配对、resetting、failed 和 roundClosing 补齐纯函数测试。
- [x] 现有 Case3 单元测试、Playwright、类型检查和构建全部通过。
