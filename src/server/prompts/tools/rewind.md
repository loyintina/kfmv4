# rewind — 快照回滚

结束当前 checkpoint，回滚上下文到 checkpoint 设置点，用精简报告替换中间探索内容。

## 参数

- `report`（必填）— 简洁的发现报告

## 要求

- 报告必须简洁、事实性、可操作
- 包含关键发现、决策和未解决的风险
- 避免原始日志转储
- 如果 checkpoint 已回滚，从保留的报告继续，不要重试

## 行为

- 无活跃 checkpoint → 错误
- 成功 → 会话回滚，保留报告，关闭 checkpoint
- 回滚对此 checkpoint 是终局的，重复调用会报错
