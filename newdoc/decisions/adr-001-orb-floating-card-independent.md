> 这是什么：ADR-001——orb 与 floating-card 保持独立模块的决策（accepted）。
> 别的去哪找：统一化失败史 → adr-002-card-unification-abandoned.md；浮卡契约 → ../domains/floating-card/contract.md。


**日期**: 2026-06-07  
**状态**: accepted  
**决策者**: KFM v4 team

## 背景

项目有两个浮动面板系统：`orb.ts`（光球 + AI 对话面板）和 `floating-card.ts`（浮卡发射/拖拽/缩放）。两者共享大量模式——四角光球、拖拽状态机、位置计算、GSAP 动画——但因为独立实现而产生代码重复。

## 选项

### A. 统一为一个引擎
以 `orb.ts` 为参考实现，将 `floating-card.ts` 泛化为通用引擎，移除 orb 的独立实现。所有浮动面板（光球、浮卡、未来调试面板）由同一个引擎驱动。

### B. 保持独立，共享底层
两个模块各自维护，但通过共享层（常量、类型、拖拽处理器）消除重复，不碰各自的核心逻辑。

## 决策

**选 B**。统一化方案尝试了两次均回退放弃。

## 理由

1. **统一化成本远高于预期**。orb.ts 经过多轮迭代，包含 AI 面板特定的业务逻辑（消息渲染、SSE 流式、会话管理），这些逻辑无法泛化而不丢失细节。floating-card.ts 有全屏切换、文件预览、键盘避让等完全不同的需求。

2. **共享层已经解决了重复问题**。`interaction-constants.ts` 统一了常量（MARGIN、DRAG_THRESHOLD），`drag-handler.ts` 统一了拖拽状态机。两个模块不再有逻辑重复——只有概念对称。

3. **独立便于迭代**。过去 4 天 orb.ts 有 14 个 commit，floating-card.ts 零改动。如果两者耦合在一个引擎里，每次 orb 改动都可能破坏浮卡行为。

4. **三层共享层方向可行**。常量层（interaction-constants）+ 类型层（共享接口）+ 能力声明层（Registry）可以在不碰逻辑的前提下逐步收敛。

## 后果

- 两个模块各自有 500-800 行的代码，接手者需要理解两套状态机
- 新增交互模式必须在 `gesture-registry.ts` 统一注册，不能各自 addEventListener
- 未来如果出现第三个浮动面板系统，应优先评估能否复用共享层，而非再次启动统一化
