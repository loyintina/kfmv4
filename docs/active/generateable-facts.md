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
| 眼睛格式事实段 | PAGE_STATE_TEXTS 注册表 + ui-registry 类型联合 | gen-page-state-schema.mjs | `<!-- gen:page-state-facts:start/end -->` |

## 可生成待升档（按优先级）

| 事实 | 源头 | 现状 | 升档路径 | 优先级 |
|------|------|------|---------|--------|
| **CLAUDE 路由表**（16 工作流） | docs/workflows/*.yaml（id/name） | ✅ 生成器 gen-route-table 挂链 | — | ✅ P0 |
| **契约文件清单 ×6** | code-inventory（域文件列表） | ✅ 生成器 gen-contract-lists 挂链 | — | ✅ P0 |
| 版本号标记（README:1/5） | package.json | ✅ sync-counts 回写 | — | ✅ P1 |
| check 清单（名字） | chain.mjs STEPS | ✅ 已由 contract chain:auto 覆盖（生成区含全部名字） | — | ✅ P1 |
| 「六域」列举 | docs/domains/ 目录 | 域数稳定（6），code-inventory 已机械列出全部域 | 不升档：prose 提及属判断区，生成成本高于收益 | ⏸ P2 |
| **工具文档参数节**（16 份） | tools/*.ts 的 KfmTool.parameters schema | ✅ 生成器 gen-tool-docs 挂链（参数节拼接 + check-only 门） | `<!-- gen:tool-params:start/end -->` | ✅ P0 |
| 运行时事件类型清单 | shared/chat-protocol/events.ts 类型 union | detail-runtime §3.3 手写 7/9 种（缺 error/rule_warning） | 低成本：生成类型清单或补引用指针 | P1 |
| debug-tools CDP 操作表 | debug.ts action 分支 + kfmv4-views.ts | 手写 14/19 种 + launch 状态错 | 生成器从注册表拼接 | P1 |

## 边界（不可生成，默认手写）

- STACK 条目（工作栈判断）、ADR（决策叙事）、判例/豁免理由、bug 根因、设计讨论——
  需要判断的内容，按「不可生成默认」原则手写，但遵守状态新鲜度纪律。

## 登记规程

1. 新可生成事实 → 本表登记（事实/源头/升档路径）；
2. 生成器落地 → 标记行改 ✅ + 生成器列填名；
3. 升档后原手写区删除（防止双份）；
4. 生成器必须幂等 + check-only 漂移门（否则等于没升）。
