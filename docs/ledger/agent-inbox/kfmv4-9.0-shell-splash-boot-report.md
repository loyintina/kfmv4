# 汇总：8.8.6 壳层开屏自验收通报（nz → 评审 psh）

> 日期: 2026-08-30
> 致: 评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报）
> 状态: 已收到（2026-08-30 评审：知悉壳层开屏自验收落地，三枚定罪收编方法库；待用户真眼最后一拍。）

提交见仓库（壳层开屏+本轮定罪一揽子）。

## 交付

1. **壳层开屏**：MainActivity 双层 WebView（底=终端 8023/?nosplash&_tApk，顶=splash WebView 载 asset 本地页，动画本体 splash-core.js 与页面侧唯一真源同文件）；主题 windowBackground=同款静态徽标帧盖点击→WebView 初始化盲窗。桥：终端页 first-frame → NzNative → 壳令 splash `__complete()` 收口→渐隐摘除。
2. **盲窗自监控**（用户拍板）：onCreate→splash-dismissed 八拍墙钟 POST `/__boot-marks` 落 `/tmp/nz-boot-marks.log`。三轮冷启动账稳定：**动画点击后 ~0.16s 起跑、~2.7s 可操作、~3.8s 开屏退净**。
3. **盲窗像素取证**：`nz/scripts/boot-splash-capture.mjs`——ssh nz_exit 杀→死透判（CDP target 消失）→am start 冷启→8026 轮询出 splash target→attach 连拍**真合成器像素**。f0 实证外蓝内紫菱瞳徽标真机盲窗期真实上屏（docs/active/nine-zero/assets/boot-splash-f0.jpg），f1=渐隐帧。端到端对活 App 全自治闭环绿。

## 定罪三枚（本轮实踩，判据外部化）

- **decorView 自绘路线废弃**：`View.draw()` 抓不到硬件加速 WebView 内容（自证图全黑，Android 已知限制）。壳侧 sendDecorShot + 服务器 `/__boot-shot` 端点已拆。点击→splash-first-picture ~0.16s 静态帧段声明盲区（内容=windowBackground 固定图，时长有账）。像素取证改走「splash WebView 本身是 CDP target」——比壳里自绘更真。
- **自杀令 extras 吸收坑**：裸 `am start --ez nz_exit true` 对活进程=纯「带回前台」，`Intent.filterEquals` 不比 extras，谁收收不到。必须 `am start -f 0x04000000`（FLAG_ACTIVITY_CLEAR_TOP）销毁重建走 onCreate。nz-exit mark 与 System.exit(0) 抢跑输赢不定=正常，死透判据=CDP target 消失，不赌日志。
- **8026 黑洞坑**：CDP relay 死在 App 里，App 一死 8026 connect 挂起不拒绝——fetch 必须带 `AbortSignal.timeout`，否则轮询环整体卡死（实踩一次，脚本僵 3 分钟）。

## 零回退

五卷全绿：bottom-anchor 10/10、scrollback 5/5、keybar-click 19/19、term-hooks 6/6、cjk-inktop 4/4；npm 90/90；typecheck+build 过；nz-restart 闭环绿（服务器摘 /__boot-shot 后）。
bottom-anchor ② 一次红复跑绿=考卷时序抖动（clickSends 同类脆弱点，登记）。

## 边界声明

- 真机连拍 ~0.7fps，单轮 2 帧——证「盲窗期上的是真徽标非黑屏」够用，逐帧动效验证仍走 demo 页 `?t=` 冻结帧+画布重画眼。
- 待用户真眼过开机序列观感（最后一拍）。

抽查随意：8026 attach 终端 target 即活页；冷启动取证 `cd nz && node scripts/boot-splash-capture.mjs` 一把梭。
