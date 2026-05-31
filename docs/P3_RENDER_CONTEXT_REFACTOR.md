# P3 重构计划：Renderer 上下文隔离

> 写于 2026-05-31，基于 root-picker Renderer 替换模式的审计结论。
> 目标：消除全局单例 `L` 在渲染器切换时的状态泄漏，让替换模式真正"自动继承"。

---

## 一、问题陈述

### 1.1 现象

root-picker 使用 Renderer 替换模式（`KFM_V4_INVARIANTS.md` §1.6）：
打开时保存 `L.renderer`，替换为 picker 的渲染器；关闭时恢复。

但这个替换**只替了渲染引用**，辅助状态没有跟着切换：

| 替换了什么 | 没替换什么 | 后果 |
|-----------|-----------|------|
| `L.renderer` | `L._rowIndex` | 关闭时需手动恢复 `_savedRowIdx` |
| — | `L.cursorRowId` | 需手动保存恢复，遗漏则光标跳动 |
| — | `L.cursorBox` | 可能被 picker 的 cursor 污染主树 |
| — | `KFMState.files` | picker 写入的数据会污染文件缓存 |

**每一次"漏掉"都产生一个补丁。** 修复了 4 个缺口后，模式"看起来"稳定了，但缺口类型是枚举不完的——下次加一个新功能（如搜索面板复用替换模式），同样的缺口会重新出现。

### 1.2 根因

`L`（`RendererLifecycle`）是一个全局单例。它的职责模糊：

```typescript
class RendererLifecycle {
  renderer: Renderer | null;  // 当前渲染器
  _rowIndex: Box[];           // 当前渲染器的行索引
  cursorBox: Box | null;      // 当前渲染器的光标
  cursorRowId: string | null; // 当前渲染器的光标位置
  // ...
}
```

当 `L.renderer` 指向 A，但 `L._rowIndex` 还残留着 B 的数据——这是数据结构层面的竞态条件。替换模式通过"保存→替换→恢复"的协议来规避，但这个协议不在类型系统中，全靠人工遵守。

---

## 二、方案：RenderContext 原子化

### 2.1 核心设计

把属于渲染器的可变状态从 `L` 剥离，封装为 `RenderContext`：

```typescript
interface RenderContext {
  renderer: Renderer | null;
  rowIndex: Box[];
  cursorBox: Box | null;
  cursorRowId: string | null;
}
```

`L` 改为管理 `RenderContext` 栈：

```typescript
class RendererLifecycle {
  private _contextStack: RenderContext[] = [];

  get ctx(): RenderContext {
    return this._contextStack[this._contextStack.length - 1];
  }

  /** 保存当前上下文，推入新上下文 */
  pushContext(ctx: RenderContext): void { ... }

  /** 弹出上下文，恢复到上一个 */
  popContext(): void { ... }
}
```

### 2.2 使用方式

```typescript
// 替换模式的标准用法：
const saved = L.pushContext({
  renderer: new Renderer(pickerCanvas, ...),
  rowIndex: [],
  cursorBox: null,
  cursorRowId: null,
});
// 所有 L.ctx.* 现在指向 picker 的上下文
// 所有系统函数（rebuildTree、getCursorRowIndex 等）自动继承

// 用完恢复：
L.popContext();
// L.ctx.* 自动回到主树的上下文
```

### 2.3 能自然继承的部分

- `rebuildTree()` 通过 `L.ctx.renderer` 和 `L.ctx.rowIndex` 工作，无需额外参数
- `getCursorRowIndex()`、`moveCursorTo()`、`ensureCursorBox()` 全部操作 `L.ctx.*`
- `canvas-scroll.ts` 中的滚动/光标逻辑自动对齐到当前上下文
- 不再需要 `_savedRenderer`、`_savedRowIdx`、`_savedCursorRowId`
- 同一个函数同时服务主树和 picker，零分支

### 2.4 不能自动继承的缺口

- **`KFMState.files`** 仍是全局的，不属于 RenderContext。picker 写入的目录数据在关闭后需要清理。这目前通过 `_savedFiles` 快照解决——这个快照逻辑需要保留。
- **`_stateSub`**（`KFMState` 订阅）是全局的，切换上下文时不应重新订阅。`rebuildTree` 在哪个上下文上跑取决于当时 `L.ctx.renderer` 指向谁。
- **`L.cursorBox`** 是 `Box | null`，但 Box 属于特定渲染器的树。恢复上下文后，旧的 `cursorBox` 引用可能无效（树已重建）。`ensureCursorBox` 需要能处理这种情况。

---

## 三、实施步骤

### 第一步：定义 RenderContext 类型并嵌入 L（无行为变更）

**文件**：`src/client/modules/renderer-lifecycle.ts`

- 新增 `RenderContext` 接口
- `L` 初始化时创建默认 context（`{ renderer: null, rowIndex: [], cursorBox: null, cursorRowId: null }`）
- 所有 `L.renderer`、`L._rowIndex`、`L.cursorBox`、`L.cursorRowId` 改为通过 `L.ctx` 访问

**风险**：极低。纯重构，不改逻辑。记得用 `Object.defineProperty` 或 getter/setter 保持向后兼容。

**验证**：`npm run check` + `npm test`

### 第二步：实现 pushContext/popContext

**文件**：`src/client/modules/renderer-lifecycle.ts`

- `pushContext(ctx: Partial<RenderContext>): void` — 推入新上下文，自动继承未指定的字段
- `popContext(): void` — 弹出当前上下文，恢复上一个

**验证**：单元测试覆盖 push/pop 的原子性

### 第三步：改造 root-picker.ts

**文件**：`src/client/modules/root-picker.ts`

- `_initPicker` 中：`_savedRenderer` 等保存逻辑替换为 `L.pushContext(pickerCtx)`
- `_destroyPicker` 中：恢复逻辑替换为 `L.popContext()`
- 删除 `_savedRenderer`、`_savedRowIdx`、`_savedCursorRowId` 变量
- `_rebuildPicker` 中删除手动 `moveCursorTo(row0)`——`popContext()` 后自动回到主树的光标

**风险**：中。`_rebuildPicker` 中 `L._rowIndex = []` 需要验证。当前 `_rebuildPicker` 重置 rowIndex 为 picker tree 重建，用 `pushContext` 后这个自然由 context 隔离。

**验证**：`npm run build` + 手动测试 picker 打开/关闭/展开/折叠 完整流程

### 第四步：清理全局引用

**文件**：所有 `L._rowIndex`、`L.cursorBox`、`L.cursorRowId` 的直接读写点

- 将这些引用改为通过 `L.ctx` 访问
- 搜索模式：`L\._rowIndex`、`L\.cursorBox`、`L\.cursorRowId`

**风险**：低。纯机械替换。

### 第五步：文档化替换模式协议

**文件**：`docs/KFM_V4_INVARIANTS.md` §1.6

- 更新 Renderer 替换模式的使用方式为 `pushContext/popContext`
- 说明哪些状态是上下文内隔离的、哪些仍是全局的

---

## 四、不做的事

1. **不改 `KFMState` 的全局性**。它是状态层不是渲染层，与 RenderContext 无关。
2. **不改 `gesture-registry`**。手势调度不依赖 `L` 的状态，不需要上下文切换。
3. **不引入 DI 容器**。`pushContext/popContext` 是轻量栈机制，不是 DI 框架。全局单例 DI 改造是独立的 P3 任务。

---

## 五、交接指南

### 接手 agent 必读

1. 通读 `CLAUDE.md`（项目总览）
2. 通读 `KFM_V4_INVARIANTS.md`（心法原则 + 修改协议）
3. 通读 `docs/BUG_AUDIT_REGISTRY.md`（隐性契约）
4. 阅读本文档的**第一章 + 第二章**（理解问题的来龙去脉）
5. 阅读 `src/client/modules/renderer-lifecycle.ts`（理解 `L` 的当前结构）
6. 按照**第三章**的实施步骤顺序执行

### 关键陷阱

- `ensureCursorBox` 创建新的 Box 并添加到当前树的 root。popContext 后，如果旧 cursorBox 的 Box 属于已被销毁的树，renderer 的 rAF 循环可能尝试绘制已释放的 Box。`ensureCursorBox` 需要在每次渲染前验证 cursorBox 是否属于当前树。
- `rebuildTree` 内部 `L._rowIndex = []` 是直接赋值。改为 `L.ctx.rowIndex = []` 即可。
- `_rowIndex` 在 `canvas-cursor.ts` 和 `canvas-scroll.ts` 中也是通过 `L._rowIndex` 访问的。这些文件需要同步修改。
- `findBoxById` 不依赖 `L`，不涉及。
