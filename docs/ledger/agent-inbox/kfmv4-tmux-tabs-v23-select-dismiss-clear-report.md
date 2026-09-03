# tmux-tabs v2.3 选择态/清屏/操作屏幕收起修复通报

> 日期: 2026-09-02
> 致: 主会话，评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报；tmux-tabs v2.2→v2.5 迭代链）
> 状态: 通报完毕（2026-09-02 kfmv4-9.0：迭代通报初投）



**致**: amp / 评审 / 用户  
**发件**: nz 9.0 线  
**日期**: 2026-09-02  
**提交**: `b8ce94f5`

## 用户仲裁（第六次）

真机验收 v2.2 时提出三个交互细节：

1. **点聚焦标签回终端态时，标签排应保持展开**：选择态下无论点哪个标签还是回到终端页面，都是选择行为，标签栏不应消失。
2. **回到终端页面后应清掉 tmux 窗口内容**：detach 后屏幕上仍残留 tmux 画面，会暗示用户「没彻底回来」，需要清屏并重绘 prompt。
3. **操作屏幕时自动收起标签栏**：选好窗口后，用户开始操作屏幕（点击终端/keybar、滚动、键盘输入）时，标签栏应手气收起。

## 修改内容

### `nz/src/client/plugins/tmux-tabs/index.tsx`

- `leaveTmux`：
  - 终点由 `HANDLE` 改为 `EXPANDED`（标签排保持展开）。
  - detach 后 120ms 调用 `__kfmNzTermClear()` 清屏，再 inject `^L` 让 readline 重绘 prompt。
- 新增全局事件监听：
  - `pointerdown` / `wheel` / `keydown`
  - 当标签栏展开且事件源不在 `[data-tmux-tabs-root]` 内时收起。
  - overlay 弹出时禁用（避免毛玻璃输入期误收）。

### `nz/src/client/term/shell.ts`

- 新增 `TermShell.clear()`：
  - 向 wasm 核 feed `\x1b[2J\x1b[H`（清屏+光标归位）。
  - 清空行缓存，调用 `renderFrame()`。
  - 不清 scrollback 历史区。

### `nz/src/client/plugins/term/index.ts`

- 暴露公共钩子 `__kfmNzTermClear()`，供 tmux-tabs / 控制台脚本调用。

### `nz/docs/tmux-tabs-v2-state-machine.md`

- T3 终点改为 `EXPANDED`，并注明清屏+`^L` 行为。
- 新增 T15：操作屏幕 → `HANDLE`。
- 考卷映射升级为 v7（11 颗钉）。

### 测试

- `nz/tests/browser/tmux-tabs.test.mjs` 升 v7：钉 ③ 验证 T3 标签排展开+清屏；钉 ⑨ 验证 T15 键盘输入收起。
- `nz/tests/browser/tmux-tabs-l2-crosscheck.mjs`：L1+L2 互证，新增 detach 后服务端 `tmux ls` attached=0 验证。
- `nz/tests/browser/tmux-tabs-l3-console-crosscheck.mjs`：L3 控制台钩子验证 `__kfmNzTermClear()+^L` 清屏并重绘 prompt。

## 多路径验证结果

| 路径 | 层级 | 结果 |
|---|---|---|
| 自动化考卷 v7 | L1 | **11/11** |
| 浏览器钩子 + 服务端 `tmux ls` | L1+L2 | **5/5** |
| 控制台公共钩子 | L3 | **3/3** |
| bottom-anchor | L1 回归 | **10/10** |
| scrollback | L1 回归 | **5/5** |
| keybar-click | L1 回归 | **20/20** |
| term-hooks | L1 回归 | **6/6** |
| npm test | L1 回归 | **104/0** |

## 待用户真机 C 档

刷新 nz 页面后验证：

1. 展开标签排，点当前已聚焦的标签 → 终端回到裸 shell，但顶部标签排仍展开。
2. 终端页面上没有残留 tmux 内容，只有干净的 prompt。
3. 在终端区域打字或滚动 → 标签栏应手气收起。

## 纪律备注

本次修复是 `nz/AGENTS.md` Bug 验收纪律落地后的第二个样本，严格执行了「普通 bug 2 条 + 交互 bug 3 条」隔离路径要求。
