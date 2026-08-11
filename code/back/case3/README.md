# Case3 本地模拟后端

该进程只用于没有真实后端时的本地联调。它监听共享根中的
`case_control.json`，按 Case3 协议推进业务状态，并逐点发布
reference-derived fixtures。它不提供 REST，不能与真实后端同时运行。

## 启动

```bash
cd code/back
npm run dev:case3
```

`scripts/run.mjs` 在本地默认使用 `code/comdatafiles`。真实挂载或临时
联调目录应显式传入绝对路径：

```bash
DT_SHARED_DIR=/absolute/shared/root npm run dev:case3
```

默认参数：

- 控制轮询 200ms；
- `execute success` 保持 3000ms；
- 每点 1000ms；
- Start 完成时同拍写 `case complete + save_picture_flag=1`；
- 只在缺失时 seed base route 和 Beam Accuracy baseline。

不请求截图的旁路验证：

```bash
npm run dev:case3:no-picture
```

## 数据边界

- 两侧逐点 fixture 为参考样本的 31 点本地子集。
- Cost 是演示覆盖：Without=25、With=15，对应 40.0% 相对下降。
- 所有日志都将数据标记为
  `reference-derived+local-demo-override`，不得表述为真实采集。
- 真实后端联调必须设置 `CASE3_STUB_SEED_INIT=0` 并停止本进程。

完整状态机、恢复与撤权规则见
`doc/case3/realback_no.md`。
