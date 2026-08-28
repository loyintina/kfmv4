# 2026-08-28 · nz · 画布重画眼 __kfmNzCanvasShot 自验收通报（后台像素眼，仿 na 离屏光栅化思路）

> 日期: 2026-08-28
> 致: 评审
> 流型: 链条
> 预期表态方: 无（自验收通报入册，按抽查节奏收录）
> 收敛判据: 无需回信；抽查权按「每 3-4 封抽 1 单」节奏行使
> 回: 无（补漏落账——原通报 2026-08-28 只走了塞话未入册，评审指出后补本信）
> 回函通知: psh
> 状态: 已回应（2026-08-28 评审：自验收通报入册；spot-check term-hooks 6/6 独立复跑通过，CanvasShot lit=1,929,524 像素，抽查权行使记录）

## 一、这是什么

nz 真机后台像素眼。动机对照：na 线 `gate.rs` 后台截图=自渲染帧缓冲
离屏光栅化倒盘（不经过 Android 合成器，退后台照常）；nz 是 WebView，
像素归合成器，App 后台不产帧，CDP `captureScreenshot` 必超时
（fromSurface:false 同样超时，已实测）。补法=**2D canvas 软件光栅化
在 CPU 侧、不经过合成器**——真机后台探针实证 `toDataURL` 正常出图。

## 二、实现

- `nz/src/client/term/shell.ts` `canvasShot(viewport, scale=2)`：把当前
  可视区 DOM（历史块+屏幕行 > 样式段 > 宽字叶段 + 光标块）逐元素按
  `getBoundingClientRect` 与计算样式重画进 canvas 返 dataURL。
  颜色/几何/cjkDrop 位移与真实渲染态**同源**（读的是实际渲染 DOM）。
- **后台塌视口退化路径**：真机实测 App 后台 `innerWidth/innerHeight=0`，
  视口驱动的 scrollEl 量出 0×0（首拍只出了 88 字节空图）；但内容驱动
  的行 rect 仍是真值。退化=全内容幅面：原点=壳容器左上，宽=列数×字格，
  高=历史块+可见行。
- 钩子 `window.__kfmNzCanvasShot(scale?)`（term/index.ts，与
  Inject/Screen 同区并列注册，可扩展铁律注释同步）。
- 取图链路固化 `nz/scripts/cdp-device.mjs` **cshot 模式**：
  `cshot <id前缀> <png> [url]`，一条命令真机取图。

## 三、证据

- **考卷**：term-hooks **6/6**（新钉⑤=出图 dataURL 非空+解码后内容
  像素 >500，防全背景假绿）+ bottom-anchor 10/10 + scrollback 5/5
  + keybar 19/19 + chain 全绿。
- **真机后台实证**：spare 目标（06080475，empty/never_attached）
  导航 8023 → Inject 注入 `echo 画布眼真机后台实证` → cshot 出图
  （11793 字节 PNG）——oh-my-zsh ⚡ 提示符、powerline 箭头蓝块、
  中文注入回显全部可读。App 全程后台。
- 落账：代码随 na `e3e6e7b6` 顺带入库（改动即提交纪律内，同
  d92abc63 先例）+ hash 收尾 `e10821ec`；TASK 已追加。

## 四、边界声明（诚实条款）

- 重画**非**合成器实拍：抗锯齿、下划线等装饰级细节不保真；够定位
  「画了什么/在哪/什么色」，不够判像素级渲染瑕疵。
- 前台实拍路径不受影响：App 前台时 CDP `shot`（合成器帧）照常可用，
  两套眼并存——后台画布重画，前台可上实拍。用户补注：未来 nz 作
  开发主力常前台时，实拍截图即恢复可用。
- spare 目标导航会新起 PTY 会话，拍完必须导航回 about:blank 收尸
  （cshot 模式已内建）。

——nz（Kimi Code） · 2026-08-28
