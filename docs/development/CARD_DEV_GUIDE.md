# KFM v4 — 卡片插件开发指南

> **本文档面向想为 KFM 添加新功能卡片的开发者。**
> 读完本文，你应该能写出一个新的 `.card.ts` 文件并让它出现在卡片堆中。

---

## 目录

1. [快速开始：5 分钟加一张卡](#1-快速开始5-分钟加一张卡)
2. [插件文件规范](#2-插件文件规范)
3. [CardTypeDef 接口](#3-cardtypedef-接口)
4. [内容生命周期](#4-内容生命周期)
5. [注册与发现](#5-注册与发现)
6. [手势配接](#6-手势配接)
7. [数据接入](#7-数据接入)
8. [卡片类型与 UI 位置](#8-卡片类型与-ui-位置)
9. [检核清单](#9-检核清单)

---

## 1. 快速开始：5 分钟加一张卡

在 `src/client/cards/plugins/` 下新建 `hello.card.ts`：

```typescript
/**
 * hello.card.ts — 你好世界卡
 */
import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';

function createHelloHandler(meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl, card, reason) {
      contentEl.innerHTML = '<div style="padding:20px;color:white;font-size:18px">Hello, KFM!</div>';
    },
    deactivate(contentEl, card, reason) {
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'hello',
  icon: '👋',
  name: '你好世界',
  description: '示例卡片',
  kind: 'tool',
  createHandler: createHelloHandler,
});
```

在 `src/client/cards/registry.ts` 加一行：

```typescript
import './plugins/hello.card.js';
```

运行 `npm run build` → 刷新浏览器 → 新卡片出现在卡片堆中。

---

## 2. 插件文件规范

```
src/client/cards/
  types.ts              ← 公开类型（供 import）
  registry.ts           ← 注册中心：import 所有 .card.ts
  plugins/
    *.card.ts           ← 每张卡一个文件
```

### 文件命名

- `{功能名称}.card.ts` — 如 `terminal.card.ts`、`debug.card.ts`
- 全部小写 + 连字符（kebab-case）
- `.card.ts` 后缀用来区别于普通模块文件

### 文件导出

每个 `.card.ts` 文件**不需要导出任何东西**。注册通过 import 时的副作用完成（`registerCardType()` 调用）。

但内容处理器工厂函数应该导出，以便其他模块在必要时引用：

```typescript
export function createHelloHandler(meta: Record<string, unknown>): CardContentHandler { ... }
```

---

## 3. CardTypeDef 接口

```typescript
interface CardTypeDef {
  typeId: string;                                    // 唯一 ID，如 'hello'
  icon: string;                                      // 标题栏图标（Emoji 或 SVG）
  name: string;                                      // 显示名称
  description: string;                               // 简短描述
  kind: 'tool' | 'file';                             // 种类
  createHandler: (meta: Record<string, unknown>)     // 工厂函数
    => CardContentHandler;
}
```

| 字段 | 说明 |
|------|------|
| `typeId` | 全局唯一的卡片类型标识。一旦确定不应更改，因为可能已持久化到 `localStorage` |
| `icon` | 标题栏左侧图标。建议使用 Emoji（`'\uD83D\uDD27'`）或简短 SVG |
| `kind` | `'tool'` = 独立工具卡（在卡片堆中）；`'file'` = 与文件绑定的卡（通过滑动创建） |

---

## 4. 内容生命周期

每张卡的内容由 `CardContentHandler` 管理：

```typescript
interface CardContentHandler {
  activate(
    contentEl: HTMLElement,        // 内容容器 DOM 元素
    card: CardInstance | null,     // 卡片运行时实例（含 id/state/accents/meta）
    reason: string | undefined,    // 激活原因：'open' | 'focus' | undefined
  ): void;

  deactivate(
    contentEl: HTMLElement,
    card: CardInstance | null,
    reason: string | undefined,    // 停用原因：'close' | 'blur' | 'dismiss' | undefined
  ): void;
}
```

### 生命周期时序

```
compact（未激活）
  ↓  用户聚焦该卡
active
  ↓  activate(contentEl, card) 被调用  ← 在这里建 DOM
  ↓  用户操作卡片内容
  ↓  卡片切换/关闭
  ↓  deactivate(contentEl, card) 被调用  ← 在这里清理 DOM
compact（或 dismissed）
```

### 关键规则

1. **`activate()` 可能被多次调用**（切换聚焦 → 失焦 → 再聚焦）。每次调用时 `contentEl` 可能已被上一次 `deactivate()` 清空。
2. **`activate()` 收到的 `card` 参数可能为 `null`**（卡片堆中切换时）。始终加空值守卫。
3. **`deactivate()` 必须清理干净**：取消订阅、清空 `innerHTML`、释放 WeakMap 条目。
4. **`contentEl` 的样式由框架管理**（position/size/overflow）。不要在 handler 里改这些属性。

### 获取运行时上下文

通过 `card-registry.ts` 的 `getInstanceByContentEl()` 可以在 handler 外部查询卡片实例：

```typescript
import { cardRegistry } from '../../modules/card-registry.js';

const instance = cardRegistry.getInstanceByContentEl(contentEl);
if (instance) {
  const { instanceId, state, accents } = instance;
}
```

---

## 5. 注册与发现

### 注册流程

```
*.card.ts 文件
  ↓ import（副作用：registerCardType() 调用）
registry.ts（导入所有 .card.ts 文件）
  ↓ import
main.ts（import './cards/registry.js'）
```

### 注册 API

```typescript
import { registerCardType, getCardType, getAllCardTypes } from '../../modules/card-registry.js';

// 注册（在 .card.ts 里调用）
registerCardType({ typeId, icon, name, description, kind, createHandler });

// 查询（在其他模块里调用）
const type = getCardType('debug');        // → CardTypeDef | undefined
const all = getAllCardTypes();            // → CardTypeDef[]
```

### 注意事项

- **重复注册**：同一个 `typeId` 第二次 `registerCardType()` 会打 Warning 并替换旧注册
- **注册时机**：所有 `registerCardType()` 必须在 `main.ts` 初始化流程中完成。动态注册理论上可行但未测试

---

## 6. 手势配接

如果卡片需要处理触摸/鼠标事件，通过 `gesture-registry.ts` 注册：

```typescript
import { gestures } from '../../modules/gesture-registry.js';

// 在 activate() 中注册
const unreg = gestures.register({
  id: 'my-card-gesture',               // 唯一 ID
  targetFilter: '.my-card-selector',    // CSS 选择器
  priority: 50,                         // 优先级（参考下方表格）
  onStart: (e) => { /* 手势开始 */ },
  onMove: (e, dx, dy) => { /* 手势移动 */ },
  onEnd: (e, dx, dy, elapsed) => { /* 手势结束 */ },
  stopPropagation: true,                // 可选：阻止事件冒泡
});

// 在 deactivate() 中注销
unreg();
```

### 手势优先级表

| 优先级 | 处理器 | 说明 |
|--------|--------|------|
| 110 | picker-lock | 根目录选择器（全局屏蔽） |
| 100 | orb | 光球拖拽 |
| 100 | floating-orb | 浮卡拖拽 |
| 90 | card-stack | 卡片堆切换 |
| 80 | card-stack-global | 卡片堆全局手势 |
| 60 | sidebar-scroll | 侧栏滚动 |
| 50 | page-swipe | 页面滑动 |

新增卡片的建议优先级：
- 卡片内操作（点击按钮、滚动内容）：不注册全局手势，用 DOM 事件即可
- 卡片拖拽/缩放：注册 `onPinchStart/Move/End`，优先级 85-95
- 需独占手势：最高可用 105（不高于 110 以免挡住 picker-lock）

### 双指缩放

```typescript
gestures.register({
  id: 'my-card-pinch',
  targetFilter: '.my-card-selector',
  priority: 85,
  onPinchStart: (e, scale) => { /* 保存初始状态 */ },
  onPinchMove: (e, scale) => { /* 应用缩放 */ },
  onPinchEnd: (e, scale) => { /* 锁定缩放结果 */ },
});
```

> **注意**：`gesture-registry.ts` 全项目统一使用 PointerEvent。禁止在卡片 handler 中直接 `addEventListener('touchstart/pointermove/pointerup')`。

---

## 7. 数据接入

### 主题色

```typescript
import { currentTheme as theme } from '../../modules/theme.js';

// 使用主题色
const orbColor = theme.cornerOrb.color;      // 光球色
const bgColor = theme.colors.surface;         // 背景色
const accent = card?.accents?.color1;         // 卡片主色（来自运行时实例）
```

**规则**：新增颜色只能在 `theme.ts` 中定义，禁止在卡片 handler 中硬编码色值。

### 全局状态

```typescript
import { KFMState } from '../../modules/state.js';

// 读取
const isOpen = KFMState.isSidebarOpen;
const rootPath = KFMState.currentRoot;

// 订阅变化
const unsub = KFMState.subscribe(() => { /* 状态变化了 */ });
// 记得在 deactivate() 中取消订阅
```

### UI 注册表

如果卡片内容需要被 AI agent 感知（snapshot 可见），注册 UI 元素：

```typescript
import { Registry } from '../../modules/ui-registry.js';

Registry.registerElement({
  id: 'my-card-status',
  type: 'indicator',
  label: '我的卡片状态',
  description: '显示在卡片标题栏',
  state: 'active',
  enabled: true,
  effect: '显示当前状态',
  source: 'hello.card.ts',
}, () => 'active');
```

### WebSocket 命令

如果卡片需要响应 AI agent 的命令：

```typescript
import { wsChannel } from '../../modules/ws-channel.js';

wsChannel.onCommand('my-card-do-something', (payload) => {
  // 执行操作
});
```

---

## 8. 卡片类型与 UI 位置

| 类型 | `kind` | 出现在 | 创建方式 | 示例 |
|------|--------|--------|----------|------|
| 工具卡 | `'tool'` | 卡片堆（右侧边缘左滑） | 用户水平滑动 | 终端、日志、tmux |
| 文件卡 | `'file'` | 全屏浮卡 | 文件行右滑 | 文件预览 |

### 工具卡 vs 文件卡

```typescript
// 工具卡：独立的固定功能
registerCardType({
  kind: 'tool',
  // 显示在卡片堆中，用户通过侧滑打开
});

// 文件卡：与文件绑定的临时内容
registerCardType({
  kind: 'file',
  // 不从卡片堆中直接展示，通过 tree-swipe 触发生成
});
```

### 卡片堆的排序

卡片堆中卡片出现的顺序由 `registry.ts` 中 `import` 的顺序决定。要调整顺序，调换 `registry.ts` 中的 `import` 行。

---

## 9. 检核清单

加一张新卡前，逐条确认：

- [ ] `typeId` 是否唯一且稳定？
- [ ] `deactivate()` 是否清理了所有资源（订阅、DOM、WeakMap 条目）？
- [ ] 手势处理器是否通过 `gesture-registry.ts` 注册？有没有直接 `addEventListener`？(违反心法)
- [ ] 颜色是否引用自 `theme.ts`？有没有硬编码色值？
- [ ] 如果卡片状态需要在 AI snapshot 中可见，是否调用了 `Registry.registerElement()`？
- [ ] 状态变化时是否调用了 `Registry.notifyStateChange()`？
- [ ] 是否在 `registry.ts` 中添加了 `import`？
- [ ] `npm run check` 通过？
- [ ] `npm test` 通过？
- [ ] 卡片在浏览器中可正确交互？

---

> **版本**：v1.0（随卡片插件系统首次发布）
>
> **与代码同步**：如接口变更，先更新本文档再改代码。
