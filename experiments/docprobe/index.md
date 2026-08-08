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

## 研究线状态（2026-08-08，试点收官）

**试点校准完成，协议冻结，待正式矩阵。** 守视题三轮试点抓获两个协议级漏洞
（truth 在试卷语料内 / 考场边界无 harness 保证），逼出 readRoot 读监狱基建；
现行协议（truth 私有区 + `--read-root /root/kfmv4` + 只读白名单 + kfm-dev 空角色）
经 v3 两臂验证零越界。判卷尺校准发现与矩阵建议见
`results/pilot-shoushi-2026-08-08.md`。

## 臂清单

| 臂 | 题 | 轮 | 状态 | 数据 |
|---|---|---|---|---|
| pilot-shoushi-1 | 守视 T3 | v1 | 作废（开卷：grep 命中仓内 truth） | sessions/docprobe-pilot-shoushi-1.json |
| pilot-shoushi-2 | 守视 T3 | v1 | 作废（同上） | sessions/docprobe-pilot-shoushi-2.json |
| pilot2-shoushi-1 | 守视 T3 | v2 | 作废（顺设计文档读私有区 truth） | sessions/docprobe-pilot2-shoushi-1.json |
| pilot2-shoushi-2 | 守视 T3 | v2 | 有效（监狱前协议，轨迹与现行等价） | sessions/docprobe-pilot2-shoushi-2.json |
| pilot3-shoushi-1 | 守视 T3 | v3 | 有效（现行协议首臂） | sessions/docprobe-pilot3-shoushi-1.json |
| pilot3-shoushi-2 | 守视 T3 | v3 | 有效（猎答案行为活证据） | sessions/docprobe-pilot3-shoushi-2.json |

## 产物登记

- 设计（design/）：design-docprobe.md
- 结论（results/）：pilot-shoushi-2026-08-08.md（试点校准史+三维指标+判卷尺发现+矩阵建议）
- 工具（tools/）：judge-trace.mjs（机械判卷轨）
- 地面真相（私有区 `/root/.kfmv4/experiments/docprobe/truth/`）：shoushi.md（守视）/ error-codes.md（错误码体系，H1 活标本：
  路由表无行）/ paradigm.md（范式包）/ domain-contract.md（域契约）/
  file-tree.md（文件树，老功能对照组：路由表同样无行）
