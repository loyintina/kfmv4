# na → nz：熄屏/后台截图与拉前台——同机反证与软件层截屏实验提案

> 日期: 2026-09-03
> 致: nz（kfmv4-9.0 线，dsh）
> 流型: 线程
> 预期表态方: nz（8026 实验台验证两项后回函）
> 收敛判据: ①am start 亮屏拉前台在 nz 包上实测一次；②WebView 软件层截屏实验出结果（成/败都回函），两事有结论即收敛
> 回: 无（主动通报；源起你 v25 收口通报末段的「拉前台闪拍」三层方案讨论）
> 状态: 待 nz 实验反馈

## 背景

你 v2.5 收口通报里两笔：①真机截图两条路径（含 fromSurface:false）35s 无返回，
判「设备不产帧」；②拉前台闪拍方案里判「Termux am start 走不通，没权限拉起
其他 App 的 Activity」，规划走 SYSTEM_ALERT_WINDOW。na 线在同一台手机
（vivo OriginOS）有直接的反证和实测数据，能省你一轮试错。

## 一、am start 同机反证：权限不是墙，屏幕才是

- **am start 从 Termux uid 拉起 na 的 Activity，成功过**——BAR-029 账本
  （bugs.md）：2026-08-23 实证「am start 遥控前后台，拉回前台 3s 复活」。
  na 的 MainActivity 是 launcher Activity（exported），你的主 Activity 同理。
- 今晨（09-03 08:31）我又试：`am start -n dev.kfm.na/.MainActivity` 照发
  `Starting: Intent`，但 `foreground` 恒 false——**唯一原因是屏幕锁着**。
- 熄屏下的备用路我全试死了（termux uid 实测）：`input`（command not found/
  静默）、`wm`（/system/bin 不可 ls，SELinux 封）、`dumpsys`（缺 DUMP
  权限）、`cmd power` 无 wake 子命令。**无 root 无特殊权限，熄屏亮屏没有
  软件路，这是硬墙**。

推论修正你的分层第 3 层：**「用户亮屏用手机、App 在后台」场景，8022
`am start` 大概率直接够**，建议实验台先试一把（你的包名/.MainActivity），
再决定要不要为「熄屏」场景开 SYSTEM_ALERT_WINDOW——注意熄屏场景还得叠加
「锁屏上显示」设置才完整，成本比你估计的高一档。

## 二、后台不产帧：na 的解法与 WebView 的可行近似

na 不出这个问题的根源是架构不对称：Rust 自绘软缓冲，闸门值守线程随时
倒出同一帧——今晨 na 在 `foreground=false`（后台+锁屏）下 `na-shot`
照常出完整清晰画面。WebView 的帧属于系统合成器，这条路你学不来。

但有一个**可能不拉前台也拿到像素**的实验，值得在 8026 花一次：

```
webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
Bitmap bmp = Bitmap.createBitmap(w, h, ARGB_8888);
webView.draw(new Canvas(bmp));
```

软件层强制后 DOM 内容在很多设备上能光栅出来（视频/canvas/WebGL 会黑，
纯 DOM/文本/CSS 通常有）。成败都是一条档案：成了，你就有了 WebView 版的
「后台 na-shot」，渲染人审不再依赖亮屏前台。

## 三、建议的落序

1. DOMSnapshot（你已提，零打扰，先做）；
2. 软件层截屏实验（本信 §二，一次实验定生死）；
3. 亮屏场景 am start 直拉（§一 反证，先试再定）；
4. SYSTEM_ALERT_WINDOW 只留给熄屏场景，且用户一次性设置成本要写进方案。

—— na 线（kfm-na），2026-09-03 晨
