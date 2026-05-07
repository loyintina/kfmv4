# Bug 修复原则 & 架构审计

> 写于 2026-05，伴随 P1-P5 重构完成 + 6 个 bug 修复后。

## 核心原则

**禁止打补丁。排查到最深层根因，通过调整架构间接消除 bug。**

这个原则来自痛苦的实践经验：对一个不熟悉的项目，AI 辅助修 bug 容易陷入"打补丁→引入新 bug→再打补丁"的死循环。唯一的出路是停下来，理解整个系统的设计意图，然后问自己：**这个类别的 bug 以后还会出现吗？如果会，架构上缺了什么？**

### 近期修复案例

以下 6 个 bug 的修复过程都体现了这个原则：

| Bug | 症状 | 补丁式修复（我们没用） | 架构修复（实际采用） |
|-----|------|---------------------|-------------------|
| 字符雨落错位置 | 文字出现在右侧缩进处 | 在 char-rain.ts 里加偏移量 | 发现 `row.y` 是折叠态而非展开态；改为显式传入 `rowTargetYs` 参数 |
| 展开逐行卡顿 | 兄弟行一个个刷新 | 加长动画时间 | 发现 `ts.to()` 缺 `, 0` 参数导致串行；补上 position 参数 |
| 光标动画瞬移 | 光标从中央飞回目标行 | 加速光标动画 | 发现 `rebuildTree` 恢复光标时不应播动画；改用 `moveCursorTo(target, false)` |
| 折叠闪烁+癫痫 | 盒子先闪一下再抽搐式回收 | 调整缓动曲线 | 发现旧 tween 残留 + `ts.time(0)` 复活；在每个 `ts.call` 回调加 `ts.clear()` |
| 展开无字符雨 | 根目录展开看不到字符 | 增加字符数量 | 发现 overlay 继承源容器 `overflow: hidden` 裁剪字符；GSAP onUpdate 加 `setRoot` 强制渲染 |
| 折叠文字消失 | 文字在盒子回收前就没了 | 延迟文字隐藏 | 发现行 Y 动画和容器高度动画缓动不同步；删除行 Y 动画，让 `overflow: hidden` 自然裁剪 |

每个修复都有一个共同特征：**改完后的代码比改之前更短，而不是更长。** 总共净删约 250 行。

### 隐式契约审计

在整个重构过程中，我们消除了代码里最危险的一类模式：跨模块的 `(as any)._xxx` 隐式契约。

**问题**：`tree-render.ts` 给 overlay Box 设 `_targetY` 属性（通过 `any` 类型），`char-rain.ts` 跨模块读 `(row as any)._targetY`。TypeScript 完全看不见这条依赖线。我们曾因此出了一个 bug——字符雨落错位置。

**解决**：
- `tree-render.ts` 定义了 `OverlayMeta` 接口，28 处 `(as any)._xxx` 替换为 `(as Box & OverlayMeta)._xxx`
- `char-rain.ts` 不再摸 `any`——改为接收显式的 `rowTargetYs?: number[]` 参数
- 现在任何对 overlay 元数据的读写都在 TypeScript 的注视下：拼错字段 → 编译报错

## 当前架构审计

### 健康的部分

- **P2 状态机**：`L.beginOp(path, direction)` / `L.endOp()` / `L.isAnimating` 提供了显式的状态转换。不再有散落的 `_animBusy` boolean。
- **P3 overlay 模式**：GSAP 只碰临时 overlay，主树始终保持终端态。中断动画（`ts.clear()` + `_removeAllOverlays()`）安全回到稳态。
- **P4 事件队列**：`click-queue.ts` 统一管理点击事件的入队/出队/清理，`processClickQueue` 独占消费。
- **P5 abort 机制**：`treeAbort` 代际令牌，`_unveilOverlaySubContainers` 在每个 `await` 点检查令牌。
- **类型安全**：overlay 元数据全部类型化，`char-rain.ts` 的 `as any` 清零。
- **时间线清理**：每个 `ts.call` 回调里 `ts.clear()`，旧 tween 不残留。

### 残余风险（按严重程度排序）

#### 1. 零自动化测试（高）

整个项目唯一的"测试"是 `npm run check`（TypeScript）和 `check-anim.mjs`（GSAP 导入检查）。没有任何一次展开/折叠/字符雨的行为被自动化验证过。回归依赖手动在手机上过 14 条清单。

**计划**：在关键路径埋运行时断言（见下方"改进计划"）。

#### 2. char-rain 使用独立 GSAP 时间线（中）

`animateCharRain` 使用 `anim.timeline()`（独立时间线），而 overlay 动画使用 `ts`（scope 时间线）。两个时间线同时运行，互相不知道对方的存在。如果 `ts.clear()` 被调用（中断场景），字符雨仍在运行，可能导致 `cr-*` 残留。

**计划**：将 char-rain 迁移到 `ts` 时间线，或在 `ts.clear()` 时同步清理 char-rain 时间线。

#### 3. `_stateSub` 守卫依赖运行时状态（中）

`_stateSub` 在每次 `KFMState.notify()` 时触发 `rebuildTree()`。现在靠 `L.isAnimating` 守卫阻止动画期间重建。但如果有人不小心在动画中调了 `notify()` 且绕过了守卫，整棵树会被替换。

**计划**：在 `_stateSub` 的 `rebuildTree()` 调用前加运行时断言：如果 `L.isAnimating` 为 true，至少记录警告日志。

#### 4. `_treeOp.direction` 字段未被消费（低）

状态机正确记录了 `direction`，但 `processClickQueue` 的中断逻辑没有利用它来做优雅的逆向动画。当前行为是能用的（中断→重建→执行反向），但不够优雅。

**计划**：在 processClickQueue 的同路径中断分支里，根据 `L.animatingDir` 决定是否可以直接启动反向动画，而非暴力 `ts.clear()` + `rebuildTree()`。

## 改进计划

### 立即（低成本、高收益）

1. **运行时断言层**：新建 `src/client/modules/debug-assert.ts`（~30 行），在以下关键点埋断言：
   - 动画开始前：`_activeOverlays.length === 0`
   - 动画结束后（`ts.call` 回调）：`_activeOverlays.length === 0`
   - `rebuildTree()` 入口：如果 `L.isAnimating`，记录警告

2. **`_stateSub` 守卫加固**：在 `_stateSub` 的 `rebuildTree()` 调用前加显式检查 + 注释，说明为什么 `endOp()` 必须在 `rebuildTree()` 之前。

### 短期

3. **char-rain 迁移到 `ts` 时间线**：`anim.timeline()` → `ts` scope，统一时间线管理。`ts.clear()` 一次性杀光所有动画。

4. **P2 逆向动画**：在 `processClickQueue` 同路径中断时，利用 `L.animatingDir` 实现优雅的方向反转。

### 长期

5. **自动化回归**：基于 Canvas 2D 的截图对比或 Box 树状态快照。

## 关键不变量

这些是我们认为"不可能为 false"的运行时条件。任何违反都应该触发断言：

1. `_activeOverlays` 在动画开始前必须为空
2. `_activeOverlays` 在 `ts.call` 回调完成后必须为空
3. `rebuildTree()` 被调用时 `L.isAnimating` 应为 false（除非超时释放）
4. `char-rain.ts` 不直接读取 `(row as any)._targetY`（类型系统已保证）
5. `doExpand`/`doCollapse`/`triggerExpandAnimation` 的 `ts.call` 回调中必须调用 `ts.clear()`
