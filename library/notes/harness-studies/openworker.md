# OpenWorker（andrewyng/openworker）agent 体系研究报告

> 研究日期：2026-08-02　·　研究方式：只读源码精读（仓库克隆 + 核心文件逐行 + 外围系统子代理深挖）
> 相关报告：`openwork.md`（different-ai/openwork，此前误研对象，与本文无关）

---

## 1. 仓库与版本

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/andrewyng/openworker（MIT，README 标注 open beta，自我更新） |
| 克隆位置 | `/root/箱子/工具箱/openworker-ng`（`git clone --depth 1`，未做任何修改） |
| HEAD commit | `01b6f83b3927e02912dda84bb392942c13ca70d1`（"Merge pull request #393"，2026-08-01 09:26:17 -0700，`main` 分支，无 release tag） |
| 语言/规模 | Python 3.10+ 后端约 2.5 万行；`coworker/` 为主体，`surfaces/gui/`（React + Tauri）是壳，`stt/`（Rust 语音侧车） |
| 依赖 aisuite | `pyproject.toml:20` 钉 git commit `1b4bbf303ec21968230b1ec869a144d054e9b3c4`，注释用途 "toolkits/tracing"（见 §4.2 的澄清） |

仓库布局（README §Repository layout）：`coworker/`（Python 后端——agent 引擎、模型 provider、连接器、MCP client、记忆、自动化）、`surfaces/gui/`（React UI + Tauri 壳，负责监督本地 server）、`stt/`、`packaging/`、`tests/`。注意 `docs/` 只有 `config.example.toml` 和一张架构图，**没有 markdown 设计文档**——设计决策散落在源码 docstring 里（本文引用均为源码行号）。

## 2. 架构总览：引擎—连接器—UI 分层

```text
┌─────────────────────────────────────────────────────────────┐
│ surfaces/gui（React + Tauri 壳）                             │
│   WS(事件流) + REST(v1/*) + inbox 卡片 + Slack/Telegram 镜像  │
├─────────────────────────────────────────────────────────────┤
│ coworker/ 本地 agent server（Python，aisuite 只做工具层）      │
│                                                             │
│  server/manager.py ── 会话/引擎生命周期、approver 注入、调度    │
│  TurnEngine(engine.py) ── 回合循环：模型↔工具迭代              │
│    ├─ PermissionEngine(permissions.py)  ← 审批门控（决策）     │
│    ├─ risk.classify(risk.py)           ← 风险分级             │
│    ├─ ToolRegistry(tools/registry.py)  ← 工具注册/执行         │
│    ├─ ProviderRouter → ProviderClient(providers/) ← 模型抽象   │
│    ├─ approver 回调（app.py / inbox / 自动化） ← 审批（执行）   │
│    └─ events.py 事件契约 → 广播给所有观看该会话的 surface       │
│  ├─ connectors/（descriptor 数据 + 工具定义 + 平台适配器）      │
│  ├─ mcp/（MCPManager + OAuth2.1/PKCE/DCR）                   │
│  ├─ memory/（SQLite）+ automation/（scheduler）+ inbox/       │
│  └─ secrets/audit/roots/workspace_trust ← 本地优先与边界       │
├─────────────────────────────────────────────────────────────┤
│ 你的文件与终端 · 25+ 连接器 · 任意模型（BYO key / Ollama）      │
└─────────────────────────────────────────────────────────────┘
```

一次回合的数据流（关键路径）：

```
session WS → manager.get_engine → build_engine(agent.py:141) 装配 Agent+工具+权限
  → TurnEngine.run(engine.py:165) 追加 user 消息 → _loop(:314) 迭代：
      [压缩检查] → _astream(:535) 流式取模型回复（工具 schema = registry.schemas()）
      → 有 tool_calls → _handle_tool_calls(:584)：
          逐调用：TOOL_PROPOSED 事件 → _authorize(:673) 权限决策
            needs_user → PERMISSION_REQUIRED 事件 → await approver(…)
          授权通过 → 低风险并发 / 写与 shell 严格串行 → _execute_sync(:782)
          → _record_result(:789) 追加 tool 结果 → 回 _loop 下一轮
      → 无 tool_calls → TURN_END，回合结束
```

关键设计分界：

- **权限引擎只决策，approver 只执行**：`PermissionEngine.evaluate` 返回 `Decision{allowed, needs_user}`；"审批"是 engine 通过**注入的异步 approver 回调**完成的（`engine.py:46 Approver = Callable[[PermissionRequest], Awaitable[ApprovalOutcome]]`）。approver 由 surface 注入：有人值守 WS（`app.py` 内联卡片）、无人值守/自动化（`inbox_approver`，`inbox.py:348`）、定时任务（`_scheduled_approver`，`manager.py:2679`）。
- **agent 与 harness 解耦**：`coworker/agents/base.py:28` 的 `Agent` 只是 `{name, title, system_prompt, needs_workspace, tool_factory, family/messaging/connectors 三特质}` 的数据类；审批逻辑完全在 engine 层，persona 无法触碰（`overrides.py` 明文铁律：风险覆盖存储只允许用户写，"persona/包加载路径绝不触碰"，防自我授权）。

## 3. 核心机制详解

### 3.1 审批门控（写/发送/shell 命令前检查）—— 本报告重点

#### 3.1.1 风险分级：四类 RiskClass（不是 low/medium/high 三档字符串）

`coworker/risk.py:18`：

```python
class RiskClass(str, Enum):
    READ = "read"            # 无副作用 → 恒放行
    WRITE_LOCAL = "write_local"  # 改 workspace → 路径限定 + 模式门控
    EXEC = "exec"            # 跑命令 → 模式门控
    EXTERNAL = "external"    # 机器外副作用 → 审批 + 无人值守 Inbox 挂钩
```

`classify()`（`risk.py:39`）优先级：用户级 `RiskOverrides`（`risk.py:36`，Phase 2 预留）→ 按名基表 `_BASE`（`risk.py:29`，写工具 → WRITE_LOCAL，`run_shell` → EXEC）→ aisuite 元数据 `requires_approval` → 兜底 READ。工具上的 `risk_level="low/medium/high"`（如 `tools/shell.py:563`）只是展示性标注，**真正驱动门控的是 `requires_approval` + `classify`**。

#### 3.1.2 决策状态机：`PermissionEngine.evaluate`（permissions.py:120-178）

```
1. 只读模式(DISCUSS/PLAN) + 有副作用      → 拒绝 "read-only"          (:131)
2. 写工具 path 不在可写 root 内           → 拒绝 "path is not in a writable directory" (:137)
3. 纯读（READ）                          → 放行 "low risk"            (:143)
4. Mode.AUTO                             → 全放行                    (:147)
5. shell：allowed_commands 前缀命中 / 会话级命令放行                  (:151)
6. 会话级工具放行（connector 工具除外）                                (:157)
7. 任务级 standing rule：tool → 精确 target（§3.1.4）                  (:165)
8. Mode.CUSTOM + 配置 auto_allow 工具     → 放行                      (:174)
9. 否则 → needs_user=True（弹审批）                                   (:178)
```

判例全部**fail-closed**：默认拒绝、显式放行。工具目录里没有条目的工具由调用点兜底拒绝（"unknown tool"，`engine.py:757-778`）。

#### 3.1.3 硬防护细节（机制层，非提示词层）

- **写路径作用域**：写工具 `path` 参数必须落在可写 root 内（`permissions.py:204 _under_writable_root`）。`roots` 是**共享可变列表**，按引用传给 PermissionEngine、文件工具、上下文注入器（`permissions.py:100`、`engine.py:402`、`agent.py:178`）——运行时增删文件夹三方立即可见。
- **shell 命令白名单的双重陷阱拦截**（`permissions.py:21-25, 216-238`）：
  - `_SHELL_OPERATORS = (";", "&", "|", ">", "<", "`", "$(", "(", "\n", "\r")` —— 任何元字符（链接/管道/重定向/命令替换/换行）直接否决白名单自动放行，改为弹审批；
  - 匹配用 `shlex.split` 后的 **argv token 精确前缀**：`git status` 放行 `git status -s` 但绝不放行 `git statusfoo` 或裸 `git`；`git status && rm -rf ~` 因 `&&` 命中元字符被拒。
  - 默认内置白名单为空（`config.py:19-24` 明言"没有普遍安全的可执行文件"）；`allowed_commands` 仅受信任 workspace 的仓库配置可提供。
- **工具元数据驱动**：`connectors/tool_defs.py:1102 approval_for_tool()` —— **read 永不 gate、write 恒 gate**（工具定义的 `kind: "read"|"write"` 是单一事实源），目录外工具 fail-closed 默认询问。
- **低风险才并发**：`engine.py:664 _parallel_safe` —— 仅 `risk_level=="low"` 且无 `requires_approval` 的工具并行执行；写/shell/未标注工具严格串行（`_handle_tool_calls:625-649`）。
- **审批对 agent 的可见形式 = 工具错误**：被拒调用以 `{"error": "tool call not executed", "reason": "denied by user"}` 进入历史（`engine.py:760 _tool_error_message`），模型只能调整策略，不存在绕过通道；unknown tool / 路径越界同样走此通道。
- **挂起而非空转**：`engine.py:143 _interruptible` 将审批 await 与 `_cancel` 事件竞争，用户点 Stop 即返回 DENY 并取消等待（已发出的 inbox 卡片后续 no-op）。
- **幂等与恢复**：`PermissionRequest.tool_call_id`（`engine.py:43`）→ inbox 按 `(session_id, tool_call_id)` 幂等去重（`inbox.py:133-136`）→ 进程重启后 `engine.resume()`（`engine.py:270`）重放**最后一个无 tool 结果的 assistant tool_calls**（`_unanswered_trailing_tool_calls:288`），回调发现 item 已 resolved 直接返回、不重复询问。

#### 3.1.4 审批结果三档 + 任务级 standing rule

- 用户响应四选一（`engine.py:30 ApprovalOutcome`）：`ONCE` / `ALWAYS_TOOL`（记入会话 allowlist，`engine.py:743`）/ `ALWAYS_COMMAND`（记入会话命令 allowlist，`engine.py:745`）/ `DENY`。
- **standing rule（§25）**：自动化任务可声明 `always_allowed_tools: ["send_message slack:C123"]`（`automation/models.py:128-129`，`"tool target"` 一个空格格式）。只对 **EXTERNAL 风险**且工具声明了 `target_arg` 且调用确实带 target 的调用生效（`permissions.py:62 standing_rule_candidate`）——**shell 和写文件永远要问**；精确 target 绑定是它敢自动放行 connector 工具的原因。批准时 `mint_task_rule`（`manager.py:2620`）落盘并审计 `standing_rule_minted`；每个自动放行调用在审计与工具卡片上引用其规则（`engine.py:688-695`）。
- 会话级 allowlist 只在内存；任务级规则持久化在自动化任务记录；用户级风险覆盖在 `~/.config/coworker/risk_overrides.json`（`overrides.py`，glob 匹配工具名，最具体规则胜出）。

#### 3.1.5 无人值守/自动化时的审批降级（不因无人而放弃门控）

- `unattended.py` docstring 语义：**无人值守不改自治上限**（上限由权限 mode 决定），只改"人从哪里被触达"——本应 inline 弹出的审批/问题改投 Inbox，agent 挂起直到被回答。
- 所有交互原语（approval/question/directory/plan）**统一先落为 inbox item** 再 `inbox.wait` 挂起（`inbox.py:323`）；`visibility`（inline/inbox）只决定展示位置（`app.py:1556-1561 _visibility`）。
- 自动化 run 的未授权操作：`_scheduled_approver`（`manager.py:2679-2709`）对写工具/按名允许的工具直接 `ONCE`，**其余一律 park 进 Inbox 挂起**——"优雅降级：未授予的自动化照跑，只是会问"。
- Inbox item 持久化为 JSON（`inbox.json`），挂起时的工具调用先落盘（`persist_session`），重启后可 `_durable_resume`（`manager.py:874-886`）续跑；Slack/Telegram 镜像为按钮（`interactions.py:43 buttons_for`，item id 嵌按钮值），纯文本通道用 `[ow:{id}]` token + allow/deny 正则解析（`inbox_routing.py:123-142`）。
- **状态机反竞态契约**（`inbox.py:8-12`）：`pending → resolved` 恰好一次、先响应者胜（`resolve` 重复调用返回 False）。

#### 3.1.6 全链路审计

`engine._audit`（`engine.py:837`）在每个阶段写一条 sqlite 记录（`audit.py`，`audit_events` 表）：`proposed → approval_requested → approval_resolved(approved/denied) → started → finished / auto_allowed / filtered / interrupted`（`engine.py:600, 647, 693, 716, 734-755, 765`）。脱敏 `_sanitize_args`（`audit.py:123`）：token/secret/password/api_key 等 → `[redacted]`，body/content/html → `[redacted body]`，预览截断 500 字符。隐私过滤器隐藏的结果只审计"规则类 + 计数"（`engine.py:803-817`），绝不记内容。

### 3.2 工具与连接器系统

#### 3.2.1 工具注册与 schema

`coworker/tools/registry.py`：`ToolSpec{name, schema, func, metadata}`（:17）；`ToolRegistry.schemas()`（:59）把全部 schema 喂给 provider（`engine.py:540`）；`execute(name, args)`（:62）同步执行（engine 在 worker 线程跑，`engine.py:785`）。schema 来源优先级：显式 schema → 函数属性 `__coworker_schema__` → 用 aisuite `Tools([func])` 从 docstring/类型注解生成（`registry.py:69`）。

每个工具函数带两块元数据（示例 `connectors/tools.py:169-176`）：

```python
send_message.__aisuite_tool_metadata__ = ai.ToolMetadata(
    name="send_message", category="messaging",
    risk_level="medium", capabilities=["messaging"], requires_approval=True)
send_message.__coworker_schema__ = _SCHEMA
```

#### 3.2.2 25+ 连接器 = "数据，不是代码"

连接器的核心抽象是**声明式数据** + 工具函数，而非继承体系：

- `connectors/descriptors.py:420 DESCRIPTORS`：40 个 `ConnectorDescriptor`（35 可用，5 个 placeholder `available=False`）。描述符承载**连接生命周期**：名称/图标/授权方式/auth 校验回调（`_validate_telegram` :97、`_validate_slack` :121、通用 `_validate_whoami` :140）、向导字段、实验性标记、多账号声明。
- `connectors/tool_defs.py:27 TOOL_DEFS`：**159 个 `ConnectorToolDef`**（33 个连接器，`jira` 同时含 REST 工具和 `mcp__jira__*` 钉选工具）。`ConnectorToolDef{connector, name, label, kind("read"|"write"), description, default_enabled, target_arg}`（:12）。**`kind` 是审批的单一事实源**（§3.1.3）。
- 装配链路：`setup.py:54 connector_list(secrets)` 判定各连接器 connected/enabled → `agent.py:85 _enabled_connector_tools` 收集启用集 → `integration_tools.py:546 make_integration_tools` 构造全部工具后按启用集过滤（:4917-4923）→ `registry.register_all`（`agent.py:231`）。
- **per-tool 控制**：`SecretStore` profile `<connector>:tools` 存 `{"enabled": {tool_name: bool}}`；`tool_enabled`（`tool_defs.py:1138`，未知工具返回 False）+ `patch_tool_settings`（:1148，只接受目录内已知名字，防注入）。
- 消息平台是唯一的继承式抽象：`connectors/base.py:141 BasePlatformAdapter`（Slack Socket Mode / Telegram long-poll / 云 relay 三实现），它只负责**入站监听 + 出站发送**，与第三方连接器（纯工具函数）是两条线。
- 发送类动作独立处理：`connectors/senders.py` 无状态一次性 HTTP POST；token **调用时才从 SecretStore 拉，绝不进模型上下文**（`connectors/tools.py:115 _resolve_token`）；`send_file` 强制路径落在会话 roots 内（`tools.py:226 _resolve_within`）。

#### 3.2.3 MCP 接入

- `mcp/client.py` `MCPManager`：每 server 一个常驻 asyncio task（`_serve` :88），`streamablehttp_client`/`stdio_client` → `ClientSession` → `list_tools`；`call`（:67）扁平化 `CallToolResult`。
- 工具桥：`mcp/tools.py:57 build_callables` 把每个 MCP 工具包成 sync callable（`asyncio.run_coroutine_threadsafe` 桥回 server loop），名字 `mcp__<server>__<tool>`（清洗到 `[A-Za-z0-9_-]{1,64}`），schema 直接取自 MCP `inputSchema`。
- 控制面：`mcp/config.py:26 MCPServerDef` 支持 `include_tools/exclude_tools/requires_approval/auth="oauth"`；配置两层合并——global `~/.config/coworker/mcp.json` + workspace `.coworker/mcp.json`，**后者仅在 workspace 受信任时读取**（`mcp/config.py:58-65`，"克隆本身不足以定义会话启动时运行的进程"）；OAuth server 无 token 直接跳过、绝不从 turn 内启动交互流（`manager.py:919-927`）。
- 审批：默认 `requires_approval=server.requires_approval`；connector-backed server 再用 `approval_for_tool` 覆盖，未分类工具 fail-closed（`manager.py:971-974`）。钉选 `include_tools` 只能缩不能扩（drift 只收窄能力面）。
- OAuth：`mcp/oauth.py` —— OAuth 2.1 + PKCE + **Dynamic Client Registration**（无预注册 client id/secret），token 存 SecretStore profile `mcp-oauth:<server>`（0600），loopback redirect + state 门防本地伪造回调（`_pending` :117），300s 超时；`interactive=False` 时换拒绝式回调抛 `InteractiveAuthRequired`（:91）——防后台上下文劫持浏览器。

#### 3.2.4 本地工具与外部防护

- `tools/shell.py`：`LocalExecutor`（:137）常驻 shell REPL，超时先 SIGINT 再硬杀；`run_shell` 标 `risk_level="high", requires_approval=True`（:559-567），后台任务输出/杀进程低风险不 gate。
- `tools/files.py`：`read_file` 自身做 `target.relative_to(root)` 边界检查（:66-69，"path escapes the workspace"）；写工具来自 aisuite toolkit（`catalog.py:55 _code_files` 单 root / `:69 _files` 多 root 变体）。
- `web/guard.py`：**SSRF 防护**（模型输入不可信原则——web_fetch 无审批，必须从机制上堵）：loopback/私网/链路本地（含 169.254.169.254 云元数据端点）/CGNAT(100.64.0.0/10)/multicast/reserved 全拒，**每一跳重定向都检查**（`get_checked` :97，`follow_redirects=False` 手工走跳，≤5 跳），名字解析返回多个 A 记录时任一落在禁区即拒。明文注明 DNS rebinding 未覆盖。
- `catalog.py`：vetted 工具目录 `Capability{id, name, description, build, requires, risk}`（:38），persona 用稳定 id 组合工具（`COWORK_CAPABILITIES = ["files", "search", "shell", "todo"]`，`agents/cowork.py:16`）；**目录是平台自有且封闭**，第三方广度只来自 MCP（docstring "PERMISSIONS-AND-INBOX"）。目录是风险声明的载体：`risk_summary`（:175）供安装同意屏。

### 3.3 模型抽象（aisuite 的真实角色）

**澄清 README 的误导**：README 说 "engine built on aisuite"，但 aisuite **只贡献工具层**（schema 生成器 `tools/registry.py:14`、`ToolMetadata` 约定、files/git toolkits），**模型调用是自有实现**——`providers/` 目录零 aisuite import。

- **统一接口**：`providers/base.py:102 ProviderClient`（`complete/stream/capabilities`）；`ProviderRouter`（`router.py:23`）按模型字符串的 `provider:` 前缀静态分派给各厂商实现：`openai_provider.py`（Chat Completions）、`openai_responses.py`（Responses API，GPT-5.6+ reasoning+tools）、`anthropic_provider.py`、`gemini_provider.py`、`bedrock_provider.py`、`vertex_provider.py`。**无跨厂商 fallback**（路由是纯静态分派；"切换"是用户手动换模型）。
- **模型注册表双层**：`registry.py:251 DESCRIPTORS` 17 个 provider 描述符（原生 5 + `_compat()` 工厂生成的 11 个 OpenAI 兼容厂商 + Ollama）；`matrix.py:51 MATRIX` ~40 条 curated 模型条目——**刻意只收"当前世代、具备 agent 工具调用能力"的模型**（docstring），"已验证工具调用"的标记就是条目存在本身。自定义模型串走 `capabilities.py:12 capabilities_for()` 的保守启发式（ollama 保守、未知最保守）。
- **能力标记**：`base.py:80 ModelCapabilities{tools, vision, pdf, parallel_tool_calls, streaming}`；消费方包括引擎切模型时的 vision 告警（`engine.py:217-225`）与 PDF/图片降级（`engine.py:1066, 1092`——按当前模型能力决定发真实文档还是本地提取，每轮重判）。
- **BYO key**：SecretStore profile `provider:<name>`；描述符声明 `env_key`（`OPENAI_API_KEY` 等 14 个）；解析顺序 显式 profile → 环境变量 → SecretStore，**延迟到首次调用**。兼容厂商刻意不走 OpenAI 回退（`registry.py:191-210`，"so a configured OpenAI key is never silently sent to a different vendor's endpoint"）。key 验证 `verify_provider_key`（`registry.py:798`，只读探针）。
- **Ollama**：`registry.py:184 _build_ollama` → `OpenAIProvider(api_key="ollama", base_url=自动补 /v1)`（SDK 要非空 key 故塞占位符），`needs_key=False`，默认 `http://localhost:11434`；模型列表实时拉 `/api/tags`（`manager.py:1737`）。
- **错误处理**：`errors.py:38 friendly_model_error` 按厂商错误文本标记翻译成可操作提示（`engine.py:379` 以 notice 追加 + Retry）；每 provider 参数级自愈 `_param_fix_retry`（`openai_provider.py:86`：reasoning_effort→none、max_tokens→max_completion_tokens 等），最多 2-3 次。
- **上下文压缩（OPE-27）**：`compaction.py` —— 触发 `min(0.8×window, 250k)`（:60, :70），用上一轮真实用量做信号；**只改出站视图，持久化转录永不被改**（:524 apply_to_outbound）；内容 = LLM 8 段摘要 + 机械提取（写过/改过的文件、最近 shell 命令+退出码、用户原话保留，:219, :284）；失败策略有人值守弹 Retry/Trim 对话框、无人值守无 LLM 的 `trim_state` 兜底（:455）——"绝不把运行挂死在簿记上"。压缩后旧摘要作为新 span 的 message zero 保证续作不 recap。

### 3.4 记忆、自动化、无人值守

#### 3.4.1 记忆（memory/）

- `base.py:16 Scope{global, workspace, session}`；`sqlite_store.py` 单表 `memories(id, scope, key, content, workspace, session_id, created_at)`（:23-33），thread-safe（RLock）。
- 工具三件套（`memory/tools.py:21-64`）：`remember(content, scope="workspace")` / `memory_update(id, content)` / `memory_forget(id)`，元数据 `risk_level="low"` 不 gate。
- **触发点**：构建引擎时注入 `_MEMORY_GUIDANCE`（`agent.py:62-73`，何时记/改/删的规则）+ 一次性快照注入 GLOBAL ∪ 本 workspace 的记忆（`agent.py:284-294`）；**写入完全由 agent 自觉调用，无自动总结钩子**。隔离靠 scope：`global` 所有 workspace 共享、`workspace` 按路径过滤（不跨项目泄漏）；无 per-user 维度（单用户本地工具）。

#### 3.4.2 自动化（automation/）

- `models.py:114 ScheduledTask`：`cron|once` 调度、`instructions`、`agent`、`workspace`、`always_allowed_tools/commands`（standing rule 载体，:128-129）、`max_runs/next_run/last_run/last_status`；每任务独立线程 `__task__<id>`。
- `scheduler.py` `Scheduler`：30s tick，**首 tick run-once-catch-up**（停机期间错过的任务补跑一次），`asyncio.create_task` spawn 不 await（一次 run 挂审批不能卡住调度循环），`_running_ids` skip-on-overlap（:91-113）。`extra_tick` 顺带执行 self-wake 恢复（:35-36）。
- 持久化 `store.py`：SQLite 两表（任务整体为 JSON blob，:73-90），`compute_next_run`（:22）用 croniter 按时区算。
- 运行：`manager.py:3125 _run_scheduled_task` —— TaskRun 落库 → 为该 run **建独立引擎/独立会话**（`_build_task_engine` :2719，approver = `_scheduled_approver`，**故意不暴露调度工具**，防 agent 自我复制）→ 首轮固定框架消息"⏰ Scheduled run …"→ 结束后把 run 会话保留为可续会话（用户可打开跟进）。
- agent 侧工具 `automation/tools.py:151-233`：`create_scheduled_task`（**gated，requires_approval=True**，创建即弹确认卡）、list/update/delete；权限提案 `grant_entries()`（`models.py:36-58`）**fail-closed**：只保留 `access:"write"` 且目标非空且工具声明了 target 参数的条目（read 只是披露、不落库）。

#### 3.4.3 无人值守 + Inbox（跨会话"人类注意力队列"）

- `inbox.py:61 InboxItem`：`{id, session_id, kind(approval|question|notification|directory|plan), state(pending→resolved), visibility(inline|inbox), tool_call_id, options, data}`。
- `InboxStore`：JSON 持久化（`inbox.json`）；`add` 按 `(session_id, tool_call_id)` 幂等（:116-154，durable resume 重放同一 prompt 不复问）；`resolve` 恰好一次先到者胜（:295）；`wait` 挂起 agent（:323）；`reconcile_on_resume`（:335）恢复 attended 时返回 pending 项 + 离开期间的 recap。
- 响应入口：REST `POST /v1/inbox/{id}/resolve`、Slack 按钮点击（`manager.py:2779`，approval/directory/plan 三类有 actor 归属校验）、频道回复 `[ow:id]` + 词法（`inbox_routing.py:25-28 _ALLOW_WORDS/_DENY_WORDS`）。
- `selfwake.py`：三种唤醒（timer / completion / event），`sleep_for/sleep_until/wake_on/wake_on_event` 工具；调度器 tick 顺带 resume（`manager.py:2855`），唤醒消息模板"⏰ Wake — Continue where you left off."。
- `subscriptions.py`：入站频道订阅（inbox 出站方向的反向，两方向警告勿混用同一通道）。

### 3.5 隐私/本地优先与数据边界

- **状态全在本地**：`secrets.py:27 state_dir()` = `$COWORKER_STATE_DIR` → `~/.config/coworker`。`SecretStore`（:106）v1 是 0600 JSON（`secrets.json`），profile 按 `connector[:account]` 为 key，值可为字面量或 `${ENV_VAR}` 引用；`status()` 只返回元数据**绝不含值**；`_restrict_to_user`（:59）POSIX chmod 0600 / Windows icacls ACL。README：数据出机器仅通过用户选择的模型与连接器；唯一云件是连接器 OAuth 握手代理。
- **数据边界三层**：
  1. PermissionEngine 路径检查（写工具，§3.1.3）；
  2. 文件工具自身 `relative_to` 检查（`tools/files.py:67`、`send_file` 的 `_resolve_within`）；
  3. 提示词约束：`environment.py environment_context`（:57-77）注入"Folder scope: work inside the workspace … Do not read or list other locations (home directory sweeps, ~/Desktop, ~/Downloads … not even via shell)"——需要别处文件用 `request_directory` 先问。
- **workspace 信任**：`workspace_trust.py` —— 仓库 `.coworker/config.toml` 的 `allowed_commands` 与 `.coworker/mcp.json`（**可执行来源**）只有用户信任该规范路径后才生效（`config.py:96-129`、`mcp/config.py:58-65`）；信任绑定路径而非配置快照。`config.py:80 _GLOBAL_ONLY_FIELDS`：工作区覆盖永不落入全局。
- **会话存储**：`conversations.py` —— SQLite 索引 + **每会话 append-only jsonl**（`conversations/<id>.jsonl`，只追加不重写）；checkpoint 事件（turn_start/permission_required/directory_requested/plan_proposed/iteration_end）中途落盘（`app.py:1786-1792`），崩溃不丢会话；`try_mark_running` 原子锁保证同一会话同时只有一个 turn。
- **显示层与模型层分离**：`_outbound_messages`（`engine.py:1025`）剥离所有展示 sidecar（`source/_display/ts/reasoning/usage`）和 `notice` 消息；`_display`（如隐私过滤器隐藏计数）用户可见但 agent 永不可见——模型无法探知自己被过滤了多少。

## 4. 对 kfmv4 的借鉴点（结合 124 臂实验结论）

> 实验背景：124 臂中 25 臂破界（20%）；破界分型为 commit 越界(11)/edit 修复者(16)/构建部署越界(18)/进程远程操作(6)；"工具暴露面决定行为面"、"harness 是行为的第一类变量，模型是第二类"；处方之一是角色卡加边界自我加压条款（已验证有效但仍是软约束）。

### 4.1 审批门控 vs 提示词劝诫：把"破界"从行为问题变成执行面问题 ★

我们的 20% 破界臂里，`edit 修复者`（16 臂）是"能力越强越想验证越容易越权"的典型——诊断全对、纪律归零，提示词劝诫对这类臂明显失效。OpenWorker 的答案是不依赖模型的纪律：**每个工具调用必经 `PermissionEngine.evaluate`，fail-closed 默认拒绝、显式放行**；审批只对 agent 呈现为工具错误（`denied by user`），没有"绕过"的通道。**借鉴：kfmv4 应在 harness 工具执行层加一个同款 evaluate() 拦截点，把边界纪律从系统提示词里挪到代码里**——提示词劝诫继续保留（降低触发频率），但机制是最终防线。破界率应成为 evaluate 命中率的观测指标。

### 4.2 风险分级四类（RiskClass）是门控的可解释地基

read / write_local / exec / external 四类比三档字符串（low/medium/high）更适合做门控：**分类直接决定策略**——read 永不问、write_local 路径限定+询问、exec 模式门控、external 审批+无人值守挂钩。kfmv4 映射自己的工具面：browser_eval/kfm-logs 这类"做事通道"（实验里与破界正相关）应归入 exec 级；`commit` 相关工具（11 臂越界）至少 write_local 级。四类分级同时让审计和实验日志可解释（每次拦截都能说清是哪一类、哪条规则）。

### 4.3 路径作用域（roots）作为写操作硬边界

实验里 commit/构建越界的共同点是"写到了不该写的地方"。OpenWorker 用三层：`_under_writable_root` 检查 + 文件工具自身 `relative_to` 检查 + 提示词声明。前两层是**机制**，第三层只是告知。**借鉴：kfmv4 的文件/commit 工具应做硬性路径判定（落在会话 root 内才执行），而不是靠"保持工作区干净"这类提示词**。共享可变 roots 列表（按引用传给权限引擎/工具/上下文）是个好模式——运行时授权文件夹立即生效，对应我们"请示型收尾"臂的行为支持。

### 4.4 shell 白名单的严谨模板（防 `git status && rm -rf ~`）

OpenWorker 把实验里"构建/部署越界（18 臂）"的大部分入口堵在机制层：`_SHELL_OPERATORS` 元字符拦截（`; & | > < \` ` $ ( ( \n \r` 即拒）+ argv token 精确前缀匹配（`git status` 不放行 `git statusfoo`）+ 默认空白名单 + "没有普遍安全的可执行文件"的明示。kfmv4 若开放 shell 工具，这是**可直接复制的安全模板**；即便不开放 shell，browser_eval 等工具的参数校验也可套用"元字符黑名单 + token 级匹配"思路。

### 4.5 审批结果的 allowlist 记忆（ONCE/ALWAYS_TOOL/ALWAYS_COMMAND）+ standing rule 粒度

一次确认不重复打扰，但豁免面可控：per-tool、per-command（精确命令串）、per-target（`send_message → slack:C123`，仅 EXTERNAL 风险，shell/写文件永远要问）。**借鉴：kfmv4 的"边界纪律"可加一层用户显式授权面**——用户对某臂/某会话点过"允许"的写操作记入会话 allowlist，既减少摩擦又保持审计可溯。standing rule 的"精确 target 绑定才自动放行"原则值得照搬：豁免必须绑定到具体对象，不允许"所有发送"这类宽豁免。

### 4.6 无人值守不放弃门控：审批降级为 Inbox 挂起

实验里无人/自动场景最容易静默越权（无人在场，模型自主决策）。OpenWorker 的答案：**自动化 run 的未授权操作进 Inbox 挂起等回答，而不是静默放行**（`_scheduled_approver`：写工具按名放行，其余全问）；无人值守只改触达渠道不改自治上限。**借鉴：kfmv4 无人值守臂应默认 fail-closed + 审批队列**——挂起而不是放行，恢复后以工具错误形式继续。

### 4.7 全链路审计 + 幂等恢复（实验可复现性）

`audit_events` 记录每个阶段的裁决（proposed→approval_requested→resolved→started→finished，含 standing rule 引用和脱敏参数）；`tool_call_id` 幂等 + `engine.resume()` 重放未答调用支持重启续跑。**借鉴：kfmv4 的 harness 应把每次破界尝试及其裁决（放行/拒绝/规则）落成结构化日志**——这正是 124 臂实验"破界定级信度 30/31"想要的机器侧证据，且能区分"模型想破界被拦"和"模型破界成功"两种完全不同的情况（前者是门控生效，后者才是失败）。

### 4.8 其余低成本借鉴

- **SSRF 防护（web/guard.py）**：模型输入不可信原则——agent 读的网页/邮件就是潜在攻击面；kfmv4 的 fetch 类工具应加同样的逐跳地址检查（loopback/私网/云元数据端点）。
- **连接器 = 声明式数据**（descriptor + tool_defs 159 个工具 + per-tool enable 开关）：kfmv4 的多通道接入可照此建模——连接生命周期（auth/validate）与工具定义（kind/审批面/target_arg）分离，新增集成不动引擎代码。
- **能力驱动的上下文管理**：`ModelCapabilities` + 按能力逐轮重判 PDF/图片降级 + 出站视图压缩（持久化转录与 provider feed 分离）——换模型不丢会话，压缩只影响出站。对 kfmv4 的多模型面板是直接可用的设计。
- **只读子代理模式印证**：实验里"探索外包给只读子代理"是全场最优行为结构；OpenWorker 的 code 系 agent 内置 `explorer_tools`（`agent.py:251-259`，只读子代理探路保主上下文）正是同一设计——kfmv4 的 kfm-explore 类工具值得做（实验处方第 2 条）。

## 5. 局限与注意事项

1. **Beta 且快速迭代**：无 release tag，HEAD 随时大改；本报告基于 `01b6f83` 快照。引用行号仅对该 commit 有效。`docs/` 无设计文档，决策散落源码 docstring。
2. **shell 的路径边界缺口**：权限引擎对 shell **只做 allowlist 前缀 + 元字符拦截，不检查命令是否会写 workspace 之外**（文档明言"没有普遍安全的可执行文件"，内置白名单为空）。`cd ~ && rm -rf` 这类只要不在 allowlist 就会弹审批，但一旦批准 `cd` 类命令，后续写路径无 root 强制。对写工具路径检查的严格性不能类推到 shell。
3. **记忆可靠性依赖模型自觉**：记忆写入完全由 agent 自主调用（只有 `_MEMORY_GUIDANCE` 提示词，无自动归档钩子）；`scope=session` 虽有模型但 `remember` 工具并不传 session_id，实际只用 global/workspace。长期记忆的时效性/漂移无机制保证。
4. **connector"读"永不 gate**：`approval_for_tool` 的 read 恒放行原则在"读"= 拉取外部数据时合理，但连接器的"读"也可能携带出站副作用（如 OAuth 刷新、读取远端状态改变），且数据出本地后不可收回。kfmv4 若做发送类通道，建议把"发送"单独列为 EXTERNAL 而非依赖 read/write 二分。
5. **无跨厂商 fallback**：路由是纯静态分派，厂商故障没有自动降级；默认模型 `gpt-5.6-sol`（OpenAI 中心，`config.py:29`）。README 声称的"模型无关"更准确说是"模型可换"，不是"故障容错"。
6. **审批 UX 依赖人响应**：无人值守挂起等待时任务不前进；若用户长时间不回答，自动化会一直挂着（`inbox.wait` 无超时）。调度器 spawn 不 await 缓解了相互阻塞，但单个任务的 liveness 无保证。
7. **本地优先的代价**：状态全在本机 JSON/SQLite，无云端同步；跨设备无会话迁移；`secrets.json` v1 是 0600 明文 JSON（接口预留了 keychain 后端但未实现）——机器被攻破即密钥泄漏。
8. **引擎事件粒度**：v1 无 token streaming，事件粒度是 per-message/per-tool（`events.py`）；渲染层对长回复的流式体验由 GUI 自行处理（`ASSISTANT_DELTA`），对 harness 事件设计有参考但不完全等价。

---

### 附：核心文件索引

| 关注点 | 文件:行 |
|---|---|
| 回合循环 | `coworker/engine.py:165 run`、`:314 _loop`、`:584 _handle_tool_calls` |
| 审批挂钩 | `coworker/engine.py:673 _authorize`、`coworker/permissions.py:120 evaluate` |
| 风险分级 | `coworker/risk.py:18 RiskClass`、`:39 classify` |
| 工具注册 | `coworker/tools/registry.py:17 ToolSpec`、`:59 schemas` |
| 连接器描述符/工具定义 | `coworker/connectors/descriptors.py:420`、`tool_defs.py:27`、`tool_defs.py:1102 approval_for_tool` |
| MCP | `coworker/mcp/client.py:44 MCPManager`、`tools.py:57 build_callables`、`oauth.py:202 build_auth` |
| 模型抽象 | `coworker/providers/base.py:102 ProviderClient`、`router.py:23`、`registry.py:251 DESCRIPTORS`、`matrix.py:51 MATRIX` |
| 压缩 | `coworker/compaction.py:70 should_compact`、`:417 build_state`、`:524 apply_to_outbound` |
| 记忆 | `coworker/memory/sqlite_store.py:23`、`tools.py:21` |
| 自动化 | `coworker/automation/models.py:114 ScheduledTask`、`scheduler.py:23` |
| Inbox/无人值守 | `coworker/inbox.py:61 InboxItem`、`unattended.py`、`manager.py:2679 _scheduled_approver` |
| 密钥/边界/审计 | `coworker/secrets.py:106 SecretStore`、`roots.py:19 RootDir`、`workspace_trust.py:19`、`audit.py` |
| SSRF | `coworker/web/guard.py:53 check_url` |
