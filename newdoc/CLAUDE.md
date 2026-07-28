# KFM v4 — Agent 入口（新结构，切换提交时移至仓库根）

## 会话启动（每次对话，1 跳）
1. 读 `newdoc/active/STACK.md` — 当前工作栈（在哪一层、干到哪）
2. 读 `newdoc/ledger/history.md` 尾部 — 最近发生了什么
3. 改代码前 → 走 pre-code-gate

## 任务 → 工作流路由表
| 任务 | 工作流卡 |
|------|---------|
| 改代码前的约束加载 | workflows/pre-code-gate.yaml |
| 修 bug + 回归钉 | workflows/bug-fix.yaml |
| 根因不明的异常 | workflows/diagnostics.yaml |
| 大改动（跨 3+ 文件/多阶段） | workflows/spec-driven.yaml |
| 同一错误重复 ≥3 次 | workflows/discipline-mechanize.yaml |
| 代码改完同步状态 | workflows/state-sync.yaml |
| 发版 | workflows/release.yaml |
| 新增/改卡片 | workflows/card-dev.yaml |
| 子系统契约更新 | workflows/contract-maintain.yaml |
| 文档-代码审计 | workflows/audit.yaml |
| 新增/移动文档 | workflows/doc-tree-sync.yaml |
| 多 agent 平行推进 | workflows/parallel-tracks.yaml（慎用） |
| **无匹配** | 完成后记录；同类操作重复 3 次 → workflows/_template.yaml 固化 |
