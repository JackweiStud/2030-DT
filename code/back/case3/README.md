# Case3 本地模拟后端

该进程只用于没有真实后端时的本地联调。它监听共享根中的
`case_control.json`，按 Case3 协议推进业务状态，并逐点发布
synthetic/fixture 数据。它不提供 REST，不能与真实后端同时运行。

## 启动

在 `code/back` 根目录：

```bash
npm run start:case3
```

`scripts/run.mjs` 在本地默认使用 `code/comdatafiles`，且只读取
`code/back/.env` 作为外部配置源。真实挂载或临时联调目录应写入：

```dotenv
DT_SHARED_DIR=/absolute/shared/root
```

默认参数：

- 控制轮询 200ms；
- `execute success` 保持 3000ms；
- 每点 1000ms；
- `CASE3_STUB_DATA_MODE=random`；
- Throughput 以 fixture 曲线为模板做 ±10% 有 seed 抖动；
- 两侧 Cost 文件由共享目录预置并保持静态；本地打桩不读写它们；
- Start 完成时同拍写 `case complete + save_picture_flag=1`；
- 只在缺失时 seed base route 和 Beam Accuracy baseline。

数据模式：

```dotenv
# 默认：仅动态生成 Throughput
CASE3_STUB_DATA_MODE=random

# 固定 seed，复现同一套动态 KPI
CASE3_STUB_SEED=demo-1

# 完整回放逐点 fixture 数据（Cost 不属于 stub fixture）
# CASE3_STUB_DATA_MODE=replay
```

关闭截图 / 调试日志也写在 `code/back/.env`：

```dotenv
CASE3_STUB_REQUEST_PICTURE=0
CASE3_STUB_LOG_LEVEL=debug
```

## 数据边界

- 两侧结构 fixture 是 21 点预置模板。坐标、扫描/selected Beam、
  Reflection 始终逐行回放，不参与动态生成。
- 结构 fixture 可用波束 ID `-1` 覆盖异常波束场景：Without 扫描行含 `-1`
  或任一侧 selected Beam 为 `-1` 时，Node/Web 将该点作为完整但波束异常的点处理。
- 每侧 Throughput fixture 独立预检和发布，样点数不要求等于结构点数；
  Without/With 两侧吞吐样点数也可不同。吞吐只按 fixture 做可复现随机抖动，
  不保证 With 每个样点高于 Without。
- 默认 `random` 只生成 Throughput；Beam Accuracy 仍由预置
  selected Beam 派生，因此保持可复现。
- `ue_comm_without_dt_cost.txt` 与 `ue_comm_with_dt_cost.txt` 必须预置在共享目录；
  Start、ReInit、恢复重放均不创建、不清空、不更新，Node/Web 只读其侧级值。
- `random` 与 `replay` 的逐点 fixture 数据均不包含 Cost。
- 日志分别标记 `synthetic-kpi+fixture-structure` / `fixture-replay`，
  不得表述为真实采集。
- 真实后端联调必须设置 `CASE3_STUB_SEED_INIT=0` 并停止本进程。

完整状态机、恢复与撤权规则见
`doc/case3/realback_no.md`。
