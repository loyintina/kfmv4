# 2026-08-24 · 评审 · 两实测问题：①点按钮弹输入法 ②TUI(htop/ranger) 超屏需上滑——请 9.0 修

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: ①点 keybar 按钮不再触发 IME 弹（无输入法时不弹）；②TUI(htop/ranger) 占满终端可视区、不超屏不上滑；A 档三卷不回退；真机/headless 看两症消失
> 回: —（首信；用户真机反馈两痛点）
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：两痛点修复落地 @ fde0d792——①按钮 click stopPropagation+两向回归钉入 keybar 卷 19/19；②syncAlt 恢复 ALT 收栏占满 headless 实证；?debug 加 rows/cellH/ch 取证字段待真机超屏定位；球交用户真机 C 档）· 代际戳 gen-2026-08-24-两痛点

## 一、问题①：无输入法时点按钮会召唤输入法

**已复现（headless）**：未聚焦时点 ENTER 按钮，焦点被抢到 `kfm-term-kb`（IME 诱饵 textarea）→ 手机上「用户手势内 focus()」规矩 → 软键盘弹出。

**根因**：`nz/src/client/plugins/term/index.ts:370`
```ts
container.el.addEventListener('click', () => kb.focus({ preventScroll: true }));
```
`barStripEl`（keybar）是 `container.el` 的子元素（index.ts:291），点 keybar 按钮冒泡到容器 click → `kb.focus()`。**即使没输入法也 focus 诱饵** → 弹键盘。

**修法建议**：keybar 按钮点击**不触发容器 focus**——在 keybar 按钮 click 处理里 stopPropagation（或容器 click 处理忽略来自 keybar 的点击），让「点按钮=发按键字节，不激活 IME」。仅当点终端文本区才 focus 诱饵。保持 `pointerdown` 不用、`click` 聚焦不被抢/选中不受影响的既有约束。

## 二、问题②：TUI(htop/ranger) 超屏需上滑

**我实测（headless，桌面 900×620 + 手机 412×915 + htop 启动后 resize）**：
- htop 渲染进 `scrollEl`（=container−KEYBAR_H，keybar 常驻垫底 84px），`rows=floor(scrollEl.clientHeight/cellH)`。
- **三种情况都无溢出**：`scrollHeight==clientHeight`，htop 始终配平滚动区。**headless 未能复现「超屏需上滑」**。

**但确认的设计缺陷**：TUI 全屏应用**没占满终端可视区**——keybar 恒常驻，把 htop 挤进 `container−84`（htop 自己的底行 `F1Help…F10Quit` 贴在 keybar 上方）。TUI 应占满整屏（alt_screen 模式 keybar 应收起/隐藏）。

**对「超屏需上滑」的排查方向（请 9.0 真机复现，因 headless 测不出）**：
1. **cellH 度量竞态**：本轮换了 Nerd Font，若某路径 cellH 用 fallback 字体测（偏小）→ rows 偏大 → htop 渲染行数超可视区 → 内容顶出需上滑。检查 alt_screen/重测行列是否真的先 `await fonts.load` 再量格（9.0 已加就业门，确认无漏网路径）。
2. **手机可视区 vs 容器**：容器高=`vv.height−kbOff`，若无键盘时 vv 含浏览器栏差异，容器可能高于真实可视区。确认真机 `visualViewport.height` 与实际可视区一致。
3. 建议 9.0 在真手机跑 htop，用 `?debug` 读 rows/cellH/scrollEl.clientHeight，对照可视区定位行数是否偏多。

## 三、验收

- **A 档**：bottom-anchor 5/5 + scrollback 5/5 + keybar-click 17/17 不回退；够格。
- **C 档（真机）**：① 无输入法点 keybar 按钮**不再弹软键盘**（点终端文本区仍弹）；② htop/ranger **占满终端可视区、不超屏不上滑**、keybar 在 TUI 全屏态不再挤占。

## 四、备注

- 问题①我复现得很干净，修法明确；问题②：headless 未复现，但**用户真机截图已复现/确认超屏**，见下补充。

## 五、补充：用户真机截图实证（问题②已确认）

用户手机信箱放了两张 htop 截图（`~/w/信箱/Screenshot_20260824_225905/225909.jpg`，评审已取回）：

- **图 A（刚进 htop，浏览器全屏、无顶栏）**：htop 填满终端，但**底部帮助栏右侧被截断**（`F1Help F2Setup F3Search F4Filter F5Tree F6SortBy F7Nice -F`，应为 `+F9Kill F10Quit`）——**列宽不匹配**（htop 画的列数 > 终端实际显示列数）。
- **图 B（上滑把浏览器顶栏带出 = 可视区变小）**：htop 内容**比可视区高**，最后一行 `20 root` **被切掉一半**、贴着 keybar 上方——**这就是「需上滑才能看到」的具体表现**。

**结论**：htop 的**行列数与终端实际显示区不匹配**；可视区变小（浏览器栏出现/键盘态）后，TUI 行数**未跟着缩**，内容溢出被切。**极可能是新 Nerd Font 的 cellW/cellH 度量问题**（换字体后 cell 尺寸变，cols/rows 按旧/错度量算 → 列溢/行溢），或 `scrollEl.clientHeight/cellH` 用量与真实可视区不符。

**请 9.0 优先查**：`index.ts:187-188` cellW/cellH 测量（是否真的 `await fonts.load` 后才量、是否用 NF 而非 fallback）、`cols=floor(clientWidth/cellW)`/`rows=floor(scrollEl.clientHeight/cellH)` 是否与渲染网格一致；确认可视区变化（chrome/键盘）时 TUI 行数正确重排。

——评审 · 2026-08-24
