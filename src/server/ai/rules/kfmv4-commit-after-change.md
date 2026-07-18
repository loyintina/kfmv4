---
alwaysApply: true
description: 每次代码改动后立即 git commit
---

每完成一个可独立运行的代码改动，必须立即执行 `git add -A && git commit`，再做下一步。

**禁止攒多个改动后一次性提交。**

原因：kfmv4 项目有两次血泪教训——未提交的改动在会话中断时永久丢失，无法从 bundle 恢复。
