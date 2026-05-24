# KFM v4 — AI 修改约束协议（Harness）

> **在修改任何 .ts 文件前，AI 必须逐条通读本文档并内化所有约束。**
> 未读本文档就动手的修改，大概率方向错误。
> 本文件是项目的不变量（invariants）和修改协议，不是参考手册。

---

## 〇、心法原则（思考框架）

以下 7 条原则是执行所有改动前必须内化的思考方式。违反任何一条的修改，大概率需要重做。

### 1. 先问"为什么"，再问"改哪里"
不要急于修复症状。找到根因，一个根源问题往往能解释所有表面症状。用补丁盖住问题，只会让问题以另一种形式在其他地方出现。

### 2. 从源头上简化，不是在输出端增加
数据模型只存不可继续简化的原始信息。所有派生状态在消费时实时计算，而不是预先存储。一个好的重构应该让代码变少，而不是变多。

### 3. 不要跨模块依赖
一个模块的决策边界等于它的可见边界。如果 A 需要知道 B 的状态才能做决策，说明设计有问题。每张卡片、每个组件，都应该是独立的颜色单位。

### 4. 状态在展示前就位
不要让用户看到"变化的过程"。过渡动画服务于状态切换，但状态本身应该在动画开始前已就位。用户不应该看到"旧状态滑入 → 突然变新状态"的断裂感。

### 5. 代码越改越少是正向指标
把 30 个变量变成 3 个，删除 10 个函数留下 5 个——这才是优雅。每次修改都应该让系统变得更简单。如果改完后代码变多了，大概率方向错了。

### 6. 先理解整体，再拆解局部
不要一头扎进代码细节。先看全貌，理解架构脉络，再定位要改的地方。理解 → 诊断 → 方案 → 执行，顺序不要乱。

### 7. 选择最匹配的一个方案，不列清单
不要给洛三个选项让她选。分析场景，权衡取舍，给出你推荐的那一个，附上理由。如果有备选再说一句"如果想走另一条路也可以"。

---

## 一、项目核心约束（违反就是 bug）

### 1.1 动画安全

```
▎ 动画开始前 _activeOverlays.length === 0
▎ 动画结束后 _activeOverlays.length === 0
▎ rebuildTree() 被调用时 L.isAnimating 应为 false
   例外：超过 3000ms 超时兜底，允许强制释放
▎ 每轮动画结束的 onComplete 回调中必须调用 _resetAnimTimeline()
   ts.clear() + ts.time(0) + ts.reversed(false)
```

这些是"不可能为 false"的运行时条件。代码中已埋入 `assert()`，构建时不可禁用。

### 1.2 类型安全

```
▎ Overlay 元数据用 (as Box & OverlayMeta) 访问，禁止 (as any)._xxx
▎ 已知遗留: _createVisualClone 中 (src as any).data 一处逃逸 (P2)
▎ char-rain.ts 不直接读取 (row as any)._targetY
   rowTargetYs 通过显式参数传入
▎ 所有 _ 前缀属性只在模块内访问
   跨模块读写 _ 前缀属性应通过显式接口
```

### 1.3 依赖方向

```
renderer-lifecycle.ts (L)
       ↓
canvas-utils.ts         ← 只依赖 L
       ↓
canvas-cursor.ts        ← 光标移动/吸附，不导入 tree-*
       ↓
canvas-scroll.ts        ← 滚动，不导入 tree-*
       ↓
tree-render.ts          ← 文件树业务，可以导入任何 canvas-*
```


### 1.4 动画治理

```
▎ 所有 GSAP 调用必须通过 animation-registry.ts
▎ tree-render 内部的动画全部加到 ts = anim.scope('tree-render')
▎ char-rain 使用独立 timeline（anim.timeline()）
   这意味 ts.clear() 不会杀 char-rain
▎ 禁止直接 import gsap（构建时 check-anim.mjs 扫描白名单）
```

---

## 二、架构模式速查

### Overlay 模式（展开/折叠动画）

GSAP tween 只碰临时 overlay 节点，不碰主树。主树始终保持终端态。

```
展开流程:
  rebuildTree() → 终端态树
  → _ensureMetaFromExpandedState() → 补 _fullHeight / _origYs
  → _setupExpandOverlays() → 创建 overlay 节点
  → _buildAndSetOverlayTree() → 构建独立动画树
  → ts.to() + ts.eventCallback('onComplete') → 动画
  → onComplete 中: cleanupCharRain() + _removeAllOverlays()
    + setOverlayRoot(null) + _resetAnimTimeline()

双树渲染:
  overlay 树通过 renderer.setOverlayRoot() 独立渲染
  主树和 overlay 树互不影响
  overlayRoot 自动补偿祖先偏移

字符雨:
  字符建在 charLayer（overlay 树的独立层）
  不是主树容器的子节点，不受 overflow:hidden 裁剪
```

### 状态机（P2）

```
状态: idle → animating → idle
方向: expand / collapse

L.beginOp(path, direction)  — 进入 animating 状态
L.endOp()                    — 回到 idle 状态
L.isAnimating                — 是否动画中
L.animatingPath              — 当前动画路径

守卫: _stateSub 在 L.isAnimating 为 true 时不会触发 rebuildTree
```

### 事件队列（P4）

```
点击事件 → clickQueue.enqueue()
processClickQueue() 独占消费:
  1. 动画中 → 光标穿透（_quickHitTest）
              或同路径中断（逆向动画）
              或其他路径等待
  2. 空闲 → 首次点击移动光标，二次点击执行 onTap
```

---

## 三、常见补丁模式（不要这样做）

以下模式在 KFM v4 中出现过，都是补丁链的开端：

### ❌ 给 overlay 加 `overflow` 属性

```
问题: 字符雨被容器裁剪
补丁: 在 overlay 上加 overflow: visible
根解: 字符雨改为使用独立 charLayer（不在容器内）
```

### ❌ 在 `onUpdate` 里调 `setRoot`

```
问题: 动画过程中渲染不更新
补丁: 每个 tween 的 onUpdate 调 setRoot(root)
根解: rAF 循环每帧自动渲染，只有新创建的 Box 需要 setRoot
      需要时也只需一次，不需要每个 onUpdate 都调
```

### ❌ 折叠时给行加 Y 动画

```
问题: 文字在盒子回收前消失
补丁: 拖慢行 Y 动画，和容器高度动画对齐
根解: 行不作 Y ���画，让容器 overflow:hidden 自然裁剪
      行固定在其展开态位置，容器收缩时自动遮住
```

### ❌ 为父容器加补丁（v4.0.2 已解决）

```
问题: 折叠子容器时父容器有闪烁
补丁: 建父容器的 visual overlay + 建内部其他行的 overlay + 修 x 坐标
根解: doCollapse 在设计时即为父容器层同步创建 overlay，
      siblingOverlay 跳过 subTarget 避免双重渲染。
      _setupCollapseOverlays 的 siblingCloneLabels 参数控制此行为。
```

**判断标准**：如果你为了修一个 bug 而新增的代码行数 > 你能用一句话说清的逻辑，那你很可能在打补丁。

---

## 四、修改代码前的自查清单

在 **任何 .ts 文件** 加任何逻辑前，逐条确认：

- [ ] 这个改动会让哪几行代码变多/变少？
- [ ] 如果变多——你能不能说出为什么不能变少？
- [ ] 这个改动用到了 `if` 判断来绕过某个情况吗？如果是，这个情况根因是什么？
- [ ] 有 `overlay` 的操作——`_activeOverlays` 的正确性维持了吗？
- [ ] 如果改动在 `onComplete`/`ts.call` 回调中——反向播放时这个回调会误触发吗？
- [ ] 你在修的是症状还是根因？问自己：**这类 bug 以后还会出现吗？**

- [ ] **初始化路径检查**（数据模型重构必问）：
  - 你改动的这个值/函数，在页面加载的初始化阶段会被调用吗？
  - 如果会——它的旧版本在那个路径上有默认值保证不崩溃吗？
  - 新版本在那个路径上也能保证不崩溃吗？

- [ ] **功能系统关联检查**（视觉/交互系统重构必问）：
  - 你改动的这个视觉/功能元素，在系统里还有其他变体或表现吗？
  - 它们是否需要保持视觉一致？是否需要保持交互一致？
  - 你确定当前改动覆盖了所有变体吗？

  **常见关联举例：**
  - 卡片堆卡片 ↔ 浮卡（同一视觉原型的不同状态）
  - 光球（AI 聊天）↔ 光球（调试面板）（相同的交互模式）
  - 主树 overlay ↔ 子容器 overlay（相同的动画机制）
  - 侧栏触摸盒子 ↔ canvas 点击（相同的光标触发逻辑）

---

## 五、关键文件职责

```
tree-render.ts     — 所有展开/折叠动画逻辑
                     当前 ~1211 行，核心约束见第一章
char-rain.ts       — 字符雨粒子动画
                     建在 charLayer 上，不碰主树 visible
renderer.ts        — Canvas 渲染，支持双树渲染
renderer-lifecycle.ts — 状态机 (L)
animation-registry.ts  — GSAP 隔离层
click-queue.ts     — 事件队列
debug-assert.ts    — 运行时断言
```

