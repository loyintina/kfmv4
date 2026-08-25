# 2026-08-25 · 9.0 · 全屏卡身移植落地回函：fixed 锚真实可视区 + overflow 硬裁剪（pinToVv/kbOff 退役）

> 日期: 2026-08-25
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核三点移植与考卷④修卷；球交用户真机 C 档（htop/ranger 占满不超屏，顶栏伸缩+键盘弹起两态）
> 回: kfmv4-9.0-fullscreen-card-port-review.md（用户拍板：8.0 全屏卡片机制搬 9.0）
> 回函通知: psh
> 状态: 已回（2026-08-25 9.0：三点移植落地 @ 1d38ae16——fixed inset:0 卡身+硬裁剪+行数对卡身量；三考卷不回退 npm 85 绿；headless htop 实证；待真机复核）

## 一、三点移植落地（对信三节）

1. **尺寸锚**：9.0 无输入栏可锚顶边，等价锚 = `position:fixed; inset:0`。viewport meta 带 `interactive-widget=resizes-content`，布局视口随键盘/地址栏**真实缩放**，fixed 元素贴布局视口 = 真实可视区——彻底不读 vv 数值（Via 有栏态多报 ~42px 的病灶失去作用点）。
2. **硬裁剪**：卡身 `overflow:hidden`（index.ts 容器 cssText），内容物理画不出卡外；body 同锁 overflow:hidden。
3. **行数对卡身量**：`measure()` 的 `scrollEl.clientHeight` 源自 fixed 卡身（已被真实可视区限高+硬裁剪），rows×cellH 恒 ≤ 可视区。vv 监听改纯重测（reportViewport + scheduleResize），不再钉容器。

## 二、处置明示（对信四节「9.0 自行判断」）

- **pinToVv 钉法与 ?kbOff 代字退役**：不信 vv 数值后两者无作用点，已删（注释留痕）；`?debug` 的 kboff 字段同删。
- **两态滚动策略（信六节）**：syncAlt 补 ALT 态 `overflow:hidden`（TUI 填满不滚）、行模式 `overflow:auto`（可回翻）——不回「TUI 也能滚」的老问题。
- 卡架构未动：term 插件即卡片不变，只换卡身尺寸/裁剪机制，无缩放/关闭钮=现状即如此（默认铺满）。

## 三、考卷④修卷（接管卷自改，明示）

bottom-anchor ④原手法 = mock `visualViewport.height` + dispatch resize——fixed 锚定后容器不读 vv 数值，此断言必红。修卷：改 `page.setViewportSize({900→400})` 真缩窗（= resizes-content 下键盘占位的同款物理），断言滚动区底边上移（536→316）+ 光标贴底不回退。

## 四、验证

- npm 85 + build + typecheck 全绿；三考卷不回退：bottom-anchor 5/5（修卷后④绿）、scrollback 5/5、keybar-click 19/19。
- headless htop 截图自验：ALT 态 ch=620=vh 占满整屏、F1-F10 帮助栏贴底完整无截断、scrollEl overflow=hidden；退出行模式 keybar 复原（ch=536=620−84）、overflow=auto 回翻正常。

## 五、待办

- 评审复核（重点：fixed 锚的等价性论证是否成立、考卷④修卷手法）。
- 用户真机 C 档：htop/ranger 占满可视区不超屏（顶栏伸缩+键盘弹起两态）——物理裁剪后不再依赖 vv 准确，预期根治；随底锚定/oh-my-zsh/配色字体四单并验收口。

——9.0 · 2026-08-25
