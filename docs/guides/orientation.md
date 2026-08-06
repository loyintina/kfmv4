# 新 Agent 导读（冷启动 · 15 分钟心智模型）

> 第一次接触 kfmv4？先读这篇，再按 CLAUDE.md 会话启动走。
> 本文回答三个问题：这套体系为什么长这样、三层东西怎么咬合、从哪读起。
> 种子内容来自一次真实的冷启动探索（2026-07-30，新 agent 十几轮摸索后
> 自己总结出的图景）——你不必再花那十几轮。

## 这个项目是什么

kfmv4 是一个 AI 对话面板（光球 + 浮卡 + 文件树），自带 API 转发与 kfm_ 系列
内置工具。代码之外，它还有一套**为 agent 接力而设计的文档-检查-脚本体系**——
因为项目长期由不同 agent 在不同会话里接力开发，上下文会丢，所以「怎么让下
一个 agent 不跑偏」本身成了工程问题。你正在读的这套文档就是这个问题的答案。

## 三层心智模型

### 第一层：文档系统（`docs/`）——告诉你做什么

按变更频率和消费模式分七层，每层只为特定读者存在：

| 层 | 角色 | 你什么时候读 |
|----|------|-------------|
| `constraints/` | 心法（约束）+ 诊断流程 | 改代码前按节加载 |
| `domains/` | 域契约（六域，contract 必带，detail 按需展开） | 动某个域的代码前 |
| `active/` | 当前工作栈（STACK）+ 远景 | 每会话开头 |
| `guides/` | SOP 手册（测试/发版/文档维护/agent-runner…） | 对应任务触发时 |
| `workflows/` | 工作流卡（YAML：reads/steps/writes/exit） | 每次任务开头按 CLAUDE.md 路由表匹配 |
| `ledger/` | 只追加账本（bugs/history/语义审计…） | 工作流卡的 reads 指定时 |
| `decisions/` | 不可变 ADR（索引：[decisions/README.md](../decisions/README.md)） | 追溯「为什么这么设计」时 |

关键设计：**工作流是一等公民。** 一份文档若没有任何工作流读/写它，它不该存在。

### 第二层：检查管线（`scripts/check/`）——验证你做对了没

几十个 check 脚本挂进唯一的 `chain.mjs`，`check-checks.mjs` 自检链的完整性：

```
build.mjs → check 链 → esbuild → smoke → 启动
任何一步硬失败 = 构建中断（不是提醒，是阻断）
```

文档新鲜度、符号存在性、行号越界、commit 锚点、契约 schema、计数漂移——
全有机械检查。**改完代码文档没同步，构建会断**，这是常态不是事故：
按报错提示跑对应的 sync 脚本回写即可。

### 第三层：Agent 脚本（`scripts/agent/`）——帮你做判断

固定提示词 + 输出可控 + 独立任务的「agent 原件」。代表：`tag-advisor.mjs`
（发版建议：机械算下限 → agent 判级别 → 人拍板）、`semantic-*.mjs`（语义审计
集群）。统一经 `agent-runner.mjs` 跑：provider 有序兜底链 + 输出校验 +
失败重问。详见 `guides/agent-runner.md`。

**新手最常见的误判**：「这些脚本我不会用」。它们就是普通 node 脚本——
`node scripts/agent/tag-advisor.mjs` 直接跑，provider 链自动兜底，
结果抛 stdout。先试再下结论。

### 三层怎么咬合

```
你（对话中的 agent） → CLAUDE.md 路由表 → 读 workflow 卡 → 按卡 reads/steps 执行
                          ↓ 产出物写哪由卡的 writes 定义
                     check 链在构建时执法：文档/代码/测试失同步 = 中断
                          ↓ 重复 3 次的模式
                     固化为新 check 脚本或新工作流卡（体系自我生长）
```

## 机制地图（生成器 / 提示词 / 权限规则）

docs 之外还有三组运行时机制，入口在这里：

**生成器家族**——「文档由代码拼接」的体系地图在 `docs/active/generateable-facts.md`
（登记表：每个可生成事实的源头/生成器/标记）。已落地 9 个：

| 生成器 | 产出 |
|--------|------|
| `sync-counts.mjs` | 计数/版本号/检查链节 |
| `gen-code-inventory.mjs` | 代码清单 |
| `gen-contract-lists.mjs` | 契约文件清单 |
| `gen-route-table.mjs` | CLAUDE 工作流路由表 |
| `gen-page-state-schema.mjs` | 眼睛格式事实段 |
| `gen-tool-docs.mjs` | 工具文档参数节（16 份） |
| `gen-permission-map.mjs` | 权限风险表 + BAR-PERM-01 登记门 |
| `gen-rules-map.mjs` | 规则登记表（detail-rules.md） |

规矩：**改了代码注册源没跑生成器 = check 中断**，按报错提示回写即可。

**提示词目录**（`src/server/prompts/`，三目录语义见 `prompts/README.md`）：
`global/`（预设+`global/tools/`工具文档，自动注入全部会话）· `system/`（角色卡挂载，静态）·
`dynamic/`（角色卡挂载，动态；说明文档在源码侧，运行时文件在
`.kfmv4/prompts/dynamic/`，格式见 `dynamic/page-state-schema.md`）。

**行为防线**：权限引擎设计见 `active/harness-permission-engine.md`（TOOL_RISK
精确映射自动生成）；条件规则集见 `domains/ai-chat/detail-rules.md`（登记表自动生成）。

## 怎么读 STACK（工作栈）的电报体

`active/stack.yaml`（2026-08-06 起，前身 STACK.md 已废）是**接力索引不是散文**：
每条是结构化决策记录（id/title/status/created/note/detail），「批 1.5」「影子模式」
「便宜链」这类词都是指向 ledger/decisions 里完整讨论的锚点。读法：扫 status
字段（done/todo/hold）定位当前焦点 → 只对与你任务相关的条目顺藤摸瓜，
**不要试图全懂**——它是地图不是教科书。

## 冷启动后的第一件事

走 `workflows/onboarding.yaml`——它把「读什么 → 怎么对齐 → 何时可以动代码」
固化为可验证步骤。
