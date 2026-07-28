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

1. 浮卡与 orb 是独立模块，各管各的；**统一化方案已两次回退放弃**（decisions/adr-002）。
2. 新增交互模式走 GestureRegistry，禁止直接 addEventListener。
3. 共享常量只能从 `interaction-constants.ts` 取——历史教训：局部定义 `MARGIN_F=8`
   绕过共享 `MARGIN`，已修正，勿再犯。

## #陷阱

1. **第三方触摸库手势冲突**：库「全捕获但只处理部分方向」时，其余方向手势被静默
   丢弃。解法：库的手势处理器加方向检测，不处理的方向传给其他处理器。
   案例：2026-07-06 终端卡全屏下水平滑无法开侧栏。
2. **`querySelectorAll('*')` + inline style 是继承链毒药**：`touch-action` 是继承属性，
   逐后代设 `style.touchAction='none'` 后永久粘住。退出全屏/浮卡态只改容器元素。
   案例：2026-07-14 浮卡滚动失效，排查 2 小时。
3. **`display:''` 恢复显示**：同 client-shell#陷阱 4（flex 布局必须显式恢复）。

## 文件清单

`card-registry.ts` `card-stack.ts` `floating-card.ts` `floating-shared.ts`
`floating-fullscreen.ts` `terminal-card-04.ts`（xterm + WS 重连重开 PTY）
`tmux-card.ts`（WS 重连 _lastCommand 自动 re-attach）
