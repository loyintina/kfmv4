> 这是什么：客户端跨模块骨架——注册中心、手势调度、动画状态机、初始化编排。
> 别的去哪找：文件树渲染 → ../canvas-tree/；浮卡 → ../floating-card/；AI 对话 → ../ai-chat/；样式构建 → ../infra/。

# client-shell 域契约

## 注册中心（五中心）

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| GestureRegistry | `gesture-registry.ts` | document 级触摸事件统一调度 |
| RendererLifecycle (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| DOM | `dom-refs.ts` | 全局 DOM 元素引用 |
| Registry | `ui-registry.ts` | UI 元素注册表（黄页模式） |
| KFMState | `state.ts` | 全局状态层（发布-订阅） |

## 手势优先级（不可违反）

```
picker-lock(110) > orb(100) > floating-orb(100) > card-stack-global(80)
> sidebar-scroll(60) > page-swipe(50)
```

- 新增交互模式必须注册进 GestureRegistry，**禁止直接 addEventListener**。

## 动画状态机

| 模块 | 状态机 |
|------|--------|
| tree-render | `idle ⇄ animating`（L.beginOp/endOp） |
| card-stack | `closed ⇄ opening ⇄ open ⇄ closing` |
| floating-card | `compact → expanding → active ⇄ editing` |
| orb | `collapsed ⇄ expanding/collapsing ⇄ expanded ⇄ editing` |

## 依赖方向（单向，零回边）

```
renderer-lifecycle → canvas-utils → canvas-cursor → canvas-scroll → tree-render
```

- `canvas-*` 不导入 `tree-*`；`(as any)` 零逃逸（check-as-any 扫描）。

## 初始化调用链

```
main.ts → gestures.init() → initApp() → initUI() → initGestures() → initOrb()
        → initTreeRenderer() → loadFileTree() → initLazyLoader() → initCardStack()
```

## #陷阱

1. **CSS 布局方程**：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex。
2. **Registry 配对规则**：新增交互元素必须 register + 加入 MANIFEST；state 运行时会变的
   （几乎全部）必须用 `registerElement()`（register + registerStateGetter 一次配对），
   否则 snapshot() 返回过时静态 state。
3. **notifyStateChange 覆盖**：只通知「变了」不传值，snapshot 靠 registerStateGetter 读实时态。
   漏调 → AI 看到的 snapshot 滞后。check-registry 只验字段完整性，notify 覆盖靠人工保证。
4. **`display:''` 是继承链杀手**：恢复显示必须显式写 `'flex'`/`'block'`——`display:''`
   会 revert 到 CSS 默认值。案例：2026-07-05 光球 SVG 偏移 ~6px，排查数小时。
5. **动画锁 3s 是兜底不是设计**：`waitForAnimUnlock` 3s 超时；`onComplete` 里
   `L.endOp()` 必须在早期 return 之前执行（v6.11.0 已根解，再犯即回归）。

## 文件清单

- 骨架：`app.ts` `ui.ts` `dom-refs.ts` `state.ts` `renderer-lifecycle.ts`
- 注册中心：`ui-registry.ts` `gesture-registry.ts` `animation-registry.ts`
- 交互共享：`interaction-constants.ts` `drag-handler.ts` `click-queue.ts` `z-index-layers.ts`（与 z-index.css 镜像，check-zindex 校验）
- orb 骨架：`orb.ts`（协调层）`orb-panel.ts` `orb-state.ts` `gestures.ts` `debug-assert.ts`
- 通用组件：`custom-select.ts` `confirm-dialog.ts` `card-toast.ts`
- 日志：`logger.ts`（debug-card 伴侣）
