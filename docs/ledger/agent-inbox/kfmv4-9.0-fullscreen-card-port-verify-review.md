# 2026-08-25 · 评审 · 全屏卡身移植复核通过：fixed 锚真实可视区 + 硬裁剪（不信 vv），交用户真机 C 档

> 日期: 2026-08-25
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在用户真机 C 档）
> 收敛判据: 无需回信；用户真机 C 档——htop/ranger 占满可视区不超屏（顶栏伸缩+键盘弹起两态）；随底锚定/oh-my-zsh/配色字体四单并验收口
> 回: kfmv4-9.0-fullscreen-card-port-response.md（三点移植落地 @ 1d38ae16——fixed inset:0 卡身+硬裁剪+行数对卡身量，pinToVv/kbOff 退役）
> 回函通知: psh
> 状态: 已核（2026-08-25 评审：三点移植与规格吻合（fixed 锚+overflow:hidden+行数对卡身、pinToVv/kbOff 退役、syncAlt 两态）；亲跑三卷+npm85+headless htop 占满 915=vh 无截断均绿；待用户真机 C 档验证 fixed 锚在 Via 的可靠）

## 一、三点移植复核（与规格吻合）

1. **尺寸锚**：`position:fixed; inset:0` + viewport meta `interactive-widget=resizes-content`——布局视口随键盘/地址栏真实缩放，fixed 元素贴布局视口 = 真实可视区，**彻底不读 vv 数值**。9.0 无输入栏可锚顶边，用 `fixed inset:0` + resizes-content 作**等价锚**，论证成立（Via 有栏态多报 ~42px 的病灶失去作用点）。
2. **硬裁剪**：卡身 `overflow:hidden` + body 同锁——内容物理画不出卡外。✅
3. **行数对卡身量**：`measure()` 的 `scrollEl.clientHeight` 源自 fixed 卡身（已被真实可视区限高+硬裁剪），rows×cellH 恒 ≤ 可视区。vv 监听改纯重测不再钉容器。✅

## 二、处置明示复核

- **pinToVv 钉法 + `?kbOff` 代字退役**：不信 vv 数值后无作用点，删（注释留痕）；`?debug` kboff 字段同删——合理。
- **两态滚动策略**：syncAlt ALT 态 `overflow:hidden`（TUI 填满不滚）、行模式 `overflow:auto`（可回翻）——不回「TUI 也能滚」老问题。✅
- 卡架构未动（term 插件即卡片、无缩放/关闭钮、默认铺满）——符合用户拍板。

## 三、考卷④修卷复核

- 原④手法 mock `visualViewport.height` + dispatch resize——fixed 锚定后容器不读 vv 数值，此断言必红。改 `page.setViewportSize({900→400})` 真缩窗（=resizes-content 下键盘占位同款物理）——**修卷合理**（量的是物理窗口伸缩，非 mock 数值）。亲跑 ④ 绿。

## 四、亲测实证

- **三卷**：bottom-anchor 5/5（修卷后④绿）、scrollback 5/5、keybar-click 19/19；**npm 85 全过** + build + typecheck 全绿。
- **headless htop**（412×915）：`sh==ch==915`（占满=vh、无溢出）、`contB=915=vh`、`scrollEl overflow=hidden`、keybar 父容器 `display:none`；截图人审：htop 红绿 CPU 条+PID 表占满全屏、`F1Help…F10` 底栏贴屏幕最底、无截断/无 keybar/无超屏。**根治。**

## 五、关键风险与下一步

- **架构对、真机待验**：修复的灵魂是 `interactive-widget=resizes-content` + `fixed inset:0` 锚到真实可视区——**能否在 Via（及手机浏览器）正确生效是唯一真机变量**（headless chromium 支持，但 Via 行为要真机确认）。好在**物理裁剪兜底**：即使 Via 可视区行为有偏差，溢出也被 overflow:hidden 裁掉，**不会再出现「需上滑」**。
- **球交用户真机 C 档**：htop/ranger 占满可视区不超屏（顶栏伸缩 + 键盘弹起**两态**），随底锚定/oh-my-zsh/配色字体**四单并验收口**。

——评审 · 2026-08-25
