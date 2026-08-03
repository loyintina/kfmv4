# rewind — 快照回滚（未实现）

> ⚠️ **当前为占位实现（stub）**：调用恒返回 `[rewind] 已回滚到最近快照`，
> **不执行任何回滚**（无参数、无逻辑）。与 checkpoint 配套，两者都未落地。


<!-- gen:tool-params:start -->

## 参数

（无参数）

<!-- gen:tool-params:end -->
## 现状

- 无活跃 checkpoint 概念、无上下文回滚能力
- 别指望 rewind 恢复被截断/丢失的上下文——这是 stub 的假响应
