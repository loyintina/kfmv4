---
status: draft
version: v1.0
last_updated: 2026-06-07
---

# KFM v4 — Box 位置映射与精确操作协议

> **版本**：v1.0
> **状态**：设计阶段（proposed）
>
> 本文档记录为 AI 建立 Canvas 文件树"内部眼睛"的设计方案。
> 核心目标：让 AI 能通过文件路径直接触发 Canvas 操作，不再受限于合成事件坐标 (0,0)。
>
> **关联文档**：
> - KFM_V4_INVARIANTS.md — 修改约束协议
> - VISION_AND_ROADMAP.md — 核心理念 §1.4（用户和 AI 对称操作）
> - HANDBOOK.md — 已知陷阱 #12（Canvas 元素的 AI click 无坐标）
> - CARD_SYSTEM_DESIGN.md — 卡片系统设计
>
> **阅读顺序**：§1（核心意图）→ §2（问题诊断）→ §3（架构设计）→ §4（实现计划）→ §5（风险与边界）

---

## §0 本文的性质

本文档记录 Box 位置映射与精确操作协议的设计讨论、产出定义和实现计划。

**为什么需要本文**：AI 对 Canvas 文件树的操作依赖坐标。当前 AI click 指令合成的 PointerEvent 坐标为 (0,0)，无法命中预期行。v6.2 通过专用命令（`expand-dir`/`collapse-dir`/`select-file`）部分缓解，但未根除——每新增一个 Canvas 交互就需要一个新命令。本文提出根解：**AI 不需要模拟人类点击屏幕的方式。AI 应该直接操作它自己构建的数据结构。**

---

## §1 核心设计意图（不可违反）

### 1.1 AI 拥有"内部眼睛"

AI 渲染了文件树。AI 知道每个文件的路径。AI 应该能查询"这个文件在 Canvas 上的什么位置"——不需要截图，不需要视觉识别，不需要猜测坐标。

### 1.2 路径即坐标

对 AI 而言，操作目标由文件路径标识。坐标是给人类手指用的。AI 发送 `path + action`，系统负责找到对应的 Box 并触发操作。

### 1.3 位置映射是数据的自然流露

`rebuildTree` 在构建文件树时已经拥有所有信息——每个文件的路径、Box 引用、屏幕像素位置。位置映射只是把这些信息保留下来，而不是构建完就丢弃。

### 1.4 不破坏现有体系

- 专用命令（`expand-dir`/`collapse-dir`/`select-file`）保持原样
- 用户触摸操作不受影响
- 105 个现有测试全通过

### 1.5 与 Registry 体系融合

Registry 跟踪"有什么交互元素"。Box 位置映射跟踪"每个文件行在 Canvas 上的位置"。两者是 Registry 的自然延伸——从"有什么"到"在哪里"。

---

## §2 问题诊断

### 2.1 根因

```
AI click 指令 → ws-channel 接收 → 合成 PointerEvent → 坐标 (0,0)
→ Canvas hit-test → 命中左上角像素 → 大概率什么也不发生
```

`rebuildTree` 在构建文件树时，每个文件 Box 的屏幕坐标被计算出来，用于渲染——但构建完成后，这个映射关系被丢弃了。没有任何数据结构记录"文件路径 → Box → 像素坐标"。

### 2.2 当前绕行方案（v6.2）

- `expand-dir /path` — 展开指定目录
- `collapse-dir /path` — 折叠指定目录
- `select-file /path` — 选中指定文件 + 光标定位 + 居中滚动

**局限性**：每新增一种 Canvas 交互（右键菜单、拖拽排序、多选……），就需要新加一个专用命令。这违反了 VISION §1.4 的核心理念——"用户能做什么，AI 就能做什么"。

### 2.3 为什么不适合修坐标补丁

在 click handler 中检测 (0,0) 坐标并推断目标位置——这是补丁思维：
- 需要标记"事件来源是 AI 还是用户"（增加耦合）
- 推断逻辑依赖当前展开状态和滚动位置（易出错）
- 如果推断错误，静默操作到错误的文件（比不操作更危险）

---

## §3 架构设计

### 3.1 整体结构

```
                         Registry
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         交互元素        内容层        Box 位置映射  ← 新增
         (已有)         (已有)       path → Box 坐标 │
                                     path → 直接操作 │
                                     └──────┬───────┘
                                            │
                                       ws-channel
                                   AI 发送路径 + 操作
                                   不再需要坐标参数
```

### 3.2 Box 位置映射（tree-render.ts 内部）

```typescript
/**
 * Canvas 文件树中一个文件行的位置信息。
 * 每次 rebuildTree 后自动重建。
 */
interface BoxLocation {
  /** 文件/目录的完整绝对路径 */
  path: string;
  /** Canvas Box 引用 */
  box: Box;
  /** 在当前渲染树中的行号（用于调试和光标定位） */
  rowIndex: number;
  /** 屏幕坐标（含滚动偏移 + DPR 转换后的 CSS 像素） */
  screenRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 路径 → Box 位置的反向索引。
 * key 是文件的完整路径，只包含当前可见的文件行。
 * 展开状态变化或 rebuildTree 后清空重建。
 */
const _boxLocationMap: Map<string, BoxLocation> = new Map();
```

**重建时机**：`rebuildTree` 末尾，遍历 `L.renderer.getRoot()` 的 Box 树，为每个文件行（`Box.data.type === 'file-row'`）记录位置。

**查询接口**（模块内部导出）：

```typescript
/** 根据文件路径返回 Box 的屏幕坐标，不可见时返回 null */
export function locateFileBox(path: string): { x: number; y: number } | null {
  const loc = _boxLocationMap.get(path);
  if (!loc) return null;
  return {
    x: loc.screenRect.x + loc.screenRect.width / 2,
    y: loc.screenRect.y + loc.screenRect.height / 2,
  };
}
```

### 3.3 精确操作接口（tree-render.ts 导出 + ws-channel 消费）

```typescript
/** 通过文件路径直接触发 Canvas 操作，不依赖坐标 */
export function executeOnPath(path: string, action: 'tap' | 'expand' | 'collapse'): void {
  const loc = _boxLocationMap.get(path);
  if (!loc) {
    // 文件不可见或路径无效——静默失败，不抛出
    return;
  }

  switch (action) {
    case 'tap':
      // 直接触发 Box 的点击回调，绕过 hit-test
      loc.box.gesture?.onTap?.();
      break;
    case 'expand':
    case 'collapse':
      // 委托给现有的专用命令
      if (action === 'expand') {
        // 复用 expand-dir 的逻辑
      }
      break;
  }
}
```

**ws-channel 注册**：

```typescript
wsChannel.onCommand('click-path', (path: string) => {
  executeOnPath(path, 'tap');
});

wsChannel.onCommand('locate-path', (path: string) => {
  return locateFileBox(path);
});
```

### 3.4 与现有命令的关系

| 命令 | 保留/迁移 | 说明 |
|------|----------|------|
| `expand-dir` | 保留 | 已有专用逻辑，不需要改为泛化 |
| `collapse-dir` | 保留 | 同上 |
| `select-file` | 保留 | 已有光标定位 + 居中滚动，逻辑复杂 |
| `click-path` | **新增** | 泛化的 tap 操作，适用于所有文件行 |
| `locate-path` | **新增** | 返回坐标，AI 可用于 composite 操作（如"先定位再截图标注"） |

---

## §4 实现计划

### 改动清单

| 步骤 | 文件 | 内容 | 代码量 |
|------|------|------|--------|
| 1 | `tree-render.ts` | 定义 `BoxLocation` 接口 + `_boxLocationMap` + `locateFileBox()` + `executeOnPath()` | ~50 行 |
| 2 | `tree-render.ts` | `rebuildTree` 末尾调用 `_rebuildBoxLocationMap()` | ~30 行 |
| 3 | `ws-channel.ts` | 注册 `click-path` 和 `locate-path` 命令 | ~8 行 |
| 4 | `ui-registry.ts`（可选） | 注册新能力声明 | ~5 行 |

### 验证方式

```bash
npm run check   # 必须零错误
npm run test    # 105 个回归测试全通过
```

### 手动验证

1. AI 发送 `click-path /root/某文件路径` → 文件被选中，光标移动到该行
2. AI 发送 `locate-path /root/某展开目录` → 返回有效像素坐标
3. 文件树展开/折叠后，`locate-path` 返回更新后的坐标
4. AI 发送 `click-path /root/不可见文件` → 静默失败，不崩溃

---

## §5 风险与边界

### 5.1 不做的

| 不做的 | 原因 |
|--------|------|
| 移除现有的 `expand-dir`/`collapse-dir`/`select-file` 命令 | 保持向后兼容 |
| 在 `InteractionCapability` 中加 `preciseOps` 声明 | 等本方案验证后再扩展类型定义 |
| 支持目录级别的 `click-path`（点击目录应展开/折叠） | 委托给 `expand-dir`/`collapse-dir` |
| 支持多选、拖拽等复杂手势 | 当前需求范围外，设计保留扩展空间 |
| 修改 GestureRegistry 调度逻辑 | 不碰事件分发 |

### 5.2 已知风险

| 风险 | 缓解 |
|------|------|
| `rebuildTree` 后 `_boxLocationMap` 未及时更新 | `rebuildTree` 末尾统一调用 `_rebuildBoxLocationMap()`，不依赖外部触发 |
| 文件路径在不同展开状态下可能不可见 | `locateFileBox` 返回 null 而非错误坐标，AI 可以处理空结果 |
| `Box.gesture?.onTap` 的副作用与正常点击一致 | 已验证：tap 回调触发 KFMState 变更，与其他模块的订阅行为一致 |

### 5.3 与 Path-Utils 的关系

服务端已有 `sanitizePath` + `SAFE_ROOT` 路径守卫（`src/server/path-utils.ts`）。`click-path` 命令的 path 参数属于操作指令，不经过文件读写路径，但建议在 `executeOnPath` 中加一层路径格式校验，确保 path 以 `/` 开头，防止相对路径注入。

---

## §6 与现有注册体系的融合展望

当前 Registry 跟踪 13 个交互元素、3 个内容块、3 个能力。Box 位置映射完成后的下一个自然步骤：

1. 在 Registry snapshot 中包含"当前可见文件数"和"文件树摘要"（已有）
2. AI 读取 snapshot → 了解有哪些文件 → 通过 `click-path` 操作
3. 未来：将 `_boxLocationMap` 的统计信息（总数、第一个/最后一个路径）作为内容层的一部分自动注册

这意味着 AI 不再需要"知道"文件树是 Canvas 渲染的——它只需要知道文件路径和可用操作。这是 VISION §1.4 "对称操作"的完整实现。

---

> **本文档与代码同步。实现过程中如发现设计漏洞或新决策，先更新本文再改代码。**
