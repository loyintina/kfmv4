# 2026-08-27 · 评审验收 · 实验台 P1 服务器侧+APK 复核通过——真机三步走起

> 日期: 2026-08-27
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 用户（真机操作后）；9.0 静候首图数据面
> 收敛判据: 用户装 APK + kalo -L 8025 → CDP attach 枚举页 → Page.captureScreenshot 首图落账，P1 全闭环转 P2
> 回: 无需回信，等用户真机结果
> 回函通知: psh
> 状态: 已回信（2026-08-27 评审：P1 服务器侧+APK 五条验收独立复核——代码/产物/运行态全过，余三条纯真机步骤待用户）

评审独立复核记录（逐条对 nz@c21421c0 实测，非采信通报）：

1. **APK 产物核 ✅**：aapt2 dump badging 实测 `dev.kfm.nz.agent` v0.1.0 targetSdk=28（NA 同款定案）、仅 INTERNET 权限；apksigner verify 过（v1/v2 签名在）。包体 12.7K 纯 Java 皮名副其实。
2. **Manifest 关键位 ✅**：`usesCleartextTraffic=true` 有注释说明为何必须（回环 http 拒载坑）——这个坑提前排掉是对的。
3. **中继架构核 ✅**：CdpRelay.java 干净桥断开立即补新桥、仅连不上才退避——与 cdp-relay.ts FIFO 配对语义咬合；statusFile 的 attach 分锅面（pendingBridges=0=APK 未连 / 有桥不通=协议问题）照补充要求落地。
4. **考卷与运行态 ✅**：cdp-relay.test.ts 5 断言含两序配对/客断桥陪葬；npm 90 绿本机复核通过；8025/8026 loopback 监听实测在，/tmp/nz-cdp-relay.status.json 落盘活。
5. **遗留一笔（不挡 P1 收口）**：relay 是 setsid 常驻进程，**服务器重启后会丢**且无守护拉起——kfm-nz.service 是 systemd 但 relay 游离在外。先记账，等真机流程跑顺后再定归宿（挂 service 或 cron @reboot），不要现在动。

**球交用户，真机三步**：
1. 装 APK：`scp -P 8022 nz/lab/device-agent/build/nz-agent.apk 手机:~/w/信箱/` 后点击安装
2. kalo 隧道加 `-L 8025`（连同既有 8023 一起）
3. 手机开 NZ-Agent App → 告知评审 → connectOverCDP('http://127.0.0.1:8026') 拿首张真机渲染截图

——评审 · 2026-08-27
