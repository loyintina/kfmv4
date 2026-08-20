# 9.0 台账对照审查 + dsh 能力地图（卡萝）

> 这是什么：两份产出——① 对 9.0 设计线能力地图（`nine-point-zero.md` 组件台账）
> 的对照审查（有没有多、有没有少）；② 用同一逻辑拆分的 **dsh 能力地图**
> （cordis 本体 + 分层插件），验证「cordis 内核 + 分类插件」是否成立。
> 别的去哪找：9.0 台账 → nine-point-zero.md；dsh 包清单 → `/opt/dsh-src/packages/`；
> 采用决策 → `../../ledger/agent-inbox/kfmv4-9.0-cordis-adoption-verdict.md`。
> 状态：✅ 已收编（2026-08-20 用户拍板，9.0 线执行：5 处缺口核对全部已闭环——rules/ 归 rule-engine 行、prompts/global 归 agent-service 行、routes/obs 归 №8 顶栏行、terminal-pty 归 №1 终端卡行、范式卡 ❌ 移除行在册；防再漂机制 = check-ledger-coverage.mjs（清单层机械生成 × 归宿层锚点咬合）已挂检查链常驻）。

---

## 一、9.0 台账对照审查（基线：v8 src/ 实测 152 文件 / 36,082 行）

> 台账基线 36,012 行，实测 36,082 行（差 70，行数口径差异，可接受）。

### 少的：5 处缺归宿行（全覆盖军规缺口）

| # | 文件/目录 | 实测 | 台账状态 | 建议归宿 |
|---|---|---|---|---|
| 1 | `src/server/ai/rules/`（5 文件：commit-after-change / no-console / read-invariants-first / regression-discipline / scss-only） | 规则注入文件 | **零提及** | 归 dynamic-prompt-files 体系（与 prompts/dynamic 同族）或域外运维——9.0 线定 |
| 2 | `src/server/prompts/global + system + tools/`（非 dynamic 部分） | prompt 模板 | **零提及**（仅 dynamic 有行） | 归 agent-service（prompt-assembler）或 dynamic-prompt-files 包 |
| 3 | `src/server/routes/obs.ts` | 观测台服务端路由 | **零提及**（obs-hud.ts 消解有记录，routes 侧没有） | 归 №8 顶栏（服务端侧） |
| 4 | `src/server/terminal-pty.ts` | PTY 会话管理 | 台账无行（契约 №1 正文提及） | 补台账行：归 №1 term-connection 家族 |
| 5 | `src/client/cards/plugins/paradigm.card.ts` | 范式卡 | 拍板取消有记录（preface），但台账卡片清单**无「已拍板移除」行** | 补一行「❌ 已拍板移除」（军规：每行有归宿，含移除） |

**附：engine/v2（8 文件）**——台账「文件树卡」行提了 Canvas 重写 DOM 化，但
engine/v2 旧渲染引擎（box/renderer/flex/text-layout）的处置未显式登记；
文件树卡契约 №7 说「v8 双树 overlay 动画/字符雨不迁移」，建议台账补
「engine/v2 不迁移留仓（随 №7 消解）」一行，防考古断链。

### 多的：1 处重复登记

| 位置 | 问题 | 建议 |
|---|---|---|
| 服务插件表「theme \| theme.ts \| 待设计」 vs 包表「UI 皮肤包：theme.ts/style-registry 归包内」 | 同一件两处登记，且「插件化的是效果不是代码」原则下 theme.ts 的归属已由皮肤包拍板 | 服务插件表 theme 行标注「→ 皮肤包」，不再独立待设计 |

### 其余判定

- 台账「插件化的是效果不是代码」原则与 v8 实况吻合：纯函数库（md 渲染器/颜色
  工具）确实无注册/订阅/状态；
- 工具家族归堆（小工具群/kfm-tools/browser/debug）与 `ai/tools/` 实况一致
  （omp 17 工具 + kfmv4 4 工具）；
- 未规划行登记（Ⓟ13,331 行）抽查一致，覆盖判定可信。

---

## 二、dsh 能力地图（cordis 本体 + 分层插件）

> 依据：`/opt/dsh-src/packages/` 实况 + vendor 清单。验证命题：
> **dsh = cordis 内核 + 分类分层的插件集合**——用户想象的优雅模式是否成立。

### L0 · 内核（cordis 本体，不可插拔）

`ctx`（Context）/ fiber 生命周期 / events 四派发 / registry（inject）/ service /
reflect / logger —— 即 9.0 契约「内核 ctx 基座」的完整实现。

### L1 · 平台层（宿主核心，每个 dsh 实例必有）

| 包 | 职责 |
|---|---|
| boot/app-boot + cmdline | 启动引导、命令行入口 |
| host/webserver + frontend-static + apiproxy | Web 服务、静态托管、浏览器 API 代理 |
| host/directory-picker-* | 目录选择（原生/浏览器） |
| host/plugin-inventory | 插件清单面板 |
| web / api / sdk | 接口面（含 python sdk-runtime） |

### L2 · 能力层（host 服务插件，按能力分类——9.0 台账「服务插件」的同构层）

| 能力族 | 包 |
|---|---|
| 模型与循环 | core/agent · agent-loop · agent-default-model · agent-tool-presentation · system-prompt · llm（+ llm-deepseek / token-meter）· model-selection |
| 记忆与上下文 | session 家族（persistence-jsonl/sqlite · projection · title-llm · stats · telemetry · checkpoint-policy）· compaction 家族（engine/basic/command/tool-result-pruner）· context 家族（time · session-reference · tmux）· spill 家族（spill/local/policy）· attachment · storage |
| 执行与工具 | core/tools · shell · fs · sandbox · subprocess · terminal 家族（terminal-bash / tool-terminal）· code-runtime |
| 编排与协作 | subagent · workflow · goal · todo · jobs · schedule · plan · feedback · interaction · hooks · skill |
| 安全与治理 | guard · credentials · identity · settings · session-query · core/scope（isolate realm） |
| 集成与接口 | mcp · lsp · acp · e2b · extensions（tool-cordis 自指工具等） |
| 观测与诊断 | runtime-diagnostics · compaction 观测件 · spill 策略（度量） |

### L3 · 客户端层（浏览器插件，9.0「卡片插件」的同构层）

运行时：client/runtime · connection · web-react · web
UI 体系：ui-primitives · ui-layout · ui-slots · ui-theme · ui-sidebar · ui-input-trigger
功能 UI：ui-conversation · ui-tool · ui-commands · ui-jobs · ui-goal · ui-plan ·
ui-subagent · ui-workflow-run · ui-deliverables · ui-message-feedback ·
ui-user-questions · ui-trajectory · ui-skill · ui-settings（general/models/plugins/
plugin-inventory）· ui-directory-picker-* · ui-model-selection · ui-agent-preset ·
ui-permission-presets · schema-form

### L4 · 预设层（组合，非插件）

preset/agent-presets（standard / code / minimal / cordis）+ 用户自定义
（caro、routing-suite、未来 kfmv4）——即 9.0「包（bundle）」形态的 dsh 侧对应。

### 验证结论：优雅模式成立

| 9.0 台账分类 | dsh 对应层 | 同构点 |
|---|---|---|
| 内核 ctx 基座 | L0 cordis | 同一物 |
| 服务插件（数据管理器） | L2 能力层 | 服务定义/实现分离、可插拔 |
| 卡片插件 | L3 客户端插件 | 有状态 UI 组件挂 Slot |
| 包（bundle） | L4 预设 + L2 包族 | 原子启停、组合 |
| 布局与壳 | ui-layout + ui-slots | 布局可换 |
| 共享基础件 | ui-primitives / web-react | 纯函数/无状态组件 |
| 域外（运维/研究） | docs / experiments（dsh 侧） | 非运行时 |

**推论**：9.0 不是「从 dsh 拔插件」，而是**按同一分层模型，在 L2 记忆与上下文族
直接引用 dsh 资产（session/compaction/context/spill 全部现成），在 L3 用 kfmv4
自己的卡片插件替换 dsh 的 React 会话 UI**。分层本身就是「拿多少」的答案：
**拿 L2 能力族、换 L3 呈现层、留 L0 内核、L4 组合自己的模式。**

——卡萝 · 2026-08-16（初稿）

---

**9.0 线确认 · 2026-08-16**：台账 5 处缺口**已全部补行**（rules/+rule-engine 归
№12 附属 / prompts 非 dynamic 归 agent-service 装配数据源 / routes/obs.ts 归
№8 顶栏 / terminal-pty.ts 归 №1 连接家族 / paradigm.card 补 ❌ 移除行）。
engine/v2 与 theme 重复两处已在 9.0 小件清零轮（2026-08-16）先行解决
（engine/v2 拍板退役清理、theme 归 UI 皮肤包 v1 重写）——审查与本线拍板
互相印证，军规第一次实战检验有效。
dsh 能力地图的分层同构结论（**拿 L2 能力族、换 L3 呈现层、留 L0 内核、L4 组合
自己的**）认可为采用后的取材地图；9.0 台账分类与 dsh 分层的对应表存档备查。
