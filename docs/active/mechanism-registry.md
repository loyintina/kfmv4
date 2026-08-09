# 机制注册表（mechanism registry）

> **这是什么**：kfmv4 依赖的核心机制地图——让"机制生态"可见，让"机制死了"可被察觉。
> 2026-08-09 立项（external-sources 复盘 → 递归终止框架落地：用地图+条款+审计防腐烂，
> 不是加守护机制层——机制连现实，不连另一层机制）。
> 更新：新机制落地时登记一行（invariants §六 自检引导）；低频手工维护，无常驻自动化。

## 登记表

| 机制 | 类型 | 机械化 | 失效信号（现实怎么叫） | 探针 |
|---|---|---|---|---|
| 检查链 chain.mjs（59 步） | 核心 | 全（hard fail） | 任一步失败 = 构建中断，现实立即叫 | ✓（check-checks 夹具） |
| 探针自检 check-probes | 核心 | 全 | 检查器对负例不报错 → 探针报"已失效" | 运行器本身（22 夹具） |
| 工作流消费门（doc-orphans 三） | 核心 | 全（DOC-FLOW-12） | 规则文档无人消费 → 门报红 | ✓（doc-orphans 夹具） |
| 契约新鲜度 contract-freshness | 核心 | 全 | 域代码比契约新 → 构建中断 | ✗ 无探针（候选） |
| 文档预算 doc-budget | 核心 | 全 | 加载类文档超行数 → 中断 | ✓ |
| 耦合门 commit-docs | 核心 | 全（hard fail + docs:na） | src/scripts 改动无 docs → 提交被拦 | 豁免（git 历史型） |
| 落成门 probe-state | 核心 | 全 | 新功能无探头记录/陈旧 → 中断 | ✓ |
| BAR 钉制度（fix-tests/bar-ledger） | 核心 | 全 | fix 无钉/未登记 → 报红 | ✓（bar-ledger 夹具） |
| 错误码引导 error-codes | 核心 | 全（⛳ 引导） | 构建失败无引导码 → agent 瞎修 | 被 check 文本消费 |
| 权限引擎（gen-permission-map） | 核心 | 全 | 新工具无 RiskClass → DOC-FLOW-05 | ✓ |
| 读写监狱（path-utils sanitizePath） | 核心 | 全（运行时） | 路径逃逸 → 拒绝 + 日志 | 运行时 BAR 钉 |
| 测试隔离 env-test-isolation | 核心 | 全 | 测试污染生产区 → check-kfmv4-data 报红 | ✓（间接） |
| 生成器族 gen-* | 核心 | 全（--check-only） | 生成物与源漂移 → 中断 | ✓（多数） |
| 数据区结构 check-kfmv4-data | 核心 | 全 | 账本回潮/结构违例 → 中断 | ✓（2026-08-09 补） |
| 工具压缩登记 tool-compaction | 核心 | 全 | 新工具无压缩登记 → 中断 | ✓（2026-08-09 补） |
| 外部来源登记 external-sources | 外围 | 约定（pre-code-gate 清单） | 引外部代码没人登记 → 升级踩坑才知（滞后） | —（接受滞后+抽查） |
| 工作流系统 workflows | 核心 | 约定 + workflow-integrity | 工作流引用失效 → MECH-FLOW-05 | ✓（consistency） |

## 分级处置

- **核心机制**（上表 15 行）：失效必须立即显形——探针 ✗ 的 4 个（contract-freshness /
  kfmv4-data / tool-compaction / secrets）是**探针补强候选**（下一轮加夹具）。
- **外围机制**：接受滞后失效信号 + 用户抽查兜底，不设守护（external-sources 即此类）。
- **退役规则**：外围机制失效信号长期无法验证 + 无真实使用 → 退役候选（doc-architecture
  §退役）。

## 历史

- 2026-08-09 立项：机制注册表（递归终止框架落地第一步）。盘点 17 个机制，
  4 个核心检查器无探针。
- 2026-08-09 体检：17 机制失效信号全部可验证或合理豁免（report：
  harness-studies/mechanism-audit-2026-08-09.md）；补 kfmv4-data + tool-compaction
  探针（22→24）；contract-freshness/secrets 为 git 历史型豁免（有据）。
