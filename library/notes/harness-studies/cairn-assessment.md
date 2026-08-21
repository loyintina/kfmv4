# Project Cairn 评估论证（2026-08-08）

> 状态：**论证完成，采纳"外部来源登记"轻机制**（用户拍板：殊途同归，值得做）。
> 对象：[Project Cairn](https://github.com/iBlinkQ/project-cairn)（agent skill，把项目工作
> 变成可复用知识：项目侧 cairn/ + 知识库侧毕业机制 + Cited.md 外部指针）。

## 1. Cairn 是什么（一句话）

一个文档先行的 agent skill：项目侧（AGENTS.md 规则 + LOG/ROADMAP/topic 结论 + Cited.md
外部知识指针）记录当前真理；验证过的经验经**人确认 → 蒸馏 → 毕业**写入跨项目知识库
（Obsidian/Notion/Lark），带来源追踪（graduated_from/contributors/graduated_by）。
自动化边界：无后台钩子、毕业必须人确认、审计只报告不静默改写。

## 2. 与我们体系的对照

| Cairn 组件 | 我们的对应物 | 差距 |
|---|---|---|
| AGENTS.md 规则 | CLAUDE.md + 路由表 + 工作流 | 我们更强（超集） |
| LOG / ROADMAP | ledger/history、stack.yaml、账本 | 我们有 |
| topic 结论 | decisions/、contract、domains | 我们有 |
| audit | 44 个检查器 + 探针自检 | 我们强得多 |
| 毕业机制 | 结晶回路（archive 结算 + 心法 31 条 + 错误码 + thinking-patterns 出处） | 有原型，缺统一元数据 |
| **Cited.md 外部指针** | **无**（此前） | **真缺口** |

**关键事实**：我们的内部引用（路由表/文档互链）和内部溯源（drift-provenance、
thinking-patterns 出处）都存在；缺的是**面向外部的塑造源登记**——"哪个外部知识/工具
实际塑造了项目"没有统一位置。

## 3. 论证：外部引入是两类，Cairn 只解决一类

- **A 类·代码/工具引入**（oh-my-pi/pi-natives/omp 移植）：**依赖来源登记**问题，Cairn
  不解决（它管知识不管依赖）。实际价值：上游升级影响评估（"omp 升级带回同类问题"的
  担忧）、反馈上游 issue（pi-natives fd 泄漏）需要知道"引入了什么、本地改了什么"。
  已有雏形：detail-browser.md 头注 + 踩坑记录。
- **B 类·知识塑造源**（NOOA 影响压缩研究假设、论文影响设计决策）：**Cited.md 的正题**，
  显式登记指针不复制正文。我们没有——复盘要考古。
- **毕业元数据**：我们的结晶回路已有出处字段，Cairn 的字段规范可借鉴但非必要（问题
  不是没出处，是没统一机检）。

## 4. 结论

- **Cairn 整套：不照搬**（项目侧我们更强，知识库侧非当前需求）。
- **外部来源登记：值得，且很轻**——一个位置（docs/ledger/external-sources.md）+ 一条
  约定（每个外部引入/塑造源登记一行），把 detail-browser.md 从孤例变成惯例。
- **A 类比 B 类更迫切**（直接支撑运维动作），但两者共用一个登记表即可。
- **用户判断**："既然很多人在自己做，分享出来的东西总归殊途同归"——多个独立项目
  （Cairn/NOOA/我们）收敛到同一类问题，方向本身值得做。

## 5. 落地

- `docs/ledger/external-sources.md`：登记表 + 约定头注（已登记 omp / NOOA / Cairn 三条）。
- 机械门：暂不设（反预设——登记漏了成为真问题时再加，现有 check-doc-orphans 保证
  文档可达即可）。
