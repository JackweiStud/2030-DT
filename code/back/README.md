# code/back

本地模拟后端打桩（无真实后端时联调用）。只扮演共享目录另一端：读 `case_control.json`、写业务 `status`、发布 Case2/Case3/Case4 结果文件；不提供 REST，不给浏览器直接调用，也不得并入 `code/server` 的默认启动路径。

子目录：`case2/`（DT Calibration）、`case3/`（DT for Comm）、`case4/`（DT for positioning）。三者互斥，同一共享根上一次只跑一个 stub。

## 常用命令

```bash
cd code/back
npm install
npm run start:case2   # Case2 打桩
npm run start:case3   # Case3 打桩
npm run start:case4   # Case4 打桩
npm test              # case2 + case3 + case4 单元测试
```

默认只读取 `code/back/.env` 作为外部配置源；缺省值由代码提供。默认
共享根为仓库内 `../comdatafiles`；覆盖时修改 `code/back/.env`：

```dotenv
DT_SHARED_DIR=/absolute/path/to/shared
CASE2_STUB_DATA_MODE=random
CASE3_STUB_DATA_MODE=random
CASE4_STUB_DATA_MODE=random
```

`CASE2_STUB_DATA_MODE`、`CASE3_STUB_DATA_MODE` 与 `CASE4_STUB_DATA_MODE`
统一只支持 `random` / `replay`。修改 `.env` 后重启对应 stub。

截图 / 日志也写入同一个 `.env`：

```dotenv
CASE2_STUB_REQUEST_PICTURE=0
CASE2_STUB_LOG_LEVEL=debug
CASE3_STUB_REQUEST_PICTURE=0
CASE3_STUB_LOG_LEVEL=debug
CASE4_STUB_REQUEST_PICTURE=0
CASE4_STUB_LOG_LEVEL=debug
```



## 与 Web / 适配服务

- 推荐一键：`./code/scripts/dev-web-server.sh`（或 Windows `dev-web-server.bat`）起 Web + Node 适配；打桩**另开终端**跑本目录 `start:case2`、`start:case3` 或 `start:case4`。
- 适配服务见 `code/server`；Web 见 `code/web`。打桩产物写入共享目录，由适配服务经 REST 暴露给浏览器。
- 本地打桩数据仅供联调，不得表述为真实后端采集结果。



## 规格与细节

- Case2：[case2/README.md](case2/README.md) · [../../doc/case2/realback_no.md](../../doc/case2/realback_no.md)
- Case3：[case3/README.md](case3/README.md) · [../../doc/case3/realback_no.md](../../doc/case3/realback_no.md)
- Case4：[case4/README.md](case4/README.md) · [../../doc/case4/realback_no.md](../../doc/case4/realback_no.md)
