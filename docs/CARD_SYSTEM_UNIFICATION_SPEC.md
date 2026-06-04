---
status: superseded
superseded_by: （待下次实验）
version: v0.2 (第一次实施尝试记录)
archived_reason: v0.1 的假设在实际实施中暴露多个缺口，代码已回退到 v6.4.0
---
# KFM v4 — 浮卡系统统一化规范

> **版本**：v0.2（第一次实施尝试记录）
> **状态**：已归档——代码已回退到 v6.4.0
>
> **本次实验的教训**：方向是对的，但实施节奏错了。应该在每一步验证后再推进，而不是一次性全部改完。§8 记录了所有踩到的坑。

> **关联文档**：
> - `UI_ELEMENT_REGISTRY_SPEC.md`（已归档）— Registry 的核心理念（§1 人与 AI 对称操作）仍然是浮卡系统的设计约束
> - `KFM_V4_INVARIANTS.md` — 本项目修改约束协议
> - `VISION_AND_ROADMAP.md` — §1.2 "一切皆卡片"是本文的核心理念来源
> - `HANDBOOK.md` — 工作手册，浮卡状态机定义参考

---

## §0 本文的性质

> 本文档记录浮卡系统统一化的设计讨论、产出定义和迁移计划。
> 前身是两套独立实现（`orb.ts` 光球面板 + `floating-card.ts` 浮卡系统），
> 实际它们是同一份交互模式的两份重复。
>
> 本文的写作风格和结构继承 `UI_ELEMENT_REGISTRY_SPEC.md`（已完成其使命，已归档）。
>
> **读这篇文档的顺序**：
> 1. 先读 §1（核心设计意图）——这是项目所有者的原始需求，不能偏离
> 2. 再读 §S（产出定义）——最终要实现什么
> 3. 然后读 §3（迁移计划）——一步一步怎么做
> 4. 最后读 §6（演进史）——看看历史决策
>
> **如果你不同意当前方案、想另走一条路，完全接受。** 只要不违反 §1 的核心意图，任何架构都可以。把你的方案补在 §7（备选方案）。设计在争论中收敛。

---

## §1 核心设计意图（不可违反）

### 1.1 一份引擎，任意浮卡

所有浮动的"面板"——光球面板、卡片堆发射的浮卡、未来的调试面板、设置面板——**必须是同一个 `floating-card.ts` 引擎的不同配置，而不是各自独立的实现**。

判断标准：

> 新增一种浮动面板时，不需要复制/粘贴拖拽逻辑、状态机、手势注册。只需要写一个配置文件（~80 行）告诉引擎"紧缩多大、展开多大、内容怎么渲染、哪些角光球可见"。

### 1.2 配置即差异

三套系统中真正不同的只有这些：

- 紧缩态尺寸（光球面板是 0×0，调试浮卡是 54×54）
- 展开态尺寸（光球面板是 300×350，调试浮卡是 155×68）
- 哪些角光球可见（光球面板只有 BR，调试浮卡四角齐全）
- 展开后的内容渲染（光球面板渲染聊天记录，调试浮卡渲染日志）
- z-index 策略（光球面板永远最上层，调试浮卡动态分配）
- 边界避让策略（光球面板跟随输入栏，调试浮卡不需要）

**这些全部写成配置参数，而不是硬编码在函数里。**

### 1.3 彻底删除 orb.ts

`orb.ts` 的所有功能必须被 `floating-card.ts` 覆盖，然后删除整个文件。

> 这不是"合并"——是"发现 orb 从来就不是一个独立系统，它只是还没被正确配置化的浮卡"。

### 1.4 不做的（scope 边界）

- ❌ 不修改 `card-stack.ts` 的面板逻辑——它仍然负责卡片堆的显示和焦点切换。发射浮卡时调引擎的 `createFloatingCard()` 即可。
- ❌ 不把引擎定义成抽象类或接口——一个 `createFloatingCard(config)` 函数就够了。不需要 new、不需要 extends。
- ❌ 暂不做"浮动卡片数据持久化"——浮卡仍是无状态的运行时对象，关闭即销毁。

---

## §2 设计约束（违反就是 bug）

### 2.1 状态机

所有浮卡共享同一个状态机：

```
launching → compact  ← → expanding → active → editing
                ↑                      │
                └────── collapsing ─────┘
```

- `launching`：发射动画中（仅从卡片堆发射时使用，光球面板跳过）
- `compact`：紧缩态，仅右下角 BR 光球可见
- `expanding`：展开动画中
- `active`：展开态，内容可见，四角光球齐全
- `collapsing`：折叠动画中
- `editing`：长按进入的编辑模式，BR 光球当缩放手柄

### 2.2 拖拽通过 gesture-registry

所有浮卡的 pointer 事件必须通过 `gesture-registry.ts`，禁止裸 `document.addEventListener`。

### 2.3 四角光球的多态

角光球的创建逻辑是统一的，差异通过配置控制：

| 角 | 可见性控制 |
|---|---|
| BR（右下） | 始终可见——它是拖拽把手 + 展开/折叠触发器 |
| TL/TR/BL | 按配置——光球面板设为 `null`，调试浮卡设为光球对象 |

### 2.4 插件文件独立

每张浮卡的配置放在 `cards/plugins/<name>.ts`，导入引擎，导出配置。引擎不 import 插件——插件 import 引擎。

---

## §S 产出定义（已定稿）

### S.1 FloatingCardItem 接口（统一后的最终形态）

```typescript
interface FloatingCardConfig {
  // 标识
  id: string;
  name: string;

  // 几何
  compactWidth: number;       // 紧缩态尺寸（光球面板：0）
  compactHeight: number;
  activeWidth: number;        // 展开态尺寸（光球面板：300）
  activeHeight: number;
  minWidth: number;           // 编辑模式最小尺寸
  minHeight: number;

  // 角光球
  cornerTL: boolean;          // 左上角光球
  cornerTR: boolean;          // 右上角光球（通常渲染关闭按钮）
  cornerBL: boolean;          // 左下角光球

  // 行为
  alwaysOnTop: boolean;       // 永远在最上层
  inputBarAvoid: boolean;     // 跟随输入栏位置（输入法弹出时避让）
  accentColor: string;        // 卡片主色

  // 生命周期回调
  onActivate(contentEl: HTMLElement): void;         // 展开时填入内容
  onDeactivate(contentEl: HTMLElement): void;       // 折叠时清理内容
  onCreate(el: HTMLElement): void;                  // 创建后额外设置
  onCommand?(action: string, params: unknown): void; // AI 命令处理

  // Registry 注册
  registryElement: InteractiveElement;               // 交互层注册信息
  registryContent?: () => ContentBlock;              // 内容层生成器
  alias?: string;                                    // 旧 id（如 'orb' → 'orb-panel'），用于无缝替换
}
```

### S.2 引擎公开 API

```typescript
// floating-card.ts 导出的唯一工业级接口

/** 创建一张浮卡并添加到桌面 */
export function createFloatingCard(config: FloatingCardConfig): void;

/** 按 id 关闭浮卡 */
export function dismissCard(id: string, animated?: boolean): void;

/** 查询浮卡是否存在 */
export function hasCard(id: string): boolean;

/** 工具函数：注册 AI 命令处理器（供插件 init 时调用） */
export function registerCardCommand(id: string, action: string, handler: (params: unknown) => void): void;
```

引擎内部管理：
- 所有浮卡的生命周期
- gesture-registry 的手势处理
- 状态机切换
- 边界钳制 + 输入法避让
- z-index 分配

### S.3 插件形态

```typescript
// cards/plugins/orb-card.ts —— 完整示例

import { createFloatingCard, type FloatingCardConfig } from '../../src/client/modules/floating-card.js';

export function initOrbCard(): void {
  createFloatingCard({
    id: 'orb-card',
    name: 'AI 对话',

    compactWidth: 0,
    compactHeight: 0,
    activeWidth: 300,
    activeHeight: 350,
    minWidth: 120,
    minHeight: 100,

    cornerTL: false,
    cornerTR: false,
    cornerBL: false,

    alwaysOnTop: true,
    inputBarAvoid: true,
    accentColor: '#7c3aed',

    onActivate(contentEl) {
      // 渲染聊天消息 + 输入框
      contentEl.innerHTML = renderChatHTML(chatMessages);
    },
    onDeactivate(contentEl) {
      contentEl.innerHTML = '';
    },
    onCreate(el) {
      // 初始位置：屏幕右下角
      el.style.right = '8px';
      el.style.bottom = '8px';
    },
    onCommand(action, params) {
      if (action === 'expand-orb') expandPanel();
    },

    registryElement: {
      id: 'orb-card',
      type: 'panel',
      label: '光球面板',
      // ...
    },
  });
}
```

### S.4 配置合并规则

引擎提供一组**合理的默认值**，插件只需覆盖自己不同的部分：

```typescript
const DEFAULT_CONFIG: Partial<FloatingCardConfig> = {
  compactWidth: 54,
  compactHeight: 54,
  activeWidth: 155,
  activeHeight: 68,
  minWidth: 54,
  minHeight: 54,
  cornerTL: true,
  cornerTR: true,
  cornerBL: true,
  alwaysOnTop: false,
  inputBarAvoid: false,
  accentColor: '#7c3aed',
  onActivate: () => {},
  onDeactivate: () => {},
  onCreate: () => {},
};
```

插件写法：`createFloatingCard({ ...DEFAULT_CONFIG, ...myOverrides })`。

### S.5 删除清单

迁移完成后删除：

| 文件 | 原因 |
|---|---|
| `src/client/modules/orb.ts` | 功能被浮卡引擎 + orb-card 插件取代 |
| `src/client/modules/card-stack.ts` 中的 `_animateStackPullFeedback`（如果迁移后不再被引用） | 已移到浮卡引擎 |
| orb 相关的变量在 `main.ts` 中的引用 | `initOrb()` 改为 `initOrbCard()` |

### S.6 行数估算

| 步骤 | 文件 | 净变化 |
|---|---|---|
| 重构引擎 | `floating-card.ts` | ~900 行（基本维持当前大小，但内部统一了变量名和分支） |
| 新增插件 | `cards/plugins/orb-card.ts` | +~80 行 |
| 删除 | `orb.ts` | -567 行 |
| 微调 | `main.ts` | ~-2 行 |

**净减 ~489 行。**

---

## §3 迁移计划

### Phase 1：引擎统一化

1. 重构 `floating-card.ts` 内部：
   - 将硬编码的浮卡常量（`FLOATING_CARD_W/H`、`COMPACT_W/H`）改为运行时由 Config 传入
   - 将角光球创建改为按需（`config.cornerTL` 等）
   - 将 `createFloatingCard(config)` 设为统一入口
   - 将 `_scatterPosition` 等位置计算改为兼容"紧缩态 0×0"的情况
   - 统一变量命名（消除 `_fItem` / `_dragItem` 两套命名）
2. 引擎内部统一拖拽路径：从 `_bindBrDragEvents` + `_ensureGlobalDragListeners` 两套，改为只通过 gesture-registry 一套
3. 输入法避让逻辑内建到引擎（`inputBarAvoid: true`）

### Phase 2：光球面板插件化

1. 创建 `cards/plugins/orb-card.ts`
2. 将 `orb.ts` 中聊天渲染、初始位置、命令处理器等内容搬过来
3. 让 `initOrbCard()` 替代 `initOrb()`
4. 穿越验证：所有现有交互行为不变

### Phase 3：清理

1. 删除 `orb.ts`
2. 删除 `main.ts` 中的 `import { initOrb }`，改为 `import { initOrbCard }`
3. 跑 `npm run check` + `npm run test`
4. 手动回归（HANDBOOK §5 手动回归清单 + orb 特有操作）

---

## §4 与现有系统的关系

| 系统 | 关系 |
|---|---|
| `card-stack.ts` | 卡片堆的"发射浮卡"逻辑改为调 `createFloatingCard(config)`。`_focusIndex`、`_currentAccents` 不再需要跨文件共享（配置自带 accentColor） |
| `gesture-registry.ts` | 浮卡统一通过它注册手势。`floating-orb` + `floating-card-body` 两个 handler 合并为一个 |
| `animation-registry.ts` | 不受影响——浮卡动画仍通过 `anim` 调用 |
| `ui-registry.ts` | 每个浮卡插件自己注册自己的交互元素和内容层。不再存在 "orb" + "orb-panel" 两个独立元素，而是 "orb-card" 一个元素 |
| `ws-channel.ts` | 命令处理器由插件通过 `registerCardCommand()` 注册，不再散布在各模块的 `init*()` 中 |
| `theme.ts` | 不受影响 |

---

## §5 开放问题

### 问题 1：光球面板的紧缩态是 0×0——引擎是否需要支持"尺寸为 0"的浮卡？ `[未解决]`

当前引擎的紧缩态是 54×54，布局计算假定 `compactWidth > 0`。支持 0×0 可能需要在：
- `_scatterPosition` 中跳过尺寸为 0 的浮卡
- 边界钳制中允许 0×0
- z-index 逻辑中确保 alwaysOnTop 的浮卡不被覆盖

### 问题 2：光球面板的初始位置 `[未解决]`

当前光球的位置是 `right: 8px; bottom: 8px`（右下角）。这是屏幕坐标，不是从卡片堆发射。引擎需要支持"预置位置"模式（`initialPosition?: { right: number; bottom: number }`），跳过 `_scatterPosition`。

### 问题 3：光球面板的"点击 BR 光球展开/折叠" vs 普通浮卡的"BR 光球展开、TL 光球关闭" `[未解决]`

普通浮卡：点击 BR 展开，展开后 TL 是关闭按钮。
光球面板：点击 BR 展开/折叠切换（因为是唯一的光球）。

引擎需要支持"BR 光球兼任关闭按钮"模式，或者让插件自行注册 click handler。

### 问题 4：Registry 元素 id 的向后兼容 `[未解决]`

现在有 `'orb'` 和 `'orb-panel'` 两个 id。统一后只有一个 `'orb-card'`。AI 之前可能已经学会了用 `'orb'`。需要一个别名映射机制（S.1 的 `alias` 字段），或者直接更新 MANIFEST 并在交接文档中注明。

### 问题 5：插件目录的技术限制 `[未解决]`

`cards/plugins/` 不在 `tsconfig.json` 的 `rootDir`（`src`）内。当前的 `tsconfig.json` exclude 了 `cards`，所以 .ts 文件不会被类型检查。需要：
- 修改 `tsconfig.json` 的 `include` 和 `rootDir`，或
- 把插件放在 `src/cards/` 下（但违背了"插件与核心代码分离"的设计），或
- 插件只写 .js（不享受类型检查）

---



---

## §8 第一次实施尝试的记录（2026-06-03）

> 本节记录 v0.1 提案在第一次实施中发现的缺口和教训。
> 设计方向（一份引擎、配置化浮卡）仍然是正确的。
> 实施节奏（一次性全部改、未逐步骤验证）是错误的。

### 8.1 已知缺口（按严重性排序）

| # | 缺口 | 现象 | 根因 | 修复方案 |
|---|------|------|------|---------|
| 1 | 紧缩态卡片体不可见 | card 有 `padding:1px`，即使 `compactWidth=0` 仍渲染 2×2 像素 | CSS `content-box` 下 padding 不占用 width 空间 | `onCreate` 中设 `padding:0; border:none` |
| 2 | BR 光球定位算错 | 光球位置不在预期的右下角 | `rightOff = cornerOff + rightOffAdj = -13 + 1 = -12`（负值）。原以为正偏移，实际是负 | 用 `initialPosition.right = 36` 补偿 |
| 3 | 角光球视觉太暗 | BR 光球只有微弱光晕，不像旧版光球 | `cornerOrb` 主题值是给 10px 装饰光球用的（alpha 0.45/0.18），不是给 36px 主光球（需要 0.9/0.4） | 在 `onCreate` 中覆盖 glow div 的 `background` 和 `boxShadow` |
| 4 | `onActivate` 触发太晚 | 展开动画开始 0.1s 后才设置面板样式，导致视觉跳跃 | `onActivate` 在内容淡出动画的 `onComplete` 中，不是展开动画之前 | 新增 `onPreExpand` 回调，动画开始前调用 |
| 5 | `_renderActiveLayout` 覆盖插件 CSS | 引擎在 `onActivate` 后自动调用 `_renderActiveLayout`，覆盖插件的布局设置，且默认是 `flex-direction:row` | 引擎为普通浮卡提供默认布局，但不应覆盖插件已设的值 | 交换调用顺序：先 `_renderActiveLayout` 设默认，再 `onActivate` 让插件覆盖。同时改为 `flex-direction:column` |
| 6 | 手势拖拽硬编码最小尺寸 54px | 拖动 compactWidth=0 的 orb-card 时卡片被强制拉到 54px | 手势 `onMove` 中有 `Math.max(54, ...)` | 改为 `Math.max(0, ...)` |
| 7 | 展开时光球移动 | 点击 BR 展开面板，光球跟着卡片走 | 引擎以卡片右下角为锚点扩展，光球在卡片内部 | 新增 `keepOrbFixed` 配置，展开时计算光球的固定屏幕位置 |
| 8 | TL/TR/BL 丢失 SVG 和功能 | 浮卡展开后 TL/TR/BL 是空白光球，无图标、无点击功能 | 拆分提交 `7c4ecdc` 在搬运 `launchFocusedCard` 时丢失了 SVG 和 click handler | 从 `3253ee9` 原样复制回来（已在回退后补回） |
| 9 | 编辑模式尺寸记忆不生效 | 编辑模式调整大小后，折叠再展开回到原始尺寸 | 编辑尺寸存到 `compactMemW/H`，但展开时读 `activeMemW/H` | 删 3 对变量，改 1 对 `memW/memH`（但此改动也在回退中） |
| 10 | 气泡布局横排 | 聊天气泡排成一行不是垂直 | `_renderActiveLayout` 没设 `flex-direction:column` | 加上 `flex-direction:column` |
| 11 | 动态字号全是最小值 | 字号被算成 10px 不是 13px | `contentEl.clientWidth` 在展开动画期间只有 ~100px，scale 被压到 0.77 | 用目标宽度（300px）代替当前宽度计算 scale |

### 8.2 实施节奏的错误

1. **一次性改了太多东西**：`orb.ts` 删除、`floating-card.ts` 重写、`orb-card.ts` 新建、`main.ts` 修改——全部在同一个 commit 中。出问题时无法定位哪一步错了。

2. **代码改了没重建 bundle**：前几次用户"看不到效果"其实是因为 `public/bundle.js` 还是旧的。每次修改后必须 `npm run build`，且浏览器需要硬刷新（Ctrl+F5）。

3. **没跑手动回归就去改下一个问题**：每一步改完只跑了 `npm run check` 和 `npm run test`，没有手动在浏览器里验证就继续改下一个。问题积累到最后全炸了。

### 8.3 下次实施时的推荐顺序

```
Step 1: 只加 createFloatingCard()，不改任何现有行为
Step 2: 写 orb-card.ts，但不启用（main.ts 注释掉）
Step 3: 逐一验证引擎能力缺口（每验证一个就修一个）
        a. compactWidth=0 的问题
        b. BR 光球定位 + 样式
        c. onActivate 时序
        d. 编辑模式记忆
Step 4: 等所有缺口都验证通过了，切换 initOrb() → initOrbCard()
Step 5: 跑全部手动回归清单，确认无误后删 orb.ts
```

### 8.4 参考文献

- commit `7c4ecdc` — card-stack.ts 拆分，丢失了 TL/TR/BL SVG 和功能（原始代码参考 `3253ee9`）
- commit `1a9a3ec` — 回退 commit，撤销了从 `e7b3079`（引擎统一化）到 `163c7ea`（记忆路径统一）的全部变更
- 回退后保留的提交：`7c4ecdc`（拆分）、`3253ee9`（CARDS 迁移、operation-toast 修复）

---

## §6 演进史

### v0.1（本文初始版）

初始提案。基于三套拖拽系统（orb.ts + floating-card.ts BR 光球手势 + floating-card.ts 卡片体拖拽）的本质同一性，提出只保留一份引擎、所有浮卡通过配置创建。

### v0.2（2026-06-03，第一次实施尝试）

实施中发现 v0.1 的多项假设有缺口（详见 §8），代码已回退到 v6.4.0。
