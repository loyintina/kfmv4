# checkpoint — 快照（未实现）

> ⚠️ **当前为占位实现（stub）**：调用只返回 `[checkpoint] {label} — 快照功能已就绪，需要文件系统支持`，
> **不保存任何状态**，`rewind` 也无法真正回滚。不要依赖它做探索安全点。



<!-- gen:tool-params:start -->

## 参数

- `label`（可选）— 快照标签

<!-- gen:tool-params:end -->
## 现状与替代

- 快照/回滚能力尚未落地；需要「安全点」语义时，用 todo 记录进度 + 谨慎操作
- 实现路线：checkpoint/rewind 需要配套的上下文快照存储（未实现）
