# case2 模拟后端打桩

本目录是独立的 case2 模拟后端进程，只扮演共享目录另一端：读取 `case_control.json`，写业务 `status`，发布 Calibrated 六文件，并在启动成功路径默认置 `save_picture_flag=1`（与 `case complete` 同拍）。

它不提供 REST，不给浏览器直接调用，也不修改 `code/server/` 的默认启动路径。

默认打桩数据源为本目录下的 `back/`，即 `/Users/jackwl/Code/2030-DT/code/back/case2/back`。这里的数据只用于本地打桩联调，不代表真实后端采集结果。

## 运行

在 `code/back` 根目录：

```bash
npm run start:case2
```

默认：

- 共享根：`../../comdatafiles`（`/Users/jackwl/Code/2030-DT/code/comdatafiles`）
- **`CASE2_STUB_REQUEST_PICTURE=1`（演示默认开截图）**
- **`CASE2_STUB_DATA_MODE=random`（相对 Initial 可控改善随机生成 Calibrated）**
- start 终态同拍写 `status=case complete` + `save_picture_flag=1`
- reinit 路径仍不置 flag

数据模式：

```bash
# 默认：random（读共享目录 Initial，生成改善后的 Calibrated）
npm run start:case2

# 回退到参考样本 copy
CASE2_STUB_DATA_MODE=copy npm run start:case2

# 固定 seed，便于复现同一套 synthetic 结果
CASE2_STUB_DATA_MODE=random CASE2_STUB_SEED=demo-1 npm run start:case2
```

random 模式说明：

- 只随机/合成 **Calibrated** 六文件；Initial 不改
- 形状继承 Initial 的 `Nx/Ny/N`
- 默认 improve ratio ∈ [0.45, 0.65]，使误差整体下降（演示 CDF/降幅好看）
- 日志标注 `synthetic ... not real backend acquisition`

关闭截图 / 调试日志用环境变量：

```bash
CASE2_STUB_REQUEST_PICTURE=0 npm run start:case2
CASE2_STUB_LOG_LEVEL=debug npm run start:case2
```

覆盖共享根：

```bash
DT_SHARED_DIR=/absolute/path/to/comdatafiles npm run start:case2
```

`CASE2_SHARED_DIR` 仅作为旧脚本兼容 fallback；新配置使用 `DT_SHARED_DIR`。

## 验收（与适配服务联调）

1. 先起 `code/server` 适配服务，再 `npm run start:case2`。
2. Web 点启动：打桩 INFO 可见 `execute success` → 发布六文件 → `case complete` 且 `save_picture_flag=1`。
3. 适配服务 log 应出现 control `flag=1` 与 `POST /api/case2/screenshot`（若 Web 截图机正常）。
4. Web 点重置：只到 `reinit complete`，flag 保持 0。

## 测试

在 `code/back`：

```bash
npm test
```

或仅本包：`npm --prefix case2 test`。测试使用系统临时目录，不写仓库 `code/comdatafiles`。
