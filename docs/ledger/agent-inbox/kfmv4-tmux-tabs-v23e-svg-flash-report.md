# tmux-tabs v2.3e 闭环通报：svg 把手闪烁真因 + 第一次 attach 延迟定位

**致**: 用户 + 评审  
**来源**: nz 9.0 线  
**提交**: `106204c5` (`tmux-tabs v2.3e: 修复 svg 把手误触发外部点击导致闪烁；新增延迟观测脚本族`)  
**时间**: 2026-09-02

---

## 1. 问题复述

用户反馈：

1. **把手点击闪烁依然存在**：点击把手展开标签栏后，大概率会闪一下（展开→瞬间收起→又展开）。
2. **第一次点击会话仍有延迟**：切换会话已经是瞬间，但从终端态第一次 attach 进某个会话仍有可感知的延迟。

---

## 2. 把手闪烁真因与修复

### 真因

`document` 在 `pointerdown` 捕获阶段注册了「点击标签栏外部 = 收起标签栏」的监听器。判断是否在标签栏内部的代码是：

```ts
!!(target instanceof HTMLElement && target.closest('[data-tmux-tabs-root]'))
```

但把手图标内部是 **svg** 元素（`SVGElement`），不是 `HTMLElement`。点击 svg 时，`target instanceof HTMLElement` 为 `false`，`inside` 被误判为 `false`，于是 document 捕获阶段触发了 dismiss（收起）；随后 click 阶段把手 div 的 `onClick` 又把栏展开——这就是用户看到的闪烁。

### 观测证据

脚本 `tests/browser/tmux-tabs-handle-debug.mjs` 注入事件日志，真实点击把手时记录到：

```json
{ "phase": "capture", "type": "pointerdown", "target": "svg", "inside": false }
```

修复前 `inside=false`，修复后 `inside=true`。

### 修复

把判定改为 `Element` 父类，覆盖 HTMLElement + SVGElement：

```ts
const isInsideTabs = (target: EventTarget | null): boolean =>
  !!(target instanceof Element && target.closest('[data-tmux-tabs-root]'));
```

---

## 3. 第一次 attach 延迟定位

### 测量结果

用新增脚本族分别测量：

| 场景 | 本地 attached 翻转 | 屏幕 tmux 状态行出现 |
|---|---|---|
| 第一次 attach 已存在会话 | **53 ms** | **106 ms** |
| 新建会话并 attach | **66 ms** | **120 ms** |
| 切换已 attach 会话（轮询优化后） | 64-110 ms | 94-162 ms |

### 结论

- UI 本地响应（标签高亮切换）已经在 **50-70 ms** 内完成；
- 屏幕出现 tmux 内容需要额外 **50-100 ms**，这是 tmux 客户端启动/attach 的固有延迟，不是 UI 能压缩的；
- 用户感知的「第一次点击慢」主要是 tmux 客户端启动时间，UI 层面已无法进一步优化。

如果用户对这 100ms 级别的延迟仍不满意，后续需要考虑的就不是 UI 层优化，而是：
- 预启动 tmux 客户端；
- 或改变 attach 方式（比如复用已运行的客户端）。

---

## 4. 验证结果

| 考卷 | 结果 |
|---|---|
| L1 tmux-tabs 状态/attach/detach | 11/11 绿 |
| L2 服务端交叉验证 | 5/5 绿 |
| L3 清屏重绘 | 3/3 绿 |
| L4 渲染截图断言 | 6/6 绿 |
| bottom-anchor | 10/10 绿 |
| scrollback | 5/5 绿 |
| keybar-click | 20/20 绿 |
| term-hooks | 6/6 绿 |
| `npm test` | 104 通过 / 0 失败 |

---

## 5. 新增观测脚本

| 脚本 | 用途 |
|---|---|
| `tests/browser/tmux-tabs-handle-debug.mjs` | 注入事件日志，观测把手点击的 target/inside 判定 |
| `tests/browser/tmux-tabs-handle-flash-repro.mjs` | 反复点击把手，检测 EXPANDED/HANDLE 回弹 |
| `tests/browser/tmux-tabs-first-attach-latency.mjs` | 测量第一次 attach 已存在会话的延迟 |
| `tests/browser/tmux-tabs-new-session-latency.mjs` | 测量新建会话并 attach 的延迟 |
| `tests/browser/tmux-tabs-expand-latency.mjs` | 测量把手展开延迟 |

---

## 6. 待用户 C 档验收

请在真机上：

1. 反复点击左上角把手图标（尤其点图标正中央，也就是 svg 区域），观察是否还有闪烁。
2. 从终端态点击一个会话标签 attach，感受延迟是否可接受；UI 高亮会在点击后 50-70ms 内切换，完整 tmux 画面约 100-150ms 后出现。

如果第一次 attach 仍觉得慢，那瓶颈在 tmux 客户端启动，需要另开议题讨论预启动或复用客户端方案。
