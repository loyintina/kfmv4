---
status: draft
version: v1.0
last_updated: 2026-07-06
---

# KFM v4 — 手势识别架构改进设计规范

> **版本**：v1.0
> **状态**：设计阶段（draft）
>
> 本文档描述手势识别架构的改进方案，解决单指/双指手势冲突问题。
> 核心理念：引入**依赖关系机制**（借鉴 Hammer.js 的 `requireFailure`），让手势处理器可以配置依赖关系，实现延迟识别。
>
> **关联文档**：
> - HANDBOOK.md — 工作手册（架构、模块清单）
> - KFM_V4_INVARIANTS.md — 修改约束协议
> - TERMINAL_CARD_SPEC.md — 终端卡设计（xterm-scroll 手势）
>
> **阅读顺序**：§1（问题分析）→ §2（业界做法）→ §3（方案设计）→ §4（接口设计）→ §5（实现计划）→ §6（开放问题）

---

## §1 问题分析

### 1.1 问题描述

当用户在终端卡上进行双指缩放时，pinch-zoom 手势无法被识别，因为单指手势（xterm-scroll）优先被匹配。

**根本原因**：
1. 单指和双指手势混在同一个处理器列表中，共用 `_active` 状态
2. 优先级机制无法解决"预判"问题（第一个手指触摸时，系统无法预判是否有第二个手指）
3. 没有依赖关系配置，处理器之间是互斥的

### 1.2 当前架构的问题

| 问题 | 描述 |
|------|------|
| 状态混乱 | 单指和双指手势共用 `_active` 状态 |
| 预判失败 | 第一个手指触摸时，系统无法预判是单指还是双指 |
| 优先级失效 | 无论 pinch-zoom 优先级多高或多低，都无法解决"预判"问题 |

### 1.3 问题场景

**场景 1：单指触摸终端**
```
用户单指触摸 .xterm
  ↓
遍历处理器（按优先级降序）
  ↓
pinch-zoom（优先级 90）先被检查
  ↓
target.closest('.floating-card .card-content') → 匹配成功
  ↓
this._active = pinch-zoom
  ↓
但 pinch-zoom 没有 onStart 回调 → 无视觉反馈
  ↓
break → 不再检查 xterm-scroll（优先级 61）
```

**结果**：单指手势被 pinch-zoom "拦截"，xterm-scroll 永远不会被触发。

**场景 2：双指触摸终端**
```
用户第一个手指触摸 .xterm
  ↓
pinch-zoom 被匹配（同场景 1）
  ↓
用户第二个手指触摸
  ↓
this._pointers.size === 2
  ↓
_tryStartPinch 被调用
  ↓
但 this._active 已经是 pinch-zoom，无法正确启动
```

**结果**：双指手势无法正常启动。

---

## §2 业界做法

### 2.1 Hammer.js

Hammer.js 使用**识别器链**（Recognizer Chain）：

```javascript
var pinch = new Hammer.Pinch();
var pan = new Hammer.Pan();

// 配置依赖关系
pinch.recognizeWith(pan);  // 可以同时识别
singleTap.requireFailure(doubleTap);  // 等待失败
```

**关键设计**：
1. **独立的状态机**：每个识别器有独立的状态（`possible` → `began` → `changed` → `ended`）
2. **依赖关系**：
   - `recognizeWith()`：两个识别器可以**同时识别**
   - `requireFailure()`：只有当另一个识别器**失败**时，当前识别器才能识别
3. **延迟识别**：当配置了 `requireFailure` 时，识别器会等待一段时间来确认其他识别器是否失败

### 2.2 Interact.js

Interact.js 使用**组合式 API**：

```javascript
interact(element)
  .draggable({
    listeners: { move: dragMoveListener }
  })
  .gesturable({
    listeners: {
      move (event) {
        // 同时处理拖拽和缩放
        scale *= event.scale;
        angle += event.angle;
      }
    }
  });
```

**关键设计**：
1. **独立的监听器**：`.draggable()` 和 `.gesturable()` 有独立的监听器
2. **同时触发**：拖拽和缩放可以同时触发

### 2.3 Android

Android 使用**独立的检测器**：

```java
ScaleGestureDetector scaleDetector = new ScaleGestureDetector(context, ...);
GestureDetector gestureDetector = new GestureDetector(context, ...);

// 同时分发给两个检测器
@Override
public boolean onTouchEvent(MotionEvent event) {
    scaleDetector.onTouchEvent(event);
    gestureDetector.onTouchEvent(event);
    return true;
}
```

**关键设计**：
1. **独立的检测器**：每个手势类型有独立的检测器
2. **同时分发**：同一个事件可以同时分发给多个检测器

### 2.4 iOS

iOS 使用**手势识别器**：

```swift
let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch))
let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan))

// 配置依赖关系
panGesture.require(toFail: pinchGesture)  // 等待失败

view.addGestureRecognizer(pinchGesture)
view.addGestureRecognizer(panGesture)
```

**关键设计**：
1. **独立的识别器**：每个手势类型有独立的识别器
2. **依赖关系**：`require(toFail:)` 配置依赖

### 2.5 业界共同点

| 特性 | Hammer.js | Interact.js | Android | iOS |
|------|-----------|-------------|---------|-----|
| 独立状态机 | ✅ | ✅ | ✅ | ✅ |
| 依赖关系 | `requireFailure` | 组合式 API | 同时分发 | `require(toFail:)` |
| 延迟识别 | ✅ | ❌ | ❌ | ✅ |
| 同时识别 | `recognizeWith` | ✅ | ✅ | ✅ |

**核心思想**：
1. **独立的状态机**：每个手势类型有独立的状态
2. **依赖关系**：手势之间可以配置依赖关系（互斥或同时）
3. **延迟识别**：当不确定是哪种手势时，等待更多信息

---

## §3 方案设计

### 3.1 方案概述

引入**依赖关系机制**，借鉴 Hammer.js 的 `requireFailure` 设计：

1. 给 `GestureHandler` 添加 `requireFailure` 配置
2. 当配置了 `requireFailure` 时，处理器会等待其他处理器失败后再识别
3. 解决单指/双指手势冲突

### 3.2 核心概念

**依赖关系**：
- `requireFailure: string[]`：只有当指定的处理器失败时，当前处理器才能识别
- `recognizeTimeout: number`：延迟识别的超时时间（默认 100ms）

**处理器状态**：
- `idle`：空闲状态
- `possible`：可能识别（等待更多信息）
- `began`：已识别，手势开始
- `changed`：手势变化中
- `ended`：已结束
- `cancelled`：已取消

### 3.3 工作流程

#### 3.3.1 单指触摸流程

```
用户单指触摸 .xterm
  ↓
_handleStart 被调用
  ↓
匹配到 xterm-scroll（优先级 61，无依赖关系）
  ↓
this._active = xterm-scroll
  ↓
xterm-scroll.onStart 被调用
  ↓
用户移动手指
  ↓
xterm-scroll.onMove 被调用
  ↓
用户抬起手指
  ↓
xterm-scroll.onEnd 被调用
```

#### 3.3.2 双指触摸流程

```
用户第一个手指触摸 .xterm
  ↓
_handleStart 被调用
  ↓
匹配到 xterm-scroll（无依赖关系）
  ↓
this._active = xterm-scroll
  ↓
标记 pinch-zoom 为 possible 状态（有依赖关系）
  ↓
设置超时定时器（150ms）
  ↓
用户第二个手指触摸
  ↓
_handleStart 被调用
  ↓
this._pointers.size === 2
  ↓
_tryStartPinch 被调用
  ↓
检查 pinch-zoom 的依赖关系
  ↓
xterm-scroll 还在 active 状态 → 需要中断
  ↓
调用 xterm-scroll.onEnd
  ↓
this._active = null
  ↓
启动 pinch-zoom
  ↓
pinch-zoom.onPinchStart 被调用
```

---

## §4 接口设计

### 4.1 修改 `GestureHandler` 接口

**新增字段**：
```typescript
export interface GestureHandler {
  // ... 现有字段 ...
  
  /** 依赖关系：只有当指定的处理器失败时，当前处理器才能识别 */
  requireFailure?: string[];  // 处理器 ID 列表
  
  /** 延迟识别超时（ms），默认 100ms */
  recognizeTimeout?: number;
}
```

**字段说明**：
- `requireFailure`：指定需要等待失败的处理器 ID 列表
- `recognizeTimeout`：延迟识别的超时时间（默认 100ms）

### 4.2 添加 `RecognizerState` 接口

**新增接口**：
```typescript
interface RecognizerState {
  id: string;
  state: 'idle' | 'possible' | 'began' | 'changed' | 'ended' | 'cancelled';
  startTime: number;
  startX: number;
  startY: number;
  timeoutTimer?: ReturnType<typeof setTimeout>;
}
```

**状态说明**：
- `idle`：空闲状态
- `possible`：可能识别（等待更多信息）
- `began`：已识别，手势开始
- `changed`：手势变化中
- `ended`：已结束
- `cancelled`：已取消

### 4.3 修改 `GestureRegistry` 类

**新增字段**：
```typescript
export class GestureRegistry {
  // ... 现有字段 ...
  
  // 处理器状态追踪
  private _recognizerStates: Map<string, RecognizerState> = new Map();
}
```

### 4.4 配置示例

**pinch-zoom 处理器配置**：
```typescript
gestures.register({
  id: 'pinch-zoom',
  targetFilter: '.floating-card .card-content',
  priority: 90,
  requireFailure: ['xterm-scroll'],  // 等待 xterm-scroll 失败
  recognizeTimeout: 150,  // 150ms 超时
  onPinchStart: (e, _scale) => { ... },
  onPinchMove: (_e, scale) => { ... },
  onPinchEnd: (_e, scale) => { ... },
});
```

**xterm-scroll 处理器配置**：
```typescript
gestures.register({
  id: 'xterm-scroll',
  targetFilter: '.xterm',
  priority: 61,
  onStart: (e) => { ... },
  onMove: (e, dx, dy) => { ... },
  onEnd: (e) => { ... },
});
```

---

## §5 实现计划

### 5.1 实施步骤

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | `gesture-registry.ts` | 添加 `requireFailure` 和 `recognizeTimeout` 字段到 `GestureHandler` |
| 2 | `gesture-registry.ts` | 添加 `RecognizerState` 接口 |
| 3 | `gesture-registry.ts` | 添加 `_recognizerStates` 字段到 `GestureRegistry` |
| 4 | `gesture-registry.ts` | 修改 `_handleStart` 逻辑，支持延迟识别 |
| 5 | `gesture-registry.ts` | 添加 `_onRecognizeTimeout` 方法 |
| 6 | `gesture-registry.ts` | 修改 `_tryStartPinch` 逻辑，处理依赖关系 |
| 7 | `gestures.ts` | 给 pinch-zoom 添加 `requireFailure` 配置 |
| 8 | 测试 | `npm run check` + `npm run test` |

### 5.2 验证清单

- [ ] 单指触摸终端：xterm-scroll 正常工作
- [ ] 双指触摸终端：pinch-zoom 正常启动
- [ ] 单指→双指转换：单指处理器收到 `onEnd` 通知
- [ ] 超时机制：150ms 后自动识别
- [ ] 依赖关系：pinch-zoom 等待 xterm-scroll 失败
- [ ] 边界情况：依赖的处理器不存在、超时后又有新的触摸

---

## §6 心法检查

| 心法 | 检查 | 分析 |
|------|------|------|
| 2. 从源头上简化 | ✅ | 从源头解决了单指/双指冲突，而不是打补丁 |
| 5. 代码越改越少 | ⚠️ | 代码量会增加，但解决了根本问题 |
| 9. 原样复制后改 | ✅ | 不需要搬运代码 |
| 12. 发现补丁就立即根除 | ✅ | 不是补丁，是从架构层面解决问题 |
| 16. 一个数据一个生产者 | ✅ | `_recognizerStates` 只在 `_handleStart` 中更新 |
| 17. 不在旁边另开一条路 | ✅ | 不是补偿路径，是从源头解决问题 |

**结论**：方案 A 与现有架构**没有根本矛盾**，符合心法约束。

---

## §7 开放问题

### 7.1 超时时间

**问题**：150ms 是否足够？

**分析**：
- 人类双指触摸的间隔通常在 50-200ms 之间
- 150ms 可以覆盖大多数情况
- 如果超时时间太短，可能导致误识别
- 如果超时时间太长，可能导致响应延迟

**建议**：默认 150ms，可以通过 `recognizeTimeout` 配置调整。

### 7.2 依赖的处理器不存在

**问题**：如果 `requireFailure` 指定的处理器不存在怎么办？

**分析**：
- 如果依赖的处理器不存在，应该立即识别
- 避免因为配置错误导致手势无法识别

**建议**：在 `_onRecognizeTimeout` 中检查依赖的处理器是否存在。

### 7.3 超时后又有新的触摸

**问题**：如果超时后又有新的触摸怎么办？

**分析**：
- 如果超时后又有新的触摸，应该重新计算依赖关系
- 避免因为超时导致手势识别错误

**建议**：在 `_handleStart` 中清除超时定时器，重新计算依赖关系。

### 7.4 同时识别

**问题**：是否需要支持同时识别（`recognizeWith`）？

**分析**：
- Hammer.js 支持 `recognizeWith`，允许两个手势同时识别
- 例如：pinch 和 rotate 可以同时识别
- 当前架构不需要同时识别，因为单指和双指手势是互斥的

**建议**：暂时不支持同时识别，等有需要时再添加。

---

## §8 参考资料

- [Hammer.js 官方文档](https://hammerjs.github.io/)
- [Interact.js 官方文档](https://interactjs.io/)
- [Android 手势检测](https://developer.android.com/training/gestures)
- [iOS 手势识别器](https://developer.apple.com/documentation/uikit/uigesturerecognizer)

---

## §9 版本历史

| 版本 | 日期 | 改动 |
|------|------|------|
| v1.0 | 2026-07-06 | 初稿 |
