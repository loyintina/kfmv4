# KFM v4 动画竞态根治方案

## 问题根源

当前代码有两层独立的树更新机制互相冲突：

| 层 | 机制 | 行为 |
|----|------|------|
| BoxTree (L2) | `rebuildTree()` | 从 KFMState 全量重建整棵树，旧 Box 对象被丢弃 |
| Animation (L3) | GSAP tween | 持有旧 Box 引用，增量修改 `height/x/y/opacity` |

当 L3 正在运行时 L2 被触发 → tween 持有的 Box 引用悬空 → 死锁（slideInRows）、空盒子、点击丢失。

## 核心原则

1. **KFMState 是唯一真相源** — 视觉树只能从 State 派生
2. **动画不持有树的引用** — 动画操作临时 overlay，永远不碰主树
3. **中断总是安全的** — 任何时刻中断动画都能回到有效稳态
4. **事件生命周期可追踪** — 不丢事件，不吞队列

## 分步方案

### Phase 1: 止血（已完成）

- [x] `_stateSub` 移除 `L._clickQueue = []` — 不再吞点击
- [x] `slideInRows` 改用 `anim.to`（非 `ts.to`）+ root 校验 — tween 被 scope.clear() 杀死后不死锁
- [x] `updateFocus` 从 CSS transition 迁移到 GSAP — 消除 card-stack 内部竞态源

### Phase 2: 形式化展开/折叠状态机

**现状**: 用一个 `_animBusy` boolean + `L.animatingPath` string + `_clickQueue` array 拼凑的隐式状态机。

**目标**: 显式枚举所有合法状态和转换。

```typescript
type TreeOp =
  | { kind: 'idle' }
  | { kind: 'animating'; path: string; direction: 'expand' | 'collapse' }

let _treeOp: TreeOp = { kind: 'idle' };

// 转换规则:
//   idle + 点击展开目录 → animating(path, expand)
//   idle + 点击折叠目录 → animating(path, collapse)
//   animating + 再次点击同目录 → 中断当前动画，启动反向动画 (expand↔collapse)
//   animating + 点击不同目录 → 排队，当前动画完成后执行
//   animating + 动画完成 → idle

function beginOp(op: TreeOp): void {
  if (_treeOp.kind === 'animating') {
    // 中断当前动画 → rebuildTree → 立即进入稳态
    abortAnimation();
  }
  _treeOp = op;
}

function endOp(): void {
  _treeOp = { kind: 'idle' };
  processQueue();
}
```

**收益**: 所有状态转换可枚举、可测试、不可被意外打破。

### Phase 3: 动画与树彻底解耦

**现状**: `doExpand`/`doCollapse` 的 GSAP tween 直接修改 Box 树的 `height/y/opacity`。

**目标**: tween 操作临时 overlay，主树只在 `rebuildTree()` 时替换。

**方案**: "快照 + overlay" 模式。

```
展开流程:
  1. rebuildTree() 构建"折叠态"树（container height=0, children hidden）
  2. 创建临时 overlay Box，复制 children 的外观（位置、文字）
  3. GSAP tween 在 overlay 上做动画
  4. 动画完成后：
     a. 销毁 overlay
     b. rebuildTree() 构建"展开态"树（container height=fullHeight）
     c. renderer.setRoot() 原子替换

中断:
  任意时刻 kill tween → 销毁 overlay → rebuildTree(当前 KFMState)
  → 无论动画进行到哪一步，最终状态始终与 KFMState 一致
```

实现方式类似于 `char-rain.ts` 已有的模式：
- `char-rain.ts` 创建临时 Box（`cr-*` id），加到 container.children
- `finally` 回收临时 Box，恢复原始 label 可见性
- 根校验 `if (currentRoot !== root) return;` 防止操作旧树

slideInRows 应该效仿这个模式：展开/折叠动画完全在临时 Box 上运行，
主树只通过 rebuildTree 更新。

### Phase 4: 事件队列形式化

**现状**: `_clickQueue` 数组，任何地方都可以 `push`、`shift`、`=[]`。

**目标**: 只有 `processClickQueue` 可以消费队列，其他代码只能入队。

```typescript
const _clickQueue: ClickEvent[] = [];

function enqueueClick(e: ClickEvent): void {
  _clickQueue.push(e);
  processClickQueue(); // 自动触发处理
}

function processClickQueue(): void {
  if (_treeOp.kind === 'animating') return; // 动画中，等待完成后再处理
  if (_clickQueue.length === 0) return;
  
  const click = _clickQueue.shift()!;
  handleClick(click);
  // handleClick 完成后自动 processClickQueue 处理下一个
}

function dep dupClick(): void {
  // 合并连续的同目标点击（光标模式：第一击移动光标，第二击触发操作）
}
```

**收益**: 入队/出队单向数据流，无可被外部清空的漏洞。

### Phase 5: 通用 abort 机制

为所有 async 动画函数提供统一的 abort 原语：

```typescript
class AbortController {
  private _generation = 0;
  
  start(): number { return ++this._generation; }
  
  isCancelled(gen: number): boolean {
    return gen !== this._generation;
  }
}
```

替代手动 `root !== capturedRoot` 检查，统一管理动画生成。

---

## 实施顺序

| 阶段 | 风险 | 改动范围 | 验证方式 |
|------|------|----------|----------|
| P1 止血 | 低 | 2 行删除 + slideInRows 重构 | npm run build + 手机上快速点击 10 轮 |
| P2 状态机 | 中 | tree-render.ts 200 行 | 展开→折叠→展开快速交替 5 轮 |
| P3 动画解耦 | 高 | 重构 slideInRows + doExpand/doCollapse | 展开包含多层子目录的文件夹 |
| P4 队列形式化 | 低 | 新建 click-queue.ts，改 tree-render | 快速连点 20 次 |
| P5 abort 机制 | 低 | 新建 abort.ts，改所有 async 动画 | 回归测试 |

建议按顺序执行，每阶段单独 commit，完成验证后再进行下一阶段。
