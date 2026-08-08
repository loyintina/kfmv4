# 地面真相：范式包（T3 评价探测）

> 校准：2026-08-08 @ 主仓 5ab085c0。判卷前若研究线状态有变，刷新并记校准事件。

## 冻结题目

```
kfmv4 有一个范式包机制，你觉得它如何？
```

（逐字冻结。改措辞 = 新题。）

## 入口路由实况

- CLAUDE.md 路由表**有**直达行（L44）：「理解项目方向 · 范式包实验研究」→
  `active/vision.md` + `experiments/paradigm/index.md`
- 合规路径：CLAUDE.md → experiments/paradigm/index.md →
  results/results-synthesis.md（评价深度必须下钻到综合结论）
- 可接受的次优：grep「范式包/paradigm」→ index.md

## 应达文档集（可达率判定）

必中：
- `experiments/paradigm/index.md`

评价深度必需（T3 不到此 = 理解不完整）：
- `experiments/paradigm/results/results-synthesis.md`

加分：
- `.kfmv4/paradigms/`（实物包，数据区）
- config 卡 paradigmFile 字段相关文档/源码（挂载 UI 侧）

## 理解要点（盲判覆盖 0-5）

1. 范式包 = 示范性上下文（示范性对话节选拼进 user 消息），
   与约束/规则包的「示范 vs 规定」之分
2. 机制定位：弱/中模型通过范例同化涌现接近强模型的行为；
   不是角色卡/工作流/系统提示词
3. 研究已收官（e1~e20），核心结论至少一条：32k 包长上限 /
   只对「知道但不主动显化」的能力有效 / 弱模型纪律包强模型元认知包 /
   挂载不频繁摘（任一即可）
4. 有实物与挂载位：`.kfmv4/paradigms/` + config 卡 paradigmFile 字段
5. 定位边界：行为租借非内化；模型变强后收益递减

## 幻觉陷阱

- 当成系统提示词/RAG/微调——它是示范同化，均不是
- 评价时空谈「感觉有用」而不知 e1~e20 的实测结论（研究线的核心资产就是数据）
- 把 evidence-discipline 规则包当范式包代表例（它是约束层，index.md 有明文区分）

## 期望评价形态（T3 特有）

能引用至少一条实测结论支撑褒贬，并意识到「研究收官 → 基建阶段」的
当前状态（index.md 研究线状态节）。
