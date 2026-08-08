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

## 研究线状态（2026-08-08，落成门 v1 实装上线）

**落成门（§八 终极形态）已实装并挂链。** 三件套：probe-capability.mjs
（探头，登记行现场生成真相 × 4 臂 × ≥2/4 通过）→ docs/ledger/probe-state.json
（账本）→ check-probe-state.mjs（chain 检查门，⛳ MECH-FLOW-11）。
首扫 25 功能 × 4 臂 = 100 臂铺底：**24/25 初过，唯二 FAIL 均闭环**——
权限引擎 0/4（4/4 臂收敛真实权威文档 → 登记修正 path，复测 4/4）；
角色卡 1/4（capability-map 未挂 CLAUDE.md 路由表的指引缺口 → 用户拍板
加一行修路，复测 2/4 过）。FAIL 判读规则两条先例入 design §九。
**新功能落成流程从此多一步**：capability-map 登记 → 跑 probe-capability
过门 → 才算完工（账本陈旧 = 构建中断）。

头两个「抽测→整改→复测」闭环完成。T0 运维面盲区**完全闭合**
（覆盖 6.5→8.0 满分，幻觉 2→0，capability-map 被 4/4 臂采纳为标准入口，
成本反降）；文件树题幻觉 15→0，残余未达判定为探头策略方差（H4 范畴，
文档侧已无可修）。全文见 `results/retest-t0r-w2-2026-08-08.md`。
文件树题转作 H4 探头差异监测题，待跨模型波次复用。

T0 首波结论见 `results/t0-inventory-2026-08-08.md`；wave 1 结论见
`results/wave1-2026-08-08.md`。

## 臂清单

### 整改复测（2026-08-08，钉 8d91ce79，DS v4-flash × 4 重复/题）

| 臂 | 题 | 状态 | 数据 |
|---|---|---|---|
| t0r-inventory-1 | 总目录 T0 复测 | 有效（覆盖 8/8） | sessions/docprobe-t0r-inventory-1.json |
| t0r-inventory-2 | 总目录 T0 复测 | 有效（覆盖 8/8） | sessions/docprobe-t0r-inventory-2.json |
| t0r-inventory-3 | 总目录 T0 复测 | 有效（覆盖 8/8） | sessions/docprobe-t0r-inventory-3.json |
| t0r-inventory-4 | 总目录 T0 复测 | 有效（覆盖 8/8） | sessions/docprobe-t0r-inventory-4.json |
| w2-file-tree-1 | 文件树 T3 复测 | 有效（未达，glob 流浪） | sessions/docprobe-w2-file-tree-1.json |
| w2-file-tree-2 | 文件树 T3 复测 | 有效（未达，答非所问） | sessions/docprobe-w2-file-tree-2.json |
| w2-file-tree-3 | 文件树 T3 复测 | 有效（未达，glob 流浪） | sessions/docprobe-w2-file-tree-3.json |
| w2-file-tree-4 | 文件树 T3 复测 | 有效（到达，覆盖 5/5） | sessions/docprobe-w2-file-tree-4.json |

盲判轨数据：`.kfmv4/experiments/docprobe/judge/retest-t0r-w2.jsonl`（8 条）。

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

### 落成门校准期臂（2026-08-08，小样本/修路前 FAIL 诊断证据，已被正式扫取代）

| 臂 | 功能 | 状态 | 数据 |
|---|---|---|---|
| gate-c74aaf0c-1-msjy9jzd | Canvas 文件树 小样本 | 有效（到达，后被正式扫取代） | sessions/gate-c74aaf0c-1-msjy9jzd.json |
| gate-c74aaf0c-2-msjy9jzd | Canvas 文件树 小样本 | 有效（同上） | sessions/gate-c74aaf0c-2-msjy9jzd.json |
| gate-c74aaf0c-3-msjy9jzd | Canvas 文件树 小样本 | 有效（同上） | sessions/gate-c74aaf0c-3-msjy9jzd.json |
| gate-c74aaf0c-4-msjy9jzd | Canvas 文件树 小样本 | 有效（同上） | sessions/gate-c74aaf0c-4-msjy9jzd.json |
| gate-520ea10f-1-msjyary6 | 守视 小样本 | 有效（到达，后被正式扫取代） | sessions/gate-520ea10f-1-msjyary6.json |
| gate-520ea10f-2-msjyary6 | 守视 小样本 | 有效（同上） | sessions/gate-520ea10f-2-msjyary6.json |
| gate-520ea10f-3-msjyary6 | 守视 小样本 | 有效（同上） | sessions/gate-520ea10f-3-msjyary6.json |
| gate-520ea10f-4-msjyary6 | 守视 小样本 | 有效（同上） | sessions/gate-520ea10f-4-msjyary6.json |
| gate-a2ee93f5-1-msjyc7ob | 权限引擎 小样本 | 有效（0/4 FAIL 诊断证据：4/4 收敛 harness-permission-engine.md → 登记修正） | sessions/gate-a2ee93f5-1-msjyc7ob.json |
| gate-a2ee93f5-2-msjyc7ob | 权限引擎 小样本 | 有效（同上） | sessions/gate-a2ee93f5-2-msjyc7ob.json |
| gate-a2ee93f5-3-msjyc7ob | 权限引擎 小样本 | 有效（同上） | sessions/gate-a2ee93f5-3-msjyc7ob.json |
| gate-a2ee93f5-4-msjyc7ob | 权限引擎 小样本 | 有效（同上） | sessions/gate-a2ee93f5-4-msjyc7ob.json |
| gate-6c734174-1-msjykffs | 角色卡 修路前 | 有效（1/4 FAIL 诊断证据：臂四散代码侧 → CLAUDE.md 路由表修路） | sessions/gate-6c734174-1-msjykffs.json |
| gate-6c734174-2-msjykffs | 角色卡 修路前 | 有效（同上，此臂到达） | sessions/gate-6c734174-2-msjykffs.json |
| gate-6c734174-3-msjykffs | 角色卡 修路前 | 有效（同上） | sessions/gate-6c734174-3-msjykffs.json |
| gate-6c734174-4-msjykffs | 角色卡 修路前 | 有效（同上） | sessions/gate-6c734174-4-msjykffs.json |

### 落成门探头（自动区块，probe-capability.mjs 维护，勿手改）

<!-- probe-gate:begin -->

| 臂 | 功能 | 状态 | 数据 |
|---|---|---|---|
| gate-188e3691-1-msjyiu12 | 会话聊天面板 落成门 | 到达 | sessions/gate-188e3691-1-msjyiu12.json |
| gate-188e3691-2-msjyiu12 | 会话聊天面板 落成门 | 到达 | sessions/gate-188e3691-2-msjyiu12.json |
| gate-188e3691-3-msjyiu12 | 会话聊天面板 落成门 | 到达 | sessions/gate-188e3691-3-msjyiu12.json |
| gate-188e3691-4-msjyiu12 | 会话聊天面板 落成门 | 到达 | sessions/gate-188e3691-4-msjyiu12.json |
| gate-6c734174-1-msk2xifz | 角色卡 落成门 | 未达 | sessions/gate-6c734174-1-msk2xifz.json |
| gate-6c734174-2-msk2xifz | 角色卡 落成门 | 到达 | sessions/gate-6c734174-2-msk2xifz.json |
| gate-6c734174-3-msk2xifz | 角色卡 落成门 | 到达 | sessions/gate-6c734174-3-msk2xifz.json |
| gate-6c734174-4-msk2xifz | 角色卡 落成门 | 未达 | sessions/gate-6c734174-4-msk2xifz.json |
| gate-f16fa643-1-msjylskv | API 卡（provider 管理） 落成门 | 未达 | sessions/gate-f16fa643-1-msjylskv.json |
| gate-f16fa643-2-msjylskv | API 卡（provider 管理） 落成门 | 未达 | sessions/gate-f16fa643-2-msjylskv.json |
| gate-f16fa643-3-msjylskv | API 卡（provider 管理） 落成门 | 到达 | sessions/gate-f16fa643-3-msjylskv.json |
| gate-f16fa643-4-msjylskv | API 卡（provider 管理） 落成门 | 到达 | sessions/gate-f16fa643-4-msjylskv.json |
| gate-ff3e3a71-1-msjynx8v | 会话存储与压缩 落成门 | 到达 | sessions/gate-ff3e3a71-1-msjynx8v.json |
| gate-ff3e3a71-2-msjynx8v | 会话存储与压缩 落成门 | 到达 | sessions/gate-ff3e3a71-2-msjynx8v.json |
| gate-ff3e3a71-3-msjynx8v | 会话存储与压缩 落成门 | 到达 | sessions/gate-ff3e3a71-3-msjynx8v.json |
| gate-ff3e3a71-4-msjynx8v | 会话存储与压缩 落成门 | 到达 | sessions/gate-ff3e3a71-4-msjynx8v.json |
| gate-be964772-1-msjyq7x4 | 光球面板 落成门 | 到达 | sessions/gate-be964772-1-msjyq7x4.json |
| gate-be964772-2-msjyq7x4 | 光球面板 落成门 | 到达 | sessions/gate-be964772-2-msjyq7x4.json |
| gate-be964772-3-msjyq7x4 | 光球面板 落成门 | 到达 | sessions/gate-be964772-3-msjyq7x4.json |
| gate-be964772-4-msjyq7x4 | 光球面板 落成门 | 到达 | sessions/gate-be964772-4-msjyq7x4.json |
| gate-85255f3f-1-msjyrcl6 | 手势系统 落成门 | 到达 | sessions/gate-85255f3f-1-msjyrcl6.json |
| gate-85255f3f-2-msjyrcl6 | 手势系统 落成门 | 到达 | sessions/gate-85255f3f-2-msjyrcl6.json |
| gate-85255f3f-3-msjyrcl6 | 手势系统 落成门 | 到达 | sessions/gate-85255f3f-3-msjyrcl6.json |
| gate-85255f3f-4-msjyrcl6 | 手势系统 落成门 | 到达 | sessions/gate-85255f3f-4-msjyrcl6.json |
| gate-7bb02f76-1-msjyt7v6 | OBS HUD 观测台 落成门 | 到达 | sessions/gate-7bb02f76-1-msjyt7v6.json |
| gate-7bb02f76-2-msjyt7v6 | OBS HUD 观测台 落成门 | 到达 | sessions/gate-7bb02f76-2-msjyt7v6.json |
| gate-7bb02f76-3-msjyt7v6 | OBS HUD 观测台 落成门 | 到达 | sessions/gate-7bb02f76-3-msjyt7v6.json |
| gate-7bb02f76-4-msjyt7v6 | OBS HUD 观测台 落成门 | 到达 | sessions/gate-7bb02f76-4-msjyt7v6.json |
| gate-5b863c2e-1-msjyufzf | 卡片堆工作台 落成门 | 到达 | sessions/gate-5b863c2e-1-msjyufzf.json |
| gate-5b863c2e-2-msjyufzf | 卡片堆工作台 落成门 | 到达 | sessions/gate-5b863c2e-2-msjyufzf.json |
| gate-5b863c2e-3-msjyufzf | 卡片堆工作台 落成门 | 到达 | sessions/gate-5b863c2e-3-msjyufzf.json |
| gate-5b863c2e-4-msjyufzf | 卡片堆工作台 落成门 | 到达 | sessions/gate-5b863c2e-4-msjyufzf.json |
| gate-8fa492d2-1-msjyvn3u | 终端卡 落成门 | 未达 | sessions/gate-8fa492d2-1-msjyvn3u.json |
| gate-8fa492d2-2-msjyvn3u | 终端卡 落成门 | 到达 | sessions/gate-8fa492d2-2-msjyvn3u.json |
| gate-8fa492d2-3-msjyvn3u | 终端卡 落成门 | 未达 | sessions/gate-8fa492d2-3-msjyvn3u.json |
| gate-8fa492d2-4-msjyvn3u | 终端卡 落成门 | 到达 | sessions/gate-8fa492d2-4-msjyvn3u.json |
| gate-1f078d74-1-msjyxhiw | todo 卡 落成门 | 到达 | sessions/gate-1f078d74-1-msjyxhiw.json |
| gate-1f078d74-2-msjyxhiw | todo 卡 落成门 | 未达 | sessions/gate-1f078d74-2-msjyxhiw.json |
| gate-1f078d74-3-msjyxhiw | todo 卡 落成门 | 未达 | sessions/gate-1f078d74-3-msjyxhiw.json |
| gate-1f078d74-4-msjyxhiw | todo 卡 落成门 | 到达 | sessions/gate-1f078d74-4-msjyxhiw.json |
| gate-c74aaf0c-1-msjyyr2g | Canvas 文件树 落成门 | 到达 | sessions/gate-c74aaf0c-1-msjyyr2g.json |
| gate-c74aaf0c-2-msjyyr2g | Canvas 文件树 落成门 | 到达 | sessions/gate-c74aaf0c-2-msjyyr2g.json |
| gate-c74aaf0c-3-msjyyr2g | Canvas 文件树 落成门 | 到达 | sessions/gate-c74aaf0c-3-msjyyr2g.json |
| gate-c74aaf0c-4-msjyyr2g | Canvas 文件树 落成门 | 到达 | sessions/gate-c74aaf0c-4-msjyyr2g.json |
| gate-19065fd9-1-msjz07pe | 构建检查链 落成门 | 未达 | sessions/gate-19065fd9-1-msjz07pe.json |
| gate-19065fd9-2-msjz07pe | 构建检查链 落成门 | 到达 | sessions/gate-19065fd9-2-msjz07pe.json |
| gate-19065fd9-3-msjz07pe | 构建检查链 落成门 | 到达 | sessions/gate-19065fd9-3-msjz07pe.json |
| gate-19065fd9-4-msjz07pe | 构建检查链 落成门 | 未达 | sessions/gate-19065fd9-4-msjz07pe.json |
| gate-7c85d277-1-msjz2qwi | 文档系统 落成门 | 到达 | sessions/gate-7c85d277-1-msjz2qwi.json |
| gate-7c85d277-2-msjz2qwi | 文档系统 落成门 | 到达 | sessions/gate-7c85d277-2-msjz2qwi.json |
| gate-7c85d277-3-msjz2qwi | 文档系统 落成门 | 到达 | sessions/gate-7c85d277-3-msjz2qwi.json |
| gate-7c85d277-4-msjz2qwi | 文档系统 落成门 | 到达 | sessions/gate-7c85d277-4-msjz2qwi.json |
| gate-6ee7885f-1-msjz3sd5 | 错误码体系 落成门 | 到达 | sessions/gate-6ee7885f-1-msjz3sd5.json |
| gate-6ee7885f-2-msjz3sd5 | 错误码体系 落成门 | 到达 | sessions/gate-6ee7885f-2-msjz3sd5.json |
| gate-6ee7885f-3-msjz3sd5 | 错误码体系 落成门 | 到达 | sessions/gate-6ee7885f-3-msjz3sd5.json |
| gate-6ee7885f-4-msjz3sd5 | 错误码体系 落成门 | 到达 | sessions/gate-6ee7885f-4-msjz3sd5.json |
| gate-9aafac0f-1-msjz5hjj | agent 脚本负载 落成门 | 到达 | sessions/gate-9aafac0f-1-msjz5hjj.json |
| gate-9aafac0f-2-msjz5hjj | agent 脚本负载 落成门 | 到达 | sessions/gate-9aafac0f-2-msjz5hjj.json |
| gate-9aafac0f-3-msjz5hjj | agent 脚本负载 落成门 | 到达 | sessions/gate-9aafac0f-3-msjz5hjj.json |
| gate-9aafac0f-4-msjz5hjj | agent 脚本负载 落成门 | 到达 | sessions/gate-9aafac0f-4-msjz5hjj.json |
| gate-520ea10f-1-msjz75fc | 守视（browser-relay） 落成门 | 到达 | sessions/gate-520ea10f-1-msjz75fc.json |
| gate-520ea10f-2-msjz75fc | 守视（browser-relay） 落成门 | 到达 | sessions/gate-520ea10f-2-msjz75fc.json |
| gate-520ea10f-3-msjz75fc | 守视（browser-relay） 落成门 | 到达 | sessions/gate-520ea10f-3-msjz75fc.json |
| gate-520ea10f-4-msjz75fc | 守视（browser-relay） 落成门 | 到达 | sessions/gate-520ea10f-4-msjz75fc.json |
| gate-5f8bdd58-1-msjz89je | 语义审计 落成门 | 到达 | sessions/gate-5f8bdd58-1-msjz89je.json |
| gate-5f8bdd58-2-msjz89je | 语义审计 落成门 | 到达 | sessions/gate-5f8bdd58-2-msjz89je.json |
| gate-5f8bdd58-3-msjz89je | 语义审计 落成门 | 未达 | sessions/gate-5f8bdd58-3-msjz89je.json |
| gate-5f8bdd58-4-msjz89je | 语义审计 落成门 | 未达 | sessions/gate-5f8bdd58-4-msjz89je.json |
| gate-7eae379c-1-msjzaxuq | 部署与发布 落成门 | 到达 | sessions/gate-7eae379c-1-msjzaxuq.json |
| gate-7eae379c-2-msjzaxuq | 部署与发布 落成门 | 到达 | sessions/gate-7eae379c-2-msjzaxuq.json |
| gate-7eae379c-3-msjzaxuq | 部署与发布 落成门 | 到达 | sessions/gate-7eae379c-3-msjzaxuq.json |
| gate-7eae379c-4-msjzaxuq | 部署与发布 落成门 | 到达 | sessions/gate-7eae379c-4-msjzaxuq.json |
| gate-9185d6f7-1-msjzci8q | 回归测试体系 落成门 | 到达 | sessions/gate-9185d6f7-1-msjzci8q.json |
| gate-9185d6f7-2-msjzci8q | 回归测试体系 落成门 | 到达 | sessions/gate-9185d6f7-2-msjzci8q.json |
| gate-9185d6f7-3-msjzci8q | 回归测试体系 落成门 | 到达 | sessions/gate-9185d6f7-3-msjzci8q.json |
| gate-9185d6f7-4-msjzci8q | 回归测试体系 落成门 | 到达 | sessions/gate-9185d6f7-4-msjzci8q.json |
| gate-a2ee93f5-1-msjzef0w | 权限引擎 落成门 | 到达 | sessions/gate-a2ee93f5-1-msjzef0w.json |
| gate-a2ee93f5-2-msjzef0w | 权限引擎 落成门 | 到达 | sessions/gate-a2ee93f5-2-msjzef0w.json |
| gate-a2ee93f5-3-msjzef0w | 权限引擎 落成门 | 到达 | sessions/gate-a2ee93f5-3-msjzef0w.json |
| gate-a2ee93f5-4-msjzef0w | 权限引擎 落成门 | 到达 | sessions/gate-a2ee93f5-4-msjzef0w.json |
| gate-fd6064ff-1-msjzgloy | 读写监狱（沙箱） 落成门 | 未达 | sessions/gate-fd6064ff-1-msjzgloy.json |
| gate-fd6064ff-2-msjzgloy | 读写监狱（沙箱） 落成门 | 到达 | sessions/gate-fd6064ff-2-msjzgloy.json |
| gate-fd6064ff-3-msjzgloy | 读写监狱（沙箱） 落成门 | 到达 | sessions/gate-fd6064ff-3-msjzgloy.json |
| gate-fd6064ff-4-msjzgloy | 读写监狱（沙箱） 落成门 | 到达 | sessions/gate-fd6064ff-4-msjzgloy.json |
| gate-8cec497f-1-msjzir1c | paradigm 研究线 落成门 | 到达 | sessions/gate-8cec497f-1-msjzir1c.json |
| gate-8cec497f-2-msjzir1c | paradigm 研究线 落成门 | 到达 | sessions/gate-8cec497f-2-msjzir1c.json |
| gate-8cec497f-3-msjzir1c | paradigm 研究线 落成门 | 到达 | sessions/gate-8cec497f-3-msjzir1c.json |
| gate-8cec497f-4-msjzir1c | paradigm 研究线 落成门 | 到达 | sessions/gate-8cec497f-4-msjzir1c.json |
| gate-c04f0f20-1-msjzkb4g | coldstart 研究线 落成门 | 到达 | sessions/gate-c04f0f20-1-msjzkb4g.json |
| gate-c04f0f20-2-msjzkb4g | coldstart 研究线 落成门 | 到达 | sessions/gate-c04f0f20-2-msjzkb4g.json |
| gate-c04f0f20-3-msjzkb4g | coldstart 研究线 落成门 | 到达 | sessions/gate-c04f0f20-3-msjzkb4g.json |
| gate-c04f0f20-4-msjzkb4g | coldstart 研究线 落成门 | 到达 | sessions/gate-c04f0f20-4-msjzkb4g.json |
| gate-ce8fc140-1-msjzlykj | docprobe 研究线 落成门 | 到达 | sessions/gate-ce8fc140-1-msjzlykj.json |
| gate-ce8fc140-2-msjzlykj | docprobe 研究线 落成门 | 到达 | sessions/gate-ce8fc140-2-msjzlykj.json |
| gate-ce8fc140-3-msjzlykj | docprobe 研究线 落成门 | 到达 | sessions/gate-ce8fc140-3-msjzlykj.json |
| gate-ce8fc140-4-msjzlykj | docprobe 研究线 落成门 | 到达 | sessions/gate-ce8fc140-4-msjzlykj.json |
| gate-dbf71807-1-msjznpyz | session-runner 跑批基建 落成门 | 未达 | sessions/gate-dbf71807-1-msjznpyz.json |
| gate-dbf71807-2-msjznpyz | session-runner 跑批基建 落成门 | 未达 | sessions/gate-dbf71807-2-msjznpyz.json |
| gate-dbf71807-3-msjznpyz | session-runner 跑批基建 落成门 | 到达 | sessions/gate-dbf71807-3-msjznpyz.json |
| gate-dbf71807-4-msjznpyz | session-runner 跑批基建 落成门 | 到达 | sessions/gate-dbf71807-4-msjznpyz.json |

<!-- probe-gate:end -->

## 产物登记

- 设计（design/）：design-docprobe.md
- 结论（results/）：pilot-shoushi-2026-08-08.md（试点校准史+判卷尺发现）/
  wave1-2026-08-08.md（首波矩阵 20 臂双轨判卷：H1 反向、静默幻觉发现）/
  retest-t0r-w2-2026-08-08.md（整改复测：T0 盲区闭合+文件树幻觉清零）
- 工具（tools/）：judge-trace.mjs（机械判卷轨）/ judge-understanding.mjs（盲判轨）/
  probe-capability.mjs（落成门探头：登记行→4 臂→probe-state.json 账本）
- 账本/检查门：`docs/ledger/probe-state.json` + `scripts/check/check-probe-state.mjs`
  （挂 chain，⛳ MECH-FLOW-11；负例夹具 tests/probes/probe-state/）
- 地面真相（私有区 `/root/.kfmv4/experiments/docprobe/truth/`）：shoushi.md（守视）/ error-codes.md（错误码体系，H1 活标本：
  路由表无行）/ paradigm.md（范式包）/ domain-contract.md（域契约）/
  file-tree.md（文件树，老功能对照组：路由表同样无行）
