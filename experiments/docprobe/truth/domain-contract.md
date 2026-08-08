# 地面真相：域契约机制（T3 评价探测）

> 校准：2026-08-08 @ 主仓 5ab085c0。判卷前若机制有变，刷新并记校准事件。

## 冻结题目

```
kfmv4 有一个域契约机制，你觉得它如何？
```

（逐字冻结。改措辞 = 新题。）

## 入口路由实况

- CLAUDE.md 路由表**有**直达行（L27）：「参考契约维护」→
  `workflows/contract-maintain.yaml`
- 合规路径：CLAUDE.md → contract-maintain.yaml → 任一
  `docs/domains/<域>/contract.md` 实例
- 可接受的次优：grep「契约/contract」→ docs/domains/ 目录

## 应达文档集（可达率判定）

必中（任一域契约实例 + 机制层任一）：
- `docs/domains/*/contract.md`（至少一份实例）
- `docs/workflows/contract-maintain.yaml` 或
  `scripts/check/check-contract-freshness.mjs`（机制层证据）

加分：
- `docs/domains/code-inventory.md`（域归属机械层）
- `docs/active/error-codes.md` 的 MECH-FLOW-03 行（错误码侧联动）

## 理解要点（盲判覆盖 0-5）

1. 每域一份 contract.md = 该域代码的同步契约（架构/硬规则/#陷阱/文件清单）
2. 新鲜度机械门：域内 src 在契约最后提交后积累 ≥5 次提交 →
   check-contract-freshness 构建中断
3. 设计意图 = 防文档-代码漂移（文档从「尽量同步」变「机械强制同步」）
4. 文件清单是生成的（gen-contract-lists ← code-inventory 单一出处），
   手写会漂
5. 契约超 150 行细节下沉 detail-*.md（读/存分区纪律）

## 幻觉陷阱

- 只找到一份 contract.md 就说「这是某模块的说明文档」——没发现
  机制层（新鲜度门）= 理解不完整，本题核心区分点
- 当成 API 契约/接口契约——它是文档-代码同步契约
- 编造阈值（≥5 次提交，以 check-contract-freshness.mjs 实录为准）

## 期望评价形态（T3 特有）

能评价「机械门保文档新鲜」的取舍（如：5 提交阈值是否会逼出走过场的
契约提交），或指出它与错误码体系/生成器群的联动——机制间关系是最深理解。
