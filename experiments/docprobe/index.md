# docprobe · 研究线登记（文档抽测）

> 2026-08-08 立（用户动议拍板）。构想：**把冷启动的「整体接手考」细化到
> 功能粒度——向全新 agent 提一个具体的功能问题，测量它能否在文档指引下
> 找到、理解、评价该功能**。回答的核心问题：我们的文档指引系统
> （CLAUDE.md 路由 → 指南/契约/账本）对任意一个功能，到底铺没铺好路。
> 定位：文档系统的可量化体检线 + 新功能「落成门」候选机制。
> 方法论血缘：coldstart（试卷冻结/地面真相/判卷校准）+ paradigm
> （跑批判卷基建/重复测量/预注册）。

## 目录地图

| 目录 | 是什么 |
|---|---|
| `design/` | 设计文档（`design-docprobe.md` 线级设计：假设/指标/题型分级/环境钉版） |
| `truth/`（在私有区，不在本仓） | 每题地面真相：`/root/.kfmv4/experiments/docprobe/truth/<topic>.md`。答案不能在试卷语料内——2026-08-08 试点 v1 污染事件后从仓内迁出（见 design 修订事件） |
| `results/` | 实验结论文档 |

**找结论**：先读本目录 results/ 最新结论文档；设计原理读
`design/design-docprobe.md`。

## 通用契约七角色映射

| 角色 | 本线实例 |
|------|----------|
| 协议 | 题目逐字冻结（私有区 truth/<topic>.md 内 `question` 字段）；变量矩阵 = 题 × 模型 × 重复 |
| 环境 | **活仓库钉 commit**——每波实验钉一个主仓 commit 哈希（记入波次文档），波内可复现、跨波追趋势；探测对象 = 真实 kfmv4 仓（只读白名单，非 lab） |
| 地面真相 | 私有区 `/root/.kfmv4/experiments/docprobe/truth/<topic>.md`：应达文档集/理解要点/期望路由；每波判卷前按文档实际状态刷新并记录校准事件 |
| 评判 | 脚本机械判（轨迹 vs 期望路由/应达文档命中）+ judge-llm 盲判理解准确度（DS v4-flash 统一尺纪律，同 paradigm） |
| 数据 | `.kfmv4/experiments/docprobe/sessions/` 私有同步区（复用 session-runner 归档） |
| 索引 | 本文件臂清单（check-experiment-index 双向机检） |
| 报告 | `results/` |

## 指标定义（指引健康度三维）

1. **可达率**：轨迹中是否打开过应达文档集（每题地面真相登记）。
2. **路径合规率**：到达路径是否经 CLAUDE.md 路由表（指引牌起效）
   vs 裸 grep 撞中（指引牌失效、靠蛮力）——路径对不对比结果对不对更诊断。
3. **到达成本**：首次打开应达文档前的工具调用数 / token / 墙钟时间。
   长期趋势 = 文档稀释病的定量探头（H3）。

辅指标：理解准确度（judge 盲判要点覆盖）、幻觉率（复用 coldstart 幻觉尺纪律）。

## 研究线状态（2026-08-08，T0 收官）

**T0 总目录探测完成（4 臂）：存在性发现的病灶定位了。**
产品层功能全景稳定命中（覆盖均值 6.5/8，幻觉 2 条/4 臂）；系统性盲区 =
agent 脚本负载 + 部署发布体系（3/4 臂同漏）——README/vision 承重良好，
缺「运维面」索引；CLAUDE.md 定位确认为任务路由（答「该去哪」），
与功能总目录（答「有什么」）分工错配不是病，盲区才是。全文见
`results/t0-inventory-2026-08-08.md`。

wave 1 结论（5 题 × 4 重复 = 20 臂）：H1 反向（最老的文件树题唯一塌陷）、
静默幻觉发现、路由表对 grep-first 探头不承重——见
`results/wave1-2026-08-08.md`。
待整改项：①文件树↔canvas-tree 关键词互注；②README/vision 补运维面索引。
整改后复测同题追 H3。

## 臂清单

### T0 总目录探测（2026-08-08，钉 f1fee225，DS v4-flash × 4 重复）

| 臂 | 题 | 状态 | 数据 |
|---|---|---|---|
| t0-inventory-1 | 总目录 T0 | 有效（覆盖 6/8） | sessions/docprobe-t0-inventory-1.json |
| t0-inventory-2 | 总目录 T0 | 有效（覆盖 6/8，幻觉 1） | sessions/docprobe-t0-inventory-2.json |
| t0-inventory-3 | 总目录 T0 | 有效（覆盖 8/8，全中臂） | sessions/docprobe-t0-inventory-3.json |
| t0-inventory-4 | 总目录 T0 | 有效（覆盖 6/8） | sessions/docprobe-t0-inventory-4.json |

盲判轨数据：`.kfmv4/experiments/docprobe/judge/t0-inventory.jsonl`（4 条）。

### wave 1（2026-08-08，钉 f1fee225，DS v4-flash × 4 重复）

| 臂 | 题 | 状态 | 数据 |
|---|---|---|---|
| w1-shoushi-4 | 守视 T3 | 有效（守视第 4 重复） | sessions/docprobe-w1-shoushi-4.json |
| w1-error-codes-1 | 错误码 T3 | 有效 | sessions/docprobe-w1-error-codes-1.json |
| w1-error-codes-2 | 错误码 T3 | 有效 | sessions/docprobe-w1-error-codes-2.json |
| w1-error-codes-3 | 错误码 T3 | 有效 | sessions/docprobe-w1-error-codes-3.json |
| w1-error-codes-4 | 错误码 T3 | 有效 | sessions/docprobe-w1-error-codes-4.json |
| w1-paradigm-1 | 范式包 T3 | 有效 | sessions/docprobe-w1-paradigm-1.json |
| w1-paradigm-2 | 范式包 T3 | 有效 | sessions/docprobe-w1-paradigm-2.json |
| w1-paradigm-3 | 范式包 T3 | 有效 | sessions/docprobe-w1-paradigm-3.json |
| w1-paradigm-4 | 范式包 T3 | 有效 | sessions/docprobe-w1-paradigm-4.json |
| w1-domain-contract-1 | 域契约 T3 | 有效 | sessions/docprobe-w1-domain-contract-1.json |
| w1-domain-contract-2 | 域契约 T3 | 有效 | sessions/docprobe-w1-domain-contract-2.json |
| w1-domain-contract-3 | 域契约 T3 | 有效 | sessions/docprobe-w1-domain-contract-3.json |
| w1-domain-contract-4 | 域契约 T3 | 有效 | sessions/docprobe-w1-domain-contract-4.json |
| w1-file-tree-1 | 文件树 T3 | 有效 | sessions/docprobe-w1-file-tree-1.json |
| w1-file-tree-2 | 文件树 T3 | 有效（未达+幻觉 15，阴性样本） | sessions/docprobe-w1-file-tree-2.json |
| w1-file-tree-3 | 文件树 T3 | 有效 | sessions/docprobe-w1-file-tree-3.json |
| w1-file-tree-4 | 文件树 T3 | 有效（未达+答非所问，阴性样本） | sessions/docprobe-w1-file-tree-4.json |

盲判轨数据：`.kfmv4/experiments/docprobe/judge/wave1.jsonl`（20 条，
judge=DS v4-flash 统一尺，逐臂覆盖/幻觉/依据）。

### 试点（守视题，协议校准期）

| 臂 | 题 | 轮 | 状态 | 数据 |
|---|---|---|---|---|
| pilot-shoushi-1 | 守视 T3 | v1 | 作废（开卷：grep 命中仓内 truth） | sessions/docprobe-pilot-shoushi-1.json |
| pilot-shoushi-2 | 守视 T3 | v1 | 作废（同上） | sessions/docprobe-pilot-shoushi-2.json |
| pilot2-shoushi-1 | 守视 T3 | v2 | 作废（顺设计文档读私有区 truth） | sessions/docprobe-pilot2-shoushi-1.json |
| pilot2-shoushi-2 | 守视 T3 | v2 | 有效（监狱前协议，轨迹与现行等价） | sessions/docprobe-pilot2-shoushi-2.json |
| pilot3-shoushi-1 | 守视 T3 | v3 | 有效（现行协议首臂） | sessions/docprobe-pilot3-shoushi-1.json |
| pilot3-shoushi-2 | 守视 T3 | v3 | 有效（猎答案行为活证据） | sessions/docprobe-pilot3-shoushi-2.json |

（试点 3 有效臂计入守视题 wave 1 重复数：pilot2-2 / pilot3-1 / pilot3-2 + w1-shoushi-4 = 4 重复）

## 产物登记

- 设计（design/）：design-docprobe.md
- 结论（results/）：pilot-shoushi-2026-08-08.md（试点校准史+判卷尺发现）/
  wave1-2026-08-08.md（首波矩阵 20 臂双轨判卷：H1 反向、静默幻觉发现）
- 工具（tools/）：judge-trace.mjs（机械判卷轨）/ judge-understanding.mjs（盲判轨）
- 地面真相（私有区 `/root/.kfmv4/experiments/docprobe/truth/`）：shoushi.md（守视）/ error-codes.md（错误码体系，H1 活标本：
  路由表无行）/ paradigm.md（范式包）/ domain-contract.md（域契约）/
  file-tree.md（文件树，老功能对照组：路由表同样无行）
