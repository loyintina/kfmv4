# 外部来源登记表（external sources）

> **这是什么**：kfmv4 引入/参考的外部内容统一登记——**只留指针，不复制正文**。
> 来源包括两类（论证见 `/root/00-Loyintina/50-AI研究/20-研究笔记/harness-studies/cairn-assessment.md`）：
> - **A 类·代码/工具引入**：oh-my-pi / pi-natives / omp 移植等直接引入的外部实现。
>   价值：上游升级/修复时能评估影响（"我们引入了什么、本地改了什么、踩过什么坑"）。
> - **B 类·知识塑造源**：外部论文/项目/讨论实际改变了我们的设计决策。
>   价值：复盘"为什么这么设计"时不用考古。
>
> **约定（所有 agent 遵守）**：凡是**引入外部代码**或**某个外部来源实际塑造了设计决策**，
> 在这里登记一行：来源 / 日期 / 引入了什么 / 为什么 / 踩坑指针。宁可多记，不可不记。
> 登记 ≠ 背书——记录"它影响过我们"，不表示"我们认可它全部"。
>
> **正文去 AI 研究馆，本表只留指针**：外部来源的**完整正文**不复制进本表，按深度放
> `/root/00-Loyintina/50-AI研究/`（原 `library/`，2026-08-27 迁出本仓）——
> - 已深读、写过评估/研究正文 → `20-研究笔记/`（如 harness-studies 的 NOOA/Cairn 评估），本表"踩坑/详情指针"列指过去；
> - 有出处、暂未深读/仅剪藏抄录 → `10-剪藏/`（首篇实例：知乎 Vibe Coding 剪藏），本表类型列标"研究素材，未评估"。

## 登记表

| 来源 | 日期 | 类型 | 引入了什么 / 影响 | 为什么 | 踩坑/详情指针 |
|---|---|---|---|---|---|
| [omp](https://github.com/can1357/oh-my-pi)（oh-my-pi） | 2026-07-18 | A 代码/工具 | Browser 工具（open/run/close + tab-supervisor + puppeteer CDP）自 omp 移植；pi-natives（brush-core/uutils）全栈源码 vendored 可用 | 浏览器自动化能力（守视/巡检基建） | `docs/domains/ai-chat/detail-browser.md`（stealth patches 破坏 page.evaluate 等踩坑）；stack #11：pi-natives fd 泄漏已整理待反馈上游 |
| [NVIDIA NOOA](https://github.com/NVIDIA-NeMo/labs-OO-Agents) | 2026-08-08 | B 知识塑造源 | 「引用传递」（工具结果不进上下文）作为对照假设并入 #19 压缩研究（A 全量/B 摘要/C 不进 三档） | 压缩机制效果研究的上限参照 | `library/notes/harness-studies/nooa-direction.md` §6（延后决策 + 触发条件） |
| [Project Cairn](https://github.com/iBlinkQ/project-cairn) | 2026-08-08 | B 知识塑造源 | 「外部来源登记 + 毕业元数据」思想 → 本登记表立项；论证结论：项目侧我们更强，只吸收"外部来源登记"轻机制 | 殊途同归方向（多个独立项目收敛到同一问题） | `library/notes/harness-studies/cairn-assessment.md` |
| [AgentMemories](https://agentmemories.ai/home) | 2026-08-14 | B 知识塑造源（研究素材，未评估） | AI Agent 持久记忆——方向与本项目宪法第四条「AI 的长期记忆是产品本体」直接相关 | 用户指定「以后用来研究，会很有用」；记忆系统基建的对照研究候选 | 待评估——记档时仅留指针，未读正文、未影响决策 |
| [dsh-routing-suite](https://npm.im/dsh-routing-suite)（npm 0.1.2 / [GitHub](https://github.com/yjh051108/dsh-routing-suite)） | 2026-08-16 | B 知识塑造源（评估未引入） | 智能路由插件评估：首条真实用户消息关键词分类 → `system-prompt/assemble` 注入 guidance（inspect-first/direct）；源码审计通过（零文件/进程/网络操作，仅挂 prompt 钩子 + 只读状态端点），**已安装**（2026-08-17 用户拍板：`dsh plugin --profile web add` + preset 落位 + patch 层 insert，生效需重启 harness）——「每消息动态路由」与前缀缓存结构性冲突的分析仍成立（会话级首条定基调=缓存友好），9.0 降生协议静态/动态分层已为此留位；kfmv4 插件兼容面远期立项的第一个实验对象 | 用户动议调研 → 用户改拍板安装；「路由状态会话化」并入 9.0 降生协议动态层讨论；「kfmv4 兼容 dsh 插件」立项见任务图远期区 | 审计材料在 `/tmp/routing-suite/`（npm 包解包）；SOURCE_PROVENANCE 声称独立实现（dsh-super-injector / dsh-router-standard 仅参考） |

## 历史

- 2026-08-08 立项：本登记表（论证 + 用户拍板"殊途同归，值得做"）。此前 omp 来源登记是
  detail-browser.md 头注孤例，无机检、无统一位置。
