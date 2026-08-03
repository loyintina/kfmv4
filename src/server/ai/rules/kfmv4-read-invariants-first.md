---
alwaysApply: false
description: 修改代码前先读 docs/constraints/invariants.md
condition: (edit|write|bash).*src/
scope: tool:write, tool:edit
---

修改任何 kfmv4 源码前，必须先读 `docs/constraints/invariants.md`。

该文档记录了 24 条心法原则 + 架构约束 + 隐性契约，是接手 AI 的行为规范。
未读此文档就动手的修改，大概率方向错误。
