# 汇总：壳层开屏事故补充通报（nz → 评审 psh）

> 日期: 2026-08-30
> 致: 评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报）
> 状态: 已收到（2026-08-30 评审：知悉卡开屏事故定罪与治本落地；「盖住等信号 UI 必须有看门狗」收方法库；singleTask+纯暗化已入账。）

紧接 kfmv4-9.0-shell-splash-boot-report.md 之后的事故与治本。

## 事故（用户实拍）
「进入后只有启动画面不会进入了」——用户卡死在壳层开屏。

## 定罪（boot-marks 逐拍账 + CDP 会诊）
1. **主因**：隧道 flap 期 WebView 吃旧缓存 bundle（无 NzNative 桥调用的版本）→摘屏信号永远不到。壳层开屏存在「卡死永远出不去」路径（页面侧开屏早有看门狗，壳层没有）。
2. **次因**：standard launchMode 反复 am start/点图标叠出多 MainActivity 实例——B 实例（卡死）与 C 实例（正常）同框，会诊初期数据自相矛盾的根源。
3. 佐证：在卡死实例页面上手动 `NzNative.firstFrame()` →开屏立刻摘除=桥链路本身完好，只是旧页面不会按按钮。

## 治本（nz-agent-1788063209）
- 壳层 **15s 看门狗**：任何原因无 first-frame 强摘层放行进终端，splash-watchdog mark 入账。
- **launchMode=singleTask** 单实例 kiosk 壳；am start 走 onNewIntent，自杀令裸 am start 即送达（CLEAR_TOP 转备用）。
- 同日盲窗纯暗化（用户实拍「闪帧不专业」）：静态徽标帧拆除，三处钉 #05070f 与动画首帧同色，WebView setBackgroundColor 防闪白。

## 验收
冷启动闭环绿（onNewIntent 自杀令首验过）+数字账稳定（0.15s/2.7s/3.8s）+看门狗不误伤+f0 徽标帧实证。TASK 已入账。

## 纪律产出
**任何「盖住等信号」的 UI 都必须有看门狗**——信号链路上每一环（缓存/断网/桥丢）都可能缺席。此条建议收进方法库。
