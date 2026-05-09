# P3 交接文档：4 个遗留问题

## 当前架构概况

另一位 agent 已完成以下架构级改动（均已 commit，构建通过）：

- **`_setupExpandOverlays`** 重写为：从元数据计算 FROM 位置（`collapsedY = expandedY - fullHeight`），**不再需要预压缩的树**
- **`_ensureMetaFromExpandedState`** 在 `rebuildTree()` 内部调用，为终端态树补充 `_fullHeight` / `_origYs` 等元数据
- **单 `rebuildTree` 架构**：`doExpand` 只有一次 `rebuildTree`（通过 `onTap()` → `_stateSub`），不需要第二次
- **`OverlayMeta` 接口**：类型化元数据，替代全部 `(as any)` 转换
- **`L.beginOp/endOp`**：集中化动画生命周期管理
- **`_resetAnimTimeline()`**：`ts.clear() + ts.time(0)` 统一清理

当前 `tree-render.ts` 共 1148 行，以下问题均在此文件中。

---

## 问题 #1（严重）：`_unveilOverlaySubContainers` 中 `animateCharRain` 和 `_setupExpandOverlays` 顺序颠倒

### 根因
在 `_unveilOverlaySubContainers`（`tree-render.ts:1052`）中，第 ~1095 行调用了 `animateCharRain(child, root, L.renderer)`，然后第 ~1098 行才调用 `_setupExpandOverlays(child, subFullH)`。

问题在于 `animateCharRain` 会将字符 Box 添加到 `child.children` 数组中，然后 `_setupExpandOverlays` 会遍历 `child.children` 并为**所有子元素**（包括刚添加的字符 Box）创建 overlay。这导致：
1. 字符 Box 被错误地复制到 overlay 中
2. 字符雨动画效果异常（不可见）

### 正确做法（`doExpand` 的示范）
`doExpand` 在第 725-727 行正确实现：

```typescript
const pack = _setupExpandOverlays(container, fullHeight);       // 先搭建 overlay
const rowTargetYs = pack.rowOverlays.map(r => (r as Box & OverlayMeta)._targetY as number);
animateCharRain(container, root, L.renderer, rowTargetYs);       // 再启动字符雨
```

### 修复方案
交换 `_unveilOverlaySubContainers` 中的两行调用，并传入 `rowTargetYs`：

```typescript
// 第 1098 行 → 移到前面
const pack = _setupExpandOverlays(child, subFullH);
const rowTargetYs = pack.rowOverlays.map(r => (r as Box & OverlayMeta)._targetY as number);
// 第 1095 行 → 移到后面
animateCharRain(child, root, L.renderer, rowTargetYs);
```

### 涉及行号（当前文件）
- `tree-render.ts:1095` — `animateCharRain(child, root, L.renderer);` ← 应移到下面
- `tree-render.ts:1098` — `const pack = _setupExpandOverlays(child, subFullH);` ← 应移到上面

---

## 问题 #2（严重）：`_unveilOverlaySubContainers` 中 `animateCharRain` 缺少 `rowTargetYs` 参数

### 根因
`_unveilOverlaySubContainers` 中调用的是：
```typescript
animateCharRain(child, root, L.renderer);
```

而 `char-rain.ts:47` 定义的签名是：
```typescript
export function animateCharRain(container: Box, root: Box, renderer: Renderer, rowTargetYs?: number[]): void {
```

缺少 `rowTargetYs` 时，`char-rain.ts:84` 的 fallback 是：
```typescript
const rowExpandedY = rowTargetYs?.[rowIdx] ?? row.y;
```

由于 `row.y` 此时是终端态位置（不是 overlay 的目标位置），字符雨动画的终点位置错误。字符会在容器展开前就出现在终端位置，导致字符雨效果消失。

### 修复方案
capture `rowTargetYs` 并传入：

```typescript
const pack = _setupExpandOverlays(child, subFullH);
const rowTargetYs = pack.rowOverlays.map(r => (r as Box & OverlayMeta)._targetY as number);
animateCharRain(child, root, L.renderer, rowTargetYs);
```

### 涉及行号
- `tree-render.ts:1095` — `animateCharRain` 调用缺少第二个参数

---

## 问题 #3（中等）：`doCollapse` 中的双重光标定位

### 根因
`doCollapse`（`tree-render.ts:800`）的 `ts.call` 回调中（~第 863-874 行）：

```typescript
ts.call(() => {
    // ...
    L.endOp();
    const _savedCid = L.cursorRowId;
    hit.gesture!.onTap!();      // ① 触发 rebuildTree → 内部已定位光标
    processClickQueue();
    if (_savedCid) {
      const _r = L.renderer?.getRoot();
      if (_r) { const _tc = findBoxById(_r, _savedCid); if (_tc) moveCursorTo(_tc, false); }  // ② 再次定位
    }
}, undefined, maxDur);
```

`hit.gesture!.onTap!()` 触发 `KFMState toggle` → `_stateSub` → `rebuildTree()`，而 `rebuildTree` 内部（~第 955-980 行）已经有光标恢复逻辑。之后又显式调用 `moveCursorTo` 做二次定位。

虽然通常两次定位同一位置不会产生可见问题，但在某些竞态条件下可能导致光标闪烁或错位。

### 修复方案
移除 `ts.call` 回调中的手动光标恢复。`onTap!()` 内部的 `rebuildTree` 已经处理了光标定位。

删除如下代码段：
```typescript
    if (_savedCid) {
      const _r = L.renderer?.getRoot();
      if (_r) { const _tc = findBoxById(_r, _savedCid); if (_tc) moveCursorTo(_tc, false); }
    }
```

### 涉及行号
- `tree-render.ts:866-874` — doCollapse ts.call 回调中冗余的 `moveCursorTo`

---

## 问题 #4（低）：`rebuildTree` 中残留的裸块（bare block）

### 根因
`rebuildTree`（`tree-render.ts:902`）中有一段空作用域的裸块（~第 964-980 行）：

```typescript
  {
    if (prevCursorRowId) {
      const target = findBoxById(newRoot, prevCursorRowId);
      if (target) {
        moveCursorTo(target, false);
      } else {
        snapToCenterRow(newRoot, canvasH);
      }
    } else {
      snapToCenterRow(newRoot, canvasH);
    }
  }
```

这是旧 `_skipCursorRestore` 包裹留下的遗迹 —— 条件判断语句已被移除，但 `{ ... }` 块仍然存在。JS/TS 中裸块虽然合法，但：
1. 造成代码混淆，让阅读者疑惑是否有特殊作用
2. 影响代码风格一致性

### 修复方案
移除裸块的 `{ }` 包裹，仅保留内部逻辑：

```typescript
  if (prevCursorRowId) {
    const target = findBoxById(newRoot, prevCursorRowId);
    if (target) {
      moveCursorTo(target, false);
    } else {
      snapToCenterRow(newRoot, canvasH);
    }
  } else {
    snapToCenterRow(newRoot, canvasH);
  }
```

同时修复裸块结尾处遗留的空 `}`（第 982 行的 `// 重建光标步进行索引` 注释上方）。

### 涉及行号
- `tree-render.ts:964` — 裸块 `{` 开始
- `tree-render.ts:980` — 裸块 `}` 结束
- `tree-render.ts:981` — 注释 `// 重建光标步进行索引`
- `tree-render.ts:982` — 孤立的 `}`（属于裸块但缩进错误）

---

## 修复后验证步骤

1. **构建验证**：`npm run build`（会先跑 check-anim → tsc → esbuild）
2. **光标测试**：反复展开/折叠文件夹，光标不应跳动
3. **字符雨测试**：展开文件夹时应有字符雨动画效果
4. **子容器展开测试**：嵌套文件夹的串行展开应有字符雨 + overlay 动画
5. **快速连点测试**：快速点击不同文件夹不应卡死或空屏
6. **懒加载测试**：懒加载触发的展开动画也应正常

---

## 调试工具

- `_unveilOverlaySubContainers` 中的 `treeAbort` 令牌用于检测 overlay 是否被中断（`rebuildTree` 调用时触发 `treeAbort.cancel()`）
- `assert(_activeOverlays.length === 0, ...)` 可用于检测 overlay 泄漏
- 调试日志通过 `debugLog(msg)` 输出，可在浏览器控制台查看
- 调试面板：青色光球，点击可打开日志面板
