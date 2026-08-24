# 2026-08-24 · 评审 · 8.8.3c scrollback 验收契约（考题先行，RED→实现→绿=过）

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 实现 scrollback + 暴露钩子 + 按状态机纪律，让 scrollback.test.mjs 4 断言全绿
> 回: 8.8.3b 收口（keybar 上浮，96b53728）+ 下一小步 8.8.3c
> 回函通知: psh
> 状态: 待实现（2026-08-24 评审：8.8.3c 开工，本信=验收契约）

## 一、用户已拍板开工 8.8.3c（scrollback 历史上滑）

随手上滑翻历史=基础体验，不得比 8.x 倒退；tmux copy-mode 不作替代。三纪律：**跟底判定 / 输入回底 / IME 兼容（合成中不滚焦、落字才回底）**。

## 二、验收契约（考题先行，我已在库）

- **A 档 E2E**：`nz/tests/browser/scrollback.test.mjs`，4 断言（RED 现状）；
- **标准文档**：`docs/ledger/test-methods/standard-scrollback-8.8.3c.md`（分档 + 钩子契约 + 状态机纪律）。

**9.0 实现 → 跑这脚本 4 断言全绿 = 一遍过。** 判据就按这个，不是口头"能滚"。

## 三、钩子契约（必须暴露，否则标准测不了）

```js
window.__kfmNzTermScroll() → { scrollTop, scrollHeight, clientHeight, isAtBottom }
window.__kfmNzTermScroll().getContainer() → 可滚动容器（overflow:auto）
```
`isAtBottom`（视口是否在底）= 跟底判定的机器可读核心。**必须暴露。**

## 四、实现纪律（9.0 照此，别散写）

集中成一个状态机：

```
isAtBottom = true（初始）
· PTY 新输出：仅 isAtBottom 才跟底（scrollTop→底）；false 不滚（尊重上滑）
· 用户滚到底：isAtBottom=true；上滑：isAtBottom=false
· 输入（打字/按键）：isAtBottom=true + 立即 scrollToBottom（输入回底）
· IME：合成中上滑不回底，compositionend 落字才回底（防滚焦）
```

**散写必翻车**（跟底/回底最容易漏一态，kfmv4 键盘"Ctrl 联动不上"病根同源）。

## 五、4 断言（scrollback.test.mjs）

1. 历史渲染+翻页（灌 N 行>屏幕，上滑见历史行 + scrollHeight>clientHeight）；
2. 跟底两态：(a)在底+新输出→保持底 (b)上滑+新输出→不拽回；
3. 打字→输入回底（isAtBottom=true）；
4. 截断（超缓冲丢最旧行不崩）。

## 六、B/C 档随落地

B：千行长输出冒烟（1000+ 行不崩）；C：真机上滑实拍 + 数字收口（跟底/回底/IME 兼容视觉确认）。

## 备注

案例考法：**先把"跟底/回底"做成机器可测（isAtBottom 钩子），再让 9.0 按状态机实现**——standard 就是防"口头能滚、实际拽回"这种翻车。9.0 实现完跑 A 档全绿 + 回函按代字塞通知，评审复核后 B/C 收口。
