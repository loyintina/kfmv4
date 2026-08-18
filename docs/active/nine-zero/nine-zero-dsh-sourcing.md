# dsh 取材总清单（9.0 任务 × dsh 资产逐项对照）

> 这是什么：把 dsh 能力地图（L0-L4）与 9.0 插件全景/任务图（L0-L3 + 文档世界）
> **逐项对照**的完整取材清单——每项 kfmv4 任务标注 dsh 对应资产与取材分类
> （直接拿来 / 参考改造 / 接口对齐 / 自研）。依据用户原则（2026-08-16 拍板）：
> **能直接拿的绝不自己写，拿来改都比无中生有轻松**。
> 别的去哪找：dsh 地图 → nine-zero-capability-review.md；任务图 →
> nine-zero-dev-task-map.md；全景图 → nine-zero-plugin-map.html；dsh 包清单 →
> `/opt/dsh-src/packages/`。
> 状态：✅ 已会签（2026-08-17 卡萝初稿 → 9.0 线会签通过，见文末；2026-08-18
> 9.0 线口径对账修订：汇总表按逐项对照表重算，幻影项/混档/双档清理——评审
> 文档审计遗留 ① 处理）。

## 对照表（kfmv4 任务 → dsh 资产 → 取材分类）

### L0 内核

| kfmv4 任务 | dsh 对应 | 分类 | 说明 |
|---|---|---|---|
| Cordis 引入 | —（同源） | 已定 | 采用裁决落地 |
| 渲染宿主 | ui-layout / ui-slots（React Slot 注册） | 参考 | 机制不同（kfmv4 是 DOM 容器），但"注册=效果"的 Slot 思想已在契约；dsh 的 slot 枚举/摘除语义可对照 |
| 手势分发 | 无 | 自研 | 桌面 UI 无手机级手势，kfmv4 独有 |
| 启动引导 | boot/app-boot + cmdline | 接口对齐 | 启动链路设计（构建→check→启动→心跳）参考 dsh 的 app-boot 拓扑激活 |

### L1 服务插件

| kfmv4 任务 | dsh 对应 | 分类 | 说明 |
|---|---|---|---|
| card-types broker | host/plugin-inventory | 参考 | inventory 是"枚举全部插件"的面板——broker 的枚举语义同构，交互参考 |
| tool-host | core/tools + 工具注册体系 | **参考改造** | dsh 的 ToolRuntime：注册表/参数 JSON Schema/执行/中止/流式输出——kfmv4 KfmTool 接口已定稿，但错误处理/参数校验/中止链路可直接对照 dsh 实现补强 |
| ledger-service | 无独立包（审计在 guard/日志体系） | 自研 | append-only 简单件，不折腾 |
| session-store | **session 家族：persistence-jsonl/sqlite + projection + checkpoint-policy** | **直接拿来** | 用户点名件；双后端落盘 + 投影缓存（与宪法第四条同构）+ checkpoint——比自研成熟一个量级 |
| pool-system | credentials + settings + model-selection | 参考改造 | dsh 的 provider/model 配置管理（代字化/加密/多源）——池卡的 API/provider 页可对照 |
| agent-service | **core/agent + agent-loop + llm + system-prompt + token-meter** | **参考改造（最大的一块）** | kfmv4 对话管线本质 = agent loop；dsh 的循环（工具调用/流式/重连/压缩集成/SSE）是生产级验证的——**接口形状对齐，实现参考 dsh 而非从零** |
| permission-engine | guard + scope + ui-permission-presets | **参考改造** | 论文 §6.3 访问控制的 dsh 实装：inject=capability、interception=策略——kfmv4 的权限裁决/读写监狱可对照其裁决语义 |
| rule-engine（待设计） | hooks | 参考 | 钩子链机制参考 |
| dynamic-prompt-files | core/system-prompt（组装注册表） | 参考 | system-prompt 的 sections 注册/组装/顺序语义可对照 |
| tree-data | fs + directory-picker | 参考 | 文件系统服务与目录选择 |
| file-io | **fs（带沙箱/权限）** | **参考改造** | dsh 的 fs 服务：读写/沙箱/权限集成——kfmv4 file-io 的权限面可对照（与 permission-engine 联动） |

### L2 卡片插件

| kfmv4 任务 | dsh 对应 | 分类 | 说明 |
|---|---|---|---|
| 试点三件套 | — | 自研 | 机制验证，不取材 |
| 终端卡 | **terminal-bash（PTY 会话管理）+ tool-terminal** | **参考改造** | connection 层（open/input/resize/close/重连）直接参考 dsh PTY 会话；渲染器（xterm）自研 |
| 对话卡 | **ui-conversation + ui-tool** | **参考改造** | dsh 的对话 UI（消息流/工具卡/流式渲染）结构成熟——kfmv4 用自己的渲染壳，但消息模型/工具呈现语义对照 |
| 池卡 | ui-settings + ui-settings-models + ui-model-selection | 参考 | 配置 UI 的形态参考 |
| 文件树卡 | ui-directory-picker-browse | 参考 | 目录浏览交互参考 |
| 文件编辑卡 | 无 | 自研 | Obsidian 式编辑是 kfmv4 特色 |
| 手 | 无 | 自研 | kfmv4 独有 |
| 窗口卡 | ui-conversation 组合形态 | 参考 | 多实例对话窗口的形态参考 |
| 顶栏 | ui-layout + ui-sidebar + ui-slots | 参考 | 槽位机制同构（Slot 注册=效果） |
| todo 卡 | **todo 包** | **直接拿来/参考** | dsh 的 todo 工具语义（面板/持久化）已验证——kfmv4 todo 卡的工具侧可对齐 |

### L3 布局与包

| kfmv4 任务 | dsh 对应 | 分类 | 说明 |
|---|---|---|---|
| 全屏层叠布局 | ui-layout | 参考 | 布局插件化的先例 |
| headless 布局 | **headless-agent（examples）** | 接口对齐 | dsh 有无头模式先例（AI 自测）——同构验证 |
| 启动器 | ui-slots 枚举面 | 参考 | 枚举→开卡流程参考 |
| 眼睛包 | 无 | 自研 | kfmv4 特色 |
| UI 皮肤包 | **ui-theme + dsh-web-ui 皮肤生态** | **参考改造** | 主题 token/皮肤切换机制参考；kfmv4 默认=深蓝意志 |
| 动画包 | 无 | 自研/远期 | GSAP 生态 |
| 多端适配 | web（桌面 React） | 远期 | 桌面端形态参考 |

### 用户点名件（已并入上表，单独列出确认）

| 件 | dsh 资产 | 分类 |
|---|---|---|
| **命令系统** | **ui-input-trigger + ui-commands（斜杠命令输入触发）** | **参考改造**——kfmv4 的输入栏命令体系对照 dsh 的触发/补全/路由语义 |
| **上下文压缩** | **compaction 家族（engine/basic/command）+ tool-result-pruner + spill 家族** | **直接拿来**——pruner（head/tail 修剪）+ spill（超限保存全文+预览）正是 kfmv4 压缩挂点的对标物；compaction-basic 的 llm 摘要解决"摘要机制不成熟"问题 |

## 汇总（2026-08-18 9.0 线按对照表重算对账）

| 分类 | 件数 | 清单 |
|---|---|---|
| **直接拿来** | 3 | session-persistence/projection · compaction 家族+pruner+spill · todo（另：context 注入族=任务图注记的第 4 件，本对照表无行——接口形状对齐，落地随主线评估，见任务图取材节注） |
| **参考改造** | 9 | tool-host（dsh tools）· agent-service（loop/llm）· permission（guard/scope）· file-io（dsh fs）· 终端 connection（terminal-bash）· 命令系统（ui-input-trigger）· 对话卡（ui-conversation）· pool-system（credentials/settings）· 皮肤（ui-theme） |
| **参考** | 12 | 渲染宿主（ui-slots 思想）· broker（inventory 枚举）· rule-engine（hooks）· dynamic-prompt-files（system-prompt）· tree-data（fs/directory-picker）· 池卡（ui-settings）· 文件树卡 · 窗口卡 · 顶栏 · 全屏布局（ui-layout）· 启动器（ui-slots 枚举面）· 多端适配（web 桌面形态，远期） |
| **接口对齐** | 2 | 启动引导（boot）· headless（headless-agent） |
| **自研** | 7+1 | 手势 · ledger · 试点三件套 · 文件编辑卡 · 手 · 眼睛包 · 动画包（远期）＋ 文档世界全部（另计） |
| **已定（同源）** | 1 | Cordis 引入（采用裁决落地） |

> 对账注（2026-08-18）：此前汇总档 4/12/3/12 与对照表不符——「参考/参考改造」
> 混用已按对照表逐项归位；「渲染宿主」双档消除（归「参考」，ui-slots 思想注记保留）；
> 「文档世界全部」移出自研计数另计。

## 边界原则（取材不失控）

1. **契约优先**：dsh 资产与 9.0 契约冲突时契约优先——资产适配契约，不反让契约迁就资产（采用裁决 4）；
2. **过移动端指标**：每个拿来件过步 0-2（bundle 体积/分配率/启动耗时）——不过关降级"参考实现"；
3. **拿能力不拿生态**：拿独立服务插件（session/compaction/pruner），不拿连带重系统（mcp/lsp/acp 除非 9.0 真需要）；
4. **接口形状先行**：步 0 写内核时，压缩/命令/会话的接口形状对齐 dsh service 面——为将来直接引用铺路（任务图已有此原则，此处落到具体件）；
5. **9.x 远期素材不动**：subagent/workflow/wechat 模式/集成类保持 9.x（未来功能不是 9.0 的实现来源）。

## 给任务图的修订建议

1. L1 各任务加"实现来源"列：session-store=**dsh 拿来**；agent-service/tool-host/permission/file-io=**dsh 参考**；压缩挂点=**dsh pruner/spill 拿来**（删掉"纯函数归 lib 层"的误判——pruner 是有状态服务插件）；
2. L2 加"命令系统"任务行（输入栏命令体系，参考 ui-input-trigger）——任务图当前无此行；
3. "dsh 取材层"拆分：9.0 主线取材（本表"直接拿来+参考改造"16 件）从 9.x 远期移入主线标注；9.x 远期只留未来功能素材。

——卡萝 · 2026-08-17（初稿）· 9.0 线会签通过 2026-08-17 · 口径对账修订 2026-08-18

## 9.0 线会签（2026-08-17）

**结论：会签通过，三条修订建议已全部在任务图落实**（逐条核对：L1 实现来源列已加、
L2 命令系统任务行已补、取材层已拆主线/远期）。

逐项抽查意见：

1. **压缩挂点修正接受**——pruner/spill 是有状态服务插件（ctx.toolResultPruner /
   hooks），此前"纯函数归 lib 层"的判断作废；台账指针注记已同步改口。这是本次
   审计最有价值的一击：若按误判走 lib 层，接口形状会与 dsh service 面错位。
2. **agent-service 标"最大一块参考改造"同意**——对话管线本质 = agent loop，
   接口形状对齐 dsh、实现不自造，与契约优先原则不冲突（契约定语义，dsh 供实现参照）。
3. **边界原则五条全部认可**，尤其第 3 条"拿能力不拿生态"——mcp/lsp/acp 留 9.x
   与任务图远期素材节一致。
4. 保留一条观察：「直接拿来」4 件的实际落地仍以步 0-2 移动端指标为闸，
   不过关自动降级"参考实现"（清单第 2 条边界已含此意，执行时不得豁免）。

——9.0 设计线 · 2026-08-17
