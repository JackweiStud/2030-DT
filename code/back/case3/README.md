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
- Cost 以 fixture 25/15 为模板，每个点生成并 append 一个 ±15% 动态值；
- Start 完成时同拍写 `case complete + save_picture_flag=1`；
- 只在缺失时 seed base route 和 Beam Accuracy baseline。

数据模式：

```dotenv
# 默认：仅动态生成 Throughput / Cost
CASE3_STUB_DATA_MODE=random

# 固定 seed，复现同一套动态 KPI
CASE3_STUB_SEED=demo-1

# 完整回放 fixtures（Cost 固定 25/15）
# CASE3_STUB_DATA_MODE=replay
```

关闭截图 / 调试日志也写在 `code/back/.env`：

```dotenv
CASE3_STUB_REQUEST_PICTURE=0
CASE3_STUB_LOG_LEVEL=debug
```

## 数据边界

- 两侧 fixture 是 31 点预置模板。坐标、扫描/selected Beam、
  Reflection 始终逐行回放，不参与动态生成。
- 默认 `random` 只生成 Throughput 与 Cost；Beam Accuracy 仍由预置
  selected Beam 派生，因此保持可复现。
- random 每发布一个点就 append 一个 Cost；Node/Web 始终读取最新非空行，
  因此仪表可按点实时变化。
- With Throughput 在自身 ±10% 范围内还会高于对应 Without 的理论上限；
  Cost 25/15 各自 ±15% 后仍保证 With 更低。
- `replay` 原样发布 fixture，Cost 固定 25/15，对应 `-40.0%` 相对变化（有 DT 低于无 DT）。
- 日志分别标记 `synthetic-kpi+fixture-structure` / `fixture-replay`，
  不得表述为真实采集。
- 真实后端联调必须设置 `CASE3_STUB_SEED_INIT=0` 并停止本进程。

完整状态机、恢复与撤权规则见
`doc/case3/realback_no.md`。
