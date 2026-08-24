# 2026-08-24 · 9.0 · 两痛点落地回函：①点按钮不弹 IME（19/19 含钉）②TUI 收栏占满（headless 实证）

> 日期: 2026-08-24
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核两修复+新钉；真机「超屏需上滑」?debug 取证后定位；球交用户真机 C 档
> 回: kfmv4-9.0-button-ime-tui-overflow-review.md
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：两痛点修复落地 @ fde0d792，三考卷不回退 keybar 19/19 含新钉，htop headless 实证收栏占满；真机超屏待 ?debug 取证）

## 一、问题①：点按钮弹输入法——已修（根因与你一致）

- 根因确认：按钮 `pointerdown` 的 `preventDefault` 拦不住 `click` 派发（实测穿透），click 冒泡到容器 → `kb.focus()` → 弹键盘。
- 修法（采纳你的建议方向，落在模块内自闭环）：`keybar.ts` 按钮加 `click → stopPropagation`——点按钮=发按键字节不激活 IME；容器 click 聚焦逻辑不动（点终端文本区仍弹键盘）。
- **回归钉两向入 keybar-click 卷**（我动了卷子加断言，明示）：失焦状态点 ENTER → 焦点不落诱饵（activeElement=BODY）；点 `.nz-term` 文本区 → 焦点落诱饵（聚焦通路未堵死）。**19/19 绿**。

## 二、问题②：TUI 挤占——确定缺陷已修；超屏待真机取证

- **挤占修复**：恢复 `syncAlt` 帧后翻转（ALT_SCREEN ↔ 行模式）：ALT→按键栏 `display:none` + `scrollEl` 占满容器底；行模式翻回放回。高度变化走 `scheduleResize`（把 onViewportResize 的防抖重测块抽出共用）→ 核/壳/PTY 三方 resize，TUI 适配=真终端窗口变更语义。
- **headless 实证**：htop 运行中 keybar `display:none`、`scrollEl.bottom=620=vh`（占满整屏）、F1-F10 底栏贴屏底（截图人审）；`q` 退出 keybar 恢复 `block`。
- **真机「超屏需上滑」**：headless 未复现（与你一致）。补一条分析：cellH 竞态方向可基本排除——CSS `line-height:1.25` 是相对字号的固定值（16.25px），与字体文件无关，NF 切换影响 cellW 不影响 cellH；且字体就绪门后 probe/壳同栈同步量。嫌疑集中到**真机 vv 可视区差**。已按你三方向加 `?debug` 专症字段：`rows/cols/cellH/cellW/ch`（scrollEl.clientHeight）随视口事件上报——请用户真机带 `?debug` 跑 htop 复现超屏，收数字后定位（字段随症收口）。

## 三、验证数字

- npm 85 + smoke + build + typecheck 全绿。
- 三考卷不回退：bottom-anchor 5/5 + scrollback 5/5 + keybar-click **19/19**（含①两向新钉）。

## 四、待办

- 评审复核（①修法+新钉、②syncAlt 恢复+scheduleResize 复用）。
- 用户真机 C 档（四单并验）：点按钮不弹键盘（无输入法场景）、htop/ranger 占满不超屏——若仍超屏，带 `?debug` 复现一次，把 rows/cellH/ch 数字回我。

——9.0 · 2026-08-24
