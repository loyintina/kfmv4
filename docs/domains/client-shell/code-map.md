> 这是什么：client-shell 域**代码现状**测绘（实然）——代码此刻到底是什么，含与契约的漂移。
> 应然去哪找：设计契约 → contract.md。
> 机械层对照：文件/行数/导出符号 → ../code-inventory.md（脚本生成，可重跑）。

# client-shell 代码地图（code-map）

## 测绘元数据

- 基准：commit 03da8c9 · 2026-07-29 · 域规模 22 文件 / ~6400 行
- 方法：subagent 七问侦察 + 主 agent 抽查核实

## 一句话职责

应用外壳：启动编排、全局状态 KFMState、手势/动画/DOM/z-index 注册表底座、
拖拽引擎、光球本体（orb）与其面板骨架。

## 承重入口

| 入口 | 位置 | 调用方 |
|------|------|--------|
| main.ts（无导出，启动编排） | main.ts:66-73 同步链 + :109-134 异步尾链 | 进程入口 |
| `KFMState` 单例 | state.ts:73 | 订阅者仅 tree-render.ts:85、ws-channel.ts:343 |
| `L` 单例（渲染生命周期/动画锁） | renderer-lifecycle.ts:223 | 7 个 canvas-tree/floating 文件读写 |
| `gestures` 单例 | gesture-registry.ts:385 | 9 个文件注册 handler |
| `anim` 单例 | animation-registry.ts | ~10 个文件 |
| `initOrb()` | orb.ts（840 行，真逻辑厚重） | main.ts:70（唯一） |
| `createDragHandler()` | drag-handler.ts:68 | orb.ts:532、floating-card.ts |

公共底座（logger/dom-refs/z-index-layers/animation-registry）被全仓三域共用。

## 状态所有权

- KFMState 常规写走方法；**但 expandedPaths 被 tree-render.ts:524、tree-loader.ts:178
  直写绕过 setter（无 notify）**；currentRoot 由 main.ts:130 直接赋值
- 手势内部态：gesture-registry 独占；drag-handler 每次 create 一个闭包 DragState
- orb 模块级变量（orb.ts:63-89）：orbState/panelState 等 orb.ts 独占写；
  **chatMessages（orb.ts:89）所有权在 shell、写在 ai-chat——跨界共享**（见漂移 8）
- logger._logs（200 行环形）、click-queue._queue、Registry._elements 均模块独占

## 核心流程

**启动序列（实然）**：gestures.init（绑 document 4 监听 + body touchAction=none）→
initApp → initUI → initGestures → initOrb（ensurePanel、sessionStore 初始化、
持久 run 恢复、tryAutoResume）→ initTreeRenderer → initCardStack → initFloatingCards
→ initWsChannel（main.ts:106）→ establishRoot → loadFileTree → initLazyLoader。

**手势一帧**：pointerdown → _handleStart（gesture-registry.ts:224）→ preMatch hooks →
按 priority 降序匹配（命中即 break :281）→ drag-handler onStart（长按计时 600ms）→
超 15px 阈值转拖动 → onEnd 分流 tap/exitEdit/savePosition → orb onTap=togglePanel。

## 持久化/外部边界

- localStorage 多写者：expandedPaths 3 写者；kfmv4_currentRoot 2 写者；
  kfm-fontsize-* 写者 gestures.ts:56 + 各卡自读（key 拼接不一致，见 floating-card 图）
- .kfmv4/active.json：orb.ts:43,55（fire-and-forget 不 await）与 ai-chat 的
  session-client **双写者**
- custom-select/confirm-dialog 把 DOM 挂 body + document 级监听（destroy 时移除）

## 跨域边界

- 本域 import 域外：orb.ts → theme + ai-chat 四模块；app/ui → ws-channel（归 ai-chat 域）；
  gestures.ts → card-stack/card-registry；main.ts → 全三域 init
- 域外 import 本域：canvas-tree 与 floating-card 全域依赖 L/anim/DOM/Z/log/debug-assert；
  ai-chat → Registry/KFMState/DOM/Z/log

## 强制不变量（附证据）

- 手势互斥：priority 降序 + 命中即 break + 同 id 替换（gesture-registry.ts:82-86,281）
- GSAP 白名单：全 src 唯一 import gsap 是 animation-registry.ts:12（check-anim 构建期强制）
- z-index JS↔CSS 一致：check-zindex.mjs 构建期强制
- orb 位置钳制：`clampOrbPosition`（orb.ts:171-183）
- 长按/拖拽阈值常量唯一来源 interaction-constants.ts

## 漂移清单（实然 ≠ 应然）

1. **初始化链漂移**：契约顺序与实然不符——initCardStack/initFloatingCards 在
   loadFileTree 之前同步执行（main.ts:72-73 vs :129-134），initWsChannel 不在契约链上。
2. **【已结案】手势优先级表漂移**：契约表已按代码重测绘（实然 14 个 handler 全列，
   含平手靠注册序警告）。pinch-zoom 与 mode-btn 同为 90 的平手保留并在契约标注。
3. **【已结案】orb 状态机漂移**：契约已改为实然 3 态（过渡态由 GSAP 承担）；
   nextOrbState 及其单测（orb-state.test.ts 整文件）已随死代码批次二删除
   （orb.ts 的 re-export 收窄为仅类型）。
4. **【已结案】char-rain timeline 契约错误**：契约已改为实然（字符雨挂共享 ts
   scope，ts.clear 一并清除、重渲染时重建）——按裁决二「契约随实然」方向结案。
5. **【已结案】animation-registry 注释≠实现**：头注释泛化声称（play 自动 kill/reverse/
   killAll）已按 ADR-004 裁决二重写为「直透为官方用法、scope 按需（单租户）」，
   注释与实现现已一致；死字段 _entries/AnimEntry 已随批次二删除。
6. **契约 #8 错位**：契约称 setExpanded 受 L.isAnimating 守卫；state.ts:116-130 内
   无守卫，守卫在调用侧（tree-render.ts:409,489）。
7. **PointerEvent 统一被违反**：chat-dom.ts:192-193 直接绑 touchstart/touchmove。
8. **orb.ts 域归属漂移（呼应 ai-chat code-map 漂移 4）**：840 行中约 350 行是
   ai-chat 编排（loadSessionInto、tryAutoResume 格式转换、handleSend、chatMessages、
   abortCtrl）；orb-panel.ts 同样泄漏（sessionStore.subscribe、providers/roles 拉取）。
   「orb 骨架=协调层」名不副实，它是 ai-chat 客户端的事实宿主。
9. **【已结案】showToast 死代码 + 双份漂移**：app.ts 的零调用 showToast 已随批次二
   删除，ws-channel.ts:381-387 内联版成唯一实现（双份消除；其「消失不 notify」
   行为差异随死原版消亡，如 AI 视角需要 toast 状态另案补 notify）。
10. **【已结案】window 全局接口空声明**：main.ts 的 window.API/selectedFile 等
    8 个空声明已随批次二删除。
11. **【已结案】state.ts 卡片工作台死代码**：cart*/openCards/focusCard/setViewport
    及 OpenCard/CartEntry/CartState/CartConfig 四类型已随批次二删除
    （WORKBENCH_SPEC 遗留；呼应 cross-domain#11）。
12. **【已结案】死 API 一批**：L.pushContext/popContext/registerListener/
    removeAllListeners、gestures.disable/enable/destroy/isRegistered/
    removePreMatchHook、anim.clearScope、debug-assert.warn 已随批次二删除
    （连带 7 个测死代码的测试，按 infra 陷阱 5）。
13. **dom-refs 自我宣称不实**：头称「唯一入口」，实然 orb.ts:175、gestures.ts:142,160、
    orb-panel.ts:91 等多处绕过直查。
14. **【已结案】DragConfig 死字段**：minEditW/minEditH 接口字段及两处传值
    （floating-card/orb）已随批次二删除。
15. **【已结案】debug-assert debugger 语句上生产**：`debugger;` 已删（BAR-DEBUG-01，
    引入 4e59339）。DEBUG=true 常开保留为有意决策——本地单用户应用，用户即开发者，
    断言日志即 bug 上报通道（docstring 已写明）。
16. 次要：空 if 块死码已随批次二删除；剩余：orb 面板尺寸双实现
    （getPanelTargetPosition vs updatePanelPosition，:234-235 算了不用）；长按双机制
    并存（registry longPressMs vs drag-handler 自计时）。

## 陷阱指针

已定型陷阱见 contract.md #陷阱（注意 #8 已错位，见漂移 6）。
测绘新捕获：orb.ts 跨界共享 chatMessages 是双向漂移的枢纽——任何 orb/ai-chat 边界
重构必须先读本条与 ai-chat code-map 漂移 4。
