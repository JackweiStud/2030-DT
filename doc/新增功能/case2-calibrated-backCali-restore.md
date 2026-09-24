# case2 Calibrated：`backCali` 基线恢复（取消启动写空）

> 状态：**已按本规格实现并完成针对性自动验证**；本文件记录需求与裁决。
>
> 范围：仅 **case2** 共享目录下六个 Calibrated 工作区文件的磁盘行为；不改 Initial 六文件、不改截图、不改后端发布语义。
>
> 路径约定：共享根为 `DT_SHARED_DIR`（本地演示常为 `code/comdatafiles` 绝对路径）。
>
> 正式 Gate 文档：已同步到 `doc/case2/SERVER-SPEC.md` / `WEB-SPEC.md` / `API-CONTRACT.md` / `BACKEND-API-HANDOFF.md` 与 `code/server/README.md`。本文保留本次变更的完整诉求、裁决和验收边界。

---

## 1. 诉求（已确认）

### 1.1 旧行为（废弃）

点「启动」或「重置」时，Node 适配服务在写控制文件之前，将 `case2/` 下六个 Calibrated 文件**写为空文件**。失败码原为 `CALIBRATED_CLEAR_FAILED`。

### 1.2 新目标


| #   | 诉求                           | 结论                                                                                    |
| --- | ---------------------------- | ------------------------------------------------------------------------------------- |
| 1   | 点「启动」时                       | **不再**清空、**不再**覆盖六个 Calibrated 磁盘文件                                                   |
| 2A  | 点「重置」(reinit) 时              | 用 `backCali` 六个同名文件**整批覆盖**工作区六个 Calibrated                                           |
| 2B  | 初次进入 case2，或从其他 Tab 切回 case2 | 同样做一次 `backCali` → 工作区覆盖                                                              |
| 3   | 覆盖失败                         | 整批最多重试 **3** 次；仍失败则**拦命令**（不写控制）+ Web `console.error`；进页沿用 `adapterError`；**不加**新页面文案 |
| 4   | UI                           | 磁盘恢复**不**导致展示 Calibrated（进页/切回仍只显示 Initial；重置等待态仍暂留内存旧对比直至终态清空）                       |
| 5   | 后端/打桩                        | **不**要求「一点启动六个 cali 必须先空」；本轮在 `case complete` 前完整覆盖发布即可                               |

校准完成、重置完成后的 `init` 空闲收尾**只重置控制状态，保留 Calibrated 工作区文件**；仅进页/切回的 `init` 与用户点击重置的 `reinit` 恢复基线。




### 1.3 覆盖路径

```text
{DT_SHARED_DIR}/case2/backCali/<同名6文件>
        ↓ 整批覆盖
{DT_SHARED_DIR}/case2/<同名6文件>
```

仓库内基线目录示例：`code/comdatafiles/case2/backCali/`。

六个文件名（与现网常量一致）：

- `heatmap_cali_rss.txt` / `heatmap_cali_kpi_rss.txt`
- `heatmap_cali_effective_path_num.txt` / `heatmap_cali_kpi_effective_path_num.txt`
- `heatmap_cali_first_path_delay.txt` / `heatmap_cali_kpi_first_path_delay.txt`
- `backCali/` 为**只读基线源**；适配服务不得改写其中文件。
- **不清** Initial 六文件；**不删** `out/case2/` 截图。

---



## 2. 规格（Node 适配服务）



### 2.1 挂靠 API / 时序

均在**写控制文件之前**执行覆盖；失败则中止，控制文件保持原值。


| HTTP                                      | 是否恢复磁盘 Calibrated | 说明                                       |
| ----------------------------------------- | ----------------- | ---------------------------------------- |
| `POST /api/case2/control-file` · `{command:"init"}` | **是** | 进页 / 刷新 / 切回、进页探活恢复后的空闲写回 |
| `POST /api/case2/control-file` · `{command:"init",restore_calibrated:false}` | **否** | 启动/重置轮结束后的空闲收尾；只写回控制字段，保留工作区文件 |
| `POST /api/case2/control-file` · `reinit` | **是**             | 点「重置」                                    |
| `POST /api/case2/control-file` · `start`  | **否**             | 只合并命令并强制 `status=""`；不动六个 Calibrated 文件  |
| 截图清零等其它 POST                              | **否**             | 与本功能无关                                   |


`start` / `reinit` 强制写 `status=""`（开一轮清盘）的既有规则**不变**。

### 2.2 整批重试（不保证六文件整体原子切换）

1. 一次尝试按顺序逐个覆盖六个文件；只有六个都写成功才算本轮成功。
2. 任一源缺失、读失败或写失败 → 该次尝试失败。
3. 任一文件失败后，从第一个文件开始重试整批；最多 **3** 次（首次 + 2 次重试）。
4. 3 次仍失败 → HTTP `500`，`error.code = CALIBRATED_RESTORE_FAILED`（取代旧 `CALIBRATED_CLEAR_FAILED`），**不写**本次控制命令。
5. 六个文件整体不保证原子切换；失败后可能暂留新旧混合内容，**不回滚**已覆盖成功的文件。
6. 错误 `message` 须含失败文件名与原因摘要，供 Web `console.error` 使用。



### 2.3 最小写入算法（相对旧算法的变更点）

1. 读最新控制 JSON。
2. 若本次为合法进页 `init` / `reinit`：先做 `backCali` → 工作区逐文件覆盖并按 §2.2 整批重试；失败则中止。若为带 `restore_calibrated:false` 的收尾 `init` 或 `start`：**跳过**恢复。
3. 合并允许字段；`start`/`reinit` 强制 `status=""`；`init` 强制空闲字段集（既有规则）。
4. 临时文件 + `fsync` + 原子 `rename` 写控制（既有规则）。



### 2.4 空闲收尾保留本轮结果

默认 `POST {command:"init"}` 用于进页、切回和进页探活恢复，会恢复 `backCali` 基线。校准轮/重置轮结束后的控制收尾使用 `POST {command:"init",restore_calibrated:false}`，仅写空闲控制字段，不触碰六个 Calibrated 文件。

因此，启动完成后磁盘保留本轮刚发布的 Calibrated 结果；重置完成后的收尾也不会重复恢复基线。用户下次重新进入 case2 时仍会恢复基线。

### 2.5 启动期间磁盘非空

启动后至本轮 `case complete` 前，磁盘上可暂留上一轮结果或 `backCali` 内容。

- Web：**不会**在等待态读 Calibrated；只在本轮已见 `execute success` 后再见 `case complete` 才 `GET data-files?phase=calibrated`。
- Node 读批门禁仍要求控制四元组为 case2 start + complete，旧文件不会被当成「本轮结果」经 API 返回。
- 后端/打桩：不依赖启动瞬间文件为空；在 `case complete` 前完整覆盖发布六个文件即可。

---



## 3. 规格（Web）


| 场景           | 行为                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 进页 / 刷新 / 切回 | 串行：`GET control` → `POST {command:"init"}`（服务端恢复）→ `GET initial`。恢复失败 → `console.error` + `adapterError=true`，不拉 Initial；**不**展示 Calibrated |
| 点启动          | 清空**内存** `calibratedData`；`POST start`；**不**要求服务端动磁盘 Calibrated                                                                 |
| 点重置          | `POST reinit`（服务端先恢复）；失败（含 `CALIBRATED_RESTORE_FAILED`）→ 回退点击前相 + `adapterError` + `console.error`；`resetting` 仍暂留内存旧对比直至终态     |
| 启动/重置轮收尾 | `POST {command:"init",restore_calibrated:false}`；只重置控制状态，不改磁盘 Calibrated 文件 |
| 恢复成功         | **仅磁盘**；UI 规则不变（进页不读 Calibrated；重置终态再清 UI Calibrated）                                                                           |
| 页面文案         | **不新增**；失败只靠控制台 + 既有 `adapterError` 行为                                                                                          |


---



## 4. 后端交接要点（摘要）

- 接受：`start` 时适配服务**不再**先清空六个 Calibrated。
- 知晓：`init`/`reinit` 写控制前适配服务会从 `case2/backCali/` 覆盖工作区六个文件；重置路径后端仍只推进控制状态，不要求后端删/写空 Calibrated。
- 不变：先完整写完并关闭六个 Calibrated，最后写 `status=case complete`；业务终态字面值只由后端写出。

---



## 5. 实现记录



### 5.1 Node（`code/server`）

- [x] 将 `clearCalibrated`（写空）改为 `restoreCalibratedFromBackCali`（逐文件覆盖、失败后整批最多 3 次）。
- [x] `init` / `reinit` 的 `beforeWrite` 走恢复；`start` **不再**挂清文件/恢复。
- [x] 错误码改为 `CALIBRATED_RESTORE_FAILED`；单测覆盖：成功覆盖、源缺失、写失败重试、失败不写控制、`start` 不改 cali 文件。
- [x] 更新 `code/server/README.md` 观察口径。



### 5.2 Web（`code/web`）

- [x] 进页 / 重置 POST 失败路径：对 `CALIBRATED_RESTORE_FAILED`（及同类控制写失败）`console.error`；进页继续 `adapterError`。
- [x] 确认启动仍只清内存 Calibrated；不新增页面文案。
- [x] 补充失败路径单测；本次未进行浏览器人工联调。



### 5.3 文档回写

- [x] 核对并同步 `doc/case2/SERVER-SPEC.md` / `WEB-SPEC.md` / `API-CONTRACT.md` / `BACKEND-API-HANDOFF.md` 与本文。
- [x] 在 `doc/case2/QA-EVIDENCE.md` 追加本次自动验证范围和结果；不宣称完成人工联调。

---



## 6. 验收观察（实现后）

1. 工作区六个 cali 有非基线内容 → 进页或切回 case2 → 内容应与 `backCali` 一致；UI 仍无 Calibrated 列数据。
2. 完成一轮校准后点重置 → 写 `reinit` 前工作区应被盖回 `backCali`；UI 经 `reinit complete` 后清空对比。
3. 点启动 → 六个 cali **不应**被写空；校准完成前 Web 不展示旧盘数据为「本轮结果」。
4. 人为弄坏/缺失 `backCali` 某文件 → `POST init`/`reinit` 应 `500 CALIBRATED_RESTORE_FAILED`，控制命令未推进；浏览器控制台可见错误。
5. 启动完成并完成截图收尾后，六个工作区文件仍保留本轮结果；重置完成后的空闲收尾不再覆盖文件。

---



## 7. 对齐记录


| 日期         | 事项                                                                     |
| ---------- | ---------------------------------------------------------------------- |
| 2026-09-24 | 诉求对齐：启动不清；init/reinit 写控制前从 `backCali` 整批覆盖；失败方案甲；UI 不因恢复展示 Calibrated |
| 2026-09-24 | 确认后端不要求启动瞬间 cali 为空                                                    |
| 2026-09-24 | 变更裁决：进页/切回与 reinit 恢复；完成后的 `init` 收尾保留本轮 Calibrated 文件                 |
| 2026-09-24 | 确认按逐文件覆盖、失败整批重试、不回滚已写文件执行；不增加六文件整体切换机制                                 |
| 2026-09-24 | 完成 Node / Web 实现、文档同步及针对性自动验证                                          |
