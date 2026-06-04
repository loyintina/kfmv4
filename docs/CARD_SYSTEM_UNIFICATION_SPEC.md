---
status: active
version: v1.0
last_updated: 2026-06-05
archived_reason: ''
---

# KFM v4 — 浮卡系统统一化规范

> **版本**：v1.0
> **状态**：当前实施中
>
> **方向变更说明**：v0.2 试图以 floating-card.ts 为引擎、将 orb.ts 移植进去。实践发现 orb.ts 的核心逻辑经过多轮迭代，质量高于 floating-card.ts 中对应的实现。v1.0 反转方向：**以 orb.ts 为地基**，将它的核心逻辑提取为通用引擎。
>

> **关联文档**：
> - KFM_V4_INVARIANTS.md — 修改约束协议
> - VISION_AND_ROADMAP.md — 核心理念来源
> - HANDBOOK.md — 工作手册

---

## §0 本文的性质

本文档记录浮卡系统统一化的设计讨论、产出定义和迁移计划。
前身是两套独立实现（orb.ts + floating-card.ts），
在 v1.0 中纠正为：**orb.ts 是参考实现，floating-card.ts 是基于它的泛化引擎**。

**阅读顺序**：§1（核心意图）→ §S（产出定义）→ §3（迁移计划）→ §6（演进史）

---

## §1 核心设计意图（不可违反）

### 1.1 一份引擎，任意浮卡

所有浮动面板——光球面板、卡片堆浮卡、未来调试面板——**必须是同一个 floating-card.ts 引擎的不同配置**。

### 1.2 以 orb.ts 为地基

orb.ts 的核心逻辑（位置计算、拖拽状态机、长按编辑、输入栏避让）是引擎的**参考实现**。floating-card.ts 的泛化工作以 orb.ts 的代码为基础，不是另起炉灶。

### 1.3 配置即差异

不同浮卡之间真正不同的只有：紧缩态尺寸、展开态尺寸、角光球可见性、内容渲染、z-index 策略、输入栏避让。**全部写成配置参数**。

### 1.4 彻底删除 orb.ts

功能被引擎覆盖后删除文件。

### 1.5 不做的（scope 边界）

- 不修改 card-stack.ts 的面板逻辑
- 不定义抽象类或接口——createFloatingCard(config) 函数足够
- 不做浮卡数据持久化
- 不强制迁移卡片堆浮卡——launchFocusedCard 保留

---

## §2 设计约束

### 2.1 状态机

光球面板模式：collapsed ← → expanded ⇄ editing

卡片堆浮卡模式：
launching → compact ← → expanding → active ⇄ editing

引擎内部支持两套状态机，由配置的 mode 字段决定。

### 2.2 拖拽通过 gesture-registry

禁止裸 document.addEventListener。当前 floating-card.ts 有 _bindBrDragEvents（裸事件）和 initFloatingCards（gesture-registry）两套，统一过程中全部迁移到 gesture-registry。

### 2.3 四角光球的多态

BR 始终可见。TL/TR/BL 按配置显示。

### 2.4 插件文件独立

卡片配置放在 cards/plugins/ 下，插件 import 引擎，引擎不 import 插件。

---

## §S 产出定义

### S.1 引擎公开 API

- createFloatingCard(config): 创建浮卡
- dismissCard(id, animated): 关闭浮卡
- hasCard(id): 查询浮卡是否存在

引擎内部管理：生命周期、手势处理、状态机切换、边界钳制、输入栏避让、z-index、Registry 注册。

### S.2 引擎设计要点

1. 位置计算：从 orb.ts 的 updatePanelPosition() 原样提取，常量化
2. 拖拽状态机：从 orb.ts 的 startDrag/moveDrag/endDrag 原样提取，支持多浮卡
3. 输入栏避让：从 orb.ts 的 initInputBarWatcher 提取，通过 inputBarAvoid 控制
4. 编辑模式：从 orb.ts 的 enterEditMode/exitEditMode 提取
5. 角光球：从 floating-card.ts 的 createDecoratedCorner 提取
6. z-index：从 floating-card.ts 的 _cardAbove/_swapZIndex 提取

### S.3 删除清单

迁移完成后删除：orb.ts

---

## §3 迁移计划

### 保障机制

每次改动前确认：
- npm run check 零错误
- npm run test 全过
- 旧行为不变
- git diff 差异仅 intended 改动

### Step 1 — 引擎重写

从 orb.ts 原样提取核心函数到 floating-card.ts，泛化为 config 驱动的引擎。launchFocusedCard 保留不动。

### Step 2 — 写 orb-card.ts

新建插件，调用 createFloatingCard(config)。不启用。

### Step 3 — 新旧并行验证

用调试开关切换新旧 orb，逐项验证行为一致。

### Step 4 — 切换

main.ts: initOrb() 改为 initOrbCard()。全手动回归。

### Step 5 — 清理

删除 orb.ts，清理旧 import。

---

## §4 与现有系统的关系

| 系统 | 关系 |
|------|------|
| card-stack.ts | 不受影响，launchFocusedCard 保留 |
| gesture-registry.ts | 新引擎统一通过它注册 |
| animation-registry.ts | 不受影响 |
| ui-registry.ts | 配置驱动自动注册 |
| ws-channel.ts | 插件在 onCommand 中注册处理器 |
| theme.ts | 不受影响 |

---

## §5 已知缺口

| # | 缺口 | 解决方式 |
|---|------|---------|
| 1 | cards/plugins/ 在 tsconfig rootDir 外 | 放 src/cards/plugins/ 下 |
| 2 | initInputBarWatcher 绑定单个 orbEl | 多浮卡时只对有 inputBarAvoid 的启用 |
| 3 | orb 和 orb-panel 两个 Registry id | 保留两个 id，插件中直接注册 |

---

## §6 演进史

### v0.1（初始版）
初始提案：一份引擎，所有浮卡通过配置创建。

### v0.2（2026-06-03，第一次尝试）
以 floating-card.ts 为引擎尝试统一化，发现 orb.ts 核心逻辑质量更高，一次性改动过多导致回退。

### v1.0（2026-06-05，当前）
纠正方向：以 orb.ts 为地基，泛化为通用引擎。5 步实施，每步有验收标准。
