---
status: active
version: v1.1
---
# UI Element Registry 设计讨论

> **版本**：v1.1
> **状态**：§S（产出定义）已于 2026-06-02 实现。代码见 `src/client/modules/ui-registry.ts`，
> MANIFEST 验证见 `check-registry.mjs`，已挂入 `npm run check` 管线。
> §1-§9 的设计讨论仍为有效参考，开放问题（§5）待后续 agent 继续讨论。
>
> **v1.0→v1.1 变更（2026-06-02）**：
> - 新增 `file-tree` 交互元素，`tree-render.ts` 接入 Registry
> - `notifyStateChange` 覆盖补全：`operation-toast`、`orb-panel`、`file-tree`
> - `check-registry.mjs` 扩展为三层 MANIFEST 验证（交互层 + 内容层 + 能力层）
> - 修复 `orb-panel` 缺少独立状态通知的问题
>
> **关联文档**：
> - `KFM_V4_INVARIANTS.md` — 本项目修改约束协议（本讨论引用的不变量来源）
> - `BUG_AUDIT_REGISTRY.md` — 历史踩坑记录（讨论中引用的案例）
> - `ARCHITECTURE.md` — 架构参考（注册中心模式）
> - `VISION_AND_ROADMAP.md` — 项目愿景，§1.4 "用户和 AI 对称操作"是 Registry 的核心理念来源

---

## §0 本篇的性质

> 这份文档由多轮 agent 讨论积累而成。
> 每一轮讨论的记录保留在 §10（设计演进史），供后来者理解当前方案为什么是这个形状。
>
> **读这篇文档的顺序**：
> 1. 先读 §1（核心设计意图）——这是项目所有者的原始需求，不能偏离
> 2. 再读 §2（架构）——当前提议的方案
> 3. 然后读 §5 / §6 的开放问题——哪些还没定，需要你讨论
> 4. 最后读 §10（演进史）——看看前面的 agent 已经考虑过什么
>
> **如果你不同意当前方案、想另走一条路，完全接受。** 只要不违反 §1 的核心意图，任何架构都可以。请把你的方案用文字补在 §7（备选方案）。设计在争论中收敛。

---

## §1 核心设计意图（不可违反）

> 以下内容来自项目所有者的多层口述整理。如果后续讨论偏离了这里列出的任意一条，说明方向错了。

### 1.1 Registry 的产品使命

Registry 是一个**导航目录（索引）**，它的职责是回答一个问题：

> **当前页面上有什么可交互的、可查看的、可调用的？**

具体来说：

1. **记录所有人和 AI 都能看到的 UI 元素**：页面上有什么按钮、卡片、输入栏、光球——它们在哪儿、当前什么状态、点了会怎样
2. **记录用户能看到的信息内容**：文件树里的文件名、卡片里的文本、当前聚焦的文件路径——不光是交互组件，还有屏幕上展示的信息
3. **记录 AI 独有的扩展能力**：文件搜索、全文检索、执行命令——这些不一定有对应的视觉按钮，但 AI 应该知道它们存在
4. **输出一个动态的页面描述**：这个描述（artifact）是 AI 理解当前界面的唯一入口。人在前端点击改变状态，AI 通过工具调用改变状态——**同一个产物反映双方的操作结果**

### 1.2 人与 AI 对称操作

这是不动摇的原则（来自 `VISION_AND_ROADMAP.md` §1.4）：

- 人能做什么（点按钮、拖拽卡片、展开文件），AI 就能做什么
- 人通过手势操作，AI 通过工具调用操作——效果相同，状态变化反映到同一个产物
- 交互不是预注册的"AI 工具集"，而是跟着 UI 元素走的——新增一个卡片的同时，人和 AI 都多了一个可操作的东西

### 1.3 人与 AI 不对称的部分（扩展能力）

AI 可以做人做不到的事：

- 文件搜索、全文检索、全局替换、执行命令、读取远端数据……
- 这些能力不一定有对应的视觉按钮，但 Registry 同样记录它们
- 扩展能力和 UI 元素在 Registry 中并列存在，AI 通过同一入口发现它们

### 1.4 Registry 不做的事（scope 边界）

- Registry **不负责调度操作**——它只告诉 AI "有什么"，不帮 AI "怎么点"
- Registry **不存储任何业务状态**——文件数据、展开状态、配置项仍然是 KFMState 的职责
- Registry **不渲染任何东西**——它只是描述，不是框架
- Registry **不复制手势系统的功能**——实际的事件路由仍然走 gesture-registry
- Registry **不存储 DOM 引用**——那是 dom-refs.ts 的职责

### 1.5 Artifact：人与 AI 对同一个界面的共用视图

Registry 产出的 snapshot（页面描述）不是一个"给 AI 看的静态报表"——
它是**人和 AI 对当前界面状态的共用视图**。

```
        人在前端点击 / 滑动 / 输入
                  │
                  ▼
          界面状态发生变化
                  │
                  ▼
         Registry.snapshot() 反映新状态
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
    人看到的变化           AI 看到的变化
                         （下次 ui_snapshot 调用）
                 ▲
                 │
            AI 调用工具 → 操作 UI
```

**这意味着三条重要的设计约束**：

1. **snapshot 必须是页面当前状态的精确投影。** 它不缓存、不推断、不预测——`state: 'collapsed'` 意味着此刻光球确实是收起的，不是"我记得之前是 collapsed"。
2. **snapshot 是双向可见的。** 人在前端操作后，AI 调 `ui_snapshot()` 拿到的页面描述，和人当前看到的页面是一致的。反之，AI 通过工具操作后，人看到的页面变化也会反映在下一次 snapshot 中。
3. **snapshot 是操作入口，不只是信息展示。** AI 读 snapshot 不是为了"了解一下"，而是为了决策下一步操作。每个元素的 `effect` 字段（§2.2 交互层）就是"如果你操作这个元素，会发生什么"——AI 用它来规划行为。

当前设计的所有决策都应该回到这条原则上验证：这个决定是否让 snapshot 更好地扮演"共用视图"的角色？如果让 snapshot 与真实状态产生偏差——那就是错误的方向。

---

> **以下内容经讨论后已定稿。后续 agent 除非有重大架构理由，不应修改此章节定义的结构。**

## §S 产出定义（已定稿）

> **一句话**：Registry 的产出是一个文件 + 一个强制验证机制。文件是 `ui-registry.ts`，验证机制挂入 `npm run check`。
>
> **它不产生任何运行时开销。** 不监听事件、不订阅状态、不启动 rAF。它是被动索引。

### S.1 文件清单

| 文件 | 用途 | 行数估计 |
|------|------|---------|
| `src/client/modules/ui-registry.ts` | Registry 类 + 全部类型定义 | ~253 行 |
| 各 `init*()` 函数中加 1 行 `Registry.register(...)` | 注册具体元素 | 每元素 +1 行 |
| `src/server/ai-tools.ts` | 将 snapshot 包装为 AI 可调用的 tool | ~50 行 |

> **核心只有一个文件**：`ui-registry.ts`。ai-tools.ts 是服务端包装层，不是 Registry 的一部分。

### S.2 `ui-registry.ts` 的类型定义

>以下类型定义是最终产物 `snapshot()` 的 schema。

```typescript
// ========= 交互层（页面上能点的东西） =========

type UIElementType = 'button' | 'text-input' | 'floating-button'
                     | 'floating-card' | 'panel' | 'icon';

/** 元素运行时状态（snapshot 时通过 getter 实时获取） */
type UIElementState = 'collapsed' | 'expanded' | 'compact' | 'active'
                    | 'inactive' | 'editing' | 'focused' | 'open'
                    | 'opening' | 'closed' | 'closing' | 'visible'
                    | 'hidden' | 'enabled';

interface InteractiveElement {
  id: string;
  type: UIElementType;
  label: string;
  description: string;
  state?: UIElementState;
  enabled: boolean;
  /** 操作此元素后的预期效果（供 AI 理解操作后果） */
  effect: string;
  /** 引用来源：该元素在哪个模块定义 */
  source?: string;
}

// ========= 内容层（页面上能看到的信息） =========

interface ContentBlock {
  id: string;
  type: 'file-tree' | 'card-content' | 'text-output' | 'status-bar';  // 'status-bar' 当前未使用（v1.1）
  summary: string;
  /** 详细内容（可选 —— 可能很大，需要单独请求） */
  detail?: string | Record<string, unknown>;
}

// ========= 能力层（AI 能调用的扩展操作） =========

interface Capability {
  id: string;
  name: string;
  description: string;
  parameters: { name: string; type: string }[];
  entry: string;
}

// ========= 产物：snapshot 输出 =========

interface PageDescription {
  elements: InteractiveElement[];
  content: ContentBlock[];
  capabilities: Capability[];
  timestamp: number;
}
```

**不包含**以下在原提案中讨论过但已否定的字段/方法：
❌ `action()` — 不通过 Registry 操作 UI
❌ `updateState()` — 状态留在各模块自己手里（改用 registerStateGetter 回调）
❌ `epoch` — 已删除
❌ `bounds` — 已删除（v1 不考虑）

### S.3 Registry 类的方法

```typescript
class UIElementRegistry {
  register(el: InteractiveElement): void;
  unregister(id: string): void;
  registerStateGetter(id: string, getter: () => UIElementState): void;
  registerContent(block: ContentBlock): void;
  registerContentGenerator(id: string, generator: () => ContentBlock): void;
  registerCapability(cap: Capability): void;
  notifyStateChange(id?: string): void;
  snapshot(): PageDescription;
  get(id: string): InteractiveElement | undefined;
  getRegisteredIds(): string[];
  getCapabilities(): Capability[];
  onChange(handler: RegistryChangeHandler): () => void;
  validate(manifest: string[]): string[];
}
```

> **方法说明**：
> - `registerStateGetter()` — 可选的状态获取器。注册后 `snapshot()` 会调用 getter 获取实时 state，代替注册时的静态值。如果元素的 `state` 会在运行时变化，必须在 `register()` 之后立即调用此方法。
> - `notifyStateChange()` — 通知 Registry 某个元素的状态发生了变化。各模块在 state getter 追踪不到的关键状态变化处调用，确保 ws-channel 能自动推送最新 snapshot。
> - `get()` — 按 id 查询单个元素（返回实时状态）。
> - `getRegisteredIds()` — 返回所有已注册的交互元素 id 列表（供 MANIFEST 验证用）。
>
> **已实现的扩展说明**：
> - `registerContentGenerator()` — 内容生成器。注册一个回调函数，`snapshot()` 调用它获取实时内容块。与 `registerContent()` 的区别：后者注册一次性静态值，前者注册实时生成函数。如果同一 id 同时有静态内容和生成器，生成器优先。
> - `getCapabilities()` — 返回所有已注册的能力列表（类型安全的替代 `_capabilities` 私有属性访问）。
> - `onChange()` — 注册变更回调。当 Registry 内容（元素/内容/能力）发生变化时通知。返回一个取消注册函数。供 `ws-channel` 等模块监听变化自动推送 snapshot。
> - `notifyStateChange()` — 通知 Registry 某个元素的状态发生了变化，触发 onChange 回调。各模块在关键状态变化处调用此方法，使 ws-channel 能自动推送最新 snapshot 到服务端。

### S.4 注册方式

每个 UI 元素在所属模块的 `init*()` 函数中注册，且只在一处注册。

```typescript
// 举例：orb.ts 的 initOrb() 函数末尾
Registry.register({
  id: 'orb',
  type: 'floating-button',
  label: '光球',
  description: 'AI 对话主入口',
  state: 'collapsed',
  enabled: true,
  effect: '点击后展开光球，显示 AI 输入框',
  source: 'orb.ts'
});
// 如果元素状态会变化，同时注册 state getter
Registry.registerStateGetter('orb', () => orbState);
```

模块不存储注册后的引用，不调 `updateState()`，不知道自己被注册了。

> **重要约定**：
> 1. 如果元素的 `state` 会在运行时变化，必须在 `register()` 之后立即调用 `registerStateGetter(id, getter)`。这样 `snapshot()` 就能返回实时状态，而不是注册时的一次性快照。纯静态元素（state 永远不会变化的）可以省略这一步。
> 2. 对于 state getter 无法覆盖的异步状态变化（如 GSAP 动画回调中的状态切换），在状态变化处调用 `Registry.notifyStateChange(id)`，触发 onChange 回调自动推送 snapshot。

### S.5 强制验证机制

> **不注册 = 构建中断。**

在 `npm run check`（或 `build.mjs`）中加一段验证：

```typescript
// 权威清单——新增 UI 元素时，同时在清单里加 id（完整列表见 check-registry.mjs）
const MANIFEST = [
  'orb',                  // orb.ts — AI 对话光球
  'orb-panel',            // orb.ts — AI 对话面板
  'sidebar',              // ui.ts — 文件树侧栏
  'sidebar-toggle-btn',   // app.ts — 侧栏召唤按钮
  'card-stack-toggle-btn',// app.ts — 卡片堆召唤按钮
  'close-sidebar-btn',    // app.ts — 关闭侧栏按钮
  'eye-btn',              // app.ts — 显示隐藏文件开关
  'card-stack',           // card-stack.ts — 堆叠卡片面板
  'input-bar',            // app.ts — AI 输入栏
  'operation-toast',      // app.ts — 操作提示
  'file-tree',            // tree-render.ts — Canvas 文件树（v1.1 新增）
];

const missing = Registry.validate(MANIFEST);
if (missing.length > 0) {
  console.error(`[ui-registry] 以下元素未注册：${missing.join(', ')}`);
  process.exit(1);
}
```

**新增一个交互元素必须完成两件事**，缺一不可：
1. 在模块的 `init*()` 中加 `Registry.register(...)`
2. 在 `MANIFEST` 数组中加对应的 id

漏掉任一步 → `npm run check` 失败。

此机制与 `check-as-any.mjs` 的白名单模式完全相同——清单本身就是强制契约。

### S.6 未来加功能时的代码增量

> **注意**：以下行数为最小估算，实际增量因元素复杂度而异。`register()` 调用本身约 8 行（含 id/type/label/description/state/enabled/effect/source），`registerStateGetter()` 约 2-3 行，MANIFEST 1 行，`notifyStateChange` 调用视状态变化路径数而定（通常 1-3 处）。

| 场景 | 最小行数 | 典型行数 | 需要改的文件 |
|------|---------|---------|------------|
| 新增一个静态按钮（state 不变） | +9 | +9 | 模块（8 行 register）+ MANIFEST（1 行 id）|
| 新增一个动态按钮（state 变化） | +12 | ~15 | 模块（8+3 行 register+stateGetter）+ MANIFEST（1 行）+ notifyStateChange 调用 |
| 新增一个浮卡 | +12 | ~15 | card-stack.ts（register+stateGetter）+ MANIFEST + notifyStateChange |
| 新增一个扩展能力 | +3 | +3 | 能力注册 + MANIFEST |
| 不需要注册的情况 | 0 | 0 | 纯视觉元素、非交互的 Canvas 内部元素 |

> **步长固定但基数不同。** 增量仍可控——新增一个动态元素需要改 2 个文件（模块 + MANIFEST），不需要跨 3 个以上文件。使用 `registerElement()` 便捷方法可将模块内的增量从 11 行压缩到 3 行（见代码实现）。

## §2 架构：Registry 作为索引（提议方案）

### 2.1 核心原则：轻耦合

Registry 的设计原则：

- **模块通过轻量回调注册自身。** 模块在 `init*()` 末尾调 `Registry.register({...})` 宣告自己的存在，如果状态会变化则同时调 `registerStateGetter(id, getter)`。这是模块对 Registry 的唯一感知——模块不需要知道 snapshot 机制、不需要调 `updateState()`、不需要管理注册后的生命周期。
- **Registry 是一个被动索引。** 它不监听任何事件、不订阅任何状态变化、不拦截任何操作。它只在 `snapshot()` 被调用时通过 getter 回调读取模块的实时状态。
- **Registry 只在被查询时工作。** 没有 rAF 回调、没有定时器、没有订阅者。`onChange` 回调是外部监听方（如 ws-channel）注册的，不是 Registry 自身发起的。

这与 v0.2 讨论中提出的"模块零耦合"理想目标不完全一致——实践证明模块至少需要一行 `register()` 来宣告存在。但耦合极轻：仅一个 id + 一组元数据 + 可选 getter 回调。**这种"轻耦合"是 §5.1 方案 B（模块注册回调）经过讨论后的有意选择。**

> **关于"删掉 Registry 零行改动"**：这是 v0.2 讨论阶段提出的理想目标，实际实现中由于模块显式调用 `register()`，删除 Registry 会导致 6 个模块的编译错误。这种显式注册是故意设计的——它让每个 UI 元素的注册点在源码中肉眼可见，降低了 onboarding 和调试的心智负担。

### 2.2 三层模型

Registry 的输出（snapshot）分为三层：

```
┌──────────────────────────────────────────────────┐
│  ① 交互层 (Interactive Elements)                 │
│     ─ 页面上所有可点击/可交互的 UI 元素           │
│     ─ 光球、按钮、输入栏、卡片、面板……           │
│     ─ 字段：id, type, label, state, enabled, effect│
│     ─ 不存 bounds（v1 砍掉，见 §5 开放问题）      │
│                                                    │
│  ② 内容层 (Content Surface)                      │
│     ─ 用户在当前屏幕上能看到的信息                 │
│     ─ 文件树当前目录列表、卡片标题和内容摘要、      │
│       输入栏文字、状态栏信息                       │
│     ─ 类似无障碍访问树（Accessibility Tree）        │
│     ─ 内容可以分层采样（摘要 vs 全量）              │
│                                                    │
│  ③ 能力层 (Capabilities)                         │
│     ─ AI 可以做的操作，不论有没有对应 UI 元素      │
│     ─ 文件搜索、全文检索、全局替换、执行命令……     │
│     ─ 每项包含：名称、参数描述、返回类型、用途说明   │
│     ─ 能力是各模块自己导出描述的，Registry 只收集   │
└──────────────────────────────────────────────────┘
```

#### 交互层（能点的）

```typescript
// 描述一个可交互的 UI 元素
interface InteractiveElement {
  id: string;           // 全局唯一标识
  type: 'button' | 'text-input' | 'floating-button' | 'floating-card' | 'panel' | 'icon';
  label: string;        // 人类可读的名称
  description: string;  // 简短描述（供 AI 理解用途）
  state?: 'collapsed' | 'expanded' | 'compact' | 'active' | 'inactive' | 'editing' | 'focused' | 'open' | 'opening' | 'closed' | 'closing' | 'visible' | 'hidden' | 'enabled';
  enabled: boolean;
  /** 操作此元素后的预期效果（供 AI 理解操作后果） */
  effect: string;        // 如 "点击后展开光球，显示 AI 输入框"
  /** 引用来源：该元素在哪个模块定义 */
  source?: string;       // 如 "orb.ts", "card-stack.ts"
```

#### 内容层（能看到的）

```typescript
// 描述页面上的一段信息内容
interface ContentBlock {
  id: string;
  type: 'file-tree' | 'card-content' | 'text-output' | 'status-bar';
  summary: string;      // 摘要（例如当前目录路径、卡片标题）
  /** 详细内容（可选——可能很大，需要单独请求） */
  detail?: string | object;
}
```

#### 能力层（能调用的）

```typescript
// 描述一个 AI 可调用的扩展能力
interface Capability {
  id: string;
  name: string;
  description: string;
  parameters: ParameterDef[];  // 参数定义
  /** 能力对应的调用入口 */
  entry: string;               // 如 "server.searchFiles", "KFMState.toggleExpanded"
}
```

### 2.3 Registry API（索引类）

```typescript
class UIElementRegistry {
  // 注册一个交互元素（由各模块在初始化时调用）
  register(element: InteractiveElement): void;

  // 注销（元素不再存在时）
  unregister(id: string): void;

  // 获取当前页面的完整描述（AI 主入口）
  snapshot(): PageDescription;

  // （可选）按 id 查询（仅交互层，能力层通过 getCapabilities 查询）
  get(id: string): InteractiveElement | undefined;

  // 自检：验证 MANIFEST 一致性。返回缺失的 id 列表（空 = 全部通过）。
  // 实际签名见 §S.3：validate(manifest: string[]): string[]
  // 此处不再重复，以 §S.3 为准。
}

// snapshot 的输出 = 三层合并
interface PageDescription {
  elements: InteractiveElement[];
  content: ContentBlock[];
  capabilities: Capability[];
  /** snapshot 生成时间戳（用于 AI 判断时效性） */
  timestamp: number;
}
```

**关键设计点**：

- `snapshot()` 是只读操作——它不触发任何副作用，不修改任何状态，不产生事件
- `register()` 只在初始化时调用一次，不在运行时反复调
- 没有 `updateState()`——状态留在各模块自己手里，Registry 不做状态的二次存储
- 没有 `action()`——AI 不通过 Registry 操作 UI，AI 直接调用模块导出函数

### 2.4 AI 调用流程

```
1. AI 调用 ui_snapshot() → 拿到 PageDescription
   {
     elements: [ { id:'orb', type:'floating-button', state:'collapsed',
                   effect:'点击后展开光球，显示 AI 输入框' }, ... ],
     content:  [ { id:'file-tree', summary:'/home/user/projects' }, ... ],
     capabilities: [ { id:'search', name:'全文搜索', ... } ]
   }

2. AI 看到 orb 是 collapsed，`effect` 说明"点击后展开"
   → AI 决定操作，直接调用 orb 模块的展开函数

3. AI 再次调用 ui_snapshot() → 拿到新的 PageDescription
   {
     elements: [ { id:'orb', type:'floating-button', state:'expanded' }, ... ],
     ...
   }
   → 确认操作成功
```

**注意**：第 2 步中 AI 如何"调用 orb 模块的展开函数"——这不是 Registry 的职责。它需要一个 AI-tools 层（`src/server/ai-tools.ts`）来包装模块导出函数为 AI 可调用的 tool。Registry 只负责提供"有什么"的查询。

---

## §3 与现有系统的关系

### 3.1 现有注册中心对比

| 注册中心 | 文件 | 职责 | 与 Registry 的关系 |
|----------|------|------|-------------------|
| `GestureRegistry` | `gesture-registry.ts` | 触摸/鼠标事件按优先级调度 | Registry 不替代它。AI 操作 UI 时，AI-tools 层可能调用手势 API，但 Registry 不碰手势 |
| `RendererLifecycle` (`L`) | `renderer-lifecycle.ts` | 渲染器状态、光标、动画锁 | Registry 读取 L 的状态（通过 L 的导出接口），但 L 不知道 Registry 存在 |
| `KFMState` | `state.ts` | 文件树数据、展开状态、配置 | Registry 内容层的文件树信息来自 KFMState。KFMState 不知道 Registry 存在 |
| `styleRegistry` | `style-registry.ts` | 样式模板 | 无直接关系 |
| `DOM` | `dom-refs.ts` | DOM 元素引用 | 相似的模式——一个索引，不存数据。Registry 把"物理元素索引"扩展为"逻辑元素索引" |

### 3.2 谁负责更新状态

| 层 | 状态来源 | 怎么更新 |
|----|---------|---------|
| 交互层 | 各模块导出 `getState()` | Registry snapshot 时调用模块的 `getState()` 实时获取 |
| 内容层 | KFMState / 各模块 | Registry snapshot 时从 KFMState 读取当前值 |
| 能力层 | 静态定义（初始化时注册） | 几乎不变——能力是注册时就定义好了的 |

**模块不需要知道 Registry 存在。** 它只需要导出自己的状态接口。Registry 在 snapshot 时主动读取。

但这里有一个 trade-off：Registry 在 snapshot 时如果想获取某个模块的当前状态，需要 import 那个模块的 getter，或者模块通过注册回调的方式来暴露自己。**这需要进一步讨论（见 §5 开放问题）。**

---

## §4 源自原文档的保留内容

以下内容来自 [v0.1] 版本，经讨论后认为仍然有效，保留在此：

### 4.1 已有注册中心模式对比（原 §4.1）

同上 §3.1。

### 4.2 需迁移的现有硬编码（原 §4.2，待讨论哪些仍有效）

| 现有代码 | 位置 | 可能的迁移动作 |
|---------|------|--------------|
| `CARDS` 数组 | `card-stack.ts:28-36` | 推测：改为从 Registry 读取卡片元信息 |
| 光球的存在和状态 | `orb.ts` | 推测：在 `initOrb()` 中加 `Registry.register(...)` |
| 输入栏 | `app.ts` | 推测：在 `initApp()` 中加 `Registry.register(...)` |
| 侧栏按钮 | `ui.ts` | 推测：在 `initUI()` 中加 `Registry.register(...)` |

**注意**：这些迁移动作在 v0.1 中是基于"Registry 有大管家"假设写的。v0.2 改为"Registry 是索引"后，迁移方式可能不同。标记为 `[待讨论]`。

### 4.3 不应该放进 Registry 的（原 §8.1，保留）

- **纯样式元素**（分割线、背景、间距）——它们没有交互价值，AI 不需要知道
- **手势瞬态**（fling、swipe 过程中的位置）——`snapshot` 是某个时刻的静态快照，不是实时流
- **Canvas 内部元素**（文件树的每一行、光标）——那属于 `KFMState` 的职责（但需进一步讨论：文件树的摘要信息算不算内容层？）
- **第三方嵌入内容**（地图、IFRAME 内容）——Registry 不代理外部系统

### 4.4 与项目心法的交叉验证（原 §9）

| 心法原则 | 在本方案中的体现 | 如果不遵守会怎样 |
|---------|----------------|----------------|
| 心法 2：从源头上简化 | Registry 不存任何派生状态，snapshot 实时从各模块读取 | snapshot 与真实 UI 状态不同步 |
| 心法 3：不要跨模块依赖 | Registry 只 {{这里需要决策——见 §5 开放问题 1}} | 循环依赖 |
| 心法 5：代码越改越少 | Registry 引入后应能移除某些硬编码（如 CARDS 数组） | 代码净增长，架构退步 |
| 心法 9：搬运必须原样复制再改 | 从旧模块迁移注册逻辑时必须原样复制再改 | 重写会丢失边界条件 |
| 心法 12：发现补丁就立即根除 | 如果旧硬编码（CARDS）可以移除，必须在本轮移除 | 两套数据源共存，维护者不知道谁权威 |

---

## §5 开放问题（需后续 agent 讨论）

> 以下问题是 v0.2 阶段未能达成共识、需要后续 agent 参与讨论的。
> 每个问题标记了讨论状态：`[未解决]` / `[有倾向]` / `[已关闭]`

### 问题 1：Registry 如何获取模块的当前状态？ `[v1.0 已解决]`

> **v1.0 决策**：采用 **方案 B（模块注册回调）**——即 `registerStateGetter(id, getter)`。
> 
> 理由：
> - 方案 A（Registry import getter）虽然代码量最小，但会让 Registry 反向依赖业务模块，违背心法 3（不跨模块依赖）
> - 方案 C（主动 updateState）运行时开销大，且需要模块在每次状态变化时通知 Registry
> - 方案 D（纯静态）让 `state` 字段失去意义，违背 §1.5 "snapshot 必须是当前状态的精确投影"
> - 方案 B 是折中：模块知道 Registry 存在（耦合不可避免），但耦合极轻——仅一个 getter 回调。新增 ~2 行代码，零运行时开销（getter 只在 snapshot 时调用）
>
> 实现见 §S.3 的 `registerStateGetter()` 方法和 §S.4 的注册约定。

核心矛盾：
- 如果 Registry 直接 import 模块的 getter → 违反了"Registry 不依赖业务模块"的原则
- 如果模块主动调 `Registry.updateState()` → 回到了"模块知道 Registry"的模式，违背了"模块不知道 Registry"的原则
- 如果模块注册一个回调让 Registry 在 snapshot 时调用 → 折中方案，但需要约定回调接口

已知的几种候选方案：

| 方案 | 耦合方向 | 代码量 | 运行时开销 |
|------|---------|--------|-----------|
| A. Registry import 模块 getter | Registry → 模块 | 最小（~1 行 import + 1 行调用） | 零（仅在 snapshot 时） |
| B. ✅ 模块注册回调（已采用） | 模块 → Registry（注册时），Registry → 模块（调用时） | 中等（每个模块多 ~2 行） | 零 |
| C. 模块主动 updateState | 模块 → Registry（每次状态变化） | 大（每个状态变化路径多 1 行） | 每次状态变化都有 |
| D. Registry 不做状态获取，只返回注册时的静态信息 | 无耦合 | 最小 | 零——但 `state` 字段变成了摆设 |

**讨论指引**：`[INFERENCE]` v0.2 起草者的倾向是方案 A——Registry 直接 import 少量 getter（每个模块 1-2 个），因为 KFM 不是大型 SPA，模块数量有限（~20 个），import 链不会爆炸。但需要后续 agent 评估：这是否违反了心法 3（不要跨模块依赖）的精神。

### 问题 2：能力层（Capabilities）的实���方式 `[未解决]`

能力是各模块自己导出的描述对象，还是需要一个集中注册的地方？

| 方案 | 优点 | 缺点 |
|------|------|------|
| 各模块导出 `capability` 对象，Registry 启动时自动收集 | 新增能力不用改 Registry | 需要约定导出格式（同一种接口），需要扫描机制 |
| 集中注册（在 main.ts 或一个独立的 init 函数中注册全部能力） | 简单，所有能力一目了然 | 新增能力时容易忘了注册 |

**讨论指引**：决定了 v0.1 原文档中 Phase 4（AI tool 包装）的实现方式。

### 问题 3：内容层的粒度 `[未解决]`

原文档的疑问（附录 §6）在这里重新提出：

- 内容层是否应该包含文件树的完整目录列表？如果树有 1000 个文件，snapshot 输出多大？
- "摘要" 和 "全量" 的边界在哪里？——文件树的"摘要"是当前目录路径，还是前 20 个文件名？
- 输入栏的当前文本应该算内容层还是交互层的属性？

**讨论指引**：可以先定一条原则——**snapshot 只返回摘要，详细内容通过另一个 API 单独查询。** 这样 snapshot 本身保持轻量，不随页面内容增长而膨胀。

### 问题 4：`bounds` 是否需要加回来？ `[未解决]`

v0.2 砍掉了 bounds，理由（来自讨论）：
- Canvas 应用中位置是渲染器算出来的，每帧都在变
- AI 不需要像素坐标来操作 UI——需要的是逻辑状态

但如果将来需要"AI 把一个卡片拖到屏幕左上角"，bounds 就是必需的。在能清楚定义 drag 参数之前，bounds 是否有用？

### 问题 5：AI-tools 层的职责边界 `[未解决]`

Registry 是黄页，那 AI 实际"调用"模块函数时走什么路径？目前想到的：

```
AI → ai-tools.ts (注册在服务器端的 function calling 工具)
    → 通过 WebSocket / POST 消息发送指令到浏览器端
    → 浏览器端接收指令 → 调用对应模块导出函数
    → 返回结果
```

但这需要一个"从服务端到浏览器端的指令通道"。这个通道目前不存在。是应该扩展现有 API，还是新建一个 WebSocket，还是 Registry 最终还是要提供 `action()` 作为这个通道的一部分？

**v0.2 的明确立场**：这个通道不是 Registry 的职责。它是 `ai-tools.ts` 的职责，`ai-tools.ts` 可以调用 Registry 的 snapshot，但不应该调用 Registry 的 action。**但如何让服务端调用浏览器端模块函数——这个问题还完全没解决，需要讨论。**

---

## §6 供后续 agent 讨论的思考框架

如果你来参与讨论，建议从以下角度切入：

### 6.1 验证清单

在提方案前，请先回答这些问题：

1. **你的方案对 §1 中哪条核心意图帮助最大？**
2. **你的方案是否增加了 Runtime 负担？**（rAF 回调？订阅？事件监听？）如果有——说明正在往"大管家"模式走，需要想清楚为什么不能避免
3. **你的方案下，新增一个 UI 元素需要改几个文件？**（理想：1 个——元素自己的模块。可接受：2 个——自己的模块 + Registry 的注册入口。不可接受：3+）
4. **你的方案在 50 个 UI 元素时还成立吗？** 在 200 个呢？
5. **Registry 文件和现有模块之间是否存在循环依赖的风险？**

### 6.2 不能做的事（已知的反模式）

- 不要让 Registry 监听 DOM 事件或手势事件（那是 GestureRegistry 的职责）
- 不要让 Registry 存储 UI 元素的位置或尺寸（bounds）（在 "drag" 参数明确定义前）
- 不要让 Registry 直接操作用户界面（那是模块自己的职责）
- 不要让 Registry 成为另一个 KFMState（文件数据和 UI 状态严格分离）
- 不要让每个模块都多出一套"通知 Registry"的样板代码（如果模块不知道自己被注册了，最好）

---

## §7 备选方案记录

> 这里记录设计过程中被提出但没有采纳的方案（及其否决理由），
> 供后续 agent 看到"为什么不走那条路"。

*（暂无条目——v0.2 是第一个记录讨论结果的版本。后续在此追加）*

---

## §8 已知的未解决问题摘要

> 收集自各章开放问题，方便后续 agent 一次性看到全景。

| # | 问题 | 优先级 | 当前状态 | 相关章节 |
|   |------|--------|---------|---------|
| 1 | Registry 如何获取模块实时状态？ | 高 | ✅ 已解决（registerStateGetter 回调方案） | §5.1 |
| 2 | 能力层的实现方式 | 中 | ✅ 已解决（CapabilityExecutor + POST /api/capabilities/execute） | §5.2 |
| 3 | 内容层的粒度控制 | 中 | ✅ 已解决（registerContentGenerator 回调方案） | §5.3 |
| 4 | `bounds` 是否需要？ | 低 | 砍掉（v1） | §5.4 |
| 5 | AI-tools 层：服务端如何调浏览器端函数？ | 高 | ✅ 已解决（WebSocket 双向通道） | §5.5 |
| 6 | 内容层是否应暴露文件树全量？ | 低 | 延期到 v2（snapshot 只返回摘要，全量通过单独 API 查询） | §5.3 |
| 7 | `register()` 是手动调用还是自动扫描？ | 中 | 维持手动调用 + MANIFEST 验证（当前模式） | §5.2（关联） |
| 8 | Registry 是否应该成为一种"强制契约"（所有 UI 元素都必须注册，否则报错）？ | 低 | ✅ 已实现（MANIFEST + check-registry.mjs，不注册 = 构建中断） | — |

---

## §9 验收标准草案

> 在 §5 的开放问题全部解决前，验收标准不锁定。
> 以下是一个起点，未来 agent 讨论后可修改。

当 一 个 agent 声称完成了 Registry 的设计讨论，必须确认：

- [ ] §1 核心设计意图没有被违反
- [ ] §5 的全部开放问题都有了明确的方案（或一致的"延期到 v2"的共识）
- [ ] 所有否定掉的方案都记录到了 §7（备选方案记录），附否决理由
- [ ] 设计代码在 `npm run check` 和 `npm run test` 下零错误
- [ ] `check-as-any.mjs` 白名单未新增条目
- [ ] Registry 不 import 任何业务模块（取决于 §5.1 的决策——此条可能修改）

---

## §10 设计演进史

### v0.1 → v0.2（2026-06-01）

**v0.1 的核心设计**（前一个 agent 完成）：
- Registry 是"大管家"模式：注册 → updateState → action() 事件派发 → epoch 防过期
- 16 个测试用例，4 个实施阶段
- 聚焦于 UI 元素的注册和操作，没有内容层和能力层

**v0.1 发现的问题**（当前 agent 讨论后识别）：
1. `action()` 事件派发和项目现有手势系统存在两条操作路径，增加了系统复杂性
2. epoch 机制难以落地：用户手动操作时如何自动递进？无可行方案
3. `bounds` 在 Canvas 应用中无法低成本保持同步
4. 缺少"页面上有什么信息"的描述层（只有"有什么按钮"，没有"有什么内容"）
5. 缺少 AI 独有扩展能力（文件搜索等）的暴露机制
6. 原方案导致每个模块都需要额外写"通知 Registry"的代码，模块不知道 Registry 存在的原则被打破
7. 650 行的规范与 ~80-150 行代码的实现不成比例

**v0.2 的改动方向**：
1. 从"大管家"模式改为"黄页/索引"模式——Registry 是只读目录，不存储状态、不派发操作
2. 新增三层模型：交互层 + 内容层 + 能力层
3. 砍掉 `action()`、`updateState()`、epoch、`bounds`
4. 模块不知道 Registry 存在（零耦合目标）
5. 文档性质从"规范"改为"讨论记录"，开放问题明确标注，接受后续 agent 推翻

**v0.2 仍未解决的问题**：见 §5 和 §8。

## 附录：v0.2 留给审计 agent 的话

本文档由第二任 agent（2026-06-01）在 v0.1 基础上讨论后重写。

以下是我认为你接手时需要知道的重点：

**先做的：把 §S 跟现状对一遍。** §S 是已定稿的产出定义——文件结构、类型、注册方式、MANIFEST 验证。看看这个契约是否真的可行。如果发现缺口，第一时间标记，不要等实现后再发现。

**然后做的：攻 §5 开放问题。** 最关键是 §5.1（Registry 怎么拿到模块实时状态？）和 §5.5（服务端怎么调浏览器端函数？）。这两个问题不解决，Registry 就是脱节的——它能注册，但 AI 没法用。

**小心 §5.1 的陷阱。** 直接 import 模块 getter 最简单，但违反心法 3。回调方案更干净，但多了约定。随便选一个都可以，但要意识到这是后面所有实现路径的分叉口——选了 import，`ui-registry.ts` 就会产生依赖方向；选了回调，每个模块要多出几行注册回调的代码。

**不推荐回到"大管家"模式。** v0.1 的 action/epoch/updateState 方案被砍掉是有充分理由的——它违反了"模块不知道 Registry 存在"的原则，且 epoch 无法落地。如果你觉得当前方案有重大缺陷想推翻，请先在 §7 记录备选理由，然后才改。

**关于实现：先写 `ui-registry.ts`，再写 MANIFEST 验证，最后做集成。** 这个顺序有回退余地——核心文件写完了可以单独测试，MANIFEST 加上了就等于有了注册入口，集成是最后一步。

**最可能翻车的地方**：内容层。内容层的 `summary` 从哪里来？谁负责更新？如果是文件树，它的摘要（目录路径、文件数）是 KFMState 管的，Registry 怎么读到？这其实回到 §5.1 的问题了。如果内容层实现不了，可以先砍掉它只做交互层+能力层，不影响核心架构。

---

### v0.3 → v1.0（2026-06-02，§S 已实现）

**§S 核心已在代码中实现：**
- `src/client/modules/ui-registry.ts` — 类型定义 + UIElementRegistry 类 + 全局 `Registry` 单例
- `check-registry.mjs` — MANIFEST 硬编码 + 源码扫描验证
- 10 个交互元素已注册（orb、orb-panel、sidebar、sidebar-toggle-btn、card-stack-toggle-btn、close-sidebar-btn、eye-btn、card-stack、input-bar、operation-toast）
- `check-registry.mjs --check-only` 已挂入 `npm run check`（在 check-as-any 之后、tsc 之前）
- 不带 `--check-only` 时挂入 `npm run build`
- MANIFEST 验证采用白名单模式（同 check-as-any.mjs）：漏注册 → 构建中断

**实现决策与文档 §S 的一致性：**
- ✅ 类型定义完全匹配 §S.2（增补了 `inactive`/`visible`/`hidden`/`enabled` 到 UIElementState）
- ✅ Registry 类方法完全匹配 §S.3（增补了 `registerStateGetter()` / `get()` 便利方法）
- ✅ 模块在 `init*()` 中调 `Registry.register(...)`（§S.4）
- ✅ 所有可变状态元素已注册 `registerStateGetter()` getter（§S.4 扩展）
- ✅ MANIFEST 验证机制（§S.5）
- ✅ 内容层已填充（3 个 ContentBlock：file-tree, card-stack-content, orb-chat）
- ✅ 能力层已填充（3 个 Capability：file-search, file-read, file-write）
- ✅ `ai-tools.ts` 已创建（服务端包装层，初始提供 3 个端点）
- ⬜ §5 开放问题未完全解决（见 §5.5 通信通道仍需架构级设计；§5.1 已通过 getter 回调方案解决）

### v1.0 → v1.1（2026-06-02，§5 开放问题全部解决）

**本轮完成的工作：**

**🔴 §5.5 通信通道（WebSocket）**
- 服务端：`src/server/ws-server.ts` — WsServer 类，封装 WebSocketServer，管理连接池、心跳、消息路由
- 服务端入口：`src/server/index.ts` — 改用 `http.createServer(app)` + WsServer 附加到同一端口
- 服务端 API：`src/server/ai-tools.ts` — 改造为接收 WsServer 实例，提供实时 snapshot 查询
- 客户端：`src/client/modules/ws-channel.ts` — WsChannel 类，浏览器端自动连接、推送、重连
- 依赖：新增 `ws` + `@types/ws`

**🟡 §5.3 内容层动态化**
- `ui-registry.ts` 新增 `registerContentGenerator(id, generator)` 方法
- `snapshot()` 中生成器优先于静态内容
- 同一 id 可同时注册静态内容和生成器，生成器覆盖

**🟡 §5.2 能力层绑定**
- 服务端：`src/server/capability-executor.ts` — CapabilityExecutor 类
- 新增 `POST /api/capabilities/execute` 端点
- 新增 `GET /api/capabilities/executor` 端点
- 内置 3 个文件操作能力（file-search, file-read, file-write）

**🏗️ Registry 核心增强**
- 新增 `getCapabilities()` 方法（类型安全的能力列表访问）
- 新增 `onChange()` 回调机制（供 ws-channel 等模块监听变化）
- 移除 `ws-channel.ts` 中的 `as any` 逃逸

**文档更新：**
- `docs/notes/WEBSOCKET_CHANNEL_PROPOSAL.md` — WebSocket 方案提案
- `docs/notes/REGISTRY_NEXT_AGENT_DISCUSSION.md` — 问题状态更新
- `docs/UI_ELEMENT_REGISTRY_SPEC.md` — §S 新增 v1.1 扩展说明，§8 更新为全部已解决

**版本更新**：`package.json` → 6.0.0（未变），`check-as-any.mjs` 白名单清空（未变）。
