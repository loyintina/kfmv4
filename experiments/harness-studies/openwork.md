# OpenWork harness 研究报告

> 研究日期：2026-08-02。只读研究，未改动任何仓库代码。
> 关联冷启动实验：`experiments/coldstart/reports/06-harness-behavior.md`（五 harness × 124 臂）。

## 0. 身份澄清（2026-08-02 复核）：两个「OpenWork」

本报告研究的对象是 **`different-ai/openwork`**（Claude Cowork 开源平替，opencode 系编排层，
2026-02 起，独立组织 different-ai）。**与吴恩达（Andrew Ng）团队的 OpenWorker 是两个项目**：

| | different-ai/openwork（本报告对象） | andrewyng/openworker（吴恩达团队） |
|---|---|---|
| 定位 | Cowork 平替，opencode 反代+编排层 | 桌面 AI 同事，交成品不交聊天 |
| 技术栈 | TS（Electron+自研 server → opencode fork） | Python（coworker/ 引擎，基于 aisuite）+ Tauri GUI |
| 连接器 | opencode 工具面 | 25+ 集成（GitHub/Slack/Jira/Notion…）+ MCP 可插拔 |
| 审批 | opencode 审批流 | 写/发送/shell 命令审批门控，无人值守停在收件箱 |
| 发布 | 2026-02 | 2026-07-24 开源 beta（GitHub 3.7k+ star） |

两者都验证「harness 决定行为」主题：openwork 用提示词分段注入+动态分支，openworker 用
审批门控+连接器面。openworker 的 Python/aisuite 架构与本报告无关，如需对比研究另立篇目。

## 1. 仓库来源与版本

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/different-ai/openwork |
| 定位 | Claude Cowork / Codex 的开源平替，**powered by opencode** 的桌面端（Electron + React + Vite） |
| 克隆 commit | `5fa41c4d18f2b9ac39cce1ca2cca1b0dfea429fe`（2026-08-01，`dev` 分支浅克隆 depth=1） |
| 克隆位置 | `/tmp/openwork` |
| 应用版本 | `@openwork/app` 0.18.12（`apps/app/package.json`） |
| 捆绑 opencode | **`anomalyco/opencode` v1.17.11**（`constants.json` 固定版本，非 sst/opencode 主线） |
| 注意 | 同名项目 `modelstudioai/openwork`（阿里云百炼桌面端）与本主题无关；`langchain-ai/openwork` 亦为同名不同物。本报告仅指 different-ai/openwork。 |

**架构层级总览**（三层，agent loop 不在 OpenWork 手里）：

```
Electron 壳（apps/desktop/electron/runtime.mjs，1932 行）
  └─ 进程生命周期 / 端口分配 / token 管理 / 系统 CA 注入
OpenWork server（apps/server，embedded，node 内嵌 HTTP）
  ├─ 会话/工作区/审批/审计编排（自研）
  └─ opencode 代理（/workspace/:id/opencode/* 反代 + 鉴权门）
opencode server（anomalyco fork v1.17.11，managed 子进程）
  └─ 真正的 agent loop：模型调用、工具执行、消息流、权限（外来组件）
```

核心判断：**OpenWork 的「harness」本质是 opencode 的编排层 + 提示词注入层**，agent 主循环（turn、工具执行、压缩）全部委托给 opencode。这与 kfmv4 面板「自带循环」的设计取向相反。

---

## 2. harness 核心架构

### 2.1 agent 循环结构（turn 管理 / 工具编排 / 错误处理 / 超时）

**turn 管理完全外包给 opencode**，OpenWork 只做三个动作：

1. **创建会话**：`POST /workspace/:id/sessions`（`apps/server/src/routes/sessions.ts:212`），可带 `title` 与可选的启动 `prompt`（≤100_000 字符，`:222`）。
2. **发 prompt（异步）**：`opencode.session.promptAsync` → `POST /session/:id/prompt_async`（`apps/server/src/routes/sessions.ts:115`；前端封装 `apps/app/src/app/lib/opencode.ts:458`）。一次调用即一轮 turn 的投递，不维护自己的状态机。
3. **订阅事件**：`client.event.subscribe`（`apps/app/src/react-app/domains/session/sync/session-sync.ts:77`），消费 `session.updated` 等 SSE 事件做前端同步。会话状态由 opencode 定义：`idle / busy / retry`（`apps/server/src/session-read-model.ts:31`）。

**错误处理**：
- opencode 上游错误统一 remap 为 ApiError：400 → `invalid_query`、404 → `session_not_found`（`apps/server/src/routes/sessions.ts:65-78`）。
- 代理层 `assertOpencodeProxyAllowed` 做 scope 门禁（viewer 只读、collaborator 可写、`server.ts:806-834`），防止 viewer 自我批准权限。
- 前端 `unwrap()` 把 `FieldsResult` 的 error 抛成 Error（`apps/app/src/app/lib/opencode.ts:340`）。

**超时/看门狗**：
- 请求层：`fetchWithTimeout` 默认 10s；`prompt_async`/`command`/`summarize` 等长运行 URL 豁免超时（`opencode.ts:67, 224`）；SSE 流永不超时（`opencode.ts:284-318`）。
- 进程层：managed opencode 启动 15s 超时（`managed-opencode.ts:104`）；关闭时 SIGTERM → 1s 宽限 → SIGKILL（`managed-opencode.ts:144-161`）。
- 生命周期队列：`withRuntimeLifecycle` 串行化 engineStart/Stop/Restart，防并发互相杀进程（`runtime.mjs:1070-1084`）。

### 2.2 系统提示词/预设注入（本报告最值得看的部分）

OpenWork **没有角色卡/人格文件**，而是通过 **opencode 插件钩子 `experimental.chat.system.transform`** 在运行时向系统提示词追加分段文本。全部插件在 `apps/server/src/opencode-plugins/`：

| 插件 | 钩子 | 作用 |
|---|---|---|
| `openwork-capabilities-knowledge.ts` | `experimental.chat.system.transform`（`:221`） | 注入「You are running inside OpenWork…」身份段 + 产品能力知识 + 工具使用纪律（docs 优先于代码推断） |
| `openwork-extensions-preview.ts` | `experimental.chat.system.transform`（`:868`）+ `tool`（`:896`） | 按运行时状态动态选注入哪条 steering 指令 + 注册 `openwork_context/query/execute` 工具 |
| `openwork-anthropic-adaptive-thinking.ts` | `chat.params`（`:53`） | 改写模型请求参数（Claude 5 系 legacy thinking → adaptive），**不改提示词，改的是请求体** |
| `openwork-anthropic-tool-schema.ts` | 全局 fetch 补丁（`:108`） | 清洗 MCP 工具的顶层 `anyOf/oneOf/allOf` schema，防单个坏工具弄挂整轮 |

**指令组合原语**（`agent-instruction-compose.ts`，60 行，值得抄）：
- `createInstructionSection(id, body)` / `combineInstructionSections(...)` / `deleteInstructionSection` / `expandInstructionSection`。
- **核心思想：分段（section）+ 按 id 去重 + 有序合并**。「routing / agent-surface / skill-authoring / connect-skills / browser」各占一个 id，杜绝多个 transform 反复堆叠互相矛盾的 brochure 文本（文件头注释即言此意）。

**动态 steering**（`openwork-extensions-preview-steering.ts:314-343`）：
- 根据「OpenWork Cloud 连接状态」从 4 条候选指令中**选一条**注入：
  - cloud 就绪 → `OPENWORK_CLOUD_CONNECTION_INSTRUCTION`（教 agent 用 `openwork-cloud_search_capabilities`）
  - 未登录/缺配置 → `OPENWORK_CONNECT_SIGN_IN_INSTRUCTION`（教 agent 引导用户去 Settings 登录）
  - 显式禁用 → `OPENWORK_CONNECT_DISABLED_INSTRUCTION`
  - 其余 → `OPENWORK_EXTENSION_DISCOVERY_INSTRUCTION`（「做不到就查扩展」的兜底认知）
- 状态来源：`fetchEngineMcpStatus`（问 opencode 的 MCP 状态）或 `fetchOpenWorkConnectState`（问 OpenWork server 的 `/experimental/connect/state`，`steering:261-298`）。**提示词内容随运行状态分支**，这是「harness 决定 agent 行为」最直接的证据。

### 2.3 工具暴露面设计

工具来源四层，OpenWork 只拥有其中两层：

1. **opencode 内置工具**（bash/edit/read/grep/glob/webfetch/websearch/task/lsp/todowrite 等）——前端只做类型投影（`apps/app/src/lib/build-in-tools.ts`），实际由 opencode 引擎提供。
2. **OpenWork 插件工具**（`openwork-extensions-preview.ts:896-923`）：
   - `openwork_context`：读一帧「OpenWork 语义快照」（当前屏、tab、面板、可用 affordance 及各自 effects/executor），**工具参数为空，先读后写**。
   - `openwork_query`：side-effect-free 查询（args 带 `id`）。
   - `openwork_execute`：执行命令，args 带 `expectedRevision`（防陈旧写）；「若 descriptor 指定了别的 executor 工具，调那个」。
   - 另有 `openwork_docs_search/read`（`openwork-capabilities-knowledge.ts:224-258`，文档内联词频打分检索）。
3. **MCP 服务器**（`apps/server/src/mcp.ts`，714 行）——含 cloud MCP 治理。
4. **skills**（`apps/server/src/skills.ts`）——`.opencode/skills/<name>/SKILL.md` 目录技能。

约束设计要点：工具声明用 zod schema 直接挂在 `tool` 钩子上（`args: docsSearchArgsSchema.shape`）；工具名即命名空间（`openwork_*` 前缀 + 语义化动词）；执行前强制「读快照 → 用精确 id/args 执行」的两步协议，把 UI 控制动作收敛成 agent 可枚举的 affordance。

### 2.4 上下文管理（压缩 / 截断 / 会话持久化）

- **压缩**：完全委托 opencode。前端 `compactSession()` 优先 `session.summarize`，回退 `/compact` command（`apps/app/src/app/lib/opencode-session.ts:115-148`）。
- **持久化**：opencode 自己的 SQLite（`opencode.db`，`apps/server/src/opencode-db.ts`）。**亮点**：OpenWork 直接读写 opencode 的 DB——`seedOpencodeSessionMessages` 用 `better-sqlite3` 直插 `message`/`part` 表（`opencode-db.ts:140-180`），用于把工作区/云会话播种进引擎。openwork 侧状态（会话分组、runtime opencode 配置、授权根）另存 `runtimeDbPath` 的 SQLite KV store（`workspace-kv-store.ts` + `runtime-opencode-config-store.ts`）。
- **会话分组**：`session-groups.ts` 的 `SessionGroupEventStore` 环形缓冲事件（max 500）+ seq cursor 增量拉取，SQLite 持久化状态。
- **前端同步**：snapshot + 事件双通道去重（`session-sync.ts:315-340`），delta flush 缓冲，空闲会话 TTL 释放订阅。

### 2.5 与 kfmv4 面板 / opencode / oh-my-pi 的架构差异

| 维度 | OpenWork | kfmv4 面板 | opencode（主线） | omp |
|---|---|---|---|---|
| agent 主循环 | **无**，委托 opencode server | **自带**：`src/shared/chat-protocol/` reducer/events + run-manager cursor | 自有引擎（rust/ts） | 自有循环 |
| 提示词注入点 | opencode 插件钩子 `experimental.chat.system.transform`，运行时分段动态注入 | `src/server/prompts/`：`system/base.md` 职业卡 + `tools/*.md` 工具说明 | 引擎内 system prompt + agent 定义 | 自有预设 |
| 角色/人格 | 无角色卡，身份段+能力知识 | **显式职业卡**（base.md：「这张卡只定义你的行为方式」） | agent 文件（`agent.md`） | 预设模板 |
| 工具约束 | 快照→执行两步协议 + expectedRevision + zod schema | 工具族自命名 + 边界条款（工具哲学「通道越多越要配边界提示」） | 原生工具面 | 写工具顺手度高（实验数据：破界 9/32） |
| 权限 | 桌面审批流（ApprovalService + opencode /permission 代理），approvalMode auto/手动 | 系统提示词自约束 + 面板层 | permission 引擎 | — |
| 上下文压缩 | 委托 `session.summarize` | `src/shared/tool-compaction/` 自有压缩 | 引擎内 compaction | 自有 |
| 实验观测点 | — | 探索最深、唯一发现双仓（06 报告） | 中规中矩 | 长时深探（≥57 调用） |

**最本质的差异**：OpenWork 的 harness 是「配置/编排 opencode 的外部层」，它的行为影响力主要通过（a）系统提示词分段注入、（b）工具暴露面裁剪、（c）运行时 steering 三个杠杆；而 kfmv4 面板是「自带循环 + 职业卡」的独立 harness，行为主要由角色卡与工具族决定。

---

## 3. 对 kfmv4 的借鉴点（结合面板 harness / 入口文档 / 冷启动实验）

1. **提示词分段 + 按 id 去重 + 有序合并**（`agent-instruction-compose.ts`）。
   把 base.md 职业卡拆成「身份/纪律/路由/工具/边界」分段，允许插件、文档、运行时各自贡献一段且互不覆盖。kfmv4 的入口文档体系（入口路由 + 宪法心法 + 诊断协议）正缺这个合并原语——目前是整卡单文件，扩展一段就要全卡重写。

2. **提示词内容随运行状态分支（dynamic steering）**（`openwork-extensions-preview-steering.ts`）。
   冷启动实验已证明「harness 是行为的第一类变量」；OpenWork 更进一步：同一会话里，系统提示词按「服务是否就绪/模型是否可用」切换注入段。kfmv4 冷启动实验可仿照：按「无栈/有栈/深探」三种阶段注入不同的探索指导段，而不是固定一份提示词喂所有臂——这直接对口 06 报告的「同模型跨 harness 行为可分」结论。

3. **工具暴露面用「语义快照 + 精确 id 执行」两步协议**（`openwork_context/query/execute`）。
   约束 agent 行为不靠提示词劝诫，靠工具接口结构：先读一帧枚举好的 affordance（含 effects/executor），再凭精确 id 执行，还带 `expectedRevision` 防陈旧写。kfmv4 面板工具族（browser_eval/kfm-logs 等）暴露面广、破界也最多（10/48），正需要这种「先枚举后执行」的结构性约束，比在 base.md 里加边界条款更硬。

4. **文档即工具面：把入口文档内联成可搜索工具**（`openwork_docs_search/read`）。
   OpenWork 把 `packages/docs/` 打包进引擎，注册 `openwork_docs_search`（词频打分）与 `openwork_docs_read`（防路径穿越），系统提示词里直接写「docs 是第一真相源，看代码推断是 last resort」。kfmv4 的入口文档（宪法/心法/诊断协议）可以照此做成 `kfm-doc-search/read` 工具，减少「该查文档却在脑补」的臂（冷启动 failure taxonomy 里的常见错类）。

5. **请求/进程双层看门狗 + 生命周期串行化**。
   `fetchWithTimeout`（10s 默认、长运行豁免、SSE 永不超时）+ `withRuntimeLifecycle` 串行队列 + SIGTERM→SIGKILL 收尾。冷启动实验大量臂卡在「工具调用挂起」；kfmv4 面板的 run-manager 可对照补上「按 URL 类型分流超时」与「循环操作串行化」两件小事，成本低收益直接。

---

## 4. 局限与注意事项

1. **agent loop 不在本仓库**。OpenWork 捆绑的是 `anomalyco/opencode` fork（v1.17.11，从 GitHub Releases 下载 sidecar），turn/工具执行/压缩的真实实现在那个 fork 里，本报告只覆盖了 OpenWork 侧的编排与提示词注入。若要看「循环本体」，需另研究 anomalyco/opencode（本仓库不是它的源码）。
2. **steering 依赖云端状态**。`OPENWORK_CLOUD_CONNECTION_INSTRUCTION` 的分支逻辑高度绑定 OpenWork Cloud（Den）产品；本地/离线场景只走兜底 `OPENWORK_EXTENSION_DISCOVERY_INSTRUCTION`。借鉴时只取「分支注入」的机制，不取云产品语义。
3. **Deep-dive 未覆盖**：`apps/server/src/mcp.ts`（714 行）的 cloud MCP 治理、`routes/files.ts`（1228 行）的文件代理、`cloud-plugins.ts`/marketplace 体系仅确认存在未细读；如需 MCP 暴露面细节需补一轮。
4. **仓库是 monorepo + 桌面应用**，大量代码是 Electron/打包/认证细节（runtime.mjs 的 CA 链修复、keychain），与 harness 主题无关，已跳过。
5. **版本漂移**：opencode 版本被 `constants.json` 固定为 v1.17.11；fork 的演进不受本仓库控制，引用其行为时以捆绑版本为准。

---

## 附录：关键文件索引

| 关注点 | 文件 |
|---|---|
| managed opencode 启动/关闭 | `apps/server/src/managed-opencode.ts` |
| opencode 代理与鉴权门 | `apps/server/src/server.ts:801-966` |
| 会话 CRUD/分组路由 | `apps/server/src/routes/sessions.ts` |
| 会话读模型（zod） | `apps/server/src/session-read-model.ts` |
| 提示词分段原语 | `apps/server/src/opencode-plugins/agent-instruction-compose.ts` |
| 能力知识注入 | `apps/server/src/opencode-plugins/openwork-capabilities-knowledge.ts` |
| 动态 steering 选择 | `apps/server/src/opencode-plugins/openwork-extensions-preview-steering.ts` |
| 工具暴露（context/query/execute） | `apps/server/src/opencode-plugins/openwork-extensions-preview.ts:896-923` |
| 请求超时/流处理 | `apps/app/src/app/lib/opencode.ts:218-338` |
| 压缩/恢复 | `apps/app/src/app/lib/opencode-session.ts:115-148` |
| opencode DB 直写 | `apps/server/src/opencode-db.ts` |
| 审批服务 | `apps/server/src/approvals.ts` |
| Electron 生命周期 | `apps/desktop/electron/runtime.mjs:1000-1932` |
