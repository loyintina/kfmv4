# KFM v4 — Agent 入口

> ⚠️ **改动后立即 `git add -A && git commit`。** 未提交的改动没有安全网。
> `git checkout -- <file>` 会永久回退该文件到上一次 commit——无法从 bundle 恢复。
> 历史：2026-07-05 浮卡全天工作丢失；2026-07-14 orb.ts ~200 行 AI 集成丢失。
> 违反此规则的 agent 需重做全部丢失工作。见 constraints/invariants.md 心法 14。

## 会话启动（每次对话，1 跳）
1. 读 `docs/active/STACK.md` — 当前工作栈（在哪一层、干到哪）
2. 读 `docs/ledger/history.md` 尾部 — 最近发生了什么
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
| 理解项目方向/为什么这么设计 | active/vision.md |
| 写/跑 agent 脚本（发版建议等） | guides/agent-runner.md |
| **无匹配** | 完成后记录；同类操作重复 3 次 → workflows/_template.yaml 固化 |

## 构建与运行

```bash
npm run dev      # 全链路（check → esbuild client+server → smoke → 启动）
npm run bundle   # 同 build.mjs（全链路，零快捷方式）
npm run watch    # 全链路通过后 → 持续监听、快速重编（开发时一直开着）
npm run check    # 28 个 check-*.mjs + tsc --noEmit（仅检查，不构建）
npm run build    # 同 bundle（全链路）
npm run start    # 启动生产构建 http://localhost:8021
npm run test     # 473 个回归测试
```

> **没有快捷方式**。`bundle`/`build`/`dev` 全部走 `build.mjs` 全链路。`watch` 初检不过不进 watch。
> 日常：终端 1 `npm run dev`，终端 2 `npm run watch`。改源码 → 自动重编 → 刷新。
> **Git 推送**：`git push` 前先 `source .env`（根目录 `.env` 内有 GITHUB_TOKEN，已 gitignore，不可删除）。
> agent 从不主动 push——只在用户明确要求时执行。
