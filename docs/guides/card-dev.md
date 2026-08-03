> 这是什么：卡片插件开发指南——写新 .card.ts 前必读。
> 别的去哪找：卡片域契约 → ../domains/floating-card/contract.md；注册表配对/手势优先级 → ../domains/client-shell/contract.md；视觉决策史 → vision.md；心法 → ../constraints/invariants.md。

# KFM v4 — 卡片插件开发指南

> **本文档面向想为 KFM 添加新功能卡片的开发者。**
> 读完本文，你应该能写出一个新的 `.card.ts` 文件并让它出现在卡片堆中。
>
> 迁移注（2026-07-28）：自 docs/development/CARD_DEV_GUIDE.md 迁入（原文 v8.2 注销，git show v8.1.1 考古）。§10 视觉规范归位
> （原文乱序插在 §11 后），目录补全 §11/§12；§12.2 重复表、§10.1 示例碎屑、版本脚注删除。

---

## 目录

1. 快速开始：5 分钟加一张卡
2. 插件文件规范
3. CardTypeDef 接口
4. 内容生命周期
5. 注册与发现
6. 手势配接
7. 数据接入
8. 卡片类型与 UI 位置
9. 检核清单
10. 卡片的视觉规范
11. 可复用组件
12. 开发教训

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

### 手势优先级

优先级全表见 `../domains/client-shell/contract.md` 手势优先级节（唯一来源）。

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

const orbColor = theme.cornerOrb.color;          // 光球色
const bgColor = theme.surface.bgLight;            // 背景色
const accent = card?.accents?.color1;             // 卡片主色（来自运行时实例）
```

**规则**：新增颜色只能在 `theme.ts` 中定义，禁止在卡片 handler 中硬编码色值
（唯一来源规则的家 → ../domains/canvas-tree/contract.md「两个唯一来源」）。

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
- [ ] 所有文字是否使用 `var(--card-font-size,Xpx)` 替代硬编码 `font-size:Xpx`？（否则双指缩放无效）


---
## 10. 卡片的视觉规范

### 10.0 层级归属原则

**卡片内没有"裸元素"。** 每个可见元素必须归属于某一层卡片框。同层元素统一使用同款边框、同款间距、同款渐变方向。

**基础样式必须用公共 helper（`src/client/cards/card-ui.ts`）**——`innerCardStyle(c1,c2)`（二级反色框）、`inputStyle()`、`btnStyle(accent)`、`mkRow(label)`。禁止手写内卡 cssText（2026-08-03 注入卡 UI 不同步审计：内卡样式曾被 6 张卡手抄 20+ 次且遍数不同——无模板必漂移）。新卡 import 即用，样式天然一致。

```
┌─ 外壳（一层 c1→c2）                         floating-card.ts 自动处理
│  ┌─ 编辑器/预览框（二层 c2→c1 反色）         margin-top:6px 与标题线留间距
│  │  选择器、编辑字段、操作按钮               btnStyle 全宽 flex:1
│  └─────────────────────────────────────
│  ┌─ 池框（二层 c2→c1 反色）                 直接衔接，不用分隔线
│  │  ┌─ 行（默认）────────────────── ✕ ─┐   
│  │  ├─ 行（选中，三层 c1→c2 渐变）─── ✕ ┤   三层正向渐变边框
│  │  └─ 行（默认）────────────────── ✕ ─┘   
│  └─────────────────────────────────────
└─────────────────────────────────────────
```

**约束**：
- 按钮必须在编辑器框内部，不能悬在框之间
- 两个二层框直接衔接，无需分隔线——外层边框已足够区隔
- 首个二层框必须设 `margin-top:6px`，与 `buildCardLayout` 的标题分隔线留出标准间距
- 所有同层元素的 `border-radius`、`padding`、`border-left-width` 保持一致
- **提示文本不使用 emoji 图标**：所有错误提示、状态消息使用纯文本，禁止使用 ⚠/🔧/✓/✗/⏹ 等 emoji。用方括号标记状态即可（如 `[错误: ...]`、`[已取消]`）。

新卡片必须遵守此骨架。
---

### 10.1 内容结构

必须使用 `buildCardLayout()` 创建标准布局：

```typescript
import { buildCardLayout } from '../../modules/floating-card.js';

function createMyHandler(meta): CardContentHandler {
  return {
    activate(contentEl, card, reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, title, c1, c2);
      // bodyEl 里放你的内容
    },
  };
const bg = theme.surface?.bgLight || 'rgba(10,10,15,0.85)';  // 背景色
const accent = card?.accents?.color1;                         // 卡片主色
```

`buildCardLayout()` 产出三层结构：

```
┌─ header ──────────────────┐  ← 标题栏 11px 600w
├─ divider（渐变分隔线）─────┤  ← 取自卡片 accent 色
│  body                     │  ← flex:1 你的内容区域
└───────────────────────────┘

**覆写 `bodyEl.style` 的强制规则**：如果需要自定义 bodyEl 样式，必须保留 `flex:1` 和 `overflow-y:auto`：

```typescript
// ❌ 错误：丢了 flex:1 和 overflow
bodyEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:0 10px';

// ✅ 正确：保留 buildCardLayout 的关键属性
bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto';
```

缺少 `flex:1` → bodyEl 高度坍缩为内容高度，永不溢出。缺少 `overflow-y:auto` → 内容超出不可滚。
```

禁止自建标题栏——否则点击/长按/拖拽手势路径会错过卡片框架。

**内卡与标题线的间距**：内卡（编辑区）顶部必须设 `margin-top:6px`，与标题分隔线留出标准间距。
**选择器位置**：顶部选择器必须放在内卡内部的第一行（作为 `mkRow` 的一个字段），禁止独立于内卡之外。

### 10.2 主题色引用

所有颜色引用自 `theme.ts`，禁止硬编码十六进制色值（家 → canvas-tree 契约「两个唯一来源」）：

```typescript
import { currentTheme as theme } from '../../modules/theme.js';

const bg = theme.surface?.bgLight || 'rgba(10,10,15,0.85)';  // 背景色
const accent = card?.accents?.color1;                         // 卡片主色
```
卡片注册时从 `card-registry` 获得 `accents`（`color1`/`color2`），作为标题、边框、高亮的来源。

#### 10.2.1 文字颜色的可读性

**accent 色只用于边框和装饰，不用于文字。** accent 色是动态分配的，可能落在亮色区间，与白色背景冲突。

文字一律用白色系：

| 用途 | 颜色 |
|------|------|
| 标题 | `rgba(255,255,255,0.85)` |
| 正文 | `rgba(255,255,255,0.75)` |
| 次级 | `rgba(255,255,255,0.5)` |

颜色信息通过边框/装饰线传达，不依赖文字颜色。

### 10.3 间距与字号

| 属性 | 值 | 说明 |
|------|-----|------|
| 标题字号 | `11px` `600` | header 文字 |
| 正文字号 | `10px`–`12px` | 内容区建议范围 |
| 内部圆角 | `6px`–`10px` | 卡片内控件 |
| 行间距 | `6px`–`10px` | 纵向排列间距 |
| body 内边距 | `0 10px` | `buildCardLayout` 自带 |
| 双指缩放字号 | `font-size:var(--card-font-size,Xpx)` | 替代硬编码 `font-size:Xpx`，使内容响应双指缩放手势 |

> **必须**：卡片内所有文字字号使用 `var(--card-font-size,Xpx)` 替代硬编码 `font-size:Xpx`。X 是 fallback 默认值。
> 全局双指缩放手势（`gestures.ts` 中的 `pinch-zoom`）通过 CSS 变量 `--card-font-size` 调节所有卡片字号。
> 不使用 `--card-font-size` 的卡片（如 API 卡曾犯的错误）双指缩放无效。
>
> 加载存储字号：
> ```typescript
> const stored = localStorage.getItem('kfm-fontsize-' + typeId);
> if (stored) {
>   const parsed = JSON.parse(stored);
>   if (typeof parsed.fontSize === 'number')
>     contentEl.style.setProperty('--card-font-size', parsed.fontSize + 'px');
> }
> ```

### 10.4 滚动与手势

- 内容区滚动：`overflow-y: auto; touch-action: pan-y`
- `pan-y` 确保横滑透传给全局手势（唤侧栏/卡片堆）
- 独立横滑区域（标签栏）：`overflow-x: auto; touch-action: pan-x`，高度 ~30px

### 10.4.1 操作按钮

**所有卡片底部的操作按钮（保存/新建/删除等）必须全宽铺满。**

容器：
```typescript
btnRow.style.cssText = 'display:flex;gap:6px';
```

按钮样式（`btnStyle` 函数）：
```
padding:0.3em 0.8em; border-radius:6px; flex:1; text-align:center; ...
```

关键：`flex: 1` 确保按钮均分容器宽度。禁止出现短按钮（无 `flex:1` 的按钮会收缩到内容宽度）。

按钮数量与宽度关系：
- 2 个按钮：各占 50%
- 3 个按钮：各占 33%

| 场景 | 存储方式 | 示例 |
|------|---------|------|
| 用户配置 | `localStorage` key 前缀 `kfm-` | `kfm-ai.apiUrl` |
| 卡片实例状态 | `card.meta` | `meta.terminalId` |
| 全局状态变更 | `KFMState.notify()` | — |
| AI 可见状态 | `Registry.registerElement()` | — |

### 10.6 边框

卡片的容器边框使用左粗三边设计：左边 3px，其他三边 1px。均使用渐变色。

#### 浮卡外壳（由 `floating-card.ts` 自动处理）

```css
padding: 1px;
padding-left: 3px;
background: linear-gradient(135deg, {color1} 30%, {color2} 70%);
```

内容 handler 不需要处理外壳边框。

#### 内容区内部卡片

如果内容区需要内部分组卡片，使用同款渐变边框 + 暗色填充（颜色反转，同饱和度）：

```css
border-radius: 10px;
border: 1px solid transparent;
border-left-width: 3px;
background:
  linear-gradient(rgba(10,10,15,0.92), rgba(10,10,15,0.92)) padding-box,
  linear-gradient(135deg, {color2} 30%, {color1} 70%) border-box;
padding: 8px 10px;
```

颜色反转规则：`{color1}` 和 `{color2}` 交换位置。**透明度不降**——内外卡保持相同的饱和度和视觉重量。

### 10.7 多级嵌套的颜色交替

当内容区需要多级卡片嵌套时，边框颜色逐层交替：

| 层级 | 边框配色 |
|------|---------|
| 0（浮卡外壳） | `color1→color2` |
| 1（内卡） | `color2→color1`（反转） |
| 2（子卡） | `color1→color2`（还原） |
| 3（孙卡） | `color2→color1`（反转） |

**池列表内选中行的渐变**属于第 2 层（子卡），使用还原方向：

```css
/* 池列表行 — 默认态 */
padding: 6px 8px; margin-bottom: 4px; border-radius: 6px;
border: 1px solid transparent; border-left-width: 3px;
background: rgba(255,255,255,0.03);

/* 池列表行 — 选中态（渐变边框，正向） */
border-color: transparent;
background:
  linear-gradient(rgba(10,10,15,0.92), rgba(10,10,15,0.92)) padding-box,
  linear-gradient(135deg, {color1} 30%, {color2} 70%) border-box;

/* 池列表行 — hover 态 */
background: rgba(255,255,255,0.06);
```

**池列表行布局**：双行结构，标题行 + 元信息行。

```html
┌──────────────────────────────┐
│  OpenCode Go            ✕   │  ← 标题行（font-weight:600, color:0.85）
│  20 模型                     │  ← 元信息行（font-size:9px, color:0.5）
└──────────────────────────────┘
```

- 标题：`font-size:var(--card-font-size,11px); color:rgba(255,255,255,0.85); font-weight:600`
- 元信息：`font-size:var(--card-font-size,9px); color:rgba(255,255,255,0.5)`
- 删除按钮：红色 `✕`（`color:rgba(255,100,100,0.6)`，hover 变亮至 `1`）
- 整行可点击切换选中，`e.stopPropagation()` 防止删除按钮触发行选中
- 删除前必须弹确认框（`showConfirm`）
- 选中行需同步更新顶部下拉框（`select.updateItems()`）

---

## 11. 可复用组件

项目提供了一组可复用的 UI 组件，可在所有卡片中使用。使用这些组件可以保持视觉一致性，并方便未来统一修改样式。

### 11.1 自定义下拉框 (`custom-select.ts`)

用于替代原生 `<select>` 元素，提供统一的下拉框样式。

```typescript
import { createCustomSelect, type CustomSelect } from '../../modules/custom-select.js';

const select = createCustomSelect({
  accent: '#00d4ff',           // 主题色
  placeholder: '请选择',       // 占位文本
  minWidth: 100,               // 最小宽度（默认 80）
  maxWidth: 200,               // 最大宽度（默认 200）
  onSelect: (value) => {       // 选择回调
    log('selected:', value);
  },
});

// 更新选项
select.updateItems([
  { label: '选项1', value: '1' },
  { label: '选项2', value: '2' },
], '1');  // 第二个参数为默认选中值

// 添加到 DOM
parent.appendChild(select.element);

// 获取/设置值
const value = select.getValue();
select.setValue('2');

// 销毁（在 deactivate 中调用）
select.destroy();
```

**样式特点**：
- 触发器：圆角 6px，背景 `rgba(255,255,255,0.06)`，边框 `rgba(255,255,255,0.1)`
- 下拉面板：固定定位，圆角 8px，背景 `rgba(20,16,32,0.96)`，毛玻璃效果
- 选项：悬停高亮，选中项显示 ✓ 标记
- 宽度：自适应内容，不超过 `maxWidth`

### 11.2 确认对话框 (`confirm-dialog.ts`)

用于替代原生 `confirm()` 函数，提供符合卡片风格的确认对话框。

```typescript
import { showConfirm } from '../../modules/confirm-dialog.js';

const confirmed = await showConfirm({
  title: '删除配置',                    // 标题
  message: '确定删除配置「主会话」？',    // 消息
  accent: '#00d4ff',                    // 主题色1（c1）
  accent2: '#7c3aed',                   // 主题色2（c2），用于双色渐变边框
  confirmText: '删除',                  // 确认按钮文本
  cancelText: '取消',                   // 取消按钮文本
});
  // 执行操作
}
```

**样式特点**：
- 遮罩层：半透明黑色（`rgba(0,0,0,0.5)`），毛玻璃效果
- 对话框：双色渐变边框（`linear-gradient(135deg, c1, c2)`），与卡片二层框同款，暗色背景，圆角 12px
- 键盘：Enter 确认，Escape 取消

### 11.3 使用建议

1. **在 `activate()` 中创建组件**，在 `deactivate()` 中销毁
2. **使用 `card?.accents?.color1` 作为 accent 色**，保持与卡片主题一致
3. **不要硬编码颜色**，使用主题色或 accent 色
4. **组件会自动处理事件监听**，无需手动清理


---

## 12. 开发教训

### 12.1 下拉框开发 Checklist

开发自定义下拉框时，逐条确认：

- [ ] **方向**：底部栏的下拉框向上弹出（`direction: 'up'`），顶部栏向下弹出（`direction: 'down'`）
- [ ] **面板定位**：`position:fixed` 的面板必须附加到 `document.body`，不能附加到 `position:relative` 的容器内
- [ ] **字号规范**：使用 `var(--card-font-size,Xpx)` 替代硬编码 `font-size:Xpx`
- [ ] **作用域**：变量需要在使用前定义，函数需要在调用前声明
- [ ] **事件绑定**：在元素存在后才能绑定事件，不能在元素创建前绑定
- [ ] **增量验证**：每修改一个地方就验证一次，不要一次修改多个地方

### 12.2 开发流程

1. **先研究现有实现**：查看类似功能的代码，理解设计模式
2. **理解隐式契约**：不确定时先问，不要假设
3. **增量开发**：一次只改一个地方，验证后再改下一个
4. **遵循文档**：严格按照文档规范，不要自创规则

