# KFM v4 架构不变量与重构原则

> 项目专用版。每个接手 KFM v4 的 agent 开工前必读。
> 通用协作守则见 `docs/AI_COLLABORATION_PRINCIPLES.md`。

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

在 `tree-render.ts` 加任何逻辑前，逐条确认：

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

## 六、回归验证清单

改动后至少跑通：

```bash
npm run check   # 类型检查零错误
npm run build   # 构建通过（check-anim → tsc → esbuild）
```

功能验证（手机上）：

1. 展开文件夹 → 字符雨可见，动画流畅
2. 折叠文件夹 → 文字自然被裁，无残留
3. 快速连点同一文件夹 → 正反切换无闪烁
4. 多层嵌套展开 → 各层级联展开，字符雨都正常
5. 展开后立即折叠不同文件夹 → 无卡死/空屏