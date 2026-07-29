> 这是什么：ADR-002——卡片系统统一化两次失败后放弃的决策（accepted）。
> 别的去哪找：前进方向决策 → adr-001-orb-floating-card-independent.md；浮卡契约 → ../domains/floating-card/contract.md。


**日期**: 2026-06-07  
**状态**: accepted  
**决策者**: KFM v4 team

## 背景

v6.6.0 之前两次尝试将卡片系统统一化，目标是把 `card-stack.ts`（卡片堆）、`floating-card.ts`（浮卡）和 cards/plugins 插件系统合并为一套统一的卡片管理模块。

## 尝试历史

### 尝试 1（v0.1）
以 `floating-card.ts` 为引擎，将 `card-stack.ts` 的卡片定义和 `orb.ts` 的面板逻辑移植进去。**回退原因**：orb.ts 的 AI 面板逻辑与 floating-card 的浮卡生命周期模型不兼容——AI 面板是"展开/收起"的二元切换，浮卡是"发射→拖拽→缩放→关闭"的多态流水线。

### 尝试 2（v1.0）
反转方向：以 `orb.ts` 为地基，将 floating-card.ts 重构为 orb 的泛化引擎。**回退原因**：floating-card.ts 的代码质量不如 orb.ts（orb 经过更多轮迭代），但 floating-card 的全屏逻辑和四角光球交互又比 orb 复杂——两个模块在不同维度各有优势，没有哪个能作为另一个的"地基"。

## 决策

**放弃统一化。** 前进方向（保持独立 + 三层共享层）见 adr-001。

## 理由

1. **两个模块解决的问题本质不同**。card-stack 是"卡片列表的全局展示面板"，floating-card 是"单个卡片的拖拽交互画布"。强行统一会引入不必要的抽象层。

2. **两轮尝试的沉没成本已经是信号**。总共投入了估计 10+ 小时的设计和实施，最终都回退。继续尝试的边际风险大于边际收益。

3. **正确的统一层已经存在**：`card-registry.ts` 让两个模块共享同一套卡片定义——统一在定义层，不在模块层。

## 后果

- floating-card 域契约硬规则 1 明确标注"统一化方案已放弃"
- 未来新增卡片类型只需写 plugins/ 下的 .card.ts 文件，不涉及 card-stack 或 floating-card 的重构
- 如果未来真的需要一个统一引擎，应该从零设计，而不是在现有两个模块上修补
