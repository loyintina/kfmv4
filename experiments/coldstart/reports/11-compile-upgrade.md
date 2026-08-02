# 11 · 编译升档盘点清单（compile-upgrade survey）

> 2026-08-02。三档阶梯（消灭 > 编译 > 检查）的「编译方向」盘点：扫全系统
> 「手写的事实副本」，逐个判档位，产出按优先级排序的升档候选。
> 盘点即发现：code-map:28 手写「31 个 check」实为 36（真漂移，已修）——
> 检查档没拦住，正是升档的理由。

## 全系统三档分布

### 已编译（机器生成，无漂移风险）

| 事实 | 生成器 | 出处 |
|------|--------|------|
| contract 计数 + chain:auto 区块 | sync-counts.mjs | 链内 --check-only 门 |
| testing.md 测试数 | sync-counts.mjs | 同上 |
| code-inventory（清单） | gen-code-inventory.mjs | 链内 --check-only 门 |

### 已消灭（代码单一出处 + check 强制登记）

| 事实 | 单一出处 | 门 |
|------|---------|-----|
| 工具压缩器登记 | src/shared/tool-compaction COMPACTOR_REGISTRY | check-tool-compaction |
| 卡片注册表 | src/client/cards/registry.ts + data-registry-id | check-registry |

### 检查档（手写 + 门，部分可升档）

| 事实 | 手写位置 | 现有门 | 升档评估 |
|------|---------|--------|---------|
| 构建管线计数（36 check/490 测试） | README.md:5+20、CLAUDE.md:51 | **无门**（每次加 check 手动改，已 34→35→36 三改） | **P1 编译**：进 sync-counts 回写列表 |
| workflow 路由表（17 行） | CLAUDE.md 路由表 | check-workflow-integrity 未覆盖路由表 | **P2 加门**：新 workflow yaml 必须进路由表 |
| code-map 漂移清单节 | 各域 code-map.md | 探针读作豁免（状态靠人回写） | P3 哈希（见缺口 1，与豁免同套） |
| 域契约（应然层） | 各 contract.md | freshness 门（5 提交） | 不升（规范层，人写才有意义） |

### 不升档（设计上保留人工）

- history.md 版本条目历史计数——历史快照，生成即造假；
- orientation 模糊表述（「几十个 check」）——已消灭档（不写死）；
- 判例层（variants/exemptions/STACK 状态）——裁决制，不适合生成。

## 升档候选（按优先级）

| 优先级 | 候选 | 升档路径 | 收益 |
|--------|------|---------|------|
| **P0** | code-map:28 手写 check 数 | ✅ 已修（引用式） | 消除已逮住的真漂移 |
| **P1** | README/CLAUDE 构建计数 | sync-counts 回写列表加 README.md:5/20、CLAUDE.md:51 | 消灭「加 check 手动改 3 处」的 G3 型漂移 |
| **P2** | workflow 路由表 | check-workflow-integrity 扩展：新 yaml 必须出现在 CLAUDE 路由表 | 新工作流不迷路 |
| **P3** | code-map 漂移清单节状态 | 漂移条目带目标哈希（豁免同套） | 修复轮回写即失效 |

## 结论

编译升档的真金白银在 **P1**（计数手写副本是 G3 型漂移的高发区，sync-counts 已证明能机械消灭）；
P2 是低成本门；P3 复用豁免哈希机制。P0 已当场兑现（盘点即逮住一处真漂移）。
执行时机：8.4 发版后作为主线延续（结晶回路文化的日常化），非 8.4 阻塞项。
