# tmux-tabs v2.3d 闭环通报：把手闪烁 + 切换延迟优化

> 日期: 2026-09-02
> 致: 主会话，评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报；tmux-tabs v2.2→v2.5 迭代链）
> 状态: 通报完毕（2026-09-02 kfmv4-9.0：迭代通报初投）



**致**: 用户 + 评审  
**来源**: nz 9.0 线  
**提交**: `c993eeee` (`tmux-tabs v2.3d: 把手捕获阶段止冒泡去闪烁；detach 完成轮询降切换延迟`)  
**时间**: 2026-09-02

---

## 1. 问题复述

用户反馈两个新 bug：

1. **把手按钮概率性闪烁**：点击把手展开标签栏，再点击收起，但有大概率收起后马上又展开，标签栏「闪一下」。
2. **切换会话标签仍有 0.5-0.7 秒延迟**：虽然 attach/detach 本身已即时，但切换会话不够跟手。

---

## 2. 把手闪烁根因与修复

### 根因

`TmuxTabs` 在 document 的 `pointerdown` 捕获阶段注册了「点击标签栏外部 = 收起标签栏」的监听器。把手按钮的 `onClick` 只阻止了冒泡阶段，没阻止捕获阶段。

点击收起态把手时：
1. `onClick` 把 `expanded` 设为 true，DOM 切换为展开态；
2. 同一 `pointerdown` 事件继续进入捕获阶段，document 监听器执行；
3. 此时 `expandedRef.current` 已被更新为 true，监听器判定「当前在展开态且点击了标签栏外部」，又把 `expanded` 设回 false。

展开 → 瞬间收起 = 用户看到的「闪烁」。时序受 React 调度影响，所以是概率性。

### 修复

给收起态/展开态两个把手按钮都加 `onPointerDown={(e) => e.stopPropagation()}`，在捕获阶段就截断事件，不让 document 监听器二次处理。

```tsx
const collapsedOrb = createElement('div', {
  'data-tmux-tabs': 'HANDLE', 'data-tmux-orb': '1',
  onClick: (e) => { e.stopPropagation(); onExpand(true); },
  onPointerDown: (e) => { e.stopPropagation(); },
  ...
});
```

---

## 3. 切换延迟根因与修复

### 根因

`enterSession` 在已 attach 其他会话时，走 T2s 路径：先 `Ctrl-B d` detach，再固定等待 **350ms** 后才 attach。这个 350ms 是用户感知「0.5-0.7s 延迟」的主要来源——实际 tmux 客户端通常 80-150ms 就已完成 detach。

### 修复

改为轮询检测 detach 完成：发送 `Ctrl-B d` 后，每 50ms 读一次 `__kfmNzTermScreen()`，当屏幕出现 `detached (from session <prev>)` 时立即 attach；上限 600ms 兜底，最坏情况不比原来差。

```ts
const prev = attachedRef.current;
termInject('\u0002d');
setAttached(null);
refreshRuntime();
const screen = () => __kfmNzTermScreen?.() || '';
let attempts = 0;
const timer = setInterval(() => {
  attempts++;
  if (screen().includes(`detached (from session ${prev})`) || attempts > 12) {
    clearInterval(timer);
    attach();
  }
}, 50);
```

---

## 4. 观测与测量

### 4.1 把手闪烁

- **复现方式**: 在 `nz/tests/browser/tmux-tabs.test.mjs` 的 T1/T14 反复展开/收起路径中，原有实现偶发 `state=EXPANDED→HANDLE→EXPANDED` 一帧回弹。
- **修复后**: L1 考卷 11/11、L4 截图考卷 6/6 连续展开/收起无回弹。

### 4.2 切换延迟

- **脚本**: `nz/tests/browser/tmux-tabs-switch-latency.mjs`
- **方法**: Playwright headless，从点击会话标签开始计时，分别记录：
  - 本地 `attachedSession` 翻转时间（UI 聚焦切换）
  - 屏幕出现新会话 tmux 状态行时间（终端内容切换）

**修复前**（固定 350ms）：

| 操作 | 本地翻转 | 屏幕状态行 |
|---|---|---|
| 新建并 attach B | 407 ms | 516 ms |
| 切换回 A | 366 ms | 417 ms |

**修复后**（轮询 detach）：

| 操作 | 本地翻转 | 屏幕状态行 |
|---|---|---|
| 新建并 attach B | 110 ms | 162 ms |
| 切换回 A | 64 ms | 112 ms |

切换延迟从 ~500ms 降到 ~100ms。

---

## 5. 验证结果

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

## 6. 待用户 C 档验收

请在真机上：

1. 反复点击左上角把手（展开 → 收起 → 展开），观察是否还有「闪一下又收起」的现象。
2. 在已 attach 会话 A 时，点标签切换到会话 B，感受是否还有明显卡顿；理想应在 150ms 内完成视觉切换。

如仍有问题，请告知复现节奏（比如快速连点 vs 慢点）。
