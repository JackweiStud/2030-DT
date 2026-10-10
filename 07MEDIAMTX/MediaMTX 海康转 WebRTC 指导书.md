---
title: MediaMTX 海康转 WebRTC 指导书
type: 实施指导
status: HTML 验证已通过（2026-10-10）；接入 React 另开任务
created: 2026-10-09
updated: 2026-10-10
tags:
  - MediaMTX
  - 海康
  - WebRTC
  - RTSP
  - 监控
  - 指导书
audience:
  - Agent
---

# MediaMTX 海康转 WebRTC 指导书

目标：把海康摄像头/NVR 的 RTSP 流转成浏览器可播的 WebRTC，先用独立 HTML 验证，再接入现有前端工程。

**2026-10-10 现场结论：** VLC、MediaMTX 自带页、`07MEDIAMTX/test.html` 双路均已通过。本轮锁定 **主码流** `Channels/401` 与 `Channels/1601`（不是子码流 `402` / `1602`）。下一步才能另开任务接入 React。

## 0. 一句话目标

```
海康摄像头/NVR（RTSP）
  → 同一局域网内的 PC 上 MediaMTX（拉流 + 转发）
  → WebRTC（WHEP）
  → 独立 HTML 验证（双路播放 + 截图）
  → 成功后再接入用户的 React 前端工程
```

当前阶段只做：**同一局域网、同一台 PC、同时 2 路、不要声音、支持截图、先独立 HTML 验证；验证通过后计划接入 React 前端**。本文档**不包含** React/其它正式前端接入代码，只写到 HTML 验收为止。

### 0.1 流程时序图（主图）

下面一张图说明整条链路里谁先谁后、谁连谁。Agent 按编号顺序理解即可。

```mermaid
sequenceDiagram
  autonumber
  actor User as 用户
  participant Cam as 海康 IPC/NVR
  participant VLC as VLC
  participant MTX as MediaMTX
  participant Br as 浏览器
  participant Page as HTML 验证页

  User->>Cam: 开启 RTSP，编码改为 H.264，关音频
  User->>VLC: 打开主码流 RTSP 地址（本现场锁定 401 / 1601）
  VLC-->>User: 两路都能出画则继续；否则停止

  User->>MTX: 启动 mediamtx（读 mediamtx.yml）
  Note over MTX: 监听 RTSP :8554<br/>WebRTC/WHEP :8889<br/>paths: cam01 / cam02

  User->>Br: 打开 http://127.0.0.1:8889/cam01
  Br->>MTX: WHEP 请求 cam01
  alt 尚无观看者且 sourceOnDemand
    MTX->>Cam: 主动连接 RTSP（本现场：主码流）
    Cam-->>MTX: 推送 H.264（忽略音频）
  end
  MTX-->>Br: WebRTC 视频轨
  Br-->>User: MediaMTX 自带页出画

  User->>Page: 用本地 HTTP 打开 test.html（禁止 file://）
  Page->>MTX: 分别为 cam01 / cam02 发 WHEP
  MTX-->>Page: 两路 WebRTC 视频轨
  Page-->>User: 双路出画
  User->>Page: 点「截图」
  Page->>Page: 从 video 当前帧画到 canvas
  Page-->>User: 下载 JPG

  User->>Page: 关闭页面 / 停止播放
  Page->>MTX: 关闭 PeerConnection
  Note over MTX,Cam: 无观看者时断开摄像头 RTSP
```

对应关系：

| 时序 | 指导书 |
|---|---|
| 开启 RTSP + VLC | 步骤 1～2 |
| 启动 MediaMTX | 步骤 3～4 |
| 自带页出画 | 步骤 5 |
| HTML 双路 + 截图 | 步骤 6（本阶段门禁，**2026-10-10 已过**） |
| 关页断流后 | 另开任务再接 React |

关系一句话：**摄像头只对 MediaMTX 说话；浏览器/HTML 只对 MediaMTX 的 WHEP 说话；截图只发生在浏览器本地。**

## 1. 指导要干什么（范围）

### 要做

1. 确认摄像头/NVR 能出 **VLC 可播的 H.264 RTSP**（本现场锁定主码流；其它现场仍以 VLC 实测为准）。
2. 在同一台 PC（macOS 或 Windows）安装并启动 MediaMTX。
3. 配置两条路径：`cam01`、`cam02`，按需拉流。
4. 浏览器打开 MediaMTX 自带页面，确认两路都能播。
5. 用独立 HTML（官方 `reader.js` + WHEP）双路播放，并验证截图。
6. **只有以上全部成功后**，再由后续任务接入用户的 **React** 前端工程（本文档不写接入代码）。

### 不做（本阶段明确排除）

- 公网访问、STUN/TURN、外网 HTTPS
- 多于 2 路并发
- 音频
- 服务端定时抓图存盘（浏览器截图足够）
- FFmpeg 转码（仅当摄像头无法改为 H.264 时再考虑）
- 把摄像头账号密码写进 React 或任何前端页面
- 本文档内的任何前端框架接入示例与组件代码（接入 React 另开任务）

---

## 2. 前置条件

### 2.1 硬件与网络

| 项 | 要求 |
|---|---|
| 摄像头 | 海康 IPC，或挂在海康 NVR 上的通道 |
| 网络 | 摄像头与 PC **同一局域网**，PC 能 ping 通摄像头 IP |
| 并发 | 同时最多观看 **2 路** |
| 声音 | **不要** |
| 截图 | **需要**（浏览器从当前画面抓一帧即可） |
| 运行位置 | MediaMTX、验证用 HTML、后续前端/后端都在 **同一台 PC** |

### 2.2 名词（Agent 必读）

- **IPC**：网络摄像机本身，一台设备一个 IP，直接提供 RTSP。
- **NVR**：硬盘录像机。多台摄像头接到 NVR；对外通常只有 NVR 的 IP，RTSP 用「通道号」区分。
- **RTSP**：摄像头/NVR 提供的拉流协议；浏览器不能直接播，需要 MediaMTX 转发。
- **MediaMTX**：本地流媒体网关。主动拉海康 RTSP，对外提供 WebRTC（以及可选 HLS）。本现场使用 **v1.21.2**。
- **WebRTC**：浏览器实时音视频协议；本方案用 **WHEP**（播放端向服务器要流）。
- **WHEP 地址**：`http://127.0.0.1:8889/<路径名>/whep`，前端用它做信令。
- **子码流**：较低分辨率/码率；海康常见为通道号末位 `2`（如 `402`、`1602`）。早期笔记曾记录这两路，**不是**本轮 HTML 通过基线。
- **主码流**：较高清晰度；常见末位 `1`。本现场锁定 `401`（D4）、`1601`（D16）。

### 2.3 软件

- PC：macOS 或 Windows（均可；本现场 MediaMTX 为 Windows amd64）
- 浏览器：Chrome / Edge（推荐）
- VLC：用于验证 RTSP 是否可播
- MediaMTX：官方二进制即可（不必先上 Docker）；与 `reader.js` 版本对齐，本现场为 **v1.21.2**
- 验证页：`07MEDIAMTX/test.html` **必须**配合官方 `reader.js`（MediaMTX 1.21 的 WHEP 含 trickle ICE `PATCH`，不能用「只 POST 一次 SDP」的简化写法顶替）

### 2.4 摄像头侧必须满足

1. 开启 RTSP。
2. 视频编码改为 **H.264**（尽量 baseline，关闭 B 帧）。H.265 在多数浏览器 WebRTC 下会黑屏/无流。
3. 关闭音频。
4. 能提供一条 **VLC 可打开** 的 RTSP。本现场通过的是主码流 `401` / `1601`。

### 2.5 海康 RTSP 地址（两套都可能遇到）

**常见写法 A（Streaming/Channels）：**

```text
rtsp://用户名:密码@摄像头或NVR的IP:554/Streaming/Channels/101
```

- `101`：通道 1 主码流；`102`：通道 1 子码流
- 通道 4：`401` / `402`
- 通道 16：`1601` / `1602`

**本现场已锁定（2026-10-10，VLC + MediaMTX + HTML 均通过）：**

```text
rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/401
rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/1601
```

对应：`cam01` = D4 对接集装箱顶前视；`cam02` = D16 场地俯瞰。密码含 `@`，URL 必须写成 `%40`。不要把明文密码写进前端。

**常见写法 B（部分固件）：**

```text
rtsp://用户名:密码@IP:554/h264/ch1/sub/av_stream
```

**判定规则（写进 Agent 检查清单）：以 VLC 能打开、且本轮 HTML 已通过的地址为准，不要死记一种格式。**

若是 **NVR**：两条流通常是同一 IP + 不同通道号，而不是两台不同摄像头 IP。

### 2.6 端口（本阶段局域网）

| 端口 | 用途 |
|---|---:|
| 8554 | MediaMTX 自身 RTSP（一般不用浏览器访问） |
| 8889 | WebRTC / WHEP（浏览器访问这个） |
| 5500 | 仅用于本地静态打开 `test.html`（`python -m http.server 5500`） |

本阶段：**不要配置 STUN/TURN**。MediaMTX 自带页用 `http://127.0.0.1:8889/...`。独立 HTML **必须**经本地 HTTP 打开，禁止 `file://`。

---

## 3. 怎么做（按顺序执行）

### 步骤 1：网络与账号确认

1. PC ping 通摄像头/NVR IP。
2. 记下：IP、用户名、密码、是 IPC 还是 NVR、通道号。
3. 打开摄像头/NVR 网页：开启 RTSP、编码改 H.264、关音频。

**完成标准：** ping 通；网页设置已保存。

### 步骤 2：VLC 验证 RTSP（必须先过）

#### VLC 是什么
VLC（VideoLAN Client）是免费播放器。浏览器不能直接打开海康 RTSP，所以先用 VLC 确认「这条流本身能不能播」。本步骤**只验证 RTSP**，不涉及 MediaMTX / WebRTC。

#### 需要准备
- 已安装 [VLC](https://www.videolan.org/)（macOS / Windows 均可）
- 摄像头或 NVR 的 IP、用户名、密码
- 一条完整 RTSP（本现场用主码流 `401` / `1601`）
- PC 与摄像头同一局域网（能 ping 通）

#### 怎么操作
1. 打开 VLC。
2. 菜单：**媒体 → 打开网络串流**（Open Network Stream）。
3. 粘贴本现场已锁定的 RTSP（必须带账号；`@` 写成 `%40`）。
4. 点播放。
5. 第二路再用同样方法测一遍。

#### 完成标准
- 两路 RTSP 在 VLC 均可**稳定出画面**。本现场已通过。
- 本阶段不要声音：无声或静音均可，不作为失败条件。

#### 失败则停止
不要进入 MediaMTX。先回到摄像头网页：确认 RTSP 已开、编码改为 **H.264**、地址与密码正确，或换另一种 RTSP 写法后再用 VLC 重测。

### 步骤 3：安装并启动 MediaMTX

1. 从官方发布页下载对应系统的 MediaMTX：  
   **https://github.com/bluenviron/mediamtx/releases/latest**  
   - 本现场已用：`mediamtx_v1.21.2_windows_amd64.zip`（目录内有一份）  
   - macOS：选带 `darwin` / `macos` 的压缩包（Apple Silicon 选 `arm64`，Intel 选 `amd64`）  
   - Windows：选带 `windows` 的压缩包（通常 `amd64`）  
   - 解压后应能看到 `mediamtx`（macOS）或 `mediamtx.exe`（Windows），以及默认的 `mediamtx.yml`
2. 放到固定目录，例如：
   - macOS：`~/mediamtx/`
   - Windows：`C:\mediamtx\`
3. 编辑该目录下的 `mediamtx.yml`（见下方步骤 4 模板；也可先用默认文件确认能启动）。
4. 启动二进制；确认日志无报错。  
   - macOS：在终端进入目录后执行 `./mediamtx`  
   - Windows：双击 `mediamtx.exe`，或在终端进入目录后执行 `mediamtx.exe`

**完成标准：** 进程在跑；日志里能看到 WebRTC 监听 `8889`。

### 步骤 4：写入 MediaMTX 配置（双路、无音频、按需拉流）

本现场已通过的配置（路径名仍用验证阶段的 `cam01` / `cam02`）：

```yaml
rtspAddress: :8554
webrtcAddress: :8889
webrtc: true
# 独立 HTML 与 MediaMTX 不同源，必须放行；以后 React 再收紧
webrtcAllowOrigins: ["*"]

paths:
  cam01:
    source: rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/401
    rtspTransport: tcp
    sourceOnDemand: true

  cam02:
    source: rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/1601
    rtspTransport: tcp
    sourceOnDemand: true
```

说明：

- `rtspTransport: tcp`：海康局域网更稳（部分文档写作 `sourceProtocol: tcp`，以当前 MediaMTX 版本字段名为准）。
- `sourceOnDemand: true`：页面关闭后断开摄像头拉流，节省连接数。
- 换现场时：以 VLC 实测地址整段替换 `source`，不要只改 IP。
- 早期笔记中的子码流 `402` / `1602` 仅作备选，**不要**在未复测的情况下改回它们。

重启 MediaMTX，使配置生效。

**完成标准：** 配置文件已保存且服务已重启。

### 步骤 5：MediaMTX 自带页面验证（先于任何自定义 HTML）

浏览器分别打开：

```text
http://127.0.0.1:8889/cam01
http://127.0.0.1:8889/cam02
```

**完成标准：** 两页都能自动出画面。本现场已通过。  
**失败排查：**

- VLC 能播但这里不能 → 查编码是否仍为 H.265、路径名是否写错、MediaMTX 日志报错。
- 黑屏 → 几乎总是编码问题，回到步骤 1～2。

### 步骤 6：独立 HTML 双路播放 + 截图

**本现场已通过的文件（不要另写一份简化页顶替）：**

- `07MEDIAMTX/test.html`
- `07MEDIAMTX/reader.js`（官方 v1.21.2，与现场 MediaMTX 对齐）

`reader.js` **必带**。缺它时控制台是 `MediaMTXWebRTCReader is not defined` / 「MediaMTXWebRTCReader 找不到」。MediaMTX 自带页能播，是因为它自己提供了这份脚本；自定义 HTML 不会自动带上。

MediaMTX 1.21 的 WHEP 还要 trickle ICE 的 `PATCH`，不能只用「`createOffer` + 一次 POST SDP」的简化示例。

#### 打开方式（必须用 HTTP，禁止 file://）

两个文件放**同一文件夹**。MediaMTX 保持运行。在该文件夹执行：

```text
python -m http.server 5500
```

（有的机器是 `python3 -m http.server 5500`；没有 Python 可用 `npx --yes serve -l 5500`。）

然后用 Chrome / Edge 打开：

```text
http://127.0.0.1:5500/test.html
```

**不要**资源管理器双击，也不要用 `file:///.../test.html`。`file://` 下 WHEP 请求 `127.0.0.1:8889` 常被浏览器拦住。

`test.html` 会先向 `http://127.0.0.1:8889/reader.js` 取与正在跑的 MediaMTX 同一份脚本，失败再读同目录 `reader.js`。

#### 完成标准（本阶段门禁）

1. `http://127.0.0.1:8889/cam01` 与 `/cam02` 都能播。
2. `http://127.0.0.1:5500/test.html` 两路都能播（状态为「已出画」）。
3. 截图按钮能下载 JPG，且画面内容正确。
4. 关闭页面后，MediaMTX 日志显示对应 path 断开（`sourceOnDemand` 生效）。

**2026-10-10：** 第 1、2 条已由现场确认通过。第 3、4 条未单独复述；复测时按上表勾。

**全部成功前：禁止接入用户前端工程。** 第 1、2 条已过后，接入 React 仍须另开任务，不要在本指导书里写框架代码。

### 步骤 7：后续接入 React（仅步骤 6 成功后，另开任务）

本文档到此结束。步骤 6 主路径已通过后，**另开任务**再接入用户的 React 前端。

接入时只需记住验证阶段已经锁定的契约，不要回头改 MediaMTX 路径名：

- WHEP：`http://127.0.0.1:8889/cam01/whep`、`http://127.0.0.1:8889/cam02/whep`
- 播放库：与 MediaMTX 版本对齐的官方 `reader.js`（`MediaMTXWebRTCReader`）
- 只要视频：`offerToReceiveVideo: true`，`offerToReceiveAudio: false`
- 截图：从 `<video>` 当前帧绘制到 canvas 再下载/上传
- 停止：关闭 `RTCPeerConnection`，清空 `srcObject`
- 建议在 React 里补：`onconnectionstatechange` 断线重连、加载/错误状态
- 以后远程访问再考虑：同源反向代理、收紧 `webrtcAllowOrigins`、HTTPS + TURN

**禁止：** 把摄像头账号密码写进 React 代码或仓库。也不要用未经验证的「纯 WHEP 简化示例」替换 `reader.js`。

---

## 4. 验收清单（Agent 勾选）

- [x] PC 与摄像头/NVR 同一局域网，ping 通
- [x] 摄像头 RTSP 已开，编码为 H.264（本轮按现场可播结论）
- [x] VLC 两路均可播放（主码流 `401` / `1601`，2026-10-10）
- [x] MediaMTX 已启动，监听 8889（v1.21.2）
- [x] `http://127.0.0.1:8889/cam01` 可播
- [x] `http://127.0.0.1:8889/cam02` 可播
- [x] 独立 HTML 两路可播（`07MEDIAMTX/test.html` + `reader.js`，经本地 HTTP 打开）
- [ ] HTML 截图可下载且内容正确（用户未单独复述）
- [ ] 关闭页面后按需拉流断开（用户未单独复述）
- [x] 已记录最终可用的两条完整 RTSP 地址（见 §2.5 / §9）
- [ ] **仅当以上完成**：再另开任务接入 React 前端（本文档不覆盖）

---

## 5. 常见失败与处理

| 现象 | 最可能原因 | 处理 |
|---|---|---|
| VLC 都不能播 | 地址错、账号错、不在同一网段 | 回摄像头网页核对 RTSP；ping；`@` 必须写成 `%40` |
| VLC 能播，MediaMTX/浏览器不能 | 多为 H.265 | 改 H.264；或换本轮已通过的主码流 `401` / `1601` |
| MediaMTX 日志有源但页面黑屏 | 编码/浏览器兼容 | 确认 H.264；换 Chrome/Edge |
| 只播一路 | 第二路通道号/地址错 | 分别用 VLC 测两条 RTSP |
| `MediaMTXWebRTCReader` 找不到 | 缺 `reader.js`，或只用了 `file://` 打开 HTML | 两个文件放一起；用 `http://127.0.0.1:5500/test.html` |
| HTML `Failed to fetch` / WHEP 被拦 | `file://`、MediaMTX 没在 8889、或未设 CORS | 确认自带页能开；`webrtcAllowOrigins: ["*"]`；重启 MediaMTX |
| 页面能开、远程黑屏 | 本阶段不应出现；若以后远程 | 再做 HTTPS + TURN |
| 截图空白 | 视频尚未 onTrack / videoWidth=0 | 等出画再截；检查 muted/autoplay |

---

## 6. 安全注意

- 摄像头密码只出现在 MediaMTX 配置与本机环境里，不要写进前端页面或提交到正式前端仓库。
- 本阶段仅绑定 `127.0.0.1` 验证。
- 以后若对局域网其他设备开放，再限制 `webrtcAllowOrigins`、加鉴权或反向代理，不要长期 `*`。

---

## 7. 参考

- MediaMTX 官方：<https://github.com/bluenviron/mediamtx>
- 拉取摄像头 RTSP：<https://mediamtx.org/docs/publish/rtsp-cameras-and-servers>
- 浏览器播放 / 嵌入：<https://mediamtx.org/docs/read/web-browsers>
- 官方 `reader.js`（须与二进制版本对齐）：<https://github.com/bluenviron/mediamtx/blob/v1.21.2/internal/servers/webrtc/reader.js>
- 海康 RTSP 通道说明（厂商文档）：`Streaming/Channels/10x` 为主/子码流惯例

---

## 8. 当前决策记录

- **决策日期：** 2026-10-09 立项；**2026-10-10 HTML 门禁通过**
- **环境：** 摄像头与 PC 同局域网；MediaMTX 与验证页同 PC；同时 2 路；无音频；需要截图
- **MediaMTX：** v1.21.2；路径名 `cam01` / `cam02`；`webrtcAllowOrigins: ["*"]`
- **锁定 RTSP：** 主码流 `401`（D4）、`1601`（D16）。子码流 `402` / `1602` 仅为早期候选，不是本轮通过基线
- **锁定验证页：** `07MEDIAMTX/test.html` + 官方 `reader.js`；必须经 `http://127.0.0.1:5500/test.html` 打开
- **路径：** MediaMTX 自带页 → 独立 HTML **已通过** → **另开任务**再接入用户的 **React** 前端（接入代码不在本文档）
- **不做：** 本阶段公网 / STUN/TURN / 音频 / 超过 2 路 / 本文档内的 React 接入实现

---

## 9. 附录：现场 RTSP 与通道对照

国科大外场通道与参数获取过程见：

- [[国科大外场--目标摄像头的Rtsp获取和参数配置]]

**2026-10-10 已通过基线（VLC + MediaMTX 自带页 + `test.html`）：**

| 验证路径 | 建议现场名 | 目标画面 | RTSP（主码流） |
| --- | --- | --- | --- |
| `cam01` | `cam_d4` | D4 对接集装箱顶前视 | `rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/401` |
| `cam02` | `cam_d16` | D16 场地俯瞰 | `rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/1601` |

> RTSP 必须带账号；密码含 `@` 时 URL 写为 `%40`。

早期笔记中的子码流 `402` / `1602` 仅作备选，复测通过前不要替换上表。

验证阶段路径名保持 `cam01` / `cam02`（与已通过的 `test.html` 一致）。接入正式前端时如需改名，另开任务并同时改 MediaMTX `paths` 与 WHEP URL，不要只改一边。
