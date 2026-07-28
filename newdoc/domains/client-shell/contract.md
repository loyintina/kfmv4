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
6. **PointerEvent 统一**：所有触摸/鼠标输入必须走 gesture-registry 的 PointerEvent
   调度；禁止直接绑原生 `touchstart/touchmove/touchend`——两套事件系统在同一 DOM 上
   互相干扰，`pointermove` 被浏览器提前终止。案例：B.A.R. #001。
7. **touch-action 分层策略**：全局 `none`（body/.main/全屏覆盖层/自定义 Canvas 控件）；
   卡片内容区与浮卡外层 `pan-y`（原生垂直滚动 + 横滑透传全局手势）。
   内容区设 `none` → 无法滚动；全局 `auto` → 浏览器接管 → pointercancel 截断。
   **`touch-action` 是继承属性**（文档曾写反，B.A.R. #008 的诱因）。
8. **KFMState 批量修改必须合并一次 notify**：`setExpanded()` 每次调用都 notify 且受
   `L.isAnimating` 守卫；连续调用第二次可能被丢弃 → 幽灵 toggle + 动画断裂。
   批量修改用 `L.beginOp`/`L.endOp` 包裹，或确保空闲时执行。案例：2026-05-29 三连 setExpanded。

## 文件清单

- 骨架：`app.ts` `ui.ts` `dom-refs.ts` `state.ts` `renderer-lifecycle.ts`
- 注册中心：`ui-registry.ts` `gesture-registry.ts` `animation-registry.ts`
- 交互共享：`interaction-constants.ts` `drag-handler.ts` `click-queue.ts` `z-index-layers.ts`（与 z-index.css 镜像，check-zindex 校验）
- orb 骨架：`orb.ts`（协调层）`orb-panel.ts` `orb-state.ts` `gestures.ts` `debug-assert.ts`
- 通用组件：`custom-select.ts` `confirm-dialog.ts` `card-toast.ts`
- 日志：`logger.ts`（debug-card 伴侣）
