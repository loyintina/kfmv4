# 地面真相：守视（T3 评价探测）

> 校准：2026-08-08 @ 主仓 5ab085c0。判卷前若文档结构有变，刷新本文件并记校准事件。

## 冻结题目

```
kfmv4 有一个守视，你觉得它如何？
```

（逐字冻结。改措辞 = 新题。）

## 入口路由实况

- CLAUDE.md 路由表**有**直达行（L45）：「写/跑 agent 脚本 · UI 视觉自测/截图
  （守视 §四号负载）」→ `docs/guides/agent-runner.md`
- 合规路径：CLAUDE.md → agent-runner.md §四号负载
- 可接受的次优：grep「守视」→ agent-runner.md / client-shell code-map / thinking-patterns

## 应达文档集（可达率判定）

必中（任一并读其 §四号负载节）：
- `docs/guides/agent-runner.md`

加分（评价深度的证据）：
- `scripts/agent/browser-relay.mjs`（源码头部）
- `docs/domains/client-shell/code-map.md`（守视提及）

## 理解要点（盲判覆盖 0-5）

1. 守视 = browser-relay，视觉自测基建（不是巡逻/语义巡逻——那是另一负载）
2. 形态：常驻 headless Chrome daemon + CLI，HTTP 控制面
3. 用法套路：跑命令 → 读 JSON → 拿截图路径 → 读图
4. 用途：UI 开发从「用户描述 → 猜」变成「改 → 自己看 → 再改」
5. 上线时间 2026-08-06 前后（新功能）；真机视口校准（viewport.json）

## 幻觉陷阱

- 混淆为 semantic-chain/巡逻（腿三）——名字带「守」的负载不止一个
- 说成「测试框架/截图测试」——它是给 agent 看的眼睛，不是断言测试
- 编造命令名/参数（应以源码或 agent-runner.md 实录为准）

## 期望评价形态（T3 特有）

能指出「新上线、文档只有四五处提及」的铺设现状，或对视口校准/常驻成本
形成有依据的褒贬——而非空泛「挺好的」。
