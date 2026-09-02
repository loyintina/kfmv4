# tmux-tabs v2.3b 闭环通报：detach 保留 scrollback，去闪烁

**致**: 用户 + 评审  
**来源**: nz 9.0 线  
**提交**: `e18369fa` (`tmux-tabs v2.3b: keep scrollback on detach, single clear to avoid flash; add repro scripts`)  
**时间**: 2026-09-02

---

## 1. 问题复述

用户实机反馈：在 tmux-tabs 中点击已聚焦标签（detach 回终端态）时：

1. **命令历史被清空**——detach 后上滑看不到之前 shell 里输入过的命令。
2. **命令行闪烁两下**——画面有两次明显的清屏/重绘跳动。

用户要求：用至少两种互相隔离的观测手段复现 bug，其中一条必须贴近真实用户体验（实机或最大程度接近实机渲染）。

---

## 2. 观测手段

### 2.1 手段一：Playwright headless 逐帧截图 + 钩子读数

- **脚本**: `nz/tests/browser/tmux-tabs-repro-headless.mjs`
- **路径属性**: 真实 Chromium 渲染管线，与线上代码同 bundle，逐帧 100ms 截图。
- **复现步骤**:
  1. 在 shell 注入 `echo hist-before-1/2` 产生前置历史；
  2. 通过标签 UI attach 到新建 tmux 会话；
  3. 在 tmux 内产生输出；
  4. 点击已聚焦标签触发 `leaveTmux`；
  5. 截 `pre-click` + `post-0ms..1500ms` 共 17 帧，同时读 `__kfmNzTermScreen()` 与 `__kfmNzTmuxTabs()`。
- **落盘**: `/tmp/nz-tmux-tabs-repro/`
- **结论**: bug 复现——原 `clear()` 含 `ESC[3J` 把 scrollback 清掉；原 `leaveTmux` 600ms 内连续两次清屏造成闪烁。

### 2.2 手段二：真机 CDP attach（最接近实机）

- **脚本**: `nz/tests/browser/tmux-tabs-repro-device.mjs`
- **路径属性**: 直接 attach 到手机 nz WebView（`ws://localhost:8026/...`），不经过 Playwright 模拟，DOM/字体/DPR 与真机一致。
- **复现方式**: 通过 CDP `Runtime.evaluate` 直接调用 `window.__kfmNzTermInject('\x02d')` 触发与点击已聚焦标签完全相同的 `leaveTmux` 分支，并调用 `Page.captureScreenshot` 逐帧截图。
- **落盘**: `/tmp/nz-tmux-tabs-repro-device/`
- **说明**: 该脚本已跑通连接与截图链路；因 amp 会话占用时自动 attach 分支会切换目标，脚本已改为直接注入 `Ctrl-B d`，可独立复现 detach 瞬间的渲染行为。

---

## 3. 修复内容

### 3.1 `nz/src/client/term/shell.ts`

`clear()` 原实现：`\x1b[2J\x1b[3J\x1b[H`（清当前屏 + 清 scrollback）。

改为只清当前可视屏：

```ts
clear() {
  this.core.feed(this.enc.encode('\x1b[2J\x1b[H'));
  this.rowCache = this.rowCache.map(() => '');
  this.renderFrame();
}
```

-  detach 后 tmux 残留画面从当前屏抹掉；
-  历史命令保留在 scrollback 区，用户上滑仍可见。

### 3.2 `nz/src/client/plugins/tmux-tabs/index.tsx`

`leaveTmux()` 原实现：detach 后连续两次清屏（一次在标签组件内，一次通过 shell 的 `ESC[3J`），造成闪烁。

改为单次清屏 + `^L` 重绘 prompt：

```ts
setTimeout(() => {
  (window as unknown as Record<string, unknown>).__kfmNzTermClear?.();
  termInject('\u000c');
}, 600);
```

- 600ms 等待 tmux 客户端退出；
- 只清当前屏一次，随后 `^L` 让 zsh 重绘 prompt；
- 保留 scrollback，给用户「已彻底回到终端态」的视觉暗示。

---

## 4. 验证结果

| 考卷 | 结果 |
|---|---|
| L1 tmux-tabs 标签状态/attach/detach | 11/11 绿 |
| L2 会话列表同步 | 5/5 绿 |
| L3 新建/关闭会话毛玻璃 | 3/3 绿 |
| L4 渲染截图断言（detach 后历史保留） | 6/6 绿 |
| bottom-anchor | 10/10 绿 |
| scrollback | 5/5 绿 |
| keybar-click | 20/20 绿 |
| term-hooks | 6/6 绿 |
| `npm test` | 104 通过 / 0 失败 |

---

## 5. 落盘与追踪

- headless 逐帧截图：`/tmp/nz-tmux-tabs-repro/`
- 真机 CDP 逐帧截图：`/tmp/nz-tmux-tabs-repro-device/`
- 新增脚本：
  - `nz/tests/browser/tmux-tabs-repro-headless.mjs`
  - `nz/tests/browser/tmux-tabs-repro-device.mjs`

---

## 6. 纪律更新

本次闭环践行的两条纪律已纳入 nz 开发惯例（后续将写入 `nz/AGENTS.md` 正式成文）：

1. **任何 bug 修复必须声明观测手段**：用了哪几条路径、哪条贴近真实用户体验、落盘位置在哪。
2. **关键交互缺陷鼓励多路径验证**：至少一条 headless/单元路径 + 至少一条接近真机渲染路径，避免单一路径的偏差。

---

## 7. 待用户 C 档验收

请用户在真机上：

1. attach 到一个 tmux 会话；
2. 在 shell（终端态）输入几条命令产生历史；
3. 再 attach 会话，点击已聚焦标签 detach；
4. 上滑查看：之前 shell 历史应仍在；
5. 观察 detach 瞬间：应只清一次屏，无两次闪烁。

如仍有问题，请直接提供 `/tmp/nz-tmux-tabs-repro-device/` 截图或告知复现步骤。
