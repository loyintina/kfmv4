# KFM v4 — Agent 入口

> ⚠️ **改动后立即 `git add -A && git commit`。** 未提交的改动没有安全网。
> `git checkout -- <file>` 会永久回退该文件到上一次 commit——无法从 bundle 恢复。
> 历史：2026-07-05 浮卡全天工作丢失；2026-07-14 orb.ts ~200 行 AI 集成丢失——违反此规则需重做全部丢失工作（心法 14）。

## 环境快照与边界（冷启动必读）

**仓库**：`/root/kfmv4`=canonical 主仓，8021 服务跑它，origin=GitHub（loyintina/kfmv4），
数据 `~/.kfmv4/`，构建链 `build.mjs`→check→esbuild。**如遇第二仓库（快照/分叉）**：
读 `onboarding.md` §取证三步，**禁止自行 merge-base 推断**。**计数**：文档数字
默认已陈旧，引用前当场实跑（`npm run test` 尾 / `check-checks.mjs` / `git rev-list --count HEAD`）。
**边界**：接手=探索+汇报+请示，不自动改代码；真问题→证据+选项交裁决。
**进门三验**：`git log -1`、`curl -s localhost:8021`、history 尾 → 读 `onboarding.md` 陷阱地图。

## 会话启动（每次对话，1 跳）
0. 首次接触 → orientation.md + onboarding.yaml；随后读 STACK.md + history.md 尾
3. 读 semantic-chain-inbox.md 尾 — 信箱 ⚠️ → 裁决流
4. 改代码前 → pre-code-gate

## 任务 → 路由表
| 任务 | 去向 |
|------|---------|
<!-- gen:route-table 自动生成，禁止手改（源：docs/workflows/*.yaml name/id） -->
| 文档-代码审计 | workflows/audit.yaml |
| Bug 修复 + 回归钉 | workflows/bug-fix.yaml |
| 卡片插件开发 | workflows/card-dev.yaml |
| 参考契约维护 | workflows/contract-maintain.yaml |
| 语义深扫 | workflows/deep-scan.yaml |
| Bug 诊断/分诊 | workflows/diagnostics.yaml |
| 纪律机械化 | workflows/discipline-mechanize.yaml |
| 范式级讨论研究 | workflows/discussion-study.yaml |
| 文档树同步 | workflows/doc-tree-sync.yaml |
| 文档写入 | workflows/doc-write.yaml |
| 新 agent 接手 | workflows/onboarding.yaml |
| 平行多轨讨论 | workflows/parallel-tracks.yaml |
| 改代码前约束加载 | workflows/pre-code-gate.yaml |
| LLM 管线病灶排查 | workflows/probe-diagnosis.yaml |
| 版本发布 | workflows/release.yaml |
| 语义审计 | workflows/semantic-audit.yaml |
| 大改动 spec-driven 流程 | workflows/spec-driven.yaml |
| 活跃状态同步 | workflows/state-sync.yaml |
<!-- /gen:route-table -->
| 理解项目方向/为什么这么设计 | active/vision.md |
| 写/跑 agent 脚本（发版建议等） | guides/agent-runner.md |
| **无匹配** | 完成后记录；同类操作重复 3 次 → workflows/_template.yaml 固化 |

## 构建与运行

```bash
npm run dev      # 全链路（check → esbuild client+server → smoke → 启动）
npm run watch    # 全链路通过后 → 持续监听、快速重编（开发时一直开着）
npm run check    # 39 个 check-*.mjs + tsc --noEmit（仅检查，不构建）
npm run start    # 启动生产构建 http://localhost:8021
npm run test     # 500 个回归测试
```

> **没有快捷方式**：`bundle`/`build`/`dev` 全走 `build.mjs`；`watch` 初检不过不进。
> 日常：终端 1 dev、终端 2 watch。Git 推送：push 前先 `source .env`；agent 从不主动 push。
