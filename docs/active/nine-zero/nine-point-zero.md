> 这是什么：9.0 大重构的**设计地图**——全部内容的功能台账 + 契约索引 + 依赖图 + 推进日志。
> 别的去哪找：拍板结论与决策史 → nine-zero-preface.md（会前酝酿记录）；组件契约正文
> → `nine-zero-phase1-contracts.md`（№1~№16）与 `nine-zero-phase2-contracts.md`（0–9）（已迁出分文件）；评审往来 → ../../ledger/agent-inbox/；
> v8 功能总目录（机械生成）→ ../../domains/capability-map.md；
> 配套材料 → nine-zero-capability-review.md（台账审查+dsh 能力地图）·
> nine-zero-cordis-vendor-18-eval.md（18 条强化评估）·
> nine-zero-implicit-globals-audit.md（隐式全局普查）·
> nine-zero-infra-inventory.md（第二阶段基线：基建层盘点）·
> nine-zero-semantic-map-cordis-side.md（三方语义映射表 Cordis 侧）·
> nine-zero-plugin-map.html（卡萝 2026-08-17 绘：沙漏模型插件全景图，
> archify 交互式，含契约 0–9 机制层 + L0–L3 代码世界分层）·
> nine-zero-dev-task-map.md（开发任务图：全景图的任务版，含 dsh 取材层，派活依据）·
> nine-zero-dsh-sourcing.md（dsh 取材总清单：任务×资产逐项对照，卡萝初稿，
> 2026-08-17 经卡萝审计修正：压缩挂点的 pruner/spill 是有状态服务插件，
> 非纯函数 lib——以取材清单与任务图 L1「压缩挂点」行为准）。

# 9.0 设计地图

> 2026-08-16 立。组织方式：一点一点讨论，写一点、测试、论证审核复查审计、再推进
> （spec-driven 元工作流）。**台账先行，逐插件填充**——每行归宿拍板后，契约讨论
> 成熟一个定稿一个（正文暂记 nine-zero-preface.md，转正时迁出）。
>
> **全覆盖军规（2026-08-16 拍板）**：本台账 + 共享基础件表 + 域外表合计必须覆盖
> v8 src/ 全量 36,012 行 / 152 文件——每行要么有契约、要么有归宿、要么明确拍板
> 移除。防 7→8 跨版本信息丢失重演。基线盘点：已规划 22,681 行（63.0%，扣语料/
> 生成物后纯逻辑约 56%），未规划 13,331 行已全部登记入下表（带 Ⓟ 行数标注）。
>
> **第二阶段军规（2026-08-17 拍板，与第一阶段同款）**：基建层六族每一项
> （86 脚本 / 124 文档 / 163 测试 / 21 机制 / 5 实验线）要有归宿——有契约、
> 有归属、或明确拍板不动。基线 = nine-zero-infra-inventory.md。原则：
> 机制能到的地方 = 干净（覆盖率即清洁度）。

## 设计原则（拍板于 nine-zero-preface.md，此处索引）

- 一切皆插件：内核只留 ctx 基座（事件总线 / inject 引擎 / 生命周期 / 渲染宿主）+
  手势分发；**服务即插件**（服务与卡片同为插件，仅 provide 内容不同）；
- **插件化的是"效果"不是代码**（2026-08-16）：纯函数库无注册/订阅/状态，import
  即用，是 lib 层不入插件体系；有状态、有注册表的件才做成服务插件；
- 三状态归属表：登记类逆序摘 / 发射类不撤 / 数据归数据管理器；插件只持私有草稿；
- 布局 = 卡片摆放管理（一种语义）；tmux 是全屏卡片；动画整体插件化，组件 v1 零动画；
- 池结构：agent = 组合（prompt × model × 工作区），箭头只向下，引用即 relied；
- 契约模板对齐 NA 规格书 §8 九字段 + apply/unload 两栏不得缺栏；卸载三相 +
  take-once + 观察等价；事件逐条标派发模式；
- 验收哲学：不用的干净消失，需要的随时召唤；**抽文件测试**判据（执行两式：
  变异抽检 / 配置禁用；恢复 = 重构建后）；
- 迁移法：绞杀者两步走（数据管道换心 → 搬进新容器）+ 功能一致对照表 +
  保留性考题三条。

## 组件台账（v8 全部内容 → 9.0 归宿）

### 内核（不可插拔，目标压到最小）

| 件 | 来源 | 状态 |
|----|------|------|
| ctx 基座（事件总线 / inject 引擎 / 生命周期） | **采用 Cordis 本体**（cordis@4.0.0-rc.7 锁版本进 lockfile，升级契约化归 9.0 线；契约优先：Cordis 是承载，9.0 纪律是宪法）；自研收窄为渲染宿主+手势分发（№14） | ✅ 采用拍板（2026-08-17 用户终审）· 步 0 四项验证中 |
| 渲染宿主（DOM 容器 / 摘容器 API） | 新建（v8 无此物；容器生灭唯一入口，宿主给盒子/布局摆盒子/卡填盒子） | №14 | ✅ 定稿 <!-- covers: z-index-layers.ts --> |
| 手势分发 | v8 gesture-registry Ⓟ346 收编 + 两补丁（ctx 效果注册 / 优先级层带公约） | №14 | ✅ 定稿 <!-- covers: gestures.ts --> |
| 启动引导 | main.ts 131 + app.ts 130 + app-lifecycle 20 + logger 57 + version-watch 59 Ⓟ397——拓扑激活；调试桥删；错误直报+version-watch 留 boot | №16 | ✅ 定稿 <!-- covers: dom-refs.ts --> |
| ws 服务端对 | ws-server Ⓟ323 一拆三：传输通道=壳基建+推送通道服务 / PtyManager→№1 / page-state→№5 | №16 | ✅ 定稿 <!-- covers: ws-channel.ts --> |
| canvas UI 引擎 engine/v2 | Ⓟ2703（v8 文件树/浮卡的 canvas 底座） | ❌ 已拍板退役清理（№7 DOM 化+浮卡降级后无消费者，9.0 落地即删；2026-08-16 小件轮） <!-- covers: renderer-lifecycle.ts --> |

### 服务插件（数据管理器阶层）

| 服务 | 收编 v8 内容 | 契约 | 状态 |
|------|--------------|------|------|
| card-types broker | 卡片注册表（155 行）+ singleton 声明（修订注） | №6 | ✅ 定稿 <!-- covers: card-registry.ts --> |
| tool-host 工具宿主 | tools/index.ts 170 + types.ts 109 框架；各工具插件：omp/browser Ⓟ2422 / omp/debug Ⓟ1274 / 小工具群 Ⓟ677 / 自指工具 Ⓟ323（含 kfm-hand-press、restart） | №10 | ✅ 定稿 |
| ledger-service 账本 | tool-exec.jsonl 机制提为通用 append-only 服务（执行账/裁决审计/操作审计） | №10 附属 | ✅ 定稿 |
| session-store | 会话存储与压缩（sessions/）+ routes/compact.ts Ⓟ126；落盘纪律自管（承重墙） | №12 | ✅ 定稿 |
| pool-system | API卡/角色卡/配置卡/会话卡的数据层 + routes/proxy Ⓟ93 + routes/providers Ⓟ65 + env-store Ⓟ102 + **workspaces/ 点亮**（agent 工作区维） | №3 附属 + №12 | ✅ 定稿 |
| agent-service | 流式对话 / 工具循环 / prompt 装配线 + **server 对话管线：chat.ts Ⓟ571 / run-manager Ⓟ239 / routes Ⓟ160** + prompts/ 模板库（global/system/tools，装配数据源） | №2 附属 + №12 | ✅ 定稿 |
| rule-engine | 规则引擎 + ai/rules/ 5 文件（commit-after-change 等；№12 装配线数据源，规则归此） | №12 附属 | 待设计 |
| dynamic-prompt-files | prompts/dynamic/ 目录管理 | №5 附属 | 待设计 |
| tree-data | 懒加载（tree-loader / list-recursive） | №7 附属 | 待设计 |
| file-io | routes/files.ts 文件 CRUD Ⓟ457（池文件与通用读写走它） | №12 附属 | 待设计 |
| theme | ~~theme.ts~~ UI 皮肤包 v1 重新实现，不收编 v8 | — | 已拍板（2026-08-16 小件轮） |
| permission-engine | 权限裁决 + 读写监狱（permissions.ts + path-utils.ts 路径监狱 Ⓟ171）+ ask 批准卡 + 审计 | №15 | ✅ 定稿（安全包形态；影子转正真拦截；宿主基线留 tool-host） |
| style-registry | Ⓟ161 树样式 canvas 来源——随 engine/v2 退役 | — | ❌ 已拍板退役（2026-08-16 小件轮） |
| ~~tool-compaction~~ | 纠偏：纯函数+静态表，归 lib 层；挂点=agent-service 投影链（№12 修订注） | — | 已拍板归 lib（2026-08-16） |

### 卡片插件

| 卡 | 收编 v8 内容 | 契约 | 状态 |
|----|--------------|------|------|
| 对话卡（渲染壳）→ 窗口卡（完全体） | 光球面板 + 会话聊天面板 + 全局输入栏收编 | №2 + №9 | ✅ 定稿 <!-- covers: orb.ts, orb-panel.ts, orb-state.ts, orb-chat.ts, orb-chat-run.ts, orb-chat-host.ts, orb-chat-hints.ts, chat-dom.ts, session-client.ts --> |
| 终端卡 / tmux 卡 | terminal-card-04 + tmux-card + server terminal-pty.ts（PTY 会话管理，归 №1 连接家族） | №1 | ✅ 定稿 <!-- covers: terminal.card.ts, tmux.card.ts --> |
| 池卡（七 tab） | API/角色/配置/会话/工具/脚本卡 | №3 | ✅ 定稿 <!-- covers: role.card.ts, session.card.ts, api.card.ts, tools.card.ts, scripts.card.ts, config.card.ts, drag-handler.ts --> |
| 文件树卡 | Canvas 文件树重写（DOM 化，UI 不变）+ mode-system Ⓟ446（copy/move/delete 模式工具栏，读码消解归此） | №7 | ✅ 定稿 <!-- covers: tree-render.ts, tree-model.ts, tree-swipe.ts, file-action-bar.ts, sibling-switcher.ts --> |
| 手 | hand.ts（通用多实例） | №4 | ✅ 定稿 <!-- covers: hand-geometry.ts --> |
| todo 卡 | todo 工具的面板呈现 | — | ✅ 已拍板：工具附属 UI 卡（工具经 №6 注册卡类型，todo 为首例） |
| apk 卡 | apk.card Ⓟ71 + download/apk 端点同退 | — | ❌ 已拍板移除（8022 直连手机 + NA 侧直接编译，2026-08-16） |
| 文件编辑卡 | file.card Ⓟ18 壳 + handler-factory Ⓟ296 + lib 渲染器集群；预览+编辑双态、自动保存、checkbox 写回；扼点事件化跟随同步 | №13 | ✅ 定稿 |
| 日志卡 | debug.card Ⓟ110 | — | ❌ 已拍板移除 |
| 范式卡 | paradigm.card.ts | — | ❌ 已拍板移除（范式包取消，卡随同） |

### 包（bundle）

| 包 | 内容 | 契约 | 状态 |
|----|------|------|------|
| 眼睛包 | 总插件 + 六段 | №5 | ✅ 定稿 <!-- covers: viewport-visibility.ts, ui-registry.ts --> |
| 池卡 | 容器 + 七 pool-page | №3 | ✅ 定稿 |
| UI 皮肤包 | **覆盖层（换脸）**：主题/配色/质感；theme.ts 不收编、v1 重写；功能自带基础 UI（2026-08-16 澄清） | — | 待设计（已拍板皮肤可插拔 2026-08-16） |
| 安全包 | 权限裁决+读写监狱+ask 批准卡+审计（一文件夹一包第二实例） | №15 | ✅ 定稿 |
| 动画插件 | v8 交互动画收编：GSAP / 双树 overlay / 字符雨 / 徽标引擎 Ⓟ493 / 光标液体粒子 liquid-geometry Ⓟ108 / canvas-cursor Ⓟ392 / animation-registry Ⓟ75 | — | 远期（v1 组件零动画） <!-- covers: tree-overlay.ts, tree-animation.ts, char-rain.ts --> |
| 多端适配包 | 浮卡工作台（桌面端布局插件，未来新写，v8 代码留仓参考） | — | 远期（2026-08-16 拍板降级） |

### 布局与壳

| 件 | 说明 | 状态 |
|----|------|------|
| 全屏层叠布局（默认，手机优先） | 启动器点卡直接全屏；保留全屏关闭 UI；取消浮卡切换 UI | №11 ✅ 定稿 |
| headless 布局 | 同接口不渲染（A 档测试 / AI 无头自测） | №11 ✅ 定稿 |
| 卡片堆 → 启动器插件 | 手势唤出抽屉（UI 保留）→ broker 枚举 → 开卡；摆放归布局 | №11 ✅ 定稿 <!-- covers: card-stack.ts --> |
| tmux 全屏卡 | 全屏层叠语境下的全屏卡（议题 1 下钻语义不变） | №11 语境 ✅ |
| 浮卡工作台 | v8 floating-card Ⓟ810 + fullscreen Ⓟ213 + shared Ⓟ172 不迁移留仓 | → 多端适配远期包（用户拍板 2026-08-16） <!-- covers: floating-fullscreen.ts, floating-shared.ts --> |
| 顶栏（槽位 broker + tmux 管理） | 徽标/余额/系统三格/光球/tmux 五槽位；tmux 逻辑归 server 服务；routes/obs.ts 观测台服务端归此 | №8 ✅ 定稿（含 slot-sys 修订注） <!-- covers: obs-emblem.ts, obs-hud.ts --> |
| OBS HUD / 徽标 | ✅ 消解：HUD=顶栏本体（归 №8）；徽标动画引擎归动画插件；坐标注册归 №5 | — |

### 共享基础件（lib 层，非插件——"效果非代码"原则 2026-08-16）

| 件 | 行数 | 说明 |
|----|------|------|
| md 渲染器集群 | Ⓟ740 | renderers/：handler-factory / math-diagram / code-highlight / md-* / 预览回退 |
| 通用 UI 件 | Ⓟ549 | custom-select 245 / confirm-dialog 191（=各契约引用的 showConfirm）/ card-toast 52 / color-utils 45 / debug-assert 16 <!-- covers: card-ui.ts --> |
| canvas 交互件 | Ⓟ476 | canvas-scroll 358 / canvas-utils 60 / click-queue 38 / interaction-constants 20 |
| shared 协议层 | Ⓟ571 | chat-protocol 542（to-openai-messages / reducer）+ message-normalize 29 <!-- covers: chat-protocol/events.ts, chat-protocol/block-idx.ts --> |
| 工具 I/O 压缩（tool-compaction） | Ⓟ369 | 纯函数+静态表；挂点=agent-service 投影链（№12 修订注）；双向核对检查脚本留运维域 |
| 数据语料 | Ⓟ1107 | waiting-hints.ts（等待提示语料，归窗口卡包内数据，不是逻辑） |
| 生成物 | Ⓟ1354 | scripts-catalog.ts（构建期生成，归池卡包数据源） |
| **依赖引入：cordis 本体** | 外部依赖 | 归宿类型「依赖引入（lib 层）」首例（裁决 6，2026-08-17 生效）：cordis@4.0.0-~~rc.7~~ **rc.8** 锁版本进 lockfile（2026-08-18 用户拍板改锁 rc.8：未开工直接用新版，rc.7→rc.8 已知差异=LoggerLevel 枚举数值对调/emit 循环化/Caller 机制，对新建代码无影响，diff 档案入任务图审计记录）；升级评估归 9 线（回归判据=考题全绿+试点三件套+576 基线不许降）；考题不因采用而减少 |

### 域外（不进 9.0 运行时插件体系）

> 边界声明（2026-08-16，拍板修订）：本层是**工坊不是产品**——不跑在 app 运行时里。
> 但插件思想同样适用（文档系统即插件系统方向已拍板，信箱=文档系统的 ctx）：
> 基建层的插件化组织 = **9.0 线第二阶段，设计权归本线**——9.0 主题是重构，
> 文档系统/脚本管线同属重构对象，不该踢回主开发线。复用 9.0 自己的纪律工具
> （契约模板 / 三状态归属 / 效果判据 / 军规）。运行时 16 契约定稿后进入。

| 内容 | 处置 |
|------|------|
| 运维 10 项（检查链/文档系统/错误码/agent-runner/守视/语义审计/部署/回归） | 项目基建，留在 server/scripts，非运行时插件 |
| 研究 4 项（paradigm/coldstart/docprobe/session-runner） | experiments/ 不动；paradigm 池卡已拍板取消 |
| tests/ Ⓟ8090 | 测试基建，随重构整体重写（绞杀者两步走的对照基） |
| server/index.ts Ⓟ187 入口 | 服务端引导，归 server 壳（同客户端启动引导待遇） |

## 依赖图（已定稿部分）

```
内核 ctx ── 手势分发 / 渲染宿主
  └─ card-types broker(№6, +singleton)
       ├─ 终端卡(№1) ← term-renderer / term-connection
       ├─ 对话卡(№2)/窗口卡(№9) ← agent-service / session-store / 基础四池(读)
       ├─ 池卡包(№3) ← pool-system ← persistence
       ├─ 文件树卡(№7) ← tree-data
       └─ 手(№4) ← render-host / gestures / events
  └─ dynamic-prompt-files ← 眼睛包(№5)（段 ← 布局服务直读几何）
  └─ 布局插件（全屏层叠默认 / headless；浮卡 → 多端适配远期）← 渲染宿主
  └─ 顶栏(№8) ← 槽位插件（徽标/余额/系统三格/光球/tmux标签）；tmux 服务归 №1 连接家族
  └─ tool-host(№10) ← 工具插件包（core-tools / kfm-tools / browser / debug）
       ← permission-engine（闸①②裁决）/ ledger-service（闸④账本）
  └─ agent-service(№12) ← tool-host / session-store(№12) / pool-system(№12)
       ← file-io；workspaces/ = agent 工作区维（pool-system 管）
```

## 推进日志

- 2026-08-15：会前酝酿立档（nine-zero-preface.md）；议题 1 / 议题 1 下钻 /
  议题 3 / 服务即插件 / 契约模板 / 验收哲学 / 试点顺序拍板；契约 №1~№3 定稿；
  评审七条 + 茉莉本体视角全采纳落档。
- 2026-08-16：契约 №4~№7 定稿；动画整体插件化拍板；抽文件测试判据化；
  评审两轮（进度评审 3 条 / broker 契约评审 3 条）全采纳闭环；**设计地图立档**；
  契约 №8 顶栏定稿（槽位 broker + tmux 管理服务，事件驱动，清空需确认+审计）+
  slot-sys 修订注；零碎裁决轮：权限引擎提为服务插件 / todo 卡=工具附属 UI 卡首例 /
  OBS HUD 消解归 №8；契约 №9 窗口卡定稿（五部件/挂点/四元组自配置不命名/
  启动器统一入口/收起≠销毁）+ №6 singleton 修订注；**全覆盖盘点**：src/ 36,012 行
  基线，已规划 63%，未规划 13,331 行全部登记入台账（工具宿主列为 №10 候选）；
  "效果非代码"原则 + 全覆盖军规拍板；
  契约 №10 工具宿主定稿（骨架固定+闸可插拔+只收不放 / 四家族归堆 /
  重子系统懒加载 / ledger-service 同稿）；UI 皮肤包拍板（默认=深蓝意志）；
  契约 №11 布局壳定稿（全屏层叠默认+headless / 浮卡降多端适配远期包 /
  点卡直接全屏）+ №9 几何户口简化修订注；mode-system 读码消解归 №7；
  契约 №12 服务层三件套定稿（persistence 不新建 / workspaces 点亮 /
  active.json 葬礼）；r3 评审五条全采纳（№9/№7 修订注 + 契约模板升格四条 +
  军规判据强化：归宿=可执行迁移路径）；小件清零轮：apk 卡废弃（8022 直连）/
  文件卡正名=文件编辑卡（№13 候选，"带 AI 入口的 Obsidian"）/ tool-compaction
  纠偏归 lib + 投影链挂点（№12 修订注）/ 主题 UI 包 v1 重写 / engine/v2 Ⓟ2703
  拍板退役清理（style-registry 随同）；文档重组：9.0 文档群迁入 nine-zero/ 目录；
  **Cordis 本体采用裁决通过**（信箱 verdict：走 (c) / 锁版本+升级契约化 /
  总注+差异注 / 步 0 四项验证为闸门；落地清单 9.0 线主笔步 0）；
  台账军规首次实战：卡萝审查抓 5 处缺口全部补行；三份新材料
  （18 条评估/隐式全局普查/能力审查+dsh 能力地图）9.0 线会签通过；
  契约 №14 内核自研件定稿（渲染宿主三分 / 容器生灭唯一入口 /
  手势层带公约 / 验收三数字）；契约 №15 安全包定稿（v8 权限文档转正 /
  影子转正真拦截 / ask 内联窗口卡 / 注册强制 riskClass / UI 包=覆盖层澄清）；
  契约 №13 文件编辑卡定稿（全局单例全屏卡 / 扼点事件化跟随同步 /
  AI 入口浅层 + 远期方向记录 / textarea 内核 v1）；契约 №16 启动引导与通道
  定稿（拓扑激活 / 调试桥删 / ws-server 一拆三）；域外边界声明：
  基建层插件化=议题 6 归主开发线，复用 9.0 纪律工具 → **拍板修订：
  归 9.0 线第二阶段，设计权归本线**（9.0 主题是重构，文档系统/脚本管线
  同属重构对象；运行时 16 契约定稿后进入）。
- 2026-08-17：**双终审落档**——① Cordis 采用用户终审通过（六项裁决+两附加
  全生效；台账内核行改采用、归宿类型新增「依赖引入（lib 层）」；步 0 四项
  验证正式启动，preface 总拍板+语义映射表待步 0 通过后落地）；② 第二阶段
  开篇命题定稿（四方表态全采纳：沙漏模型+三界定 / ctx=Σ+事件+累积器(git)
  三元组 / 机制三件套+生命周期嵌套三相+两种红+死后访问判红 / 开篇四块
  0 机制形式定义→1 降生协议→2 broker 扶正→3 信箱事件面 / 即刻手工纪律
  两条 / 三方语义映射表两线各半）；**契约 0 机制三件套形式定义定稿**
  （判定三问 / 注册表七字段（+规约出处+状态，21 条存量待回填）/
  升级触发器=真实事故 / 运行时模板裁剪变体）；**契约 1 降生协议定稿**
  （八步全新降生链+步 0 身份定位 / 四步会话重生链 / 断言两档=结构机检
  两件套+coldstart 认知考卷 / `_birth.yaml` 元工作流沿用下划线惯例）；
  **契约 2 机制注册表扶正 broker 定稿**（broker=清单+机械守卫+退役协议
  不新造实体 / 守卫四件只守现实锚点 / 递归终止：broker 停滞靠降生发现+
  抽查 / 豁免区同文件 / 21 条存量回填两列）；**契约 3 信箱事件面定稿**
  （四流型+完成判据 / 信封四字段 / 回执按流型 / 状态列=投影+归属行
  扫描器+代际戳 / git 卫生 v0 升机制 / N:N 只登记形状名 / push 缓建）——
  **第二阶段开篇四块全部定稿**；**第二阶段军规拍板**（六族每项有归宿，
  基线=infra-inventory，机制覆盖率即清洁度）；文档户籍管辖范围拍板
  （全项目机制可达文档，至少含实验区，法外之地走显式豁免）；
  **契约 4 文档户籍机制定稿**（入户最小三样：层级推导/消费者/户籍状态 /
  单扫描器三分流 / 影子先行 v1 丈量 v2 执法 / 存量三胚胎并立 / 原则注记：
  建造放开采纳收紧）——六族逐族契约开张（文档系统族）；
  **契约 5 检查链族定稿**（59 步零漂移 / 缺口：30 黑户+23 裸奔+注册表
  三处滞后 / 登记按机制群归行 / 探针增量必带存量撞墙补 / 对账方式随契约 2
  守卫机制化）；**契约 6 生成器族定稿**（8/11 探针，缺的恰是 route-table
  +capability-map=发现面大腿 → 破例提前补入 B 组 / 原则入契：可推导事实
  必须生成不许手写）。
- 2026-08-17（续）：**契约 7 部署运维族定稿**（登记两行：部署运河+数据
  卫生 / 失效信号覆盖陈旧不覆盖死亡 → kfm-restart 借版本握手死后显形 /
  auto-push 外向条件入登记行 / **kfm-restart 退役判据=热重载落地+用量
  归零**——契约 0 退役流程第一个预定案例）；**契约 8 agent 运行时族定稿**
 （5 个一次性 exp 脚本退役=退役流程首实战 / 登记客观功能三行+观测建议行 /
 设计出处注记 / 契约 0 修订注：失效信号分确定区·概率区）；**契约 9 实验族
 定稿——六族收官**（门内自由门口登记 / 三结局：结晶=活件迁出壳归档
 （机械判据：被链上引用即毕业）/归档/删除 / 五线归宿定案 / 索引考古优化）。
 **第二阶段设计讨论完整**。
- 2026-08-18：**任务图 v3 落地**（8.x.y 小版本串行 + 终端/tmux 优先 +
  工坊线 D1–D6 同步发版 + 替换即删旧 + 用户可见性硬规则）；**小步预排
  29 步并入版本策略节**（内容/契约/前置/验收/删旧/Rust 内核六列 + 全局
  DoD 七条 + 编号纪律 + 验收分层；独立清单文档立后即撤——限制文档数量）；
  **NA 协同路径与 Rust 共享内核立节**（关系式：9.0 出规格/crate 出实现/
  两端各自包壳；分层判据——共享 crate 三条件 vs 专有 WASM 实测驱动；
  终端芯定案 alacritty_terminal，kfm-na 全量调查证伪「终端库只能自研」；
  九项共享内核清单 + dsh 拿来件 Rust 化评估 + 共享 crate 接口冻结点）；
  NA 协同信投信箱，**NA + 评审表态全收**（证伪入裁决史 / 分工接受 /
  三认领按时机挂起 / 互证基准=解析层计时升格正式口径）；评审文档审计
  口径遗留四项处理：dsh-sourcing 汇总对账重算 ✅ / plugin-map.json 眼睛
  双档消除 ✅ / 本节待讨论残留清理 ✅ / cordis-na 侧映射稿留 NA 线自处。
- 2026-08-18（续）：**步 0 执行与总拍板**——0-1 守视实拍 PASS / 0-2 三数字
  实测齐+茉莉会签达标（附达标线三条）/ 0-3 存量普查满足 / 0-4 经用户
  拍板拆分（0-4a 基准设定 ✅ 闸门认项；0-4b NA 互证归 8.7.2——原口径
  与 NA 交付窗口构成循环依赖死锁，案例移交审计线）；**锁定版本 rc.7→rc.8**
  （用户拍板：未开工直接用新版；rc.8 全量复测等价，diff 档案=LoggerLevel
  枚举对调/emit 循环化/Caller 机制，升级评估首例）；茉莉 rc.8 平移确认
  用户指示跳过；**闸门纪律三件套兑现**（preface 总拍板节 + 语义映射表转正
  + 试点三件套重定向 Cordis 生效 + 卸载遗言差异注落地），**8.7.1 开工授权
  生效**；8.7 前置容器生灭点位普查闭环（灭侧对照全表 26 行 + 宿主 API 四
  设计要件入 №14 修订注②）；8.7.1 接线六点定稿入任务图表下注。
- 2026-08-18（续）：**8.7.1 完成关账**（cordis@4.0.0-rc.8 锁版入 lockfile +
  ctx.ts 内核 + node 钉子 5 条 + cordis d.ts node16 补丁 postinstall——升级
  评估物理触发点；tsc/构建链/守视浏览器实测全绿，churn 2000×2 无泄漏）；
  守视文本化通道（snapshot DOM 语义树 / --text 文本流 / ascii chafa 两档——
  无视觉模型看网页）；**版本策略 v3→v4：发版冻结**（用户拍板：9.0 完成前
  小步只作进度标记，不发版不 tag，全部完成一次性 v9.0.0；tag-advisor 系
  挂起休眠；check-versions 零改动天然兼容）；tag-advisor 排障确诊
  deepseek-v4-flash 默认开思考致 agent-runner 空响应（非 key 问题），
  抽取型负载显式关思考修复，通用健壮性与事故记录见 ledger/bugs.md。
- 2026-08-18（续）：**kfm-nz 另起炉灶拍板**——9.0 代码实现不在 kfmv4 内
  绞杀：另立外置纯代码项目 kfm-nz（kfmv4 不动照住；nz 只放代码不建新
  文档系统，kfmv4 nine-zero 文档即规格书；独立端口；Cordis 根总线起步
  逐插件做/移植；成功后整体迁入 kfmv4 src/ 正名发 v9.0.0）。设计资产
  分流：插件设计契约全部保留为 nz 规格书；kfmv4 内部收编类设计作废登记。
  **工坊线 D1–D6 整体推迟**（六族契约 0–9 实施冻结，设计稿保留定稿；
  代码完成后重评重建——文档世界是影子世界，代码换血后形态需求会变）。

## 待讨论

- **域外运维工具活性探针（2026-08-18 用户指示"先记录"）**：8.7.1 排障暴露
  ——scripts/agent/ 域外工具（agent-runner/tag-advisor/守视等，契约 8 拍板
  不动架构）没有失效信号，provider 行为漂移（v4-flash 默认开思考→空响应）
  无人预警，全靠跑时炸。候选方案：`~/.kfmv4/ledger/agent-calls.jsonl`
  既有账本（每笔调用落盘）加失败率/空响应率异常观测，接 M3 基线前扫雷。
  不违反契约 8 拍板不动项（只加观测不加架构）。暂缓实施，记录待议。
- ~~内核：ctx 基座待 Cordis 采用终审~~ → ✅ 用户终审通过（2026-08-17）；
  ~~步 0 四项验证~~ → ✅ **步 0 全过 + 总拍板（2026-08-18）**：0-1 守视实拍
  PASS / 0-2 茉莉会签三数字达标（达标线三条随附）/ 0-3 存量普查 / 0-4a
  基准设定（0-4b NA 互证拆分归 8.7.2，死锁解锁）；锁定版本同日改 rc.8
  （复测等价），茉莉 rc.8 平移确认用户指示跳过；闸门三件套兑现（总拍板 +
  语义映射表转正 + 试点三件套重定向 Cordis 生效），见 preface「步 0 全过：
  总拍板」节——**8.7.1 开工授权生效**；
- ~~第二阶段契约讨论（契约 0→9 逐块）~~ → ✅ 契约 0–9 全部定稿（2026-08-17，
  定稿史见推进日志）；**当前：落地清单执行（A 注册表/B 降生链/C 信箱 +
  各族缺口）与步 0 四项验证两线择一启动**；2026-08-18 任务图 v3 落地
  （8.x.y 小步串行 + 29 步预排 + NA 协同/Rust 内核节），NA/评审表态全收；
- **契约候选：文档户籍机制** → ✅ 定稿（契约 4，2026-08-17：入户最小三样 /
  单扫描器三分流 / 影子先行 v1 丈量 v2 执法）；
- 窗口卡完全体的剩余工程细节（№9 已定骨架 + 几何户口简化修订注）；
- 远期议题：termview-wasm / 协作基建（拍板修订：归 9.0 线第二阶段）/ wechat 模式 /
  文件卡 AI 原生操作（工具调用可视、AI 按行操作、手动画配合——№13 记录）/
  **agent 组织层**（自动化公司方向：管理/执行/审查分工——角色从真实重复工作
  结晶，组织架构不先行设计；现存胚胎：四线协作 + agent-runner + 语义审计
  五件套；未来取材 = dsh L2 编排协作族；用户 2026-08-17 提议登记）。
- 远期取材清单（dsh L2 能力族，9.x 候选插件，登记防遗忘——2026-08-16 对照
  nine-zero-capability-review.md dsh 能力地图）：记忆与上下文族（session
  projection/title-llm/checkpoint、compaction 引擎家族、context 注入族、spill
  族、attachment）/ 编排协作族（subagent/workflow/goal/plan/jobs/schedule/
  hooks/skill/feedback）/ 执行族（sandbox/subprocess/code-runtime）/ 治理族
  （credentials/identity/session-query/scope）/ 集成族（mcp/lsp/acp/e2b）/
  观测族（runtime-diagnostics/telemetry）。原则：取材非补课——采用 cordis 后
  引用现成资产为主，不自写；机制型件（compaction 策略可换 / hooks / 事件面）
  的接口形状在步 0 写内核时对齐 cordis service 面，第一阶段不为此加契约。
