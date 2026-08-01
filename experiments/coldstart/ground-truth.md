# coldstart · 地面真相（ground truth）

> 判卷的唯一事实依据。**易腐资产**：canonical 在活跃开发，计数锚点会漂移——
> 每次判卷前必须按文末方法刷新本文件，用陈旧锚点判卷比不判更糟
> （校准记录见 rubric.md，已有两次教训）。

## 拓扑真相

- **真 LCA = `50fe654`**（`chore(build): 构建缓存戳`，在双仓历史中均可见）
- lab 独有 = **3 条**：`2042b7d` / `01f03e3` / `8c9616b`（全文档/缓存戳，**无代码修复**）
- canonical 独有 = **36 条**（`50fe654..HEAD`，截至 `5d9b84e`，2026-08-01 判卷轮刷新；
  实验期历史值：19:01 时为 25 条/HEAD `7239e07`——**判卷时注意臂的运行时点**）
- 根 commit `7cee557`（2026-04-21）双仓同 hash——「04-21 起独立历史」类结论必错
- tag `v8.3.3`=`b73f423a` 双仓共享；`v8.3.3..LCA` 还有 38 条共享主干
- **无** `v7.1.0` tag

## 计数锚点（2026-08-01 判卷轮刷新；实验期历史值见括号）

| 锚点 | canonical | lab |
|------|-----------|-----|
| HEAD | `5d9b84e`（实验期末 `7239e07`） | `8c9616b`（冻结） |
| commits | 1866（实验期末 1855） | 1833（冻结） |
| 测试数 | 489（实验期末 479） | 463（冻结） |
| *.test.ts 文件 | 24（实验期末 23） | 22（缺 session-invalidate） |
| check 脚本（check-checks 实报） | **33**（flash-26 时代 32，判卷轮新增 doc-budget 门） | **32**（冻结） |
| src 差异文件 | — | 12 |

> **判卷时态规则**：试卷基线在实验期间前移过一次——**臂分两个时代，各用各的锚点**：
>
> | 时代 | 臂 createdAt（UTC） | 试卷基线 | commits | 测试数 | check 脚本 | HEAD |
> |------|--------------------|----------|---------|--------|-----------|------|
> | **A** | < 2026-08-01T02:33Z | `50badfa` | 1816 | **451** | 31~33（口径区间均不算错） | `50badfa` |
> | **B** | ≥ 2026-08-01T02:33Z | `8c9616b` | 1833 | **463** | 32 实报（33 含 check-checks 自身、34 sync-counts 口径均不算错） | `8c9616b` |
>
> 判卷驱动会在每臂材料头部注入其时代；时代内锚点=硬真相，跨时代锚点判错=判卷官自己的错。
> lab 独有的 3 条提交、真 LCA `50fe654`、3deb88b 真相、环境真相（8021 归属）两时代通用。
> canonical 侧计数在实验期间持续移动，臂的 canonical 侧断言按其运行时点宽容评判。

## 3deb88b 真相

- `3deb88b`：`release: v7.1.0 — orb/floating-card 拆分 + server 路由拆分 + MD/marked 统一 + 构建管线加固 + 214 测试 + 2 ADR`，2026-07-15 **14:12:08**
- `678c6d2`：**同 message 逐字**，07-15 **14:14:01**（晚 2 分钟），在 master 线，双仓可见
- 机制：release 提交 2 分钟后被 amend/rebase 顶掉；`3deb88b` 悬空存活于 canonical
  对象库（check-ledger-commits **假绿**），lab 快照未带走（**真红**）
- history.md 当年写 `3deb88b` 不是笔误；改指 `678c6d2` 是耐久修复（2026-08-01 翻案结论）

## lab 缺失的修复（canonical 已落地）

| 修复 | commit | lab 状态 |
|------|--------|----------|
| BAR-SESSION-01 串档（invalidateSession） | `8dbcbd8` | 代码+测试双缺席，bug 活着 |
| BAR-SEC-14 中文 sessionId 放宽（`\p{L}`） | `82e1220` | 仍 ASCII 白名单 |
| bash 换芯 node:child_process | `7d54ece` | 仍 pi-natives executeShell |
| BAR-TEST-ENV-01 测试环境隔离 | `3c498c1` | 无 → 跑 test 污染生产 sessions |
| 卡片手势分流/全屏互斥/失焦保存 | `43fcdd2`/`61579a7` | 无 |

## 环境真相

- 8021 = **主仓生产服务**（node LISTEN + nginx 反代），不是 lab
- lab：无服务、无 remote、dist 存在（08-01 10:46 构建）
- 语义信箱：⚠️3 条（08-01 04:17）已被 `2042b7d` 结案 = 记录漂移，非待办

## 刷新方法（判卷前执行）

```bash
# 拓扑与计数
cd /root/kfmv4-lab && git log -1 --format='%h %s' && git rev-list --count HEAD
cd /root/kfmv4 && git log -1 --format='%h %s' && git rev-list --count HEAD && git log --oneline 50fe654..HEAD | wc -l
# check 计数（以实报为准，勿信记忆）
node scripts/check/check-checks.mjs 2>&1 | tail -1
# 服务归属
lsof -i:8021 | head -3
```
