# Case4 本地模拟后端

该进程只用于没有真实后端时的本地联调。它监听共享根中的
`case_control.json`，按 Case4 协议推进业务状态，并按节拍发布
三路定位轨迹、两路吞吐和最终统计。它不提供 REST，不能与真实后端
同时运行。

## 启动

在 `code/back` 根目录：

```bash
npm run start:case4
```

`scripts/run.mjs` 在本地默认使用 `code/comdatafiles`，且只读取
`code/back/.env` 作为外部配置源。真实挂载或临时联调目录应写入：

```dotenv
DT_SHARED_DIR=/absolute/shared/root
```

默认参数：

- 控制轮询 200ms；
- `execute success` 保持 3000ms；
- 每步 1000ms；
- `CASE4_STUB_DATA_MODE=random`；
- Start 完成时同拍写 `case complete + save_picture_flag=1`；
- 只在缺失时 seed `ue_position_coordinates_base.txt`。

数据模式与 case3 相同，写在 `code/back/.env`，改完后重启：

```dotenv
# 默认：相对包内 fixtures 小幅扰动
CASE4_STUB_DATA_MODE=random

# 固定 seed，复现同一套扰动
CASE4_STUB_SEED=demo-1

# 原样回放包内 fixtures
# CASE4_STUB_DATA_MODE=replay
```

关闭截图 / 调试日志：

```dotenv
CASE4_STUB_REQUEST_PICTURE=0
CASE4_STUB_LOG_LEVEL=debug
```

## 数据边界

- fixtures 来自 `01-参考资料/case4/data/` 的一次性复制，运行时只读
  `code/back/case4/fixtures/`，不回读参考目录。
- `replay` 发布有效记录原文（含科学计数、空白或逗号分隔、单独一行 `65535`），剥离首尾空行，不改分隔符。
- `random` 扰动 XY / 吞吐 / CDF 横轴与 CEP / NLOS；Z、65535、base
  与 CDF 概率列保持原值。日志标记 `synthetic-perturbation` /
  `fixture-replay`，不得表述为真实采集。
- 真实后端联调必须设置 `CASE4_STUB_SEED_INIT=0` 并停止本进程。

完整状态机、恢复与撤权规则见
`doc/case4/realback_no.md`。
