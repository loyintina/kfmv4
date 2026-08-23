# ip-as-logo skill：图像生成配方 skill——Agent Skill 范本剪藏

> 主题：ip-as-logo（Agent Skill，MIT，单文件 SKILL.md）
> 来源：https://github.com/s1dashu/ip-as-logo-skill（README 为宣传页，SKILL.md 为实质）
> 剪藏日期：2026-08-23
> 剪藏说明：作为"如何写一份模型能稳定遵行的指令文档"的范本收存，与
> `library/notes/skill-本质与kfmv4文档世界-2026-08-21.md` 互为实例。本文是评估摘要，
> 完整正文见原始 SKILL.md（链接即原文）。

## 它是什么

一个"图像生成配方 skill"：教 agent 生成极简、可爱、可当企业 IP 的方形吉祥物图。
符合开放 Agent Skills 格式（frontmatter name/description + 正文），跨 agent 可用。

## 设计亮点（为什么值得学）

**1. 给约束，不给感觉**——把美学决策写成可执行硬规则：
- 构图：左下/右下角出，占 85–95%，勿居中
- 配色：恰好 3 个语义色（2 IP 基色 + 1 背景色）
- 复杂度预算：4–7 大形状，≤1 个物种特征，≤2 个内部色区
- 可读性：32×32 仍要认得出，否则放大/合并/删
- 形状语言：禁锐角/尖耳/细脖/薄嘴，所有尖端做钝圆

**2. 懂图像模型的坑**：
- prompt 从不说 "logo/brand mark/icon"，只说"一个方形角色图"——避免用途措辞误导图生模型
- 区分现代指令跟随模型（内联 `Constraints:` 行）与旧模型（专用 `negative_prompt` 通道），附完整负向词表（text/watermark/borders/frames…）
- 拒绝 SVG 回退、拒绝编造结果、把生成当"随机抽取"而非"合规考试"（不自动重试/后处理）

**3. 善用平台**：subagent 并行跑 6 个候选、按波次补位。

**4. 克制**：明确"别把开题做成品牌工作坊"、不规定渐变公式、不用 contact sheet。

## 实际的边界（清醒看待）

- **运行时依赖硬**：要求 top-tier 图像模型（GPT Image 2 / Nano Banana Pro 档）。
  大多数 CLI 编程 agent（含 kimi-code）不内置图生工具——"兼容任意 agent"是理想态，
  要跑得先接一个图生 MCP/工具 + key。
- **文档冗长**：若干规则在正文/prompt 骨架/交付行为各说一遍（塞上下文的成本）。
- **交付不设门**：刻意不验收、不拦截，尊重随机性——偶发烂图也不会拦（明确取舍）。
- **窄**：只服务"IP 吉祥物生成"一个场景。

## 与我们 skill 讨论的关系

按"命题的分类"，它属于**创意配方型 skill**（打包一个工作流让模型执行生成），
而非**知识继承型 skill**（打包事实让零上下文 agent 继承）。更接近 brainstorming 的结构化
流程，但载荷是 prompt 工艺。作为"prompt 资产化"的完成度最高样板收存。
