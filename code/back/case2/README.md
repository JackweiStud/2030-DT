# case2 模拟后端打桩

本目录是独立的 case2 模拟后端进程，只扮演共享目录另一端：读取 `case_control.json`，写业务 `status`，发布 Calibrated 六文件，并在截图联调时置 `save_picture_flag=1`。

它不提供 REST，不给浏览器直接调用，也不修改 `code/server/` 的默认启动路径。

默认打桩数据源为本目录下的 `back/`，即 `/Users/jackwl/Code/2030-DT/code/back/case2/back`。这里的数据只用于本地打桩联调，不代表真实后端采集结果。

## 运行

```bash
npm start
```

默认操作仓库本地共享根 `../../comdatafiles`，也就是 `/Users/jackwl/Code/2030-DT/code/comdatafiles`。部署或特殊联调时可以覆盖：

```bash
CASE2_SHARED_DIR=/absolute/path/to/comdatafiles npm run dev
```

截图联调：

```bash
npm run dev:picture
```

## 测试

```bash
npm test
```

测试使用系统临时目录，不写仓库 `code/comdatafiles`。
