---
status: draft
version: v1.0
last_updated: 2026-07-07
---

# KFM v4 — 测试基础设施改进设计规范

> **版本**：v1.0
> **状态**：设计阶段（draft）
>
> 本文档描述 KFM v4 测试基础设施的现状问题与改进方案。

## 关联文档

- HANDBOOK.md §三 持续观察 — 测试基础设施脆弱
- HANDBOOK.md 陷阱 #11 — GSAP mock 时序失真
- DIAGNOSTICS.md — 诊断流程

---

## §1 现状分析

### 1.1 当前覆盖

| 覆盖层级 | 模块 | 测试数 | 可靠性 |
|----------|------|--------|--------|
| **纯逻辑** | Box、flex、state、logger、click-queue、debug-assert、GestureRegistry（匹配）、text-layout | ~140 | ✅ 高——同步 mock 不影响纯逻辑 |
| **依赖 GSAP 动画** | animation-registry | ~15 | ⚠️ 中——同步执行回调导致顺序测试误判 |
| **依赖 DOM 布局** | style-registry、tree-model | ~15 | ⚠️ 中——getBoundingClientRect 恒为 0 |
| **UI 交互** | floating-card、card-stack、orb、gesture-registry（集成） | ~8 | ❌ 跳过——DOM mock 不足以支持交互测试 |
| **Canvas 渲染** | renderer.ts、box.ts（渲染）、BorderDrawer.ts | 0 | ❌ 完全未覆盖 |
| **手势交互** | gestures.ts、xterm-scroll、pinch-zoom | 0 | ❌ 完全未覆盖 |

### 1.2 三个根本缺陷

#### 缺陷 A：GSAP mock 时序失真

文件：`tests/mocks/gsap.ts`

```
问题：processOps() 通过 queueMicrotask 批量执行所有操作，
      tl.call(cb) 中的 cb 在时序位置之前就被调用了。

具体表现：
  tl.to(target, { x: 100, onComplete: fn })  // fn 在注册时就被调用
  tl.call(cb)                                 // cb 紧随上一个 ops 立即执行
  tl.reverse()                                // 反转时 onComplete 不会触发

根因：Mock 没有维护"当前时间位置"，ops 只是一个按序执行的数组，
      没有"从位置 0 播放到位置 0.5"的渐进概念。
```

#### 缺陷 B：DOM mock 无布局计算

文件：`tests/preload.mjs`

```
问题：makeElement() 返回的对象形似 DOM 元素，但核心布局属性是常数。

具体缺失：
  - getBoundingClientRect() 恒返回 { x:0, y:0, width:0, height:0 }
  - scrollTop/scrollHeight/clientHeight 是普通数字，不与 overflow 联动
  - 没有子元素边界计算（appendChild 不影响父元素尺寸）
  - classList 不触发任何样式变化
  - style 赋值不影响 getComputedStyle()
```


```
Canvas 2D 渲染器的输出是像素级绘制，无法用传统的 assert 验证。
renderer.ts (825 行) 和 box.ts (623 行) 的渲染路径完全未覆盖。

可行的测试策略：
  - 验证 Box 树构建正确（不渲染，只检查节点结构）
  - 验证 layout 计算结果（flex 布局后的 x/y/width/height）
  - 验证手势 hitTest 的命中/未命中边界
  - 快照对比（jest snapshot 或 Canvas 截图 base64 对比）
```

---

## §2 改进方案

### 2.1 总体策略

```
三层递进：
  第 1 层：修 GSAP mock 时序 → 让动画相关测试能跑
  第 2 层：增强 DOM mock 布局 → 让交互相关测试能跑
  第 3 层：补 Canvas 层测试 → 让渲染相关测试能跑
```

每一层是下一层的基础。不推荐跳层。

### 2.2 实施步骤

#### 步骤 A：GSAP Mock 时序修正

**目标**：让 `tl.to()` / `tl.call()` / `tl.reverse()` / `tl.progress()` 的时序行为与真实 GSAP 一致，同步 mock 但支持"时间位置"概念。

**改动范围**：仅 `tests/mocks/gsap.ts`

**设计要点**：

```typescript
// 新架构：时间线 = 有序事件列表，每个事件有 position（毫秒位置）
interface TimelineEvent {
  position: number;    // 从时间线开始计算的毫秒位置
  type: 'tween' | 'call' | 'set';
  target?: any;
  vars?: any;
  fn?: Function;
  duration: number;    // tween 持续时间（call/set 为 0）
}

// 播放 = 按 position 顺序执行事件
// progress(0.5) = 执行所有 position < totalDuration * 0.5 的事件
// onComplete 在 tween 的 position + duration 位置触发
// reverse() = 反向执行（从当前位置回退）
```

**关键约束**：
- 保持同步（不引入真实定时器）
- `progress()` 必须可双向跳转
- `tl.call(cb)` 在时间线的对应位置执行
- `tl.reverse()` 反向走到 `progress(0)` 时触发 `onReverseComplete`

**验收标准**：
- [ ] `tl.to(target, { x: 100, duration: 100, onComplete: fn })` → `tl.progress(1)` 后 `fn` 被调用
- [ ] `tl.call(cb)` → `tl.progress(pos)` 到 cb 的 position 时调用 cb
- [ ] `tl.reverse()` → `tl.progress()` 从 1→0，反向触发 onReverseComplete
- [ ] 现有 178 个测试不因 mock 修改而失败

#### 步骤 B：DOM Mock 布局增强

**目标**：让 `getBoundingClientRect()` 返回基于元素 style（width/height/padding）的计算值，`scrollTop`/`scrollHeight` 根据内容溢出自动联动。

**改动范围**：`tests/preload.mjs` 中的 `makeElement()`

**设计要点**：

```typescript
// 增强后的 makeElement：
// - style.width/height → getBoundingClientRect() 返回对应值
// - appendChild(child) → scrollHeight + child.height
// - overflow: auto + scrollHeight > clientHeight → scrollTop 可读写
// - getComputedStyle(el) 返回当前 style 的计算值（简化版）
```

**验收标准**：
- [ ] `el.style.width = '100px'` → `el.getBoundingClientRect().width === 100`
- [ ] `el.style.overflowY = 'auto'` + 子元素超出 → `el.scrollTop` 可读写
- [ ] 现有 178 个测试不因 mock 修改而失败

#### 步骤 C：Canvas 渲染层测试策略

**目标**：覆盖 `renderer.ts` 的核心路径——Box 树构建、布局计算、碰撞检测。

**改动范围**：新增 `tests/renderer.test.ts`（不修改现有 mock）

**设计要点**：

```
不测像素输出，测：
  - Box 树构建：addChild/removeChild/find/flatten → 节点结构正确
  - Flex 布局：applyFlexLayout 后的 x/y/width/height → 布局结果正确
  - hitTest：给定坐标点 → 命中/未命中正确的 Box
  - 光标系统：cursorBox 定位 → 位置计算正确
  - 双树渲染：主树 + overlay 树独立 → 互不影响

这些不依赖 Canvas 上下文，只需要 Box 树 + 布局计算。
```

---

## §3 实施计划

### 3.1 阶段划分

| 阶段 | 内容 | 估时 | 状态 | 前置依赖 |
|------|------|------|------|---------|
| B | DOM mock 布局增强 | 2 天 | ✅ 已完成 | 阶段 A |
| C | Canvas 渲染层测试 | 2 天 | ⏳ 待开始 | 阶段 B |
| D | 交互测试补全（浮卡状态机） | 1 天 | ⏳ 待开始 | 阶段 A+B |

### 3.2 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| DOM mock 增强后现有测试失败 | 中 | 高 | 渐进式修改，每改一个属性跑一次全测试 |
| GSAP mock 时序过于复杂超出同步模拟能力 | 低 | 高 | 接受"近似"语义，只保证常见路径（to/call/reverse）正确 |
| Canvas 快照对比在 CI 中不稳定 | 中 | 低 | 结构测试优先于像素测试 |

---

## §4 开放问题

### 4.1 是否需要真实浏览器测试？

当前方案在 Node.js 中模拟 DOM。真实浏览器测试（Playwright/Puppeteer）可以覆盖手势交互的完整链路，但：
- 需要启动浏览器 + 服务端
- CI 配置更复杂
- 运行时间更长

**建议**：第三阶段评估，当前不引入。

### 4.2 测试文件组织

当前 178 个测试全部在 `regression.test.ts` 中（1849 行）。是否需要拆分？

**建议**：暂时不拆分。阶段 A/B 完成后，如果 `regression.test.ts` 超过 2500 行，再按模块拆分。

---

> **本文档与代码同步。实现过程中如发现设计漏洞或新决策，先更新本文再改代码。**
