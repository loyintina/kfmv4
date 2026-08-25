# 2026-08-25 · 评审 · TUI 超屏根治：把 8.0 全屏卡片机制搬进 9.0（默认全屏终端卡，无缩放/关闭钮）

> 日期: 2026-08-25
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 给终端卡套上「高=可视区 + overflow:hidden 硬裁剪」的卡身（尺寸锚不用裸 vv.height，改用可靠可视区/DOM 锚），行数对着卡身量、终端填满卡永不溢出；真机 htop/ranger 不再超屏需上滑（即使 vv 多报/浏览器栏伸缩）；A 档三卷不回退
> 回: —（首信；用户拍板方向）
> 回函通知: psh
> 状态: 已回（2026-08-25 9.0：三点移植落地 @ 1d38ae16——fixed 卡身+硬裁剪+行数对卡身量，pinToVv/kbOff 退役；待评审复核+真机 C 档）· 代际戳 gen-2026-08-25-全屏卡身

## 一、用户拍板

把 **8.0（旧 kfmv4）的全屏卡片机制搬进 9.0**：
- 进入页面 = **一个默认铺满全屏的卡片**，卡片里放终端；
- 这个全屏卡**没有缩小/关闭按钮**，就铺在页面最底（内容区），终端是页面主体。

## 二、为何超屏没根治（根因，非事件/度量竞态）

此前 truefix（vv scroll 重测 + 字体晚到）修的是「事件/度量竞态」，但根子在**尺寸锚点与缺硬裁剪**，故用户真机仍超屏：

- nz 终端容器是**裸的全高块**，直接钉 `vv.height - kbOff`（`nz/src/client/plugins/term/index.ts:161-170`），**没有**「高=可视区、overflow:hidden」的卡身中间层。
- 内部 `scrollEl` 是 `overflow:auto` **真滚动区**（index.ts:206-209），`rows = floor(scrollEl.clientHeight / cellH)`，而 `scrollEl.clientHeight` 又源自 `vv.height`。
- **病灶**：Via 等浏览器 `vv.height` 在「有栏/键盘态」多报 ~42px（index.ts:152-153 注释、`kbOff` 即为此设）→ 容器被钉高 → rows 偏多 → htop 画的行数超可视区 → 底部进 chrome/键盘后面 → 需上滑。且 `height=max(80,…)` 是**下限**（键盘态 vv 小时可能反而高于可视区）、150ms 防抖让 rows 慢半拍。

## 三、要搬的 8.0 卡片机制（照抄关键三点）

8.0 不超屏靠「**可视区内 DOM 锚 + 卡内 overflow:hidden 硬裁剪**」，请 9.0 把这套搬到 nz 终端卡：

1. **尺寸锚不用裸 vv**：8.0 全屏卡高 = `barTop − 2`（`floating-fullscreen.ts:75-77`，取屏幕内输入栏顶边 `getBoundingClientRect().top`）——**锚一个「屏幕内可见 DOM 的顶边」，天然 ≤ 可视区**。9.0 可锚等价的可见区 DOM 元素（或稳定的可视区高度，不裸信 vv 数值），保证卡高 ≤ 真实可视区。
2. **卡身 = 容器限高 + `overflow:hidden` 硬裁剪**：8.0 卡体 `flex:1; overflow:hidden`（`floating-card.ts:801`）+ 终端 `flex:1; overflow:hidden`（`terminal-card-04.ts:462`），三层 overflow:hidden——**内容物理上不可能画出卡外**。9.0 终端卡同样：卡身高锁定，终端填满卡，不出现「可超过卡身滚动」的内部滚动区。
3. **行数对着卡身量**：8.0 用 xterm `FitAddon.fit()` 对卡体高算（`terminal-card-04.ts:87-111`）；9.0 的 `measure()`（`rows=floor(scrollEl.clientHeight/cellH)`）应改为**对卡身 clientHeight 算**，且卡身已被限高 + 硬裁剪，rows×cellH 恒 ≤ 可视区。删除/停用那个能把 TUI 画高出可视区的 `overflow:auto` 滚动态（或仅在非 ALT 行模式用于回翻，ALT/TUI 模式=填满不滚）。

## 四、与 9.0 现卡架构的关系

9.0 本身已有 cardTypes broker、term 插件即卡片——**不是整套替换 9.0 卡架构**，只把 8.0 的全屏卡「**尺寸锚 + 硬裁剪 + 终端填满卡**」这三点搬进 9.0 的 term 卡，让它落到与 8.0 相同的「不可能超屏」约束。9.0 自行判断如何并入现有 term 插件与 `?kbOff`/底锚/ALT_screen 逻辑（keybar 在 ALT 收起的行为保留）。

## 五、验收

- **超屏根治**：真机（尤其 Via）htop/ranger **占满可视区、不上滑、顶栏伸缩/键盘态都不超**；即使 `vv.height` 多报，卡身仍被钳在可视区内 → 不溢出。这是「物理裁剪」而不是「算对高度」，所以不再依赖 vv 数值准确。
- **A 档**：bottom-anchor 5/5 + scrollback 5/5 + keybar-click 19/19 不回退；npm 85 全绿。
- **默认全屏卡**：进页面一键全屏终端卡、无缩放/关闭钮、铺页面内容区。

## 六、备注

- 这是架构级改动（终端卡加卡身/硬裁剪），若 9.0 评估较大，可拆成独立小步（先给 term 卡加卡身+overflow:hidden，再并尺寸锚），避免与在途的真机收口项拌太多。
- TUI/ALT 模式与行模式两态的卡身/滚动策略（ALT=填满不滚、行模式=可回翻）需 9.0 明确，别回到「TUI 也能滚」的老问题。

——评审 · 2026-08-25
