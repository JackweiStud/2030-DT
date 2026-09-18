# Case4 反射 fixture

`ue_position_with_dt_coordinates_reflection_point.txt` 是本地打桩演示样本：

- 记录条数与当前包内三轨迹 fixture（21 点）对齐，便于完整演示运行中路径与完成静态路径。
- 内容复制自 `01-参考资料/case4/data/ue_position_with_dt_coordinates_reflection_point.txt` 的真实格式（空白分隔 `losFlag n x y z ...`），**不是**真实标定或真实采集结果。
- 参考目录文件不自动补齐、不循环复制；本文件是明确标注的模拟夹具。`wc -l` 可能因无结尾换行显示 20，解析按完整记录计。
- 打桩缺失该文件时仍可启动主线，运行中反射前缀为 0；故障测试可注入短文件、半行或整行 65535。
