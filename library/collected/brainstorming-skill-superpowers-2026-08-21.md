# brainstorming skill：superpowers 流水线的设计硬门——Agent Skills 剪藏

> 主题：brainstorming（obra/superpowers 插件包的第一个环节）
> 原作者：obra（Jesse Vincent）/ superpowers
> 来源：https://agenticskills.io/skills/brainstorming（SKILL.md 全文镜像）
> 剪藏日期：2026-08-21
> 剪藏说明：superpowers 工作流 `brainstorm → write-plan → execute-plan（子 agent TDD）` 的入口。比 grill-me 重：带硬门、文档产出、自查环节。与 grill-me 同属「批准前不动手」纪律。

## 核心机制

**HARD-GATE（硬门）**：设计未经用户批准前，禁止调用任何实现类 skill、禁止写任何代码、禁止 scaffold。「这太简单不需要设计」被明确列为反模式——todo list、单函数工具、配置变更都要走流程，设计可以只有几句话，但必须呈现并获批。

**固定检查单**（逐项建 task，按序完成）：

1. 探索项目上下文（文件、文档、近期提交）
2. （如涉及视觉问题）单独发一条消息提供 Visual Companion
3. 逐个澄清问题（一次一个，优先选择题）
4. 提 2–3 个方案，带取舍和推荐（推荐的放第一个）
5. 分节呈现设计，每节确认（架构、组件、数据流、错误处理、测试）
6. 写设计文档到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` 并提交 git
7. Spec 自查（占位符 / 内部矛盾 / 范围是否可单计划实现 / 歧义二义性），就地修
8. 用户审 spec 文件（明确等用户回复的关卡）
9. 转交 `writing-plans` skill——**唯一合法下一步**，禁止直接调其他实现 skill

**范围判断**：请求若含多个独立子系统，先帮着分解，每个子项目各走一轮 spec → plan → implementation。

**关键原则**：一次一个问题；优先选择题；YAGNI 无情砍；永远先提 2–3 个方案再定；增量验证；讲不通就回去澄清。

## Visual Companion（可选）

涉及 mockup / 布局 / 架构图的问题，可开本地 web 服务器在浏览器里展示，绕开 ASCII 图的表达极限。单独发消息征求同意；同意后逐题判断「看比读更懂吗？」——视觉内容进浏览器，文字内容留终端。

## 与 grill-me 的对比

| 维度 | grill-me | brainstorming |
|------|----------|---------------|
| 体量 | 三行指令，极简 | 完整流水线入口，重流程 |
| 产物 | 复述确认即可 | spec 文档 + git 提交 + 自查 |
| 终点 | 你确认后自由动手 | 钉死只能转 writing-plans |
| 共同纪律 | 一次一个问题、agent 给推荐答案、批准前不动手 | 同左 |

共同点正好对应「谄媚效应（sycophancy）」的解药：强制 agent 暴露分歧、先问清楚，而不是顺着你往下编。

## 依赖注意

brainstorming 单独装会断链——它的终点调用 `writing-plans` skill（同属 superpowers 包）。要完整用需装整个 superpowers 插件包（`npx claudepluginhub ibytechaos/claude --plugin superpowers`，Claude Code）；在 kimi-code 里可只装 SKILL.md 作纪律参考，终点步骤自然降级为普通计划。
