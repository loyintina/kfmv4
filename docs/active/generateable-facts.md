# 可生成事实登记表（generateable facts registry）

> 2026-08-02 立。语义单源 + 生成呈现（`active/semantic-generation.md`）的落地登记：
> 凡「能从单一活源头推导」的文档内容 → 生成器产出，不手写。
> 新可生成事实必须在此登记（同状态新鲜度载体套路）；登记即承诺「生成区标记 + 幂等 + check-only」。

## 已生成（✅ 落地）

| 事实 | 源头 | 生成器 | 标记 |
|------|------|--------|------|
| 计数（测试数/check 数） | npm test / check-checks 实况 | sync-counts.mjs | 回写点 TARGETS |
| 检查链节（chain:auto） | chain.mjs STEPS | sync-counts.mjs | `<!-- chain:auto -->` |
| 代码清单（域归属/行数） | 代码树 | gen-code-inventory.mjs | 机械生成头注 |
| 观测台周报 | 账本/审计/信箱 | obs-aggregate.mjs | 每周投信箱 |

## 可生成待升档（按优先级）

| 事实 | 源头 | 现状 | 升档路径 | 优先级 |
|------|------|------|---------|--------|
| **CLAUDE 路由表**（19 工作流） | docs/workflows/*.yaml（id/name） | 手写 18 行，新工作流靠人记得加 | 生成器：枚举目录 + frontmatter → 表；加门（新 yaml 必须进路由表） | **P0** |
| **契约文件清单 ×5** | code-inventory（域文件列表） | ai-chat/client-shell/floating-card/infra/server 手写；canvas-tree 已引用式 | 生成器：从 inventory 提取域文件 → 清单节（gen: 标记） | **P0** |
| 版本号标记（README:1/5 + CLAUDE） | package.json + git tag | 手写（发版时手动改） | sync-counts 加版本号回写点 | P1 |
| check 清单（「37 个 check-*」名字） | chain.mjs STEPS | 只有计数没名字 | 生成器：STEPS 枚举 → 名字清单 | P1 |
| 「六域」列举（多处） | docs/domains/ 目录 | 手写数字 | 生成器：目录枚举 | P2 |

## 边界（不可生成，默认手写）

- STACK 条目（工作栈判断）、ADR（决策叙事）、判例/豁免理由、bug 根因、设计讨论——
  需要判断的内容，按「不可生成默认」原则手写，但遵守状态新鲜度纪律。

## 登记规程

1. 新可生成事实 → 本表登记（事实/源头/升档路径）；
2. 生成器落地 → 标记行改 ✅ + 生成器列填名；
3. 升档后原手写区删除（防止双份）；
4. 生成器必须幂等 + check-only 漂移门（否则等于没升）。
