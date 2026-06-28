---
status: active
version: v1.1
last_updated: 2026-06-28
---

# KFM v4 — 卡片注册表设计规范

> **版本**：v1.1
> **状态**：已实施（active）
>
> 本文档描述 KFM v4 卡片运行时注册系统的三层架构设计。
> 核心理念：所有卡片类型在一处声明，所有卡片实例在一处追踪，AI 通过同一注册表感知页面全部卡片。
>
> **背景**：Phase 8（终端卡）开发过程中暴露了架构缺陷——内容处理器拿不到所属卡片的运行时上下文，导致每个新卡片类型都在重复发明状态管理。
>
> **关联文档**：
> - WORKBENCH_SPEC.md — 卡片工作台总体设计
> - TERMINAL_CARD_SPEC.md — 03 号终端卡设计
> - KFM_V4_INVARIANTS.md — 修改约束协议
> - archive/design/CARD_SYSTEM_DESIGN.md — 原始卡片系统设计（已归档）
>
> **阅读顺序**：§0（问题陈述）→ §1（三层架构）→ §2-4（三层详细设计）→ §5（终端卡改造）→ §6（AI 层）→ §7（实施计划）→ §8（开放问题）

---

## §0 问题陈述

### 0.1 补丁链

Phase 8 终端卡的开发过程中，同一个缺口上打了多层补丁：

```
补丁 1: _terminalCounter 放 handler 闭包 → 多终端卡共享编号
补丁 2: 移到 activate() 里          → 紧缩→展开时误自增
补丁 3: 加 Map<contentEl, CardState> → 各自建状态，重复造轮子
补丁 4: 加 alloc/free 回收编号      → 即将开始
补丁 n: ...
```

每一层补丁都在绕同一个缺失：**内容处理器不知道"我是谁"**。

### 0.2 根因

`CardContentHandler` 接口签名是 `activate(contentEl)` / `deactivate(contentEl)`——收到一个裸 `<div>`，没有所属卡片的：

- `id` — 我是哪个卡片？
- `state` — 当前是 compact / active / dismissed？
- `accents` — 用什么配色？
- `meta` — 该存哪类状态？

导致每个卡片类型各自用闭包变量、`Map<HTMLElement, State>`、`dataset` 偷渡来自己管理状态。

### 0.3 三个设计需求

| # | 层 | 职责 |
|---|-----|------|
| 1 | 静态类型注册表 | 一个文件声明全部卡片类型。增新卡必须走这里。 |
| 2 | 运行时实例注册表 | 当前打开的全部卡片实例。每实例：id / type / state / accents / meta。支持按类型过滤、按 DOM 查询。 |
| 3 | AI 工具层 | Registry snapshot 含卡片清单，AI 可通过命令操作卡片。 |

---

## §1 三层架构总览

```
┌─ 静态类型注册表（init-time）───────────────────────────┐
│  CardTypeDef                                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │ typeId: 'debug' | 'card03' | 'file' | 'settings'  │ │
│  │ icon / name / description                          │ │
│  │ kind: 'tool' | 'file'                              │ │
│  │ createHandler: (meta) => CardContentHandler        │ │
│  │ registerCardType(def) — 这里是唯一入口              │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ 注册类型
┌─ 运行时实例注册表（runtime）───────────────────────────┐
│  CardInstance                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ instanceId: UUID                                   │ │
│  │ typeId → CardTypeDef                               │ │
│  │ el / contentEl                                     │ │
│  │ state: compact | active | editing | dismissing      │ │
│  │ accents: { color1, color2 }                        │ │
│  │ meta: Record<string, unknown> — 类型扩展槽          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  CardRegistry 类                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │ registerType / createInstance / destroyInstance    │ │
│  │ getInstance / getInstanceByContentEl / getAll      │ │
│  │ getByType / updateState / count                     │ │
│  │ allocId(pool) / freeId(pool, id) — 按池分配编号     │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ snapshot
┌─ AI 工具层（API）─────────────────────────────────────┐
│  Registry.snapshot() 含卡片列表                         │
│  wsChannel.onCommand: focus-card / close-card / ...    │
└───────────────────────────────────────────────────────┘
```

---

## §2 静态类型注册表

### 2.1 CardTypeDef 接口

```typescript
interface CardTypeDef {
  /** 类型 ID。与 card-stack.ts _cards[].id 一致 */
  typeId: string;

  /** 标题栏图标 */
  icon: string;

  /** 默认标题名称 */
  name: string;

  /** 简要描述 */
  description: string;

  /** 种类：工具卡（独立生命周期）或文件卡（与文件绑定） */
  kind: 'tool' | 'file';

  /** 创建内容处理器 */
  createHandler: (meta: Record<string, unknown>) => CardContentHandler;
}
```

### 2.2 注册

```typescript
// src/client/modules/card-registry.ts

const _typeDefs = new Map<string, CardTypeDef>();

export function registerCardType(def: CardTypeDef): void {
  if (_typeDefs.has(def.typeId)) {
    log('[warn] [card-registry] 重复注册卡片类型: ' + def.typeId);
  }
  _typeDefs.set(def.typeId, def);
}

export function getCardType(typeId: string): CardTypeDef | undefined {
  return _typeDefs.get(typeId);
}

export function getAllCardTypes(): CardTypeDef[] {
  return [..._typeDefs.values()];
}
```

### 2.3 增新卡片的唯一入口

```typescript
// 示例：注册终端卡
registerCardType({
  typeId: 'card03',
  icon: '>',
  name: '终端',
  description: '命令行终端模拟器',
  kind: 'tool',
  createHandler: createTerminalHandler,
});
```

**约束**：所有卡片类型必须在 `initializeCardTypes()` 中调用 `registerCardType()`。不经过这个入口的类型不合法。

---

## §3 运行时实例注册表

### 3.1 CardInstance 接口

```typescript
interface CardInstance {
  /** 全局唯一运行时 ID（UUID） */
  instanceId: string;

  /** 指向 CardTypeDef.typeId */
  typeId: string;

  /** 外层卡片 DOM 元素 */
  el: HTMLElement;

  /** 内容容器 DOM 元素 */
  contentEl: HTMLElement;

  /** 当前状态 */
  state: 'compact' | 'active' | 'editing' | 'dismissing';

  /** 边框渐变色 */
  accents: { color1: string; color2: string };

  /** 类型扩展数据（终端卡存 terminalId/sessionId，文件卡存 filePath） */
  meta: Record<string, unknown>;

  /** 创建时间戳 */
  createdAt: number;
}
```

### 3.2 CardRegistry 类

```typescript
class CardRegistry {
  private _instances = new Map<string, CardInstance>();
  private _byContentEl = new WeakMap<HTMLElement, CardInstance>();
  private _idPools = new Map<string, Set<number>>();

  /** 创建卡片实例（由 floating-card.ts 调用） */
  createInstance(typeId: string, el: HTMLElement, contentEl: HTMLElement,
                 accents: { color1: string; color2: string }): CardInstance {
    const instance: CardInstance = {
      instanceId: crypto.randomUUID(),
      typeId,
      el,
      contentEl,
      state: 'active',
      accents,
      meta: {},
      createdAt: Date.now(),
    };
    this._instances.set(instance.instanceId, instance);
    this._byContentEl.set(contentEl, instance);
    return instance;
  }

  /** 销毁卡片实例（由 floating-card.ts 调用） */
  destroyInstance(instanceId: string): void {
    const inst = this._instances.get(instanceId);
    if (inst) {
      this._byContentEl.delete(inst.contentEl);
      this._instances.delete(instanceId);
    }
  }

  /** 按 instanceId 查询 */
  getInstance(instanceId: string): CardInstance | undefined {
    return this._instances.get(instanceId);
  }

  /** 按 contentEl 查询（内容处理器用） */
  getInstanceByContentEl(el: HTMLElement): CardInstance | undefined {
    return this._byContentEl.get(el);
  }

  /** 全部活跃实例 */
  getAll(): CardInstance[] {
    return [...this._instances.values()];
  }

  /** 按类型筛选 */
  getByType(typeId: string): CardInstance[] {
    return this.getAll().filter(i => i.typeId === typeId);
  }

  /** 更新实例状态（由 floating-card.ts 调用） */
  updateState(instanceId: string, state: CardInstance['state']): void {
    const inst = this._instances.get(instanceId);
    if (inst) inst.state = state;
  }

  /** 在指定池中分配最小可用编号 */
  allocId(pool: string): number {
    let ids = this._idPools.get(pool);
    if (!ids) { ids = new Set(); this._idPools.set(pool, ids); }
    let id = 1;
    while (ids.has(id)) id++;
    ids.add(id);
    return id;
  }

  /** 在指定池中释放编号 */
  freeId(pool: string, id: number): void {
    this._idPools.get(pool)?.delete(id);
  }

  /** 当前活跃实例数 */
  get count(): number { return this._instances.size; }
}

export const cardRegistry = new CardRegistry();
```

---

## §4 集成到现有系统

### 4.1 card-stack.ts — 改用 registerCardType

**现在**：
```typescript
const _cards: CardDef[] = [
  { id: 'debug', icon: '🔧', name: '日志管理', desc: '' },
  { id: 'card03', icon: '>', name: '终端', desc: '' },
  ...
];
_registerCardHandler('debug', { activate, deactivate });
_registerCardHandler('card03', createTerminalHandler());
```

**改后**（在 `initCardStack()` 或一个集中的 `initCardTypes()` 函数里）：
```typescript
registerCardType({
  typeId: 'debug', icon: '🔧', name: '日志管理', description: '',
  kind: 'tool', createHandler: createDebugHandler,
});
registerCardType({
  typeId: 'card03', icon: '>', name: '终端', description: '',
  kind: 'tool', createHandler: (_meta) => createTerminalHandler(_meta),
});

// 文件卡类型由 tree-swipe.ts 注册：
registerCardType({
  typeId: 'file', icon: '', name: '', description: '',
  kind: 'file', createHandler: (meta) => createFileHandler(meta),
});
```

`_cards` 数组改为从 `getAllCardTypes()` 生成，保证类型定义一致。

### 4.2 floating-card.ts — 接入实例注册表

| 操作 | 调用 |
|------|------|
| `createFloatingCard()` | `CardRegistry.createInstance(typeId, el, contentEl, accents)` |
| `dismissFloatingCard()` | `CardRegistry.destroyInstance(instanceId)` |
| `_toggleExpandCollapse()` 状态变化 | `CardRegistry.updateState(instanceId, newState)` |
| `config.contentHandler.activate(contentEl)` | 改为 `activate(contentEl, instance)` |

`FloatingCardConfig` 新增 `typeId: string` 字段。`createFloatingCard` 的所有调用方必须提供此字段（card-stack 用 `getCardId(idx)`，tree-swipe 用 `'file'`）。

**CardContentHandler 新签名**：
```typescript
interface CardContentHandler {
  activate(contentEl: HTMLElement, card: CardInstance): void;
  deactivate(contentEl: HTMLElement, card: CardInstance): void;
}
```

### 4.3 去掉 dataset 偷渡

现在 `floating-card.ts` 有：
```typescript
contentEl.dataset.cardAccent1 = config.color1;
contentEl.dataset.cardAccent2 = config.color2;
```

改后：`CardInstance.accents` 直接携带，删掉这两行。

各处理器改用：
```typescript
const c1 = card.accents.color1;
const c2 = card.accents.color2;
```

### 4.4 state.ts — 关系

`KFMState.openCards` 曾是设计中的跟踪数组，但从未接线。CardRegistry 建成后，`openCards` 弃用。AI snapshot 从 `CardRegistry.getAll()` 读取。

---

## §5 终端卡改造

### 5.1 删除的补丁

| 删掉 | 取而代之 |
|------|---------|
| `_states: Map<HTMLElement, CardState>` | `CardRegistry.getInstanceByContentEl(contentEl)` |
| `_terminalId` 自增 + alloc/free 逻辑 | `cardRegistry.allocId('card03')` / `freeId('card03', id)` |
| `dataset.cardAccent1/2` 读取 | `card.accents` |
| `contentEl.isConnected` 判断 | `card.state` |

### 5.2 改后 activate / deactivate

```typescript
activate(contentEl, card) {
  if (!card.meta.terminalId) {
    card.meta.terminalId = cardRegistry.allocId('card03');
  }
  const terminalName = '终端 ' + card.meta.terminalId;
  // buildCardLayout 用 card.accents
  // 新建 renderer + WS 桥接
  // sessionId 存 card.meta.sessionId
}

deactivate(contentEl, card) {
  if (card.state === 'dismissing') {
    cardRegistry.freeId('card03', card.meta.terminalId as number);
    // terminal-close PTY session
  }
  // compact 时什么都不做——保持 PTY 和编号
}
```

### 5.3 效果

| 场景 | 之前 | 之后 |
|------|------|------|
| 发射终端卡 | 获取编号 N | 同 |
| 紧缩 | PTY 断开，编号丢失 | PTY 保持，编号保留 |
| 再展开 | 获取新编号 N+1 | 复用原编号，重连 PTY |
| 关闭 | 编号释放 | 同 |
| 再发射 | 编号继续自增 | 复用最小空闲号 |

---

## §6 AI 工具层（设计方向）

### 6.1 不在本次实施范围

本章描述方向，具体实施待 AI 能力 Phase 开始。

### 6.2 快照注入

`Registry.snapshot()` 已推送 `PageDescription` 到服务器。增加 `cards` 字段：

```typescript
const cards = cardRegistry.getAll().map(c => ({
  instanceId: c.instanceId,
  typeId: c.typeId,
  state: c.state,
  name: c.meta.terminalId ? '终端 ' + c.meta.terminalId : undefined,
}));
```

AI agent 通过 `GET /api/ui/snapshot` 可获取当前全部卡片。

### 6.3 卡片操作命令

扩展 `wsChannel.onCommand`（与现有 `open-card-stack` 等共用通道）：

| 命令 | 参数 | 行为 |
|------|------|------|
| `focus-card` | `{ instanceId }` | 聚焦指定卡片 |
| `close-card` | `{ instanceId }` | 关闭指定卡片 |
| `send-to-card` | `{ instanceId, data }` | 往终端卡注入输入或往编辑器卡注入内容 |

---

## §7 实施计划

| 步骤 | 文件 | 内容 | 估行 |
|------|------|------|------|
| 1 | `src/client/modules/card-registry.ts`（新建） | `CardTypeDef` + `CardInstance` + `CardRegistry` 类 | ~80 |
| 2 | `card-stack.ts` | `initCardTypes()` 集中调用 `registerCardType()`；`_cards` 从 registry 生成 | ~15 |
| 3 | `floating-card.ts` | `createFloatingCard` 调 `createInstance`；`dismiss` 调 `destroyInstance`；handler 签名扩展 +card 参数；删 dataset 偷渡 | ~20 |
| 4 | `terminal-card.ts` | 删 `_states` / `_terminalId` / dataset 读；从 `card` 取 state / accents / meta | ~15 |
| 5 | `handler-factory.ts` | activate/deactivate 签名适配 +card 参数 | ~3 |
| **净增** | | | **~133** |

**实施状态**：步骤 1-5 全部完成。

### 依赖链

```
1（新建 card-registry.ts）
  ├── 2（card-stack 改用 registerCardType）
  ├── 3（floating-card 接入实例注册）
  │     └── 4（terminal-card 切 card 参数）
  ├── 4、5 可并行
  └── 6（check-cards.mjs 校验）
```

---

### 构建验证：`check-cards.mjs`

作为 `npm run check` 的第 9 个脚本，验证规则：

> 每个 `getCardType('xxx')` 静态引用必须有对应的 `registerCardType({ typeId: 'xxx' })`。

实现：正则扫描 `src/client/modules/` 下所有 `.ts` 文件，收集注册和引用的 typeId，取差集。差集非空时报错阻断 build。

当前状态：3 个类型已注册（debug / card03 / file），1 个静态引用（`getCardType('file')`），零违规。

---

## §8 开放问题

### 8.1 文件位置

**问**：`card-registry.ts` 放 `src/client/modules/` 还是 `src/client/cards/`？

**答**：放 `modules/`。`src/client/cards/` 目录目前不存在，建目录放一个文件是过度设计。等未来 card 相关文件超过 3 个再搬迁。
**状态**：✅ 已决策，已实施。

### 8.2 allocId / freeId 放哪

**问**：编号分配器放 CardRegistry 还是各卡片类型自己管？

**答**：放 CardRegistry，作为按池（pool）分配的通用机制。不存在不需要的卡片类型不调用。消除了未来其他多实例卡片类型重复实现编号逻辑的可能性。
**状态**：✅ 已实施。

### 8.3 AI 层命令通道

**问**：AI 层卡片命令是否共用 `wsChannel.onCommand`？

**答**：是。已有 12 个命令处理器走此通道。加 `focus-card`、`close-card`、`send-to-card` 三个即可，无需新协议。
**状态**：📝 设计已定，留待 Phase AI 实施。

### 8.4 ContentHandler 签名兼容

**问**：改了 `CardContentHandler` 签名后，现有的 `activate(contentEl)` 调用处怎么兼容？

**答**：有 3 处调用——`createFloatingCard()` 首次激活、`_toggleExpandCollapse` 展开分支，以及 `_renderFloatingContent` 后的激活。全部在 `floating-card.ts` 内，集中改 3 处即可。

### 8.5 file 类型卡片不在 card-stack _cards 里

**问**：文件卡不经过卡片堆发射，`CardTypeDef` 是否要注册它？

**答**：要。`tree-swipe.ts` 的 `deployAllCards()` 和未来可能的新入口都创建文件卡。在类型注册表里声明文件卡类型，使其在 AI snapshot 中也有合法的 `typeId`。

---

> **本文档与代码同步。实施过程中如发现设计漏洞，先更新本文再改代码。**
