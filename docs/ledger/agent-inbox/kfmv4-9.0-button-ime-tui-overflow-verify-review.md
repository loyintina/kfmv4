# 2026-08-24 · 评审 · 两痛点修复复核通过：点按钮不再唤 IME + TUI 收栏占满（实证实测），交用户真机 C 档

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在用户真机 C 档）
> 收敛判据: 无需回信；用户真机 C 档（四单并验：点按钮不弹键盘【无输入法场景】+ htop/ranger 占满不超屏；若仍超屏带 `?debug` 跑 htop 收 rows/cellH/ch 数字回评审）
> 回: kfmv4-9.0-button-ime-tui-overflow-response.md（两痛点修复落地 @ fde0d792，keybar 19/19 含新钉，htop headless 占满）
> 回函通知: psh
> 状态: 已核（2026-08-24 评审：①点按钮不唤 IME（keybar 19/19 两向新钉）+②TUI 收栏占满（headless htop=vh、keybar 隐藏、F1-F10 贴底）均实测通过；npm85+三卷全绿；待用户真机 C 档）

## 一、问题①：点按钮不再唤 IME——复核通过

- 修法（你定的 stopPropagation 自闭环）正确：`keybar.ts` 按钮 `click → stopPropagation`，点按钮=发字节不激活 IME；容器 click 聚焦通路不动（点文本区仍弹键盘）。
- **亲跑 keybar-click 19/19**，含你新加的两向钉（均绿）：
  - 失焦点点 ENTER → activeElement=**BODY**（不落诱饵，不弹键盘）✅
  - 点 `.nz-term` 文本区 → activeElement=**kfm-term-kb**（聚焦通路未堵死）✅
- 卷子改动明示收到，无异议。

## 二、问题②：TUI 收栏占满——复核通过

- `syncAlt` 恢复帧后翻转（ALT_SCREEN → keybar `display:none` + scrollEl 占满容器底；行模式翻回），`scheduleResize` 抽出共用（onViewportResize 防抖重测块复用）——TUI 适配新尺寸=真终端窗口变更语义。
- **亲跑守视（手机视口 412×915 + htop）**：
  - `scrollEl.bottom=915=vh`（**占满整屏**）、keybar 父容器 `display:none`（**隐藏**）、`scrollHeight==clientHeight==915`（无溢出、无需上滑）。
  - 截图人审：htop 红绿 CPU 条 + PID 表占满全屏，`F1Help…F10` 底栏**贴屏幕最底**，无 keybar 挤占。**超屏/挤占根治。**
  - （底栏右侧 `F7…` 截断=窄屏 htop 正常截断行为，非缺陷。）

## 三、cellH 竞态排除 + ?debug 取证字段

- 你排除 cellH 竞态合理：CSS `line-height:1.25` 是相对字号固定值（16.25px），与字体文件无关；NF 切换影响 cellW 不 cellH；字体就绪门后 probe/壳同栈同步量。**采纳此结论。**
- 真机「超屏」嫌疑集中到 vv 可视区差（合理），`?debug` 已加 `rows/cols/cellH/cellW/ch` 随视口上报——按你建议，真机如仍超屏，带 `?debug` 跑 htop 收数字定位（字段随症收口，与 IME 专症字段同款纪律）。

## 四、回归

npm test **85 全过** + smoke + build + typecheck 全绿；bottom-anchor 5/5 + scrollback 5/5 不回退。

## 五、结论与下一步

两修复落地正确、实测通过、无回归。**球交用户真机 C 档（四单并验）**：点按钮不弹键盘（无输入法场景）+ htop/ranger 占满不超屏。若真机仍超屏，带 `?debug` 复现一次把 `rows/cellH/ch` 数字回评审，定向定位收口。

——评审 · 2026-08-24
