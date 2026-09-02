# tmux-tabs v2.3a 真机渲染修复通报

**致**: amp / 评审 / 用户  
**发件**: nz 9.0 线  
**日期**: 2026-09-02  
**提交**: `d311bcb4`

## 用户真机反馈

1. **detach 后屏幕没有清掉 tmux 内容**：headless 文本断言通过了，但真机渲染截图显示 `[detached...]`、`tmux new-session...` 等残留仍在屏幕上。
2. **点屏幕有卡顿**：第一次点击只收起标签栏，终端/keybar 没有同步响应，需要再点一次。
3. 要求 **强制有一条验证路径必须贴近用户体验（真实渲染截图）**，并且每次汇报必须说明观测手段。

## 根因分析

### 清屏没生效

- 原 `TermShell.clear()` 只发 `ESC[2J ESC[H` 清当前屏幕，但 tmux 客户端退出后的输出（`[detached...]`、prompt）会立即重新覆盖。
- 更关键的是 nz 采用**单区底锚定**：当前屏幕和 scrollback 历史在同一个连续滚动区。tmux 残留内容进入 scrollback 后，即使当前屏清了，上滑仍能看见。
- 头less 测试只断言 `__kfmNzTermScreen()` 当前可见行，没覆盖 scrollback 和真实像素。

### 点击卡顿

- 原 backdrop 是 `pointer-events: auto`，覆盖整个屏幕，第一次点击被 backdrop 拦截，只触发收起；真正的 terminal/keybar 收不到事件。
- 用户需要第二次点击才能操作屏幕。

## 修复内容

### `src/client/term/shell.ts`

`TermShell.clear()` 升级为清屏+清 scrollback：

```ts
this.core.feed(this.enc.encode('\x1b[2J\x1b[3J\x1b[H'));
this.rowCache = this.rowCache.map(() => '');
this.historyDiv.textContent = '';
this.histCount = 0;
this.histEvicted = 0;
this.renderFrame();
```

- `ESC[2J` 清当前屏；`ESC[3J` 清 scrollback（rio-vt 支持）；`ESC[H` 光标归位。
- 同时清空历史区 DOM，避免上滑复现旧内容。

### `src/client/plugins/tmux-tabs/index.tsx`

- **backdrop**: `pointer-events: none`，不再拦截第一次点击。
- **收起逻辑**: 改到 `document.addEventListener('pointerdown', ..., { capture: true })` 捕获阶段。事件到达终端/keybar 之前先移除标签栏，用户第一次点击即同步操作屏幕。
- **leaveTmux 清屏**: 延长到 500ms 后再清屏（等 tmux 客户端退出），并加 300ms 二次兜底。

### `nz/AGENTS.md`

新增纪律：

- 第 6 条：每次验证必须明确说明**工具/命令、数据来源、判断标准**。
- 第 7 条：至少一条路径必须贴近用户真实体验（渲染截图 / 真机操作 / CDP 输入回放），不能全是 headless DOM 或服务端文本。

## 观测手段（本次全部明确列出）

| 路径 | 工具 | 数据来源 | 判断标准 |
|---|---|---|---|
| L1 自动化考卷 | `tests/browser/tmux-tabs.test.mjs` | Playwright 驱动 DOM + `__kfmNzTmuxTabs`/`__kfmNzTermScreen` 钩子 | 11 颗钉全部通过 |
| L2 服务端真值 | `tests/browser/tmux-tabs-l2-crosscheck.mjs` | `tmux ls -F '#{session_name} #{session_attached}'` | attach/detach 前后 attached=1/0 |
| L3 控制台钩子 | `tests/browser/tmux-tabs-l3-console-crosscheck.mjs` | `window.__kfmNzTermClear()` + `__kfmNzTermScreen()` | 清屏后探测文本消失、提示符仍在 |
| **L4 贴近用户体验** | `tests/browser/tmux-tabs-render-shot.mjs` | **Playwright `page.screenshot()` 真实渲染 PNG** | attach 后截图含 tmux 内容；detach 后截图不含 tmux 内容 |
| 回归 | bottom-anchor / scrollback / keybar-click / term-hooks / `npm test` | 既有考卷 | 零红 |

## 验证结果

- **L1 考卷 v7**: 11/11
- **L2 服务端互证**: 5/5
- **L3 控制台钩子**: 3/3
- **L4 渲染截图**: 6/6（attach/detached/screen-op 三张 PNG 落盘 `/tmp/nz-tmux-tabs-shots/`）
- **回归**: bottom-anchor 10/10、scrollback 5/5、keybar-click 20/20、term-hooks 6/6
- **npm test**: 104/0

## 截图证据

- `/tmp/nz-tmux-tabs-shots/01-attached.png`：attach 后屏幕含 `tmux new-session...` 和 prompt。
- `/tmp/nz-tmux-tabs-shots/02-detached-cleared.png`：detach 后屏幕干净，只剩底部 prompt。
- `/tmp/nz-tmux-tabs-shots/03-screen-op.png`：点终端后标签栏收起，屏幕正常。

## 待用户真机 C 档

刷新 nz 页面后验证：

1. attach 到某个 tmux 会话，产生一些输出；点聚焦标签 detach。
2. 屏幕应只剩干净 prompt，**上滑也不应看到 tmux 残留内容**。
3. 展开标签排，直接点击终端/keybar 的某个按键或滚动，标签栏应手气收起，且终端/keybar **第一次就响应**。
