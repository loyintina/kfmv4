<!-- 机械生成：node scripts/check/gen-capability-map.mjs —— 请勿手改 -->
<!-- 登记源：scripts/capability-map.manifest.json · 生成于 2026-08-08 -->

# 功能总目录（capability map）

> 这是什么：项目全部功能的一行式总目录——俗名 / 关键词 / 主入口 / 一句话。
> 产品与运维不分局（项目自指：产品自己运维自己，docprobe T0 盲区整改）。
> 给「想知道有什么」的读者（人或裸启动 agent）；「知道要干什么该去哪」→ CLAUDE.md 路由表。
> 机械门：DOMAIN_SRC 每域 ≥1 行；每个关键词必须在主入口或域文档 grep 可达（俗名↔路径桥）。


## 产品（11）

| 功能 | 关键词 | 主入口 | 域 | 一句话 |
|------|--------|--------|-----|--------|
| 会话聊天面板 | `聊天` `会话` | docs/domains/ai-chat/contract.md | ai-chat | 流式对话/思考框/工具卡折叠/历史会话 |
| 角色卡 | `角色卡` `role` | docs/domains/ai-chat/contract.md | ai-chat | 人格注入，L1 角色卡+L2 心法分层 |
| API 卡（provider 管理） | `provider` `API` | docs/domains/ai-chat/contract.md | ai-chat | 多 provider 配置与模型选择 |
| 会话存储与压缩 | `压缩` `存储` | docs/domains/ai-chat/contract.md | ai-chat | 会话落盘/工具结果压缩/长会话续读 |
| 光球面板 | `光球` `orb` | docs/domains/client-shell/contract.md | client-shell | 中央光球+展开面板的主交互 |
| 手势系统 | `手势` `gesture` | docs/domains/client-shell/contract.md | client-shell | 滑动手势注册与分发 |
| OBS HUD 观测台 | `观测台` `HUD` `obs` | docs/domains/client-shell/contract.md | client-shell | 页内状态观测 HUD |
| 卡片堆工作台 | `卡片` `卡片堆` | docs/domains/floating-card/contract.md | floating-card | 浮动卡片引擎+插件卡体系 |
| 终端卡 | `终端` `tmux` `xterm` | docs/domains/floating-card/contract.md | floating-card | xterm.js 终端/tmux 会话卡 |
| todo 卡 | `todo` | docs/domains/floating-card/contract.md | floating-card | todo 工具的面板呈现 |
| Canvas 文件树 | `文件树` `字符雨` | docs/domains/canvas-tree/contract.md | canvas-tree | Canvas 自绘文件树+字符雨动画 |

## 运维（10）

| 功能 | 关键词 | 主入口 | 域 | 一句话 |
|------|--------|--------|-----|--------|
| 构建检查链 | `检查器` `chain` `检查` | docs/domains/infra/contract.md | infra | 43+ 检查器构建时执法 |
| 文档系统 | `文档` `工作流` `域契约` | docs/guides/doc-architecture.md | infra | docs 分层体系+工作流路由 |
| 错误码体系 | `错误码` `FLOW` | docs/active/error-codes.md | infra | check 报错引导码（自我修正回路） |
| agent 脚本负载 | `agent-runner` `负载` `巡逻` | docs/guides/agent-runner.md | infra | 常驻/定时 agent 脚本体系 |
| 守视（browser-relay） | `守视` `browser-relay` | docs/guides/agent-runner.md | infra | headless Chrome 视觉自测 |
| 语义审计 | `语义审计` `semantic` | docs/guides/agent-runner.md | infra | 文档-代码语义一致性探针集群 |
| 部署与发布 | `部署` `deploy` `发布` | docs/guides/release.md | infra | deploy-fast/版本发布流程 |
| 回归测试体系 | `回归` `BAR` `测试` | docs/guides/testing.md | infra | 528+ 回归测试与 BAR 钉制度 |
| 权限引擎 | `权限` `RiskClass` | docs/active/harness-permission-engine.md | server | 工具风险分级与审计 |
| 读写监狱（沙箱） | `沙箱` `监狱` `readRoot` | docs/ledger/bugs.md | ai-chat | write/edit 与 read/grep/glob 路径监狱 |

## 研究（4）

| 功能 | 关键词 | 主入口 | 域 | 一句话 |
|------|--------|--------|-----|--------|
| paradigm 研究线 | `范式包` `paradigm` | experiments/paradigm/index.md | — | 范式包对 agent 行为影响的实验体系 |
| coldstart 研究线 | `冷启动` `coldstart` | experiments/coldstart/index.md | — | 全新 agent 整体接手能力测量 |
| docprobe 研究线 | `docprobe` `文档抽测` | experiments/docprobe/index.md | — | 文档指引系统的功能粒度体检 |
| session-runner 跑批基建 | `session-runner` `跑批` | experiments/paradigm/index.md | — | 离线会话驱动与实验臂归档 |
