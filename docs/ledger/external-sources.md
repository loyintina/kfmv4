# 外部来源登记表（external sources）

> **这是什么**：kfmv4 引入/参考的外部内容统一登记——**只留指针，不复制正文**。
> 来源包括两类（论证见 `experiments/harness-studies/cairn-assessment.md`）：
> - **A 类·代码/工具引入**：oh-my-pi / pi-natives / omp 移植等直接引入的外部实现。
>   价值：上游升级/修复时能评估影响（"我们引入了什么、本地改了什么、踩过什么坑"）。
> - **B 类·知识塑造源**：外部论文/项目/讨论实际改变了我们的设计决策。
>   价值：复盘"为什么这么设计"时不用考古。
>
> **约定（所有 agent 遵守）**：凡是**引入外部代码**或**某个外部来源实际塑造了设计决策**，
> 在这里登记一行：来源 / 日期 / 引入了什么 / 为什么 / 踩坑指针。宁可多记，不可不记。
> 登记 ≠ 背书——记录"它影响过我们"，不表示"我们认可它全部"。

## 登记表

| 来源 | 日期 | 类型 | 引入了什么 / 影响 | 为什么 | 踩坑/详情指针 |
|---|---|---|---|---|---|
| [omp](https://github.com/can1357/oh-my-pi)（oh-my-pi） | 2026-07-18 | A 代码/工具 | Browser 工具（open/run/close + tab-supervisor + puppeteer CDP）自 omp 移植；pi-natives（brush-core/uutils）全栈源码 vendored 可用 | 浏览器自动化能力（守视/巡检基建） | `docs/domains/ai-chat/detail-browser.md`（stealth patches 破坏 page.evaluate 等踩坑）；stack #11：pi-natives fd 泄漏已整理待反馈上游 |
| [NVIDIA NOOA](https://github.com/NVIDIA-NeMo/labs-OO-Agents) | 2026-08-08 | B 知识塑造源 | 「引用传递」（工具结果不进上下文）作为对照假设并入 #19 压缩研究（A 全量/B 摘要/C 不进 三档） | 压缩机制效果研究的上限参照 | `experiments/harness-studies/nooa-direction.md` §6（延后决策 + 触发条件） |
| [Project Cairn](https://github.com/iBlinkQ/project-cairn) | 2026-08-08 | B 知识塑造源 | 「外部来源登记 + 毕业元数据」思想 → 本登记表立项；论证结论：项目侧我们更强，只吸收"外部来源登记"轻机制 | 殊途同归方向（多个独立项目收敛到同一问题） | `experiments/harness-studies/cairn-assessment.md` |

## 历史

- 2026-08-08 立项：本登记表（论证 + 用户拍板"殊途同归，值得做"）。此前 omp 来源登记是
  detail-browser.md 头注孤例，无机检、无统一位置。
