# docprobe T0 结论：功能总目录探测（2026-08-08）

> 用户动议：「这个项目都有什么功能？」——不给任何功能名的存在性发现测试。
> 4 臂（DS v4-flash，wave 1 同协议，钉 f1fee225）。动机：wave 1 发现
> 路由表对命名题不承重（grep 直达），但命名题都有字符串桥；T0 无桥，
> 是总目录类文档的真正考场。

## 一、路径行为：策略整体切换，且零流浪

wave 1 的 grep-first 习惯在 T0 完全消失（4 臂 0 次 grep）——无关键词可搜时，
探头换成「glob 根目录 → 读根级 md」策略，且四臂高度一致：

| 臂 | 关键路径 | 总调用 | 墙钟 | token |
|---|---|---|---|---|
| t0-1 | glob* → glob *.md → **README** → vision.md → （末位补读 CLAUDE.md） | 6 | 3.7s | 13k |
| t0-2 | glob* → **README** → vision.md → code-inventory → main.ts | 8 | 5.2s | 28k |
| t0-3 | glob* → **README** → vision.md → orientation.md → code-inventory → stack.yaml | 7 | 4.6s | 33k |
| t0-4 | glob* → **README** → vision.md → onboarding.md → package.json | 7 | 4.0s | 14k |

**真正承重的入口文档是 README.md（4/4）和 docs/active/vision.md（4/4）**，
不是 CLAUDE.md（1/4，且是末位补读）。与 wave 1 合看的修正结论：
不是「探头不读入口文档」，是「探头不读 CLAUDE.md」——README/vision
作为总目录是有效的；CLAUDE.md 的定位（任务路由表：给定任务→工作流）
与「功能全景」需求错配，它不答「都有什么」，只答「该去哪」。

## 二、回答质量：覆盖 6.5/8 均值，幻觉极低（2 条/4 臂）

盲判（DS v4-flash 统一尺，judge/t0-inventory.jsonl）：8/8、6/8、6/8、6/8。
四臂答案均结构化、逐条有出处、正确区分「产品功能 vs 研究基建」，
臂 4 还自标 [未验证] 边界。产品层功能（文件树/卡片堆/终端/AI 运行时/
文档检查链/实验线）全部稳定命中。

**系统性盲区（3/4 臂同漏）**：
- **agent 脚本负载**（巡逻/语义审计/守视/agent-runner）——要点 6
- **部署发布体系**（deploy-fast/版本发布/kfm_restart）——要点 8

唯一全中的臂 3 是多读了 code-inventory.md + stack.yaml 的那臂。
盲区成因：README/vision 讲清了产品层，但运维负载的能力地图散在
guides/agent-runner.md 与 scripts/——总目录文档没有把它俩端上来。

## 三、对文档系统的可执行结论

1. **README/vision 补两行「运维面」索引**（agent 负载 → agent-runner.md；
   部署发布 → guides/release.md / deploy-fast）——T0 复测验证盲区闭合。
   这是继「文件树↔canvas-tree 关键词互注」后第二个由抽测驱动的整改项。
2. **CLAUDE.md 与 README 的分工定论**：CLAUDE.md = 任务→工作流路由
   （服务「知道要干什么」的 agent）；README/vision = 功能总目录
   （服务「想知道有什么」的 agent）。两者都不是对方的问题，
   但「总目录缺运维面」是 README 侧的真缺口。
3. T0 与 wave 1 合读：存在性发现（T0，6.5/8）比单点可达（T1-T3）
   更依赖**文档的策展质量**而非命名可 grep 性——两层病灶不同药。
