# 2026-08-23 · 评审 · 建议：给 ?debug 加 vv 诊断字段，定位 keybar 上浮被盖（chrome 显隐）

> 日期: 2026-08-23
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 加 vv 诊断字段，评审收真机「全屏 / 有栏」两种状态各弹一次键盘的数字，定位后给修法
> 回: 8.8.3b keybar（用户实拍：有浏览器栏时下排被输入法覆盖、只露 ~2px；全屏时正常）
> 回函通知: psh
> 状态: 待回信（2026-08-23 评审：请加 ?debug vv 诊断字段，收真机两种状态数字）

## 一、问题（用户实拍）

8.8.3b keybar 上浮在**浏览器栏（chrome）显示**时：**下排被输入法覆盖、只露 ~2px**；**全屏（栏隐藏）时正常**。这就是 kfmv4 以前尝试解决但失败的同一类。

## 二、根因（更准的认知）

keybar `bottom = innerHeight − vv.height − vv.offsetTop`：
- **chrome 显示**：`innerHeight`（布局视口）**含 chrome**，`vv.height`（可视）**不含**，且 `vv.offsetTop` 可能非 0（页面被 chrome 顶下）——chrome 高度没被正确扣，bottom 高估/低估 → **内容被键盘/栏盖住**；
- **全屏（栏隐藏）**：`innerHeight ≈ vv.height`、offsetTop≈0 → 公式成立，上浮正常。

**正确方向：钉 visual viewport**——容器高 = `vv.height`（真正可视区），keybar 钉容器底（`bottom:0`），chrome 显隐/键盘弹收都盖不住；配套处理 chrome+键盘的**时序**（弹键盘时部分浏览器先藏 chrome，vv 会跳，按 vv.resize+防抖重排）。

## 三、请 9.0 先加诊断（先观测再修，别盲改——case-002 纪律）

在 `?debug` 事件流（已有 sendBeacon 管道）里，**`vv.resize` 时连同现有 f/rp/sc/rz 一并上报**这几个字段：
- `innerHeight` / `vvHeight` / `vvOffsetTop` / `keybarBottom`（keybar 当前 `parent.style.bottom` 数值）/ `vvAnchor`（若用锚点定位的调试值）。

## 四、用户真机跑法（两种状态各弹一次键盘）

1. 全屏（浏览器栏隐藏）状态开 `?debug` 弹键盘 → 报一组数；
2. 有栏（浏览器栏显示）状态开 `?debug` 弹键盘 → 报一组数。

评审收这两组**真机数字**，对比 bottom 理论值 vs 实际，精确定位差在哪（chrome 高度 / offsetTop / 时序），再给**视觉视口定位**的修法。修复后再真机两种状态各验下排是否都不被盖。

## 备注

此条为**观测先行**的评审建议（同 IME 三症/滚焦那类浏览器视口问题的打法）。9.0 若认同"钉 visual viewport"方向，也可直接往那侧改，诊断字段作为验证口径。
