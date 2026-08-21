# grill-me skill：动手前的审讯纪律——Agent Skills 剪藏

> 主题：grill-me（Claude Code / Agent Skill）
> 原作者：Matt Pocock（MIT，github.com/mattpocock/skills）；本文件收录 Agentropic 重写版全文
> 来源：https://agentropic.ai/skills/grill-me
> 相关条目：mcpmarket.com/tools/skills/grill-me；skillselion.com（衍生变体众多）
> 剪藏日期：2026-08-21
> 剪藏说明：全球安装量最高的 agent skill 之一，核心只有三行指令。与 brainstorming（superpowers）同属「批准前不动手」纪律，本文件为轻量实现。

## 它杀掉的失败模式

AI 辅助工作里最贵的失败不是 bug，而是做完才发现 agent 解决的不是你脑子里那个问题。根因：**没人确切知道自己要什么**——你脑子里是粗图，agent 用自己的猜测填满每个未言明的细节，双方直到做完才发现两张图差多远。

## 行为契约（触发 `/grill-me` 后）

- **把计划当决策链**，不是文档：先找到"其他一切都挂在它上面"的决策，从那里问起；上游决策不定，下游不问。
- **每轮一个问题**，问完就停等回答，不甩问题清单。
- **每个问题附带 agent 的推荐答案** + 一句理由——你对一个立场做反应，而不是面对空白提示。
- **绝不问能自己查到的东西**：文件、配置、数据、工具它自己去翻；事实它查，判断你拍。
- **超过礼貌的限度继续问**。审讯结束的唯一条件：它能把整个计划复述给你（已定的决策、接受的取舍、明确不做的事），你确认。**确认前什么都不建。**

典型一场 15–60 个问题。不止用于代码：财务自动化、广告投放、招聘计划，任何"模糊意图即将变成具体工作"的场景都值这一场审讯。

## SKILL.md 全文（Agentropic 版）

```markdown
---
name: grill-me
description: Make the agent interrogate your plan one question at a time until you both hold the same picture of what is being built.
---

Before any work begins on this plan, put me through a full interrogation.

Treat the plan as a chain of decisions, not a document. Find the decision everything else hangs on and start there; settle each parent decision before the ones that depend on it, because my answer upstream changes what is worth asking downstream.

One question per turn. Ask it, then stop and wait for my answer. With every question, name the decision it settles and give me your own recommended answer with a one-line reason — I should be reacting to a position, never staring at an open-ended prompt.

Never ask me anything you can find out yourself. Files, configs, data, tools — go look. Facts are your job to gather; judgement calls are mine to make.

Keep going well past the point of politeness. The interrogation ends only when you can state the whole plan back to me — the decisions taken, the trade-offs accepted, and what we are explicitly not doing — and I confirm that is the thing we are building. Until I confirm, build nothing.

<!-- Original implementation by Agentropic (agentropic.ai/skills/grill-me).
     Inspired by Matt Pocock's grill-me skill (MIT, github.com/mattpocock/skills). -->
```

## 安装方式（Claude Code 约定）

```
mkdir -p .claude/skills/grill-me
curl -o .claude/skills/grill-me/SKILL.md https://agentropic.ai/skills/grill-me/SKILL.md
```

任何支持 SKILL.md 约定的 agent 通用（kimi-code 同样支持，放 `~/.kimi-code/skills/grill-me/SKILL.md`）。
