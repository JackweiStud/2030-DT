# case1 只读文件适配规格

契约见 API-CONTRACT.md；作为本轮正式前端离线文件接入的必要依赖，复用现有 Node 服务，只增加 case1 namespace，不改既有控制语义。不新增模拟后端。

固定名单映射九 TXT 和两 GLB，所有文件只读，GLB 流式响应；客户端断开销毁流。TXT 路径为环境配置 DT_SHARED_DIR 下的 case1；两 GLB 固定映射到 code/web/assets/case1/3D，不接受客户端路径，也无独立模型路径环境变量。RF `heatmap_rss.txt` 使用 `CASE1_RANGE_HEATMAP_RSS`（默认 `-500,500`）双边掐位。数据错误不影响其它 case。测试覆盖参考数值、非矩形/非法标量、缺文件、未知路径及方法拒绝。
