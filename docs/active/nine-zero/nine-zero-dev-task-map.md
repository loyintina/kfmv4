# 9.0 开发任务图（插件全景 · 任务版）

> 这是什么：9.0 正式开发的**任务图**——全景图（`nine-zero-plugin-map.html`）的
> 文字任务版。整合：第一阶段 16 契约 + 第二阶段契约 0–9 + dsh 可取材资产。
> 每行：任务 / 契约出处 / 依赖 / 验收 / 状态。
> 别的去哪找：契约全文 → `nine-zero-phase1-contracts.md` / `nine-zero-phase2-contracts.md`；
> 台账归宿 → `nine-point-zero.md`；裁决史 → `nine-zero-decision-index.md`；
> 跨世界词典 → `nine-zero-semantic-map.md`。
> 2026-08-17 立。状态图例：✅ 定稿可开工 / 🔶 验证中 / ⬜ 待设计 / 🌙 远期。

## 读法

- **层间箭头只向下**：上层依赖下层，开发自底向上；文档世界线（工坊）与代码
  世界线（运行时）**并行**，互不阻塞；
- 迁移法（绞杀者两步走）贯穿全图：数据管道换心 → 搬进新容器；每步带
  功能一致对照表 + 保留性考题；**576 测试基线不许降**；
- 全景图与本文档的分工：图看结构，本文档派活。图的内容 = 本文档 L0–L3 +
  文档世界机制层；
- **实现来源列**（2026-08-17 卡萝增补）：自研 / dsh拿来 / dsh参考 / 接口对齐——
  逐项对照见 `nine-zero-dsh-sourcing.md`；dsh 资产按契约优先 + 移动端指标两关取材。

## 第 0 层：闸门（步 0 四项验证，一切的前置）

| 任务 | 内容 | 验收 | 状态 |
|------|------|------|------|
| 步 0-1 esbuild 最小验证 | kfmv4 构建管线实跑 cordis ctx + 注册/注销效果 | 浏览器跑通 | 🔶 |
| 步 0-2 移动端指标 | cordis core bundle 体积 / 运行时分配率 / 启动耗时 | 数字达标（茉莉会签） | 🔶 |
| 步 0-3 隐式全局普查定性 | `window.__kfm*` 与模块级单例逐个定性 | 清单全定性（存量材料：implicit-globals-audit） | 🔶 |
| 步 0-4 自研件验收基准 | 验收三数字：掉帧率上限 / 拖拽 30s 内存增量 / pointercancel 完整性 | 数字写入 №14；**NA 同口径互证**（原生侧实测值由 NA 供） | 🔶 |

闸门纪律：任一不过 → 回 Cordis 采用裁决信重议；全过 → 总拍板 + 语义映射表
入 preface + 试点三件套重定向 Cordis。

## L0 内核（不可插拔）

| 任务 | 契约 | 依赖 | 状态 |
|------|------|------|------|
| Cordis 本体引入（cordis@4.0.0-rc.7 锁版本进 lockfile；升级契约化归 9.0 线） | 采用裁决 | 步 0 | 🔶 |
| 渲染宿主（DOM 容器/摘容器 API；容器生灭唯一入口） | №14 | Cordis | ✅ |
| 手势分发（gesture-registry 收编 + ctx 效果注册 + 层带公约） | №14 | Cordis | ✅ |
| 启动引导（拓扑激活；调试桥删；ws-server 一拆三） | №16 | 全部插件就位 | ✅ |

## L1 服务插件（数据管理器阶层）

| 任务 | 契约 | 依赖 | 来源 | 状态 |
|------|------|------|------|------|
| card-types broker（卡片注册表 + singleton 声明） | №6 | L0 | 自研（inventory 枚举参考） | ✅ |
| tool-host 工具宿主（骨架固定+闸可插拔+只收不放；四家族工具包） | №10 | №6 + №15 | **dsh参考**（core/tools：参数 schema/中止/流式） | ✅ |
| ledger-service 账本（append-only：执行账/裁决审计/操作审计） | №10 附属 | L0 | 自研 | ✅ |
| session-store（会话存储与压缩） | №12 | L0 | **dsh拿来**（persistence-jsonl/sqlite + projection + checkpoint） | ✅ |
| 压缩挂点（工具 I/O 修剪 + 摘要；挂 agent-service 投影链） | №12 修订注 | agent-service | **dsh拿来**（tool-result-pruner + spill-policy + compaction-basic） | ✅ |
| pool-system（基础四池数据层 + workspaces 点亮） | №3 附属 + №12 | L0 | dsh参考（credentials/settings/model-selection） | ✅ |
| agent-service（流式对话/工具循环/prompt 装配线） | №2 附属 + №12 | №10 + session-store + pool-system | **dsh参考**（agent-loop/llm/system-prompt/token-meter） | ✅ |
| permission-engine 安全包（影子转正真拦截；ask 内联窗口卡；强制 riskClass） | №15 | L0 | **dsh参考**（guard/scope 裁决语义） | ✅ |
| rule-engine（规则引擎；装配线数据源） | №12 附属 | L0 | dsh参考（hooks 钩子链） | ⬜ 待设计 |
| dynamic-prompt-files（prompts/dynamic 目录管理） | №5 附属 | L0 | dsh参考（system-prompt 组装） | ⬜ 待设计 |
| tree-data（文件树懒加载） | №7 附属 | L0 | dsh参考（fs/directory-picker） | ⬜ 待设计 |
| file-io（文件 CRUD） | №12 附属 | L0 | **dsh参考**（fs 沙箱/权限面） | ⬜ 待设计 |

注：压缩挂点已按 dsh 取材上移为独立任务行——dsh 的 pruner 是**有状态服务插件**
（ctx.toolResultPruner）、spill 是 hooks 插件，非纯函数（取材清单修正 2026-08-17）。

## L2 卡片插件

| 任务 | 契约 | 依赖 | 来源 | 状态 |
|------|------|------|------|------|
| 试点三件套（机制跑通：眼睛/手/卡片注册表——重定向 Cordis 后先行） | №5/№4/№6 | L0 + №6 | 自研 | ✅ |
| 终端卡 / tmux 卡（渲染器 + 连接家族：PTY/tmux 管理服务） | №1 | №6 | **dsh参考**（terminal-bash 连接层；渲染自研） | ✅ |
| 对话卡（渲染壳：光球面板 + 全局输入栏收编） | №2 | agent-service | dsh参考（ui-conversation/ui-tool 消息模型） | ✅ |
| 命令系统（输入栏命令触发/补全/路由） | №2 附属 | 对话卡 | **dsh参考**（ui-input-trigger + ui-commands） | ⬜ 待设计 |
| 池卡（容器 + 七 tab） | №3 | pool-system | dsh参考（ui-settings/ui-model-selection） | ✅ |
| 文件树卡（DOM 化重写，UI 不变；mode-system 收编） | №7 | tree-data | dsh参考（ui-directory-picker-browse） | ✅ |
| 文件编辑卡（预览+编辑双态；扼点事件化跟随同步） | №13 | file-io | 自研 | ✅ |
| 手（通用多实例 press 件） | №4 | 渲染宿主 + 手势 + 事件 | 自研 | ✅ |
| 窗口卡（完全体：五部件/四元组自配置/收起≠销毁） | №9 | №2 + pool-system | dsh参考（ui-conversation 多实例形态） | ✅ |
| 顶栏（五槽位 broker + tmux 管理；观测台服务端） | №8 | №6 + №1 连接家族 | dsh参考（ui-layout/ui-sidebar 槽位） | ✅ |
| todo 卡（工具附属 UI 卡首例） | №10 附属 | tool-host | **dsh拿来**（todo 工具语义） | ✅ |

## L3 布局与包

| 任务 | 契约 | 依赖 | 来源 | 状态 |
|------|------|------|------|------|
| 全屏层叠布局（默认，手机优先；点卡直接全屏） | №11 | №6 + 渲染宿主 | dsh参考（ui-layout） | ✅ |
| headless 布局（A 档测试 / AI 无头自测） | №11 | 同上 | 接口对齐（headless-agent 先例） | ✅ |
| 启动器插件（卡片堆消解：手势唤出抽屉 → broker 枚举 → 开卡） | №11 | №6 | dsh参考（ui-slots 枚举面） | ✅ |
| 眼睛包（总插件 + 六段；坐标注册） | №5 | dynamic-prompt-files | 自研 | ✅ |
| UI 皮肤包（覆盖层换脸；默认=深蓝意志，v1 重写不收编 theme.ts） | — | L2 | dsh参考（ui-theme 主题机制） | ⬜ 待设计 |
| 动画插件包（v8 动画收编；v1 组件零动画） | — | L3 | 自研 | 🌙 远期 |
| 多端适配包（浮卡工作台，桌面端新写） | — | L3 | dsh参考（web 桌面形态） | 🌙 远期 |

## 文档世界线（工坊层插件化，与运行时并行）

| 组 | 任务 | 契约 | 状态 |
|----|------|------|------|
| A 注册表 | 七字段改造 + 21 条回填规约出处 / 三处滞后修 / 豁免区 / check-mechanism-registry 守卫四件 | 契约 0/2/5 | ✅ 定稿待落地 |
| B 降生链 | `_birth.yaml` 双链 / gen-birth 生成器 / check-birth-wiring / route-table+capability-map 探针破例补 | 契约 1/6 | ✅ 定稿待落地 |
| C 信箱 | 信封四字段 + 回执表入 README / inbox-scan 归属行扫描器 / git 卫生 v0 脚本 + 登记 | 契约 3 | ✅ 定稿待落地 |
| 各族缺口 | 5 个 exp 脚本退役 / docprobe 结晶迁移（probe-capability 迁 scripts/）/ paradigm+harness-studies 归档 / 实验索引考古字段 | 契约 8/9 | ✅ 定稿待落地 |
| 户籍警 | 扫描器 v1 影子（覆盖率进 docs-status 仪表盘）→ v2 增量执法 | 契约 4 | ✅ 定稿待落地 |

## dsh 取材（2026-08-17 拆分：主线取材 vs 远期素材）

原则：**取材非补课**——采用 cordis 后引用现成资产为主，不自写；机制型件
（compaction 策略可换 / hooks / 事件面）的接口形状在步 0 写内核时对齐
cordis service 面。逐项对照与分类依据见 `nine-zero-dsh-sourcing.md`。

**主线取材（已并入各层实现来源列，9.0 验收承诺内）**：

- 直接拿来：session-persistence/projection · compaction 家族（pruner/spill/
  basic 摘要）· todo · context 注入族（time/session-reference/tmux）；
- 参考改造：agent-loop/llm（agent-service）· core/tools（tool-host）·
  guard/scope（permission）· fs（file-io）· terminal-bash（终端连接）·
  ui-input-trigger（命令系统）· ui-conversation（对话卡）· ui-settings
  （池卡）· ui-theme（皮肤）· credentials/settings（pool-system）·
  ui-layout/slots（布局/顶栏/启动器）；
- 接口对齐：boot（启动引导）· headless-agent（headless）· ui-slots 思想
  （渲染宿主）。

**9.x 远期素材（未来功能，不是 9.0 的实现来源）**：

- 编排协作：subagent / workflow / goal / plan / jobs / schedule / hooks /
  skill / feedback（=未来 wechat 模式与 agent 组织层的取材源）；
- 执行：sandbox / subprocess / code-runtime；
- 治理：credentials / identity / session-query / scope（已部分入 pool-system 参考）；
- 集成：mcp / lsp / acp / e2b；
- 观测：runtime-diagnostics / telemetry。

## 开工拓扑（一页版）

```
步 0 四项验证（闸门）
  → L0 内核（Cordis 引入 → 渲染宿主/手势）
  → №6 broker + №15 安全包（影子先跑）
  → 试点三件套（№5 眼 / №4 手 / №6）机制跑通
  → L1 服务群（№10 tool-host + №12 三件套）
  → L2 重卡（№1 终端 / №2 对话 / №3 池卡）→ 其余卡（№7/№13/№9/№8）
  → L3 布局壳 + 启动器（№11）→ №16 启动引导拓扑激活收口
  ∥ 文档世界线 A→C→B + 各族缺口（不碰构建链，随时可启动）
```
