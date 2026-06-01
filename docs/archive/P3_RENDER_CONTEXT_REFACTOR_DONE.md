# P3 重构计划：Renderer 上下文隔离（已完成 · 归档）

> 写于 2026-05-31。步骤 1~3 于当天完成并合并入主分支。
> 本文件保留了完整的方案推理链，供未来类似重构参考。
> **当前状态：已实现，pushContext/popContext 已在 `renderer-lifecycle.ts` 中运行。**

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

## 三、实施步骤（全部已完成）

### ✅ 第一步：定义 RenderContext 类型并嵌入 L

**文件**：`src/client/modules/renderer-lifecycle.ts`

- ✅ `RenderContext` 接口已定义
- ✅ `L` 初始化时创建默认 context
- ✅ 所有属性通过 `L.ctx` 委托 + getter/setter 向后兼容

**验证**：`npm run check` + `npm test` ✅

### ✅ 第二步：实现 pushContext/popContext

**文件**：`src/client/modules/renderer-lifecycle.ts`

- ✅ `pushContext(ctx: Partial<RenderContext>)` — 推入新上下文，未指定字段从当前继承
- ✅ `popContext()` — 弹出当前上下文，恢复上一个（至少保留一个默认上下文）

**验证**：通过 `_rebuildPicker` 多次重建测试 ✅

### ✅ 第三步：改造 root-picker.ts

**文件**：`src/client/modules/root-picker.ts`

- ✅ `_initPicker` 中 `L.pushContext({ renderer, rowIndex: [], cursorBox: null, cursorRowId: null })`
- ✅ `_destroyPicker` 中 `L.popContext()`；取消了 `_savedRenderer`、`_savedRowIdx`、`_savedCursorRowId`
- ✅ `_rebuildPicker` 中 `L._rowIndex = []` 由 context 隔离自然生效
- ✅ 后续交互修复：光标恢复、幂等性守卫、加载失败回退、snapToCenterRow animate 参数

**验证**：`npm run build` + 手动测试 picker 打开/关闭/展开/折叠 完整流程 ✅

### 第四步：清理全局引用（可选，未执行）

**文件**：所有 `L._rowIndex`、`L.cursorBox`、`L.cursorRowId` 的直接读写点

决定不做纯机械替换——当前 getter/setter 向后兼容能正常工作，且项目目前没有第二个 RenderContext 消费者。如果在未来引入搜索面板等新的变体面板，届时再统一清理。

### 第五步：文档化替换模式协议（已完成）

**文件**：`docs/KFM_V4_INVARIANTS.md` §1.6

- ✅ 已更新为 `pushContext/popContext`
- ✅ 相关文档已同步：`SESSION_MEMORY.md`、`HANDOFF_AUDIT.md`、`CLAUDE.md`

---

## 四、不做的事

1. **不改 `KFMState` 的全局性**。它是状态层不是渲染层，与 RenderContext 无关。
2. **不改 `gesture-registry`**。手势调度不依赖 `L` 的状态，不需要上下文切换。
3. **不引入 DI 容器**。`pushContext/popContext` 是轻量栈机制，不是 DI 框架。全局单例 DI 改造是独立的 P3 任务。
