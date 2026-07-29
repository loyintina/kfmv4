---
alwaysApply: false
description: 改 bug/写模块时的回归测试纪律（补钉子 + 登记 + revert 验证 + 可测性）
condition: src/.*\.(ts|mjs)
scope: tool:write, tool:edit
---

改动 `src/` 下的代码前，遵守回归测试体系的纪律（体系见
`docs/guides/testing.md`，账本见 `docs/ledger/bugs.md`）：

**修 bug 时**
- 补一个回归钉子 `regression('BAR-xxx', '<commit>', 名称, fn)`，断言 = 这个修复的可执行规格。
- **必过 revert 验证**：临时回退该修复（改一行）→ 跑测试 → 必须变红；否则测试是假的，没在测那个 bug。恢复后转绿。
- 在 `docs/ledger/bugs.md` 登记该条，状态置「✅ 已钉」。

**写新逻辑时**
- 逻辑与渲染/DOM/单例分离：把「算什么」抽成纯函数，渲染只消费。纯函数配单元测试。
- 需要离线测但代码依赖外部（provider/网络/streamChat）？用**依赖注入**（可选参数默认真实实现），不要 mock hack。
- 组合空间大（「N 种情况」）→ 立**不变量**（种子随机验证），而非穷举用例。

**通用**
- 禁止在测试里用墙钟计时器（`setTimeout`/`Bun.sleep`）等待——await 代码真正暴露的信号（回调/Promise/状态标志），或用有界微任务轮询。等待信号必须**独立于被测对象**。
- 改完跑 `npm test`（全量回归，~1.3s），不只跑新增的。
- 冒烟层（`npm run smoke`）只验证「活着 + 大致对」，不测逻辑；保持个位到二十几条，膨胀 = 逻辑没抽出来的信号。

**判断标准**：你改了 `src/` 却没动 `tests/`？停下来问——这个改动有没有可钉的逻辑/契约。修了 bug 却没补钉子？这个 bug 迟早复发。
