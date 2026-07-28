> 这是什么：测试体系方法论——怎么分层、怎么写钉子、怎么验证。
> 别的去哪找：纪律本身（必须补钉）→ ../constraints/invariants.md 心法 24；管线硬规则 → ../domains/infra/contract.md。

# 测试指南

## 分层

```bash
npm test       # 452 个测试（单元/集成/回归钉/不变量），~1.3s，进主管线
npm run smoke  # 11 条浏览器冒烟（puppeteer headless），~9s，独立于主管线
```

- **L1 不变量**：种子随机压组合爆炸
- **L2 单元**：纯逻辑（逻辑/渲染分离 + 依赖注入，不 mock hack）
- **L3 集成**：模块协作
- **L4 冒烟**：只验「活着」

## 写钉子的纪律（细节，心法 24 是命令本身）

1. 修 bug → 补 `regression()` 钉子（钉源码行为，不钉实现细节）
2. **revert 验证**：回退修复后钉子必须变红——不变红的钉子是假的
3. 登记 `../ledger/bugs.md`
4. 测试不用墙钟计时器（GSAP mock 时序见 infra#陷阱 3）

## 方法论素材（迁移待办）

旧 `docs/archive/design/REGRESSION_TESTING_SYSTEM.md` 的完整体系论述，
迁移 archive 时并入本节。
