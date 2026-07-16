# checkpoint — 保存快照

在探索性工作前设置安全点，之后可以通过 rewind 回滚，只保留精简的报告。

## 使用规则

- 在需要大量中间工具调用（read/grep/glob 等）的探索前设置
- 调用 rewind 结束 checkpoint 后才能 yield
- 不能嵌套 checkpoint

## 典型流程

1. `checkpoint(goal: "探索目的")`
2. 执行探索工作
3. `rewind(report: "简洁发现报告")`

回滚后，中间的探索消息从上下文中移除，只保留报告。
