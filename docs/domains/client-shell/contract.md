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

实然注册表（2026-07-29 按代码重测绘，旧表的 picker-lock(110)/card-stack-global(80)
在代码中不存在）：

```
xterm-sel-handle(105) > floating-topmid-orb(101) > orb(100) = floating-orb(100)
> check-btns(95) > mode-btn(90) = pinch-zoom(90) > temp-card-swipe(80) = card-stack(80)
> action-bar-zone(70) = tmux-tab(70) > xterm-scroll(61) > sidebar-scroll(60)
> gestures-page-swipe(50)
```

- 新增交互模式必须注册进 GestureRegistry，**禁止直接 addEventListener**。
- ⚠ 平手靠注册序（如 mode-btn/pinch-zoom 同 90）——新增 handler 避免与现有同值，
  除非顺序无关。

## 动画状态机

| 模块 | 状态机 |
|------|--------|
| tree-render | `idle ⇄ animating`（L.beginOp/endOp） |
| card-stack | `closed ⇄ opening ⇄ open ⇄ closing` |
| floating-card | `compact → expanding → active ⇄ editing` |
| orb | `collapsed ⇄ expanded ⇄ editing`（orb-state.ts 实然 3 态；
过渡态由 GSAP 承担不入状态机） |

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

## GSAP 动画治理（2026-07-29 按 ADR-004 裁决二修订）

▎ 所有 GSAP 调用必须通过 animation-registry.ts
▎ 禁止直接 import gsap（构建时 scripts/check/check-anim.mjs 扫描白名单）
▎ anim.to/set/killTweensOf/timeline 直透是**官方用法**——需要停动画直接 killTweensOf
▎ scope() 是**按需**机制（现仅 tree-render 单租户）：需要一把 clear() 清掉本模块
  整组动画时才用；char-rain 实然也挂共享 ts scope，ts.clear() 会一并清除（重渲染时重建）
▎ card-stack / orb 的 GSAP 调用走 anim 工具方法

## #陷阱

1. **CSS 布局方程**：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex。
2. **Registry 配对规则**：新增交互元素必须 register + 加入 MANIFEST；state 运行时会变的
   （几乎全部）必须用 `registerElement()`（register + registerStateGetter 一次配对），
   否则 snapshot() 返回过时静态 state。
3. **notifyStateChange 覆盖**：只通知「变了」不传值，snapshot 靠 registerStateGetter 读实时态。
   漏调 → AI 看到的 snapshot 滞后。check-registry 验字段完整性 + 孤立 getter + 跨文件命令重复，
   notify 覆盖靠人工保证。
4. **`display:''` 是继承链杀手**：恢复显示必须显式写 `'flex'`/`'block'`——`display:''`
   会 revert 到 CSS 默认值。案例：2026-07-05 光球 SVG 偏移 ~6px，排查数小时。
5. **`endOp` 必须在早期 return 之前执行**（v6.11.0 已根解，再犯即回归）；
   动画锁 3s 兜底的不变量本体 → ../canvas-tree/contract.md 动画安全节。
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
9. **拖拽残留状态禁止 if 守卫绕过**：拖拽残留（v7 的 _dragItem，已随重写消亡）的根解是拖拽生命周期由事件系统
   保证，不是在拖拽入口（v7 的 _startFloatingDrag）开头加 if 守卫清场（INVARIANTS §五迁入）。
10. **侧栏触摸区事件冒泡**：冒泡到 document 会误触发 GestureRegistry——
    侧栏交互注意事件边界的阻止/隔离（旧 CLAUDE.md 注意事项迁入）。

## Z-Index 层级（自 AI_CHAT_RUNTIME §九迁入，2026-07-28）

**产品决策（2026-07-19，commit `a5bf0c4`）**：焦点弹窗（L8, 10000+）**高于** AI 核心
（L7, 9000-9200）。理由：确认框/模态框一出现即代表用户正专注一次操作（如确认删除），
必须能盖住输入栏/发送按钮/光球，避免误触打断。

| 层 | z 值 | 内容 |
|----|------|------|
| L8 焦点交互 | 10000-10900 | action-bar / toast / 模态框 / 确认框 / 下拉 |
| L7 AI 核心 | 9000-9200 | 面板 / 输入栏 / 发送按钮 / 光球 |
| L6 终端交互 | 6400-6430 | 终端手柄 / 茎 / 放大镜 / 复制（卡片作用域） |

- **`CUSTOM_SELECT`(10900) 必须高于 `MODAL_DIALOG`(10800)**：下拉框常在模态框内部
  弹出（config/session/tools 卡的下拉都在弹窗里），低于模态框会被遮住。
- 全表见 `z-index-layers.ts` / `z-index.css`（`scripts/check/check-zindex.mjs` 强制 JS↔CSS 一致）。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `GESTURE_ARCHITECTURE_SPEC.md`：requireFailure 手势依赖方案（未采用——实际更简方案已落地）。

## 文件清单

- 骨架：`app.ts` `ui.ts` `dom-refs.ts` `state.ts` `renderer-lifecycle.ts`
- 注册中心：`ui-registry.ts` `gesture-registry.ts` `animation-registry.ts`
- 交互共享：`interaction-constants.ts` `drag-handler.ts` `click-queue.ts` `z-index-layers.ts`（与 z-index.css 镜像，check-zindex 校验）
- orb 骨架：`orb.ts`（协调层）`orb-panel.ts` `orb-state.ts` `gestures.ts` `debug-assert.ts`
- 通用组件：`custom-select.ts` `confirm-dialog.ts` `card-toast.ts`
- 日志：`logger.ts`（debug-card 伴侣）

