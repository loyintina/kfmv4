# 标准 · 8.8.3c scrollback 历史上滑（跟底判定/输入回底/渲染/截断）——A 档考题先行

> 类型：测试标准（考题先行）。日期 2026-08-24。
> 归属：nz(9.0) 8.8.3c；方法库「真实交互可测性」再一例。
> 现状：**RED**（8.8.3c 未实现 scrollback/跟底）。9.0 实现后转绿。
> 载体：`nz/tests/browser/scrollback.test.mjs`（A 档 E2E）。

## 一、目标（用户拍板）

随手上滑翻历史=基础体验，9.0 不得比 8.x 倒退；tmux copy-mode 不作替代。三个关键交互纪律：
**跟底判定 / 输入即回底 / IME 兼容（合成中不滚焦、落字才回底）**。

## 二、判卷分档

| 档 | 内容 | 方法 |
|---|---|---|
| A | 历史渲染+翻页 / 跟底两态 / 输入回底 / 截断 | 浏览器 E2E（`scrollback.test.mjs`）+ 核/壳纯逻辑考题（状态翻转函数） |
| B | 千行长输出冒烟 | 灌 1000+ 行，不崩、scrollback 可用 |
| C | 上滑手感 / 跟底视觉 / IME 兼容 | 真机上滑实拍 + 数字收口 |

## 三、钩子契约（9.0 必须暴露，测试靠它读）

```js
window.__kfmNzTermScroll() → { scrollTop, scrollHeight, clientHeight, isAtBottom }
window.__kfmNzTermScroll().getContainer() → 可滚动容器（overflow:auto）
gridText = 终端可见文本（上滑后应显示历史行）
```
`isAtBottom`（视口是否在底）是**跟底判定**的机器可读核心——9.0 要暴露，否则标准测不了。

## 四、A 档断言（全绿才算过；RED=未实现）

1. **历史渲染 + 翻页**：灌 N 行（N>屏幕行数）→ 上滑 → 可见行显示**历史**（非当前屏）+ 容器 `scrollHeight>clientHeight`（真可滚）。
2. **跟底判定（两态，最容易翻车）**：
   - **(a) 在底 + 新输出 → 保持底**（跟随）；
   - **(b) 上滑离开底 + 新输出 → 不被拽回**（scrollTop 停在上滑处 ≪ max）。
3. **输入即回底**：上滑后打字 → 视口回底（`isAtBottom=true`）。
4. **截断**：超缓冲 → 最旧行丢弃、不崩、上滑仍看次旧。

## 五、9.0 如何保证一遍过（实现纪律=状态机）

逻辑**集中成一个状态机**（别散写、别裸 scroll）：

```
isAtBottom = true（初始）
· PTY 新输出：仅 isAtBottom 才跟底（scrollTop→底）；false 不滚（尊重上滑）
· 用户滚到底（scrollTop≈max）：isAtBottom=true
· 用户上滑（scrollTop<max）：isAtBottom=false
· 输入（打字/按键）：isAtBottom=true + 立即 scrollToBottom（输入回底）
· IME：合成中上滑不回底，compositionend 落字才回底（防滚焦）
```
**散写必翻车**（跟底/回底最容易漏一个状态——kfmv4 键盘"Ctrl 联动不上"的病根就是映射散写没人判卷）。A 档断言正是盯这几个状态翻转。

## 六、流转

1. 本标准 RED → 给 9.0 当验收契约；
2. 9.0 按⑤状态机实现 + 暴露③钩子 → 跑标准 → **绿=跟底/回底/渲染/截断全对**；
3. B/C 档随落地验证（千行冒烟 + 真机上滑实拍/数字收口）。
