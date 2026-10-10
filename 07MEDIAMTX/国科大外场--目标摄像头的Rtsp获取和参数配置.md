---
title: 国科大外场——目标摄像头 RTSP 获取与参数配置
type: 现场笔记
status: 已确认（2026-10-10 锁定主码流）
tags: [国科大, 外场, RTSP, 萤石, NVR, MediaMTX]
created: 2026-10-09
updated: 2026-10-10
---

# 国科大外场——目标摄像头 RTSP 获取与参数配置

## 1. 目标摄像头 RTSP（已确认）

NVR：`192.168.1.163:554`

RTSP 鉴权：用户名 `admin`，密码含 `@`，URL 中须写成 `Huawei%406G`（不要把密码明文写进 Git/前端）。

**2026-10-10 通过基线（VLC + MediaMTX + `test.html`）：主码流。**

| 目标画面 | 摄像头 IP | NVR 通道 | RTSP（主码流，已通过） |
| --- | --- | --- | --- |
| D4：对接集装箱顶前视 | `192.168.1.168` | D4 / Channels **401** | `rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/401` |
| D16：场地俯瞰 | `192.168.1.180` | D16 / Channels **1601**（设备标注「双目」） | `rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/1601` |

子码流 `402` / `1602` 仅为早期候选，不是本轮 HTML 通过基线。编码尽量为 **H.264**。

## 2. 获取步骤（萤石 NVR）

### A. 打开萤石设备配置页

控制台：<https://open.ys7.com/console/device.html>

![[Pasted image 20261009033126.png]]

### B. 用通道号对应目标摄像头 Dx

> VLC「打开网络串流」时也必须用带账号的完整 RTSP（见第 3 节），不能只贴无账号的路径。

![[Pasted image 20261009032858.png]]

![[Pasted image 20261009032909.png]]

### C. 确认 NVR 通道号与 RTSP 路径

- NVR IP：`192.168.1.163:554`
- 通道号规则：主码流常见为 `通道号 × 100 + 1`（D4 → `401`，D16 → `1601`）；子码流末位为 `2`（`402` / `1602`）

![[Pasted image 20261009033410.png]]

### D. 摄像头 IP 与编码参数（子码流 / H.264）

![[Pasted image 20261009033022.png]]

![[Pasted image 20261009032735.png]]

![[Pasted image 20261009032747.png]]

## 3. 给 MediaMTX / VLC 时的建议写法

**VLC 和 MediaMTX 都必须带用户名密码。** 密码里的 `@` 要写成 `%40`。

完整地址：

```text
rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/401
rtsp://admin:Huawei%406G@192.168.1.163:554/Streaming/Channels/1601
```

MediaMTX 验证路径名用 `cam01` / `cam02`（与已通过的 `test.html` 一致）：

```yaml
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

VLC：媒体 → 打开网络串流，粘贴上面完整 RTSP（含 `admin:Huawei%406G`），两路都能稳定出画再进 MediaMTX。



```
admin  
Huawei@6G
密码里的 `@` 要写成 `%40`
```