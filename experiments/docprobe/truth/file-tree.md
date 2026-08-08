# 地面真相：文件树（T3 评价探测，老功能对照组）

> 校准：2026-08-08 @ 主仓 5ab085c0。**对照组：老功能，CLAUDE.md 同样无直达行——
> H1 判读时必须注意这点（路由缺失不是新功能专属）。**

## 冻结题目

```
kfmv4 有一个文件树，你觉得它如何？
```

（逐字冻结。改措辞 = 新题。）

## 入口路由实况

- CLAUDE.md 路由表**无**「文件树」行（校准日实测）
- 可接受路径：
  a. grep「文件树/canvas-tree」→ `docs/domains/canvas-tree/contract.md`
  b. 入口文档链：orientation/onboarding → docs/domains/code-inventory.md
     （域清单）→ canvas-tree 域文档
  c. 直接读源码 `src/client/modules/tree-*.ts` 摸到 canvas-tree 域契约
- 本题同为「无路由」组，与新功能组对比时提供老功能基线

## 应达文档集（可达率判定）

必中（任一即达）：
- `docs/domains/canvas-tree/contract.md`
- `docs/domains/canvas-tree/code-map.md`

加分：
- `docs/domains/canvas-tree/detail-engine.md`（引擎层）
- `src/client/modules/tree-render.ts` 等源码（实证深度）

## 理解要点（盲判覆盖 0-5）

1. Canvas 自渲染（v2 引擎 Box 树），**不是 DOM 树**——核心区分点
2. 懒加载：只取展开路径上的节点（tree-loader）
3. 两个唯一来源：theme.ts（颜色）/ style-registry.ts（尺寸字体）
4. 交互动画：字符雨展开/回收（char-rain）+ overlay 双树动画
5. 文档结构：域契约 + code-map + detail-engine 三层

## 幻觉陷阱

- 说成 DOM/虚拟列表渲染——它是 Canvas 自绘（最大幻觉点）
- 编造组件库（无第三方树组件，全自研）
- 只描述「能展开折叠」而无任何架构认知——T3 评价不合格

## 期望评价形态（T3 特有）

能对「Canvas 自研 vs 现成组件」的取舍形成有依据的评价
（如：动画自由度换可访问性/维护成本），或指出懒加载/字符雨等
具体设计的得失——老功能应展现出比新功能更厚的文档沉积
（契约的 #陷阱 节）可供评价。
