---
title: MediaMTX 海康转 WebRTC 指导书
type: 实施指导
status: 进行中（先 HTML 验证；通过后另开任务接入 React）
created: 2026-10-09
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
  User->>VLC: 打开子码流 RTSP 地址
  VLC-->>User: 两路都能出画则继续；否则停止

  User->>MTX: 启动 mediamtx（读 mediamtx.yml）
  Note over MTX: 监听 RTSP :8554<br/>WebRTC/WHEP :8889<br/>paths: cam01 / cam02

  User->>Br: 打开 http://127.0.0.1:8889/cam01
  Br->>MTX: WHEP 请求 cam01
  alt 尚无观看者且 sourceOnDemand
    MTX->>Cam: 主动连接 RTSP（子码流）
    Cam-->>MTX: 推送 H.264（忽略音频）
  end
  MTX-->>Br: WebRTC 视频轨
  Br-->>User: MediaMTX 自带页出画

  User->>Page: 打开独立 HTML（双路）
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
| HTML 双路 + 截图 | 步骤 6（本阶段门禁） |
| 关页断流后 | 另开任务再接 React |

关系一句话：**摄像头只对 MediaMTX 说话；浏览器/HTML 只对 MediaMTX 的 WHEP 说话；截图只发生在浏览器本地。**

## 1. 指导要干什么（范围）

### 要做

1. 确认摄像头/NVR 能出 **H.264 子码流 RTSP**，并用 VLC 播放成功。
2. 在同一台 PC（macOS 或 Windows）安装并启动 MediaMTX。
3. 配置两条路径：`cam01`、`cam02`，按需拉流。
4. 浏览器打开 MediaMTX 自带页面，确认两路都能播。
5. 用独立 HTML（原生 WebRTC / WHEP）双路播放，并验证截图。
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
- **MediaMTX**：本地流媒体网关。主动拉海康 RTSP，对外提供 WebRTC（以及可选 HLS）。
- **WebRTC**：浏览器实时音视频协议；本方案用 **WHEP**（播放端向服务器要流）。
- **WHEP 地址**：`http://127.0.0.1:8889/<路径名>/whep`，前端用它做信令。
- **子码流**：较低分辨率/码率，适合网页预览；海康常见为通道号末位 `2`（如 `102`、`202`）。
- **主码流**：较高清晰度；常见末位 `1`（如 `101`、`201`）。网页优先用子码流。

### 2.3 软件

- PC：macOS 或 Windows（均可）
- 浏览器：Chrome / Edge（推荐）
- VLC：用于验证 RTSP 是否可播
- MediaMTX：官方二进制即可（不必先上 Docker）
- 验证页：一个本地 HTML +（可选）`reader.js`；或纯 `RTCPeerConnection` + fetch WHEP

### 2.4 摄像头侧必须满足

1. 开启 RTSP。
2. 视频编码改为 **H.264**（尽量 baseline，关闭 B 帧）。H.265 在多数浏览器 WebRTC 下会黑屏/无流。
3. 关闭音频。
4. 能提供一条 **VLC 可打开** 的子码流 RTSP。

### 2.5 海康 RTSP 地址（两套都可能遇到）

**常见写法 A（Streaming/Channels）：**

```text
rtsp://用户名:密码@摄像头或NVR的IP:554/Streaming/Channels/102
```

- `102`：通道 1 子码流（网页优先）
- `101`：通道 1 主码流
- 通道 2：通常 `202` / `201`
- 通道 3：通常 `302` / `301`

**常见写法 B（部分固件）：**

```text
rtsp://用户名:密码@IP:554/h264/ch1/sub/av_stream
```

**判定规则（写进 Agent 检查清单）：以 VLC 能打开的地址为准，不要死记一种格式。**

密码含 `@` `:` `?` `/` 等特殊字符时必须 URL 编码。

若是 **NVR**：两条流通常是同一 IP + 不同通道号，而不是两台不同摄像头 IP。

### 2.6 端口（本阶段局域网）

| 端口 | 用途 |
|---|---:|
| 8554 | MediaMTX 自身 RTSP（一般不用浏览器访问） |
| 8889 | WebRTC / WHEP（浏览器访问这个） |

本阶段：**不要配置 STUN/TURN**。访问使用 `http://127.0.0.1:8889/...` 即可。以后若要从别的机器远程看，再单独做 HTTPS + TURN。

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
- 一条完整子码流 RTSP（以摄像头网页或厂商说明为准）
- PC 与摄像头同一局域网（能 ping 通）

#### 怎么操作
1. 打开 VLC。
2. 菜单：**媒体 → 打开网络串流**（Open Network Stream）。
3. 粘贴 RTSP，例如：  
   `rtsp://admin:密码@192.168.1.64:554/Streaming/Channels/102`  
   （通道 2 常见为 `202`；若写法 B 在网页上给出，整段换成写法 B。）
4. 点播放。
5. 第二路摄像头/通道再用同样方法测一遍。

#### 完成标准
- 两路 RTSP 在 VLC 均可**稳定出画面**。
- 本阶段不要声音：无声或静音均可，不作为失败条件。

#### 失败则停止
不要进入 MediaMTX。先回到摄像头网页：确认 RTSP 已开、编码改为 **H.264**、地址与密码正确，或换另一种 RTSP 写法后再用 VLC 重测。

### 步骤 3：安装并启动 MediaMTX

1. 从官方发布页下载对应系统的 MediaMTX：  
   **https://github.com/bluenviron/mediamtx/releases/latest**  
   - macOS：选带 `darwin` / `macos` 的压缩包（Apple Silicon 选 `arm64`，Intel 选 `amd64`）  
   - Windows：选带 `windows` 的压缩包（通常 `amd64`）  
   - 当前最新示例（以发布页为准）：macOS Apple Silicon 选 `mediamtx_v*_darwin_arm64.tar.gz`；Windows 选 `mediamtx_v*_windows_amd64.zip`  
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

将下面模板里的 IP、账号、通道号换成实测可用的 RTSP（以 VLC 为准）：

```yaml
rtspAddress: :8554
webrtcAddress: :8889
webrtc: true
# 开发/本机验证可用 *；以后 React 生产环境再改成具体前端域名
webrtcAllowOrigins: ["*"]

paths:
  cam01:
    source: rtsp://admin:密码@192.168.x.x:554/Streaming/Channels/102
    rtspTransport: tcp
    sourceOnDemand: true

  cam02:
    source: rtsp://admin:密码@192.168.x.y:554/Streaming/Channels/102
    rtspTransport: tcp
    sourceOnDemand: true
```

说明：

- `rtspTransport: tcp`：海康局域网更稳（部分文档写作 `sourceProtocol: tcp`，以当前 MediaMTX 版本字段名为准）。
- `sourceOnDemand: true`：页面关闭后断开摄像头拉流，节省连接数。
- 若 VLC 用的是写法 B，则 `source` 整段换成写法 B。
- 若是 NVR 第二通道：通常只改通道号，例如 `.../Streaming/Channels/202`。

重启 MediaMTX，使配置生效。

**完成标准：** 配置文件已保存且服务已重启。

### 步骤 5：MediaMTX 自带页面验证（先于任何自定义 HTML）

浏览器分别打开：

```text
http://127.0.0.1:8889/cam01
http://127.0.0.1:8889/cam02
```

**完成标准：** 两页都能自动出画面。  
**失败排查：**

- VLC 能播但这里不能 → 查编码是否仍为 H.265、路径名是否写错、MediaMTX 日志报错。
- 黑屏 → 几乎总是编码问题，回到步骤 1～2。

### 步骤 6：独立 HTML 双路播放 + 截图

新建本地目录，例如 `~/mediamtx-test/`，放入：

1. `index.html`（下方示例）
2. `reader.js`（从 MediaMTX 仓库 `internal/servers/webrtc/reader.js` 下载；也可不用 reader.js，直接用步骤 6b 的纯 WHEP）

用浏览器打开：

```text
file:///.../index.html
```

或用任意静态服务器打开该目录（推荐，避免部分浏览器对 `file://` 的限制）。

#### 6a. 推荐：双路播放 + 截图（reader.js）

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>MediaMTX 双路验证</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #111; color: #eee; }
    .bar { display: flex; gap: 8px; padding: 8px; flex-wrap: wrap; }
    .wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; }
    video { width: 100%; background: #000; }
    button { padding: 6px 12px; }
    .status { padding: 0 8px 8px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="bar">
    <button type="button" onclick="snap('cam01')">截图 cam01</button>
    <button type="button" onclick="snap('cam02')">截图 cam02</button>
    <button type="button" onclick="stopAll()">停止全部</button>
  </div>
  <div class="status" id="status">正在连接…</div>
  <div class="wrap">
    <video id="cam01" controls muted autoplay playsinline></video>
    <video id="cam02" controls muted autoplay playsinline></video>
  </div>
  <script src="./reader.js"></script>
  <script>
    const readers = {};
    const statusEl = document.getElementById('status');

    function setStatus(msg) {
      statusEl.textContent = msg;
      console.log(msg);
    }

    function play(id) {
      readers[id] = new MediaMTXWebRTCReader({
        url: `http://127.0.0.1:8889/${id}/whep`,
        onError: (err) => setStatus(`${id} 错误: ${err}`),
        onTrack: (evt) => {
          document.getElementById(id).srcObject = evt.streams[0];
          setStatus(`${id} 已出画`);
        },
      });
    }

    function snap(id) {
      const video = document.getElementById(id);
      if (!video.videoWidth) {
        alert(`${id} 画面还没出来`);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const a = document.createElement('a');
      a.download = `${id}-${Date.now()}.jpg`;
      a.href = canvas.toDataURL('image/jpeg', 0.92);
      a.click();
    }

    function stopAll() {
      Object.values(readers).forEach((r) => r && r.close());
      ['cam01', 'cam02'].forEach((id) => {
        const v = document.getElementById(id);
        v.srcObject = null;
      });
      setStatus('已停止');
    }

    window.addEventListener('load', () => {
      play('cam01');
      play('cam02');
    });

    window.addEventListener('beforeunload', stopAll);
  </script>
</body>
</html>
```

#### 6b. 备选：纯 WHEP（不依赖 reader.js）

适合以后迁到 React 时对照；验证阶段二选一即可。

```html
<video id="cam01" controls muted autoplay playsinline style="width:48%"></video>
<video id="cam02" controls muted autoplay playsinline style="width:48%"></video>
<script>
async function start(id) {
  const pc = new RTCPeerConnection({ iceServers: [] }); // 同机局域网可不配 STUN
  pc.ontrack = (e) => {
    document.getElementById(id).srcObject = e.streams[0];
  };
  const offer = await pc.createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: false,
  });
  await pc.setLocalDescription(offer);
  const res = await fetch(`http://127.0.0.1:8889/${id}/whep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: offer.sdp,
  });
  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  return pc;
}
start('cam01');
start('cam02');
</script>
```

**完成标准（本阶段门禁）：**

1. `http://127.0.0.1:8889/cam01` 与 `/cam02` 都能播。
2. 独立 HTML 两路都能播。
3. 截图按钮能下载 JPG，且画面内容正确。
4. 关闭页面后，MediaMTX 日志显示对应 path 断开（`sourceOnDemand` 生效）。

**全部成功前：禁止接入用户前端工程。**

### 步骤 7：后续接入 React（仅步骤 6 成功后，另开任务）

本文档到此结束。步骤 6 验收通过后，**另开任务**再接入用户的 React 前端。

接入时只需记住验证阶段已经锁定的契约，不要回头改 MediaMTX 路径名：

- WHEP：`http://127.0.0.1:8889/cam01/whep`、`http://127.0.0.1:8889/cam02/whep`
- 只要视频：`offerToReceiveVideo: true`，`offerToReceiveAudio: false`
- 截图：从 `<video>` 当前帧绘制到 canvas 再下载/上传
- 停止：关闭 `RTCPeerConnection`，清空 `srcObject`
- 建议在 React 里补：`onconnectionstatechange` 断线重连、加载/错误状态
- 以后远程访问再考虑：同源反向代理、收紧 `webrtcAllowOrigins`、HTTPS + TURN

**禁止：** 在未完成步骤 6 之前改 React 工程；也禁止把摄像头账号密码写进 React 代码或仓库。

---

## 4. 验收清单（Agent 勾选）

- [ ] PC 与摄像头/NVR 同一局域网，ping 通
- [ ] 摄像头 RTSP 已开，编码为 H.264，音频已关
- [ ] VLC 两路子码流均可播放
- [ ] MediaMTX 已启动，监听 8889
- [ ] `http://127.0.0.1:8889/cam01` 可播
- [ ] `http://127.0.0.1:8889/cam02` 可播
- [ ] 独立 HTML 两路可播
- [ ] HTML 截图可下载且内容正确
- [ ] 关闭页面后按需拉流断开
- [ ] （可选）记录最终可用的两条完整 RTSP 地址到本文或用户笔记
- [ ] **仅当以上完成**：再另开任务接入 React 前端（本文档不覆盖）

---

## 5. 常见失败与处理

| 现象 | 最可能原因 | 处理 |
|---|---|---|
| VLC 都不能播 | 地址错、账号错、不在同一网段 | 回摄像头网页核对 RTSP；ping |
| VLC 能播，MediaMTX/浏览器不能 | 多为 H.265 | 改 H.264；或换确实是 H.264 的子码流 |
| MediaMTX 日志有源但页面黑屏 | 编码/浏览器兼容 | 确认 H.264；换 Chrome/Edge |
| 只播一路 | 第二路通道号/地址错 | 分别用 VLC 测两条 RTSP |
| 页面能开、远程黑屏 | 本阶段不应出现；若以后远程 | 再做 HTTPS + TURN |
| 截图空白 | 视频尚未 onTrack / videoWidth=0 | 等出画再截；检查 muted/autoplay |

---

## 6. 安全注意

- 摄像头密码只出现在 MediaMTX 配置与本机环境里，不要写进前端仓库或提交到 Git。
- 本阶段仅绑定 `127.0.0.1` 验证。
- 以后若对局域网其他设备开放，再限制 `webrtcAllowOrigins`、加鉴权或反向代理，不要长期 `*`。

---

## 7. 参考

- MediaMTX 官方：<https://github.com/bluenviron/mediamtx>
- 拉取摄像头 RTSP：<https://mediamtx.org/docs/publish/rtsp-cameras-and-servers>
- 浏览器播放 / 嵌入：<https://mediamtx.org/docs/read/web-browsers>
- 海康 RTSP 通道说明（厂商文档）：`Streaming/Channels/10x` 为主/子码流惯例

---

## 8. 当前决策记录

- **决策日期：** 2026-10-09
- **环境：** 摄像头与 PC 同局域网；MediaMTX 与前后端同 PC；同时 2 路；无音频；需要截图
- **路径：** 先 MediaMTX 自带页 → 再独立 HTML → **全部成功后**再接入用户的 **React** 前端（接入代码不在本文档）
- **不做：** 本阶段公网 / STUN/TURN / 音频 / 超过 2 路 / 本文档内的 React 接入实现



## 附录

---

## 9. 附录：现场 RTSP 与通道对照

国科大外场已确认的目标摄像头 RTSP、NVR 通道号与参数配置见：

- [[国科大外场--目标摄像头的Rtsp获取和参数配置]]

两路子码流（供 MediaMTX `paths` 直接引用）：

| 路径建议      | 目标画面        | RTSP                                                                 |
| --------- | ----------- | -------------------------------------------------------------------- |
| `cam_d4`  | D4 对接集装箱顶前视 | `rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/402`  |
| `cam_d16` | D16 场地俯瞰    | `rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/1602` |

> RTSP 必须带账号；密码含 `@` 时 URL 写为 `%40`。详见 [[国科大外场--目标摄像头的Rtsp获取和参数配置]]。

与本指导书示例中的 `cam01` / `cam02` 对应关系：验证阶段仍可用 `cam01`/`cam02` 命名；接入现场时建议改为上表的 `cam_d4` / `cam_d16`，与笔记一致。
