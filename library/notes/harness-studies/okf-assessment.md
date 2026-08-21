# OKF（Open Knowledge Format）方向评估（2026-08-09）

> 状态：**评估完成，内部不采用；出口对齐候选（触发条件见下）**。
> 来源：微信文章「AI 时代的 HTML 时刻：一个被严重低估的知识标准 OKF」（贾克斯的平行世界）+
> Google Cloud OKF v0.1/v0.2 规范（[skillpkg 介绍](https://skillpkg.com/posts/open-knowledge-format)）。

## OKF 是什么（一句话）

一个目录的 Markdown 文件 + YAML frontmatter（`type` 必填），给 Agent 喂结构化组织知识；
v0.2 加来源/验证/状态/时效性字段——从"让 Agent 能读文档"走向"让 Agent 判断知识是否可信"。

## 评估结论

**内部不采用**（4 条理由）：
1. 类型体系不匹配——OKF 的 type（Metric/Policy/Playbook）是组织知识类型，我们的是项目工程
   类型（contract/ledger/workflow/decisions），强映射扭曲语义。
2. 内部 schema 比 OKF 强——workflows 9 字段 schema、契约必备章节门、错误码登记表；
   OKF"最小约束"是给外部交换的，内部对齐 = 降级。
3. 存量 64 份文档改造成本巨大，且触发检查链连锁反应。
4. 散文文档（vision/history/thinking-patterns）不适合 type 化。

**理念已内化**：OKF v0.2 的可信知识机制我们已有对应——来源（external-sources）、验证
（check 链/落成门）、状态（decisions/BAR）、时效（freshness）。理念有了，只差统一格式。

**认知价值**：第三方独立印证"可信知识层"方向——"Harness 会变薄，知识层会变厚"；
与 NOOA/Cairn 殊途同归（第三次）。

## 出口对齐（触发条件）

**记忆系统基建立项时**：对照 OKF 决定"内部格式 vs 出口格式"——内部维持定制体系，
出口（范式包/归档认知/可复用经验跨项目流出时）转换为 OKF 形态。不跟踪 OKF 生态、
不学规范细节、不改现有文档（反预设，撞到再研究）。
