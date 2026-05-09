# 动画系统优化方案

> 写于 2026-05-09，基于对当前动画体系问题的排查与设计讨论。

---

## 一、问题诊断

### 当前问题症状

多层嵌套文件夹展开时：
1. 第一层：盒子展开 + 字符雨正常
2. 第二层：盒子展开，**字符下落一半**（被打断）
3. 第三层及更深：只有盒子展开，**完全无字符雨**
4. 卡顿一阵后文字瞬移出现
5. 最后第一层才播放字符雨

### 根因

重构（`08f6eae` 和 `66618fa`）时，用 `_flattenExpandTree` + 单次 `ts.call` 替代了递归的 `_unveilOverlaySubContainers`。子容器的 `animateCharRain` 被完全丢掉了，只对顶层容器做了字符雨。

### 原始设计的优点

原始的 `_unveilOverlaySubContainers` 是递归的——每层盒子展开后触发该层的字符雨，再递归处理子层。视觉效果符合"盒子链条 + 每层字符雨"的构想。但它是 **async 递归 + 串行**，速度慢。

### 当前设计的优点

`_flattenExpandTree` 把所有层级的 overlay 并行搭建到一条 GSAP timeline 上，按 `level * 0.06s` staggered delay 交错。速度快、可中断性强（一个 `ts.clear()` 搞定）。

---

## 二、目标效果

层次化的盒子展开链条 + 每层独立的字符散落雨。

```
t=0:       盒子[顶层]弹出 (0.05s)
t=0+:      字符[顶层]开始散落 (0.35s)     ←←←←←←←←←←←←←←←←←
t=0.06:    盒子[子层1]弹出 (0.05s)
t=0.06+:   字符[子层1]开始散落 (0.35s)     ←←←←←←←←←←←←←←←←←
t=0.12:    盒子[子层2]弹出 (0.05s)
t=0.12+:   字符[子层2]开始散落 (0.35s)     ←←←←←←←←←←←←←←←←←
...
t=max+ε:   cleanup（清理所有 overlay）
```

每 0.06s 一波新字符开始下落，上一波的 0.35s 还在流淌。视觉得是多层瀑布重叠。

---

## 三、核心设计：单条时间线

### 所有动画在一条 `ts` timeline 上

把字符雨 tween 从独立的 `anim.timeline()` **直接挂到 `ts` scope 上**：

```
ts timeline（唯一的时间线）:
├─ t=0:    overlay[顶层]  height 0→full
├─ t=0:    char[顶层] 位置/透明度动画     ← 直接 ts.to()
├─ t=0.06: overlay[子层1]  height 0→full
├─ t=0.06: char[子层1] 位置/透明度动画
├─ t=0.12: overlay[子层2]  height 0→full
├─ t=0.12: char[子层2] 位置/透明度动画
├─ ...
└─ t=max:  ts.call(cleanup) 清理 overlay
```

**这样 `ts.reverse()` 就能逆转整个展开过程——盒子缩回、字符往回飞。无需额外逻辑。**

### 改动：`char-rain.ts` 不再使用独立 timeline

`animateCharRain` 接受 `ts` 作为参数，直接把字符 tween 加到 `ts` 上：

```typescript
// 改前
const tl = anim.timeline({ onComplete: resolve });
tl.to(charBox, { x, y, opacity }, delay);

// 改后
ts.to(charBox, { x, y, opacity }, overallDelay + randomDelay);
```

不需要 `await`，不需要 `resolve`，不需要单独的 `onComplete`。字符 tween 就在 `ts` 上，和 overlay tween 并排。

---

## 四、交互规则（三句核心）

### 规则 1：动画进行中，同路径再次点击 → state 先变 + reverse

```
用户点展开 a → a 动画播放中
用户再点 a（同路径）
  → KFMState.setExpanded(path, !当前状态)（瞬间）
  → rebuildTree()（新状态的终端树）
  → ts.reverse()
      → overlay 从当前位置倒放
      → 字符从当前位置往回飞
      → reverse 完成 → cleanup
```

展开一半点回收 → state 变折叠 → reverse 到折叠态 → 完美对齐。
折叠一半点展开 → state 变展开 → reverse 到展开态 → 完美对齐。

**不需要"reverse 完成后额外再播一个正向动画"。** reverse 到底就已是目标状态。

### 规则 2：动画进行中，其他路径点击 → 直接忽略，不排队

```
a 动画播放中，用户点 b
  → 无视这次点击
  → a 保持连贯播放
  → a 完成后 → 正常消费后续点击（包括刚才点的 b）
```

这样：
- a 的动画不会被中途打断，视觉流畅
- 用户不会因为心急"一个都展不开"——刚才点的 b 会在 a 完成后自动处理
- 不需要复杂的排队逻辑

### 规则 3：非动画中点击 → 正常走 doExpand / doCollapse

展开态 → 点击 → doCollapse（正向折叠动画）
折叠态 → 点击 → doExpand（正向展开动画）

这两套正向动画的曲线 / timing / 字符雨布局与展开一致，保证视觉对称。

---

## 五、动画生命周期

### 展开动画（`_runExpandAnimation`）

```
1. toggle.rotate 归零
2. _setupExpandOverlays(container, fullHeight) — 建 overlay
3. _flattenExpandTree(container) — 收集子容器
4. 为每个子容器建 overlay
5. 全部加到 ts 上：
   - 本层 overlay tween @ t=0
   - 本层字符雨 tween @ t=0（直接 ts.to，非独立 timeline）
   - 子层 overlay tween @ level*0.06
   - 子层字符雨 tween @ level*0.06
   ...
6. ts.call(cleanup) @ maxDelay + 0.05
```

### 折叠动画（`doCollapse` — 新建，基于当前状态）

思路：与展开对称。

```
1. _setupCollapseOverlays(container, fullHeight)
2. 字符雨 tween（字符从当前位置往回飞到屏幕上方）
3. overlay tween（盒子高度 full→0，兄弟位置下移）
4. ts.call(cleanup)
```

字符雨的"逆向飞行"如何实现？

从当前可见位置 → 屏幕上方随机位置（`initY` 与展开时一致的计算方式）。tween 参数（duration、ease）与展开一致，只是方向和初始/目标位置互换。

### 展开时反向中断（reverse）

```
用户点同路径（L.animatingPath === 点击路径）
  → KFMState 切换
  → rebuildTree（新状态终端树）
  → killActiveCharRain()
  → ts.reverse()           ← 所有 tween（overlay + 字符）一起倒放
  → reverse 完成自然触发 cleanup
```

### 清理 call（cleanup）

```typescript
function _cleanupExpand(onTap?: () => void): void {
  _removeAllOverlays();
  _resetAnimTimeline();   // ts.clear() + ts.time(0)
  L.endOp();
  const root = L.renderer?.getRoot();
  if (root) _rebuildRowIndex(root);
  if (onTap) onTap();
  processClickQueue();
}
```

---

## 六、processClickQueue 改造

### 新逻辑

```typescript
function processClickQueue(): void {
  if (clickQueue.isEmpty() || !L.renderer) return;

  // === 动画进行中 ===
  if (L.isAnimating) {
    // 超时兜底（安全阀）
    if (Date.now() - L._animBusyAt > 3000) {
      L.endOp(); clickQueue.clear(); return;
    }

    const next = clickQueue.peek();
    if (!next) return;

    const r = L.renderer.getRoot()!;
    const sy = r.scrollY ?? 0;
    const hit = _quickHitTest(r, next.offsetX, next.offsetY + sy);

    // 【规则 2】光标移动穿透（不排队）
    if (hit && L.cursorRowId !== null && L.cursorRowId !== hit.id) {
      clickQueue.dequeue();
      moveCursorTo(hit);
      _scrollToCenterCursor();
      setTimeout(processClickQueue, 0);
      return;
    }

    // 【规则 2】其他路径点击 → 直接忽略
    const tgt = _findClickPath(r, next.offsetX, next.offsetY + sy);
    if (!tgt || tgt !== L.animatingPath) return;

    // 【规则 1】同路径点击 → state 先变 + reverse
    clickQueue.dequeue();
    // 同一路径，切换 state（展开↔折叠）
    const currentExpanded = !!KFMState.expandedPaths[tgt];
    KFMState.setExpanded(tgt, !currentExpanded);
    // processClickQueue 被 setExpanded → notify → _stateSub → rebuildTree 中调用？
    // 注意：rebuildTree 中会调用 processClickQueue？需要确认。
    // 不能在这里 processClickQueue，reverse 完成后自动调用
    killActiveCharRain();
    ts.reverse();
    return;
  }

  // === 非动画中：正常消费 ===
  const { offsetX, offsetY } = clickQueue.dequeue()!;
  const root = L.renderer.getRoot();
  if (!root) return;
  // ... 正常点击处理（光标判断 → doExpand / doCollapse）...
}
```

**⚠️ 需要特别小心：** `KFMState.setExpanded()` 内部会 `notify()` → 触发 `_stateSub` → 调用 `rebuildTree()`。而 `rebuildTree()` 内部会 `assert` 检查 `L.isAnimating`。如果此时 isAnimating 为 true（动画还没结束），会 `warn` 并尝试超时释放。

**解法：** 在 `reverse` 期间，`ts` 的时间线正在逆转，**overlay 还在树上**。`rebuildTree()` 创建全新的树，走 `L.renderer.setRoot(newRoot)`——这时旧 overlay 随旧树被替换。**实际上这个衔接是安全的**，因为 `setRoot` 替换了整个根，旧 overlay 自然消亡。但我们仍需要把 `_activeOverlays` 清空，避免 assert 报错。

所以 `reverse` 分支的执行顺序是：

```typescript
// 同路径 reverse
clickQueue.dequeue();
killActiveCharRain();
_removeAllOverlays();          // 先清 overlay，避免 rebuildTree 时 assert
_activeOverlays.length = 0;    // 懒一点可以直接重置数组
const currentExpanded = !!KFMState.expandedPaths[tgt];
KFMState.setExpanded(tgt, !currentExpanded);  // 触发 rebuildTree
// 现在主树已变，overlay 是旧的，ts 上还有 tween
// reverse 让 box 属性回到初始值，但 overlay 本身还在旧树上
// _resetAnimTimeline() 在 reverse 完成时由 cleanup 处理
ts.reversed(!ts.reversed());  // 如果正向播放就反转
ts.play();
// reverse 完成 → cleanup → processClickQueue()
```

---

## 七、未解决的问题/待确认

### 7.1 `ts.reverse()` 与 rebuildTree 的时序

`rebuildTree()` 调用 `L.renderer.setRoot(newRoot)` 后，旧 root + 它的 overlay 子节点被丢弃。`ts` 上的 tween 引用的 Box 对象是旧 root 的子节点——这些对象在 JS 中仍然存活（被 GSAP 持有引用），但已不在渲染树中。GSAP 继续修改它们的属性没有意义，因为渲染器不画它们了。

所以正确的顺序应该是：
```
rebuildTree() → setRoot(newRoot) → ts.reverse()
```
而不是反过来。因为 reverse 修改的是旧 overlay 的属性，反正已经不在渲染树里了。

**但这个不影响用户视觉**——旧 tree 已被新 tree 替换。reverse 只是让 GSAP 内部的属性回归初始值，不产生可见效果。

那 reverse 的目的何在？**是为了让 ts timeline 回到正确位置，以便后续可以从头开始正向播放。**

但等等——如果是同路径 reverse，用户想要的是视觉上的逆转动画。如果 `rebuildTree()` 先执行了，旧的 overlay 已经不在了，视觉上没法逆转了。

**所以正确的顺序必须是：先 reverse（视觉逆转），再 rebuildTree。**

但 `rebuildTree` 又是在 `setExpanded → notify → _stateSub` 里触发的...

这个问题需要解决。可能的做法是：**同路径 reverse 时不通过 KFMState 触发 rebuildTree**，而是直接操控 `ts`：

```typescript
// 同路径 reverse
// 不改 KFMState — 让 overlay reverse 回到视觉起点
// 等 reverse 完成后，再通过 onReverseComplete 切换 KFMState
ts.reverse();
ts.eventCallback('onReverseComplete', () => {
  _removeAllOverlays();
  _resetAnimTimeline();
  // 此时才切换 state → rebuildTree
  KFMState.setExpanded(tgt, !currentExpanded);
});
```

但这个做法破坏了"主树状态先行"原则。

你的意思是"主树状态先行 + rebuildTree + reverse"——但 rebuildTree 会替换掉 overlay 所在的旧树，导致 reverse 不可见。**这两者确实是冲突的。** 需要想清楚怎么解决这个矛盾。

### 7.2 折叠动画的具体设计

展开动画是确定性的（从折叠态→展开态），但**折叠动画的"逆向"不一定是展开的倒放**，因为两个时间点的状态可能不同。

折叠动画的详细参数（字符飞行轨迹、timing、ease）是否需要与展开完全对称？还是只要**风格一致**（都是字符散落/回收，0.05s 盒子动画 + 0.35s 字符动画）？

### 7.3 `_ensureMetaFromExpandedState` 在折叠时的行为

当前 `_ensureMetaFromExpandedState` 只在 `rebuildTree` 中调一次，只给 `expanded-*` 容器补元数据。折叠动画时这些元数据是否足够？需要确认。

---

## 八、总结

| 模块 | 改动 | 优先级 |
|------|------|--------|
| `char-rain.ts` | 不再用独立 `anim.timeline()`，接受 `ts` 参数直接加 tween | P0 |
| `processClickQueue` | 规则 2：动画中其他路径点击忽略；规则 1：同路径 reverse | P0 |
| `_runExpandAnimation` | 每层调用 `animateCharRain(ts)` 替代单次 `ts.call` 点火 | P0 |
| `doCollapse` | 重新设计为正向折叠动画（与展开对称） | P1 |
| reverse 时序问题 | 主树 state 先行 vs rebuildTree 覆盖 overlay 的矛盾 | **需讨论** |
