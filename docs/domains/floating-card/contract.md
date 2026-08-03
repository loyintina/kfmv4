> 这是什么：浮卡 + 卡片堆 + 卡片注册表。
> 别的去哪找：手势调度 → ../client-shell/；卡片开发流程 → ../../guides/card-dev.md；统一化失败教训 → ../../decisions/。

# floating-card 域契约

## 架构

- **`card-registry.ts`**：统一注册表——类型声明 + 实例追踪。卡片类型经动态路径
  按需实例化（`terminal-card-04.ts`/`tmux-card.ts` 导入数为 0 是特性不是死代码）。
- **`card-stack.ts`**：堆叠抽屉 UI，按注册表动态构建；是浮卡的发射入口。
- **`floating-card.ts`**：浮卡发射/拖拽/缩放/编辑。
  状态机：`compact(120×36, 仅 BR 光球) → expanding(GSAP) → active(155×68, 四角光球) ⇄ editing(长按 BR 600ms → 缩放手柄)`。
  出口：`initFloatingCards()` `launchFocusedCard()` `dismissFloatingCard()` `hasFloatingCard()`。
- **`floating-shared.ts` / `floating-fullscreen.ts`**：共享类型常量 + 全屏逻辑（拆分层）。

## 硬规则

1. 浮卡与 orb 是独立模块，各管各的；**统一化方案已两次回退放弃**（../../decisions/adr-002-card-unification-abandoned.md）。
2. 新增交互模式走 GestureRegistry，禁止直接 addEventListener
   （规则的家 → ../client-shell/contract.md 手势优先级节 + #陷阱 6）。
3. 共享常量只能从 `interaction-constants.ts` 取——历史教训：局部定义 `MARGIN_F=8`
   绕过共享 `MARGIN`，已修正，勿再犯。
4. **双色渐变对应规则**：方向 135deg；color1（起点）→ 左光球 TL/BL + 图标背景；
   color2（终点）→ 右光球 TR/BR + 图标数字；文字统一白色，不派生自卡片色
   （视觉舒适 > 派生规则）。

## #陷阱

1. **第三方触摸库手势冲突**：库「全捕获但只处理部分方向」时，其余方向手势被静默
   丢弃。解法：库的手势处理器加方向检测，不处理的方向传给其他处理器。
   案例：2026-07-06 终端卡全屏下水平滑无法开侧栏。
2. **`querySelectorAll('*')` + inline style 是继承链毒药**：`touch-action` 是继承属性，
   逐后代设 `style.touchAction='none'` 后永久粘住。退出全屏/浮卡态只改容器元素。
   案例：2026-07-14 浮卡滚动失效，排查 2 小时。
3. **`display:''` 恢复显示**：同 client-shell#陷阱 4（flex 布局必须显式恢复）。
4. **卡片堆是全局模式，不是局部组件**：打开后整屏都是操作区域；
   `targetFilter: () => true` 是设计不是缺陷；任何「精确」限定手势区域的做法
   都会破坏外部触摸。案例：B.A.R. #002。
5. **BR 光球切换必须双向**：`compact ⇄ active` 状态机闭环——只写展开方向的后果是
   只能 dismiss 无法回紧凑态。案例：B.A.R. #004。
6. **背景和边框正交解耦**：外层壳用 `padding` 挤出渐变边框，内层独立元素负责毛玻璃；
   禁止在单个 `background` 里用 padding-box/border-box 分层模拟——背景透明度或
   渐变方向一改，边框就消失。
7. **浮卡与卡堆卡片共享同一套 DOM 结构**：内层毛玻璃用 `flow` 布局（外层 padding
   自然约束），禁止 `inset:0` absolute 定位；改任何一方的背景/边框/布局必须同步另一方。
8. **随机配色种子在 `openCardStack` 时生成**：每次召唤重新随机；`initCardStack`
   需预生成一次防 null——`_currentAccents` 未赋值时 `createCard` 崩溃。
   案例：B.A.R. #003。
9. **GSAP 动画冲突（幽灵卡片堆）**：`updateFocus()` 后立即 `closeCardStack()`，
   两个动画作用于同组 DOM，状态机卡在 closing/open → 幽灵卡片堆。
   必须 `updateFocus(onComplete)` 回调延迟关闭。案例：2026-07-12。
10. **全屏互斥：新来旧关，不设槽位排队**（43fcdd2）：投新全屏卡时旧卡走
    `dismissFullscreen` 完全关闭（不是压栈让位）；浮卡（滑动召唤）不改变全屏卡。
    卡片堆外 tap = 关堆（不透传手势）。
11. **手动投全屏联动折叠光球面板，AI 召唤不折叠**（61579a7）：`collapseOrbPanel`
    只挂两条手动路径——tree-render `createFileFloatingCard` 与 card-stack 的 click
    处理器；共享层（floating-fullscreen）刻意不挂，AI 自动召唤页面操作不折叠面板。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `CARD_REGISTRY_SPEC.md`：三层注册表接口 + allocId 编号池；**§6 的 AI 卡片三命令
  （focus-card/close-card/send-to-card）设计未实施**——现行无实现，属活设计缺口。
- `CARD-STACK-HANDOFF.md`：padding-box/border-box 渐变边框四次失败史 +
  父级 transform 破坏 backdrop-filter。
- `CARD_SYSTEM_DESIGN.md`：九卡 accent 配色表 + 三态 CardConfig 草样（被 adr-002 放弃）。
- `FULLSCREEN_CARD_SPEC.md`：全屏唯一槽位让位 + z-index 20-49 + 记忆位置恢复。
- `STACK_CARDS_DESIGN.md`：暮光/琉璃两套备用配色 21 色值（代码只留星云一套）。
- `TERMINAL_CARD_SPEC.md`：被弃自研 Canvas 终端方案——ANSI/SGR 解析表 + aux bar VT 映射。
- `UI_ELEMENT_REGISTRY_SPEC.md`：Registry 三层 schema + 注册配对约定 + 设计否决理由。
- `WORKBENCH_SPEC.md`：购物车交互/蜡笔光标 SVG/模式色系/API 契约。
- `WORKBENCH_PHASE4.md`：文件渲染器类型路由 + 预览/编辑双模式 + KaTeX/Mermaid CDN。

## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`src/client/modules/floating-card.ts` `src/client/modules/terminal-card-04.ts` `src/client/cards/plugins/role.card.ts` `src/client/cards/plugins/session.card.ts` `src/client/cards/plugins/config.card.ts` `src/client/cards/plugins/api.card.ts` `src/client/modules/card-stack.ts` `src/client/cards/plugins/tools.card.ts` `src/client/modules/renderers/handler-factory.ts` `src/client/modules/tmux-card.ts` `src/client/modules/floating-fullscreen.ts` `src/client/cards/plugins/inject.card.ts` `src/client/modules/floating-shared.ts` `src/client/modules/card-registry.ts` `src/client/modules/renderers/math-diagram.ts` `src/client/cards/plugins/debug.card.ts` `src/client/modules/renderers/code-highlight.ts` `src/client/modules/renderers/md-css.ts` `src/client/modules/renderers/md-extensions.ts` `src/client/cards/card-ui.ts` `src/client/modules/renderers/binary-fallback.ts` `src/client/modules/renderers/text-preview.ts` `src/client/cards/registry.ts` `src/client/cards/plugins/file.card.ts` `src/client/cards/plugins/terminal.card.ts` `src/client/cards/plugins/tmux.card.ts` `src/client/modules/renderers/file-type.ts` `src/client/cards/types.ts` `src/client/modules/renderers/katex-css.ts`
<!-- /gen:contract-list -->
