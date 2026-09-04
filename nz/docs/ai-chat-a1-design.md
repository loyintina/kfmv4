# ai-chat A1 · AI 接通最小闭环设计清单（行为层规格 + 实现清单）

> 这是什么：AI 专题（TASK.md §0.7）A1 阶段「AI 接通最小闭环」的设计清单——
> 一条真实模型通路 + 一个能对话的最小界面（say hello 级）。照此可实现。
> 语义来源：已拍板决策（通路方案 Z / BeautifulUI 最小集 / na 方法论三层分离
> + echo 夹具 / nz 身份=key 不出服务器）+ na 接入决策
> （kfm-na `docs/active/ai-presence.md` D10/D11/§四协议契约/R1-R7 风险清单）
> + kfmv4 协议层源码（`src/shared/chat-protocol/`）与直连实现
> （`src/server/ai/chat.ts`）。
> 纪律：**清单用户签收 → 考题先行（红先）→ 实现 → 变异抽检**；
> 全程 agent 保有测试与 API 调试可见能力（§五）。
> 状态：**已签收**（2026-09-04 用户拍板，§八六条异议全部裁决）。
> 考卷蓝本：A 档 `tests/ai-*.test.ts`（na fixture 当判卷基准）+
> B 档 `tests/browser/ai-chat.test.mjs`（echo 脑驱动全链）+
> C 档真机（真 provider 发一条收流式）。
> 仲裁记录（2026-09-04 用户拍板）：
> ① 简版投影新写、不搬 tool-compaction 整树 ✅；
> ② BeautifulUI 三件定性重写、逐词 blur 不搬只搬光标 ✅；
> ③ model picker 保留极简版，**默认 = Kimi 官方（api.kimi.com/coding/v1）
>    + 模型 `kimi-k2.7-code`**（用户拍板：官方渠道用此名可通，C 档实测验证，
>    不通则凭 §4.3 API 调试落盘定位再议）✅——**后被同日九拍⑮改为
>    智谱·glm-5.3-flash**；
> ④ 配置直读 `~/.kfmv4/`（providers.json + .env），`NZ_AI_CONFIG_DIR` 可覆盖 ✅；
> ⑤ kfmv4 routes.ts 不搬，错误语义靠 fixture 钉住 ✅；
> ⑥ run 薄层登记表保留（内存 Map + 封顶缓冲 + 5min 淘汰，保页面切换补流）✅。
> 仲裁记录追加（2026-09-04 用户真机拍板四条 + 主会话裁定两条，均已签收）：
> ① **composer 全局化**：从 AI 页拆出，钉中央终端页面底部**全局常驻**
>    （TERMINAL/AI_PAGE 两态都在、都可发送）；发送永远去 AI，终端输入照旧
>    走 IME 诱饵——点输入栏=跟 AI 说话、点终端=跟 shell 说话、keybar 继续
>    服务终端，三者焦点不打架；AI 页滑下时 composer 不能被盖（composer 作
>    为全局顶层条钉底，AI 页内容区底部避开 composer 高度）✅；
> ② **删返回按钮**：AI 页顶栏左侧返回按钮删除（多余，orb 即开关）；
>    硬约束 AI orb 层级必须在 AI 页之上（否则页盖住球关不掉）✅；
> ③ **入场动画**：AI 页整体自顶部向下平移（translateY(-100%)→0），收起
>    反向；时长/曲线走 tokens（--kfm-dur-normal/--kfm-ease-out）✅；
> ④ **层级规则**（从底到顶）：终端（含 tmux 控件）→ AI 页 → 输入栏 +
>    AI orb ✅；
> ⑤（主会话裁定）AI 页打开时 tmux orb+标签栏**隐藏**（不渲染/不可见，
>    不是被盖）；AI orb 始终可见可点为唯一开关 ✅；
> ⑥（主会话裁定）composer 全局化后 chat-link 脑不动——事件流与消息核
>    不变，只动皮和装配 ✅。
> 仲裁记录追加（2026-09-04 同日二拍，用户真机拍板换序，已签收）：
> ⑦ **composer/keybar 垂直次序互换**：旧=从底到顶 软键盘→keybar→composer→
>    终端内容；新=从底到顶 软键盘→**composer→keybar**→终端内容。逻辑：
>    点开软键盘时输入栏必须与软键盘直接接触。落地：composer 钉最底
>    （bottom=键盘上浮量；无键盘贴视口底、键盘弹起贴键盘顶），keybar 钉
>    composer 正上方（bottom=--kfm-aichat-composer-h），终端 scrollEl 底部
>    预留总量不变（KEYBAR_H+composer-h，内部次序颠倒），TUI 底部数学不变
>    （scrollClientH==vh−KEYBAR_H−composerH——composer 全局条 TUI/ALT 态
>    同样常驻），AI 页内容区底=keybar 顶（keybar/composer 两不盖）✅。
> 仲裁记录追加（2026-09-04 同日三拍，用户真机拍板，已签收）：
> ⑧ **AI 页打开时盖住 keybar**：⑦落地时 AI 页底=keybar 顶（两条都避让），
>    用户拍板纠正——终端的逻辑和 AI 对话的逻辑是两套，AI 页打开时两排
>    快捷键**不应继续显示**，正确做法是 AI 页把它们**盖住**（页底=视口底
>    /键盘顶）。composer 保持全局钉底不动（z43 在 AI 页 z42 之上，不被
>    盖、钉底可用）；z 序不变：终端/tmux ≤41 < AI 页 42 < composer+orb 43 ✅。
> 仲裁记录追加（2026-09-04 同日四拍，用户拍板方案 1，已签收）：
> ⑨ **AI 页面板落到 composer 上面**：⑧的页底=视口底留了一个病——内容在
>    面板内滚动到底时，底部文字会被钉底的 composer（z43 在页之上）盖住。
>    方案 1：页底=composer 顶（kbRise+composerH），面板落到输入栏上面，
>    内容区几何上不存在被盖可能。约束保持：①keybar 仍被面板盖住（keybar
>    在 composer 上方，面板落到 composer 顶正好仍盖着它，⑧语义不变）；
>    ②composer 仍全局钉底在面板之上（z43）可用；③键盘弹起时面板底随
>    composer 一起上浮（底=键盘顶上的 composer 顶）✅。
> 仲裁记录追加（2026-09-04 同日五拍，用户拍板，已签收）：
> ⑩ **上滚态点输入栏 = 主动说话意图，覆盖上滚**：AI 页有内容时用户上滚
>    阅读旧消息，点输入栏弹键盘 → 消息列表追底锚定最新（贴 composer 顶）；
>    但**被动新 delta 不拽回**——上滚阅读中来新流式内容，列表留在原地。
>    落地教训：在底判定**不依赖 scroll 事件**（程序化上滚后浏览器 scroll
>    事件合并迟发，跟随 effect 抢在事件前回拽会把「上滚过」整段抹掉），
>    改为渲染当拍直读 live 几何（scrollTop 与上拍不同=外部滚动→按 live
>    位置重判在底）；追底挂三个主动触发：进页/收起动画期、composer
>    focusin、键盘上浮沿 ✅。
> 仲裁记录追加（2026-09-04 同日六拍，用户拍板两条，已签收）：
> ⑪ **发送后自动开页**：终端页面态（AI 页关闭）在全局输入栏发送内容后，
>    自动相当于点了一下 orb——AI 页滑出（滑入动画照播），用户直接看到
>    自己的消息和 AI 的流式回复，不该需要手动再点球。与状态机咬合：
>    TERMINAL 态 send 等效 A1 转换；反向不成立——页开着发送就是页内
>    发送，无新增动作 ✅；
> ⑫ **picker 二级路由**：模型选择从单层混排改两级——第一级 provider
>    列表（/ai/providers 的 id/name），点进某 provider → 第二级该
>    provider 的 model 列表（models[]），带返回一级按钮。数据语义：
>    ①当前选中的 provider+model 两级都要可辨识（✓ 标）；②**server 下发
>    的默认模型必须恒可见**——修掉 A2 观察项①：Kimi 的 models 列表里没
>    有 kimi-k2.7-code 但它是默认，二级页把默认模型合成常驻行置顶呈现
>    （标注「默认」），切走也能点回来；③选中即生效+收起（沿用 A10 转换
>    语义，二级点定 model 才收，点 provider 只是下钻不收）。菜单机词汇
>    不变（CLOSED↔MODEL_OPEN，P9）——下钻层级是 picker 内部 UI 态，
>    不进词汇表 ✅。
> 仲裁记录追加（2026-09-04 同日七拍，用户拍板，已签收）：
> ⑬ **picker 点菜单外任意处即关，且那一指的动作必须同时生效**（照
>    tmux-tabs T15「操作屏幕即收起+动作同时」同款模式）：点终端=聚焦
>    打字+菜单关、点消息区=交互+菜单关，两者同时发生无感。落地：菜单
>    开时挂 document pointerdown 捕获阶段 passive 监听，事件源在菜单
>    DOM 外→关菜单，**不许 preventDefault/stopPropagation**（下层动作
>    照走）；菜单 DOM 内（下钻/选择/返回）与模型钮自身 toggle 豁免。
>    菜单机词汇不变（CLOSED↔MODEL_OPEN，P9）✅。
> 仲裁记录追加（2026-09-04 同日八拍，用户拍板，已签收）：
> ⑭ **composer 回车=换行，不发送**（用户原话：不然做发送按钮有什么用）
>    ——发送唯一路径=发送按钮（流式期间仍是停止钮，A8 语义不变）；
>    textarea 自然换行，不拦截即 IME 组词守卫语义保留。只改 composer：
>    终端 keybar 的 ENTER 发 \r 是终端逻辑，一个字不动 ✅。
> 仲裁记录追加（2026-09-04 同日九拍，用户拍板，已签收）：
> ⑮ **默认 provider+model 改 = 智谱·glm-5.3-flash**（③的 Kimi 官方
>    kimi-k2.7-code 默认被改）。glm-5.3-flash 在智谱 models 列表内 →
>    picker 合成默认行机制不触发但保留（防未来默认不在列表）；
>    kimi-k2.7-code 随之不再默认、不在 Kimi models 列表 → picker 不
>    可达（拍板明确接受）。C 档双路腿随之换：C1=默认（智谱）不经
>    picker，C2=下钻 Kimi 选列表内 kimi-for-coding-highspeed ✅。

## 〇、范围与边界（什么做、什么不做）

**A1 = 一条真实流式对话闭环**：页面发一条消息 → nz server 直连 provider
（OpenAI 兼容端点）→ SSE 九事件流回 → 界面逐字上屏 → 可取消 → 错误入流。

| 做 | 不做（A1 边界，越界=返工源） |
|---|---|
| nz server 薄层 `/ai/chat/*`（start/stream/cancel 三端点） | 工具调用（tool_use 事件只容忍忽略，不执行不渲染） |
| 协议层四件原样搬 + 简版投影（§一） | 会话持久化（无 session-store、无落盘会话文件；run 只在内存） |
| BeautifulUI 词汇重写的对话 UI（§三） | markdown 渲染（纯文本气泡，代码块原样等宽） |
| echo 夹具脑（断网可开发，B 档判卷腿） | 多会话/历史列表（单会话，刷新即清空） |
| 取消 / 重连补流（server 侧 run 缓冲 + cursor） | 8.x 重件：run-manager / session-store / tools / permissions / eyes 一件不搬 |
| 观测闭环（server /tmp 日志 + `__kfmNzAiChat()` 钩） | 光球/浮层/眼睛/手（na 期 0④、nz A2/A3 的活） |

**模型通路**：provider 直连（方案 Z）。A1 默认两路可测：Kimi 卡
（`api.kimi.com/coding/v1`，model `kimi-for-coding-highspeed`）与智谱卡
（`open.bigmodel.cn/api/coding/paas/v4`，model `glm-5.3-flash`）——双 provider
方言差异是 na 已实锤的考场（每帧 role 重复 / usage 双份 / 401 错误体异形），
单 provider 接通不算闭环。

## 一、数据类型

### 1.1 九事件协议：直接搬，不重新定义

**结论：原样搬运 kfmv4 `src/shared/chat-protocol/` 的 `events.ts`（44 行）、
`messages.ts`（42 行）、`reducer.ts`（121 行）、`block-idx.ts`（23 行）
四件到 `nz/src/shared/chat-protocol/`。** 理由：

- 四件全部**零依赖纯 TS**（逐个核实：events/messages 无 import；reducer 只
  引同目录两件；block-idx 无 import）——搬 = 复制，无拖拽。
- 九事件协议是 na/kfmv4 双端已跑通的真协议，na 的 probe fixture（44/40 事件
  真流实录）是它的判卷基准；nz 另起一套 = 自造第三份协议，违背「双端共享
  消除漂移」的 v8 教训。
- `block-idx.ts`（BAR-106 核心）A1 虽无工具块，但 23 行零成本，且 reducer
  的索引连续性语义依赖它——一起搬，防 A3 接工具时再补。

事件全集（照 `events.ts`，词汇表即协议）：
`message_start` / `content_block_start{index,blockType:text|tool_use,toolUseId?,toolName?}` /
`content_block_delta{index,deltaType:text_delta|thinking_delta|input_json_delta,deltaText}` /
`content_block_stop{index}` / `tool_result{…}` / `message_stop` / `done` /
`error{content}` / `rule_warning{content}`。
block 布局：`index=0` 恒为 text（**thinking + 正文同块混排，靠 deltaType
分流**——chat.ts 历史教训：曾拆两 block 导致 `textBlocks[0].text` 永远为空）；
tool_use 从 1 起连续编号。

**`to-openai-messages.ts`（308 行）不全量搬**——它 import 整个
`../tool-compaction/` 树（compactToolInput/Result、bash 归一化、todo 标注、
MUT_BURST_GAP……），恰是「8.x 重件」里最重的一族。A1 新写简版
（`nz/src/shared/chat-protocol/to-openai-messages.ts`，约 70 行），**只保留
三条有事故教训的规则**：

1. **ts 前缀只盖 user 消息**（BAR-TS-MIMIC-01：assistant 盖前缀 = AI 学成
   自己的行文格式复读；A1 无 ts 字段也要把这条写进结构，防后补时踩雷）；
2. **客户端产物占位符不进载荷**（`[错误: …]` / `[未收到回复，请重试]` 整条
   过滤——本地事故记录不是对话内容，上行污染「最近的自己」；
   `[已取消]` 不过滤，是对话信号）；
3. **空壳 assistant 一律丢弃**（无 tool_calls 且正文空 → 严格端点 kimi 400
   「assistant must not be empty」，BAR-PROVIDER-02）。

### 1.2 消息核形状（na `ai_chat.rs` 简版 + reasoning 归位 R3）

client 侧对话状态 = 共享 reducer 的直接产物，不自造第二份状态：

```ts
interface AiChatState {
  messages: ChatMessage[];   // shared/chat-protocol/messages.ts 原类型
  msgIdx: number;            // reducer cursor：当前流式消息索引，-1 = 无活跃
  phase: 'IDLE' | 'WAITING' | 'STREAMING';  // §三运行机
}
```

- 流式 = 事件逐条 `applyEvent` 进同一份 messages（原地 mutate，reducer 语义）；
  半截尾巴（组件卸载/页面切走时 run 未终结）由 server 侧 run 缓冲 + attach
  补流兜住，client 不发明第二份缓存。
- **reasoning 归位 R3**（na 风险清单 R3，kfmv4 陷阱 10，必须进规格）：
  显示层规则——text 空且 reasoning 非空 → **reasoning 归位为正文显示**
  （灰一档 `--kfm-ink-2` 以示思考性质）；text 非空 → 正文显示 text，
  reasoning 收进可展开的「思考」折叠区（A1 折叠区可只做一个 `<details>`，
  无动画）。归位只发生在显示层，reducer 数据不动（`block.reasoning` 与
  `block.text` 始终分字段存）。
- **工具事件容忍忽略**：`tool_use` / `tool_result` / `rule_warning` /
  `input_json_delta` 事件到达时 reducer 照常归约（数据在），UI 不渲染
  tool/rule_warning 块——但不许抛错、不许断流（A3 前的生态位占位）。

### 1.3 providers 配置格式 + .env 代字 fuse

**配置源：A1 直读 kfmv4 数据目录 `~/.kfmv4/providers.json` + `~/.kfmv4/.env`**
（服务器同机，零重复配置；`NZ_AI_CONFIG_DIR` 环境变量可整体换目录，
9.0 收口再议迁移——见 §八④）。条目格式（照 kfmv4 现状实录）：

```json
[{ "id": "Kimi", "name": "Kimi",
   "baseUrl": "https://api.kimi.com/coding/v1",
   "apiKey": "${KFM_PROVIDER_KIMI}",
   "models": ["kimi-for-coding", "kimi-for-coding-highspeed", "k3", "k3-256k"] }]
```

代字 fuse 语义（复刻 kfmv4 `env-store.ts` `resolveKey`，照 na `providers.rs`）：

- `apiKey = "${VAR}"` → **process.env 优先，`.env` 文件其次**（.env 行格式 =
  冻结契约：`KEY=VALUE`、`#` 注释、可选成对引号；mtime 缓存，保存即生效）；
- 变量缺失 → **error 事件人话**（报变量名），**绝不裸发代字**（fuse = 引线，
  断在 server，不烧到上游）；
- 明文 key（旧习惯）原样使用；
- **env 变量名必须带 provider 区分，且显式写死在 providers.json 条目里**——
  禁止用 `envNameForProvider` 从 id 自动派生。na 401 事故实录：智谱卡与聚光
  卡曾共用 `${KFM_PROVIDER_KEY}`（中文 id 经派生函数全塌缩成同名代字），
  .env 里存的是聚光的 key → 智谱 401「令牌已过期」，排查半天。nz 的考题
  必须含这条回归（§六 A6）。

provider 匹配（BAR-PROVIDER-MATCH-01）：按 id 或 name 匹配，**无静默回退**，
匹配不上 → error 事件（静默回退 providers[0] = 数据污染源，kfmv4 实锤）。

### 1.4 错误语义全集（判卷基准 = na error fixture 实录）

| 情形 | 行为 | 出处 |
|---|---|---|
| 参数非法（缺 messages / 空 messages） | HTTP 400 `{error}` | probe-error-cases ②③ |
| provider 不存在 / 代字缺失 | HTTP 200 立即返 runId + **SSE error 事件人话**（配置错误 → error 事件，**不抛异常不 500**） | probe-error-cases ① |
| 上游非 200（4xx/5xx） | error 事件 `API 请求失败: <status> — <body 前 300 字>`（**截断 300 字**；完整错误体只落 server /tmp 日志） | chat.ts:337 |
| 网络层失败（fetch 抛） | 重试 2 次（2s/4s 线性退避）→ error 事件 `网络错误…` | chat.ts:303-327 |
| 上游流内错误块（`chunk.error` / `type:'error'`，无 choices） | error 事件 `模型服务错误：…`（**不许静默结束**） | chat.ts:385-389 |
| 用户取消 | error 事件 `已取消` **入流收尾**（取消也是对话信号，不许静默断流） | chat.ts:284 |
| 双路 401 方言 | Kimi `{error:{message,type}}` / 智谱 `{error:{code:"401",message}}`（code 是字符串）——统一取 message | upstream-error-cases |
| 不存在 runId 挂 stream | 直接 `__end__`，不 404 | probe-error-cases ④ |

SSE 分帧（与 kfmv4 逐字节一致，B/C 档对拍基准）：帧 =
`data: {"index":N,"event":{...}}\n\n`（index = 重连 cursor）；**无 `event:`
行**；终结帧 = `data: {"type":"__end__"}`。

## 二、文件组织（na 三层分离落到 nz）

三层分离：纯逻辑零 IO / 脑插座接口（start/cancel/attach）/ IO 装配。
echo 夹具脑与 direct 脑同接口，换脑零改动。

### 2.1 server 侧新增

```
nz/src/shared/chat-protocol/          ← 协议层（双端共享，纯逻辑零 IO）
  events.ts  messages.ts  reducer.ts  block-idx.ts     ← kfmv4 原样复制四件
  to-openai-messages.ts               ← A1 简版新写（§1.1，~70 行）
nz/src/server/ai/
  sse-parser.ts        ← 纯逻辑：feed(chunk)→frames。碎喂/粘包/半帧/CRLF/
                         注释行/[DONE] 容忍（na SseParser 同语义；
                         chat.ts 的 buffer split('\n') 逐行法为参照实现）
  openai-translator.ts ← 纯逻辑：上游 chunk JSON → StreamEvent[]。
                         方言全容忍（role 每帧重复 / 空 delta:{} /
                         choices:[] usage 帧 / system_fingerprint 有无 /
                         未知字段）；usage 只记账不进事件流；
                         reasoning_content → thinking_delta
  providers.ts         ← loadProviders + resolveKey 代字 fuse
                         （env-store 精简复刻：parseEnv/loadEnvFile/resolveKey，
                         mtime 缓存；无 upsertEnvVar——A1 不写配置）
  brain.ts             ← 脑插座接口 + 两个脑 + run 登记表：
                         interface BrainEndpoint {
                           start(req): RunHandle            // 开 run，吐事件流
                           cancel(runId): boolean           // 尽力而为
                           attach(runId, from): 事件流       // 回放[from:]+尾随
                         }
                         · DirectApiBrain：fetch 直连 provider（IO），
                           组装 requestBody（model/messages/stream/
                           stream_options.include_usage），AbortSignal 透传，
                           TTFB/first-delta/usage 落观测日志
                         · EchoBrain：回放 nz/tests/fixtures/ai-chat/ 的
                           probe-*.sse（真流 fixture 当节目单），pace 节奏
                           注入（默认 5ms/事件，可配 0=尽快），取消→
                           error '已取消' 收尾，attach 历史后缀回放
                         · run 登记表（内存 Map）：events 缓冲（封顶 1 万条）、
                           cursor、done 后 5min 淘汰、同会话新 start 取代旧
                           run——这是薄层不是 8.x run-manager（无落盘、无
                           会话档案、无权限钩子）
  route.ts             ← IO 装配：mountAiChatRoutes() 把三端点接进
                         src/server/index.ts 的 raw http handler（静态服务
                         分支之前；nz 无 express，kfmv4 routes.ts 不可直接
                         搬——见 §八⑤）：
                           POST /ai/chat/start   body{messages,model?,provider?}
                           GET  /ai/chat/:runId/stream?from=N
                           POST /ai/chat/:runId/cancel
                         脑选择：provider === 'echo' → EchoBrain
                         （B 档/断网开发走 HTTP 全链，无需换进程）；
                         NZ_AI_BRAIN=echo → 全局强制 echo（真 key 也不直连）
  index.ts 改动        ← 一行：mountAiChatRoutes() 挂进请求处理链
```

### 2.2 client 侧新增（插件，守 plugin-contract）

```
nz/src/client/plugins/ai-chat/
  index.tsx            ← UiPlugin：id 'ai-chat'，
                         stateMachine: 'docs/ai-chat-a1-design.md'（契约 §7
                         机检锚点）；挂法照 tmux-tabs 先例：main.ts 里
                         host.create(overlay) + uiKernel.mount
  chat-link.ts         ← 脑（纯 TS，不碰 DOM 框架）：SSE client（fetch +
                         ReadableStream，不用 EventSource——要带 method/
                         自定义头，且 cursor 查询参数自己控）、cursor 跟踪
                         （R2：信封 index 必须跟踪）、reducer 驱动
                         AiChatState、断线重连 attach from cursor、
                         观测环（≥50 拍 {t,type,idx}）
  ui/
    message-list.tsx   ← 皮：消息列表（chat.tsx 词汇重写）
    streaming-text.tsx ← 皮：流式气泡（streaming-text.tsx 词汇重写）
    prompt-bar.tsx     ← 皮：输入栏（prompt-bar.tsx 裁剪重写）
nz/tests/fixtures/ai-chat/   ← 从 kfm-na 借六份（原样复制，~28KB）：
  upstream-kimi-k2.7-highspeed-20260830.sse   ← A 档 translator 判卷输入
  upstream-glm-5.3-flash-20260830.sse         ← 同上，第二路方言
  upstream-error-cases-20260830.txt           ← 双路 401 实录
  probe-kimi-k3-256k-20260830.sse             ← 九事件标准答案（44 事件）+
                                                EchoBrain 节目单甲
  probe-glm-5.3-flash-20260830.sse            ← 第二路互证（40 事件）+ 节目单乙
  probe-error-cases-20260830.txt              ← kfmv4 错误语义实录
```

注意两族 fixture 的分工（诚实登记，防误用）：`upstream-*` 是**原生端点**
直连实录（translator 的输入）；`probe-*` 是 **kfmv4 服务端**吐出的九事件
流（reducer/echo 的判卷基准）。两族模型不同（k3-256k vs k2.7-highspeed）、
内容不同，**只能对拍形状，不能逐帧对拍内容**。

## 三、UI 设计

### 3.0 总体形态（2026-09-04 真机拍板改版 + 同日二拍换序⑦ + 三拍⑧ + 四拍⑨方案1）

常驻 orb（**屏幕右边缘垂直居中=右中**，2026-09-04 用户拍板自右上挪位——
右上与顶部伸出的 tmux 标签排 max-content 宽度冲突；左上 tmux orb 不动）=
AI 页**唯一开关** + 运行指示灯（闲暗 /
STREAMING 亮，静态换色零常动帧）；点按 → 全屏 AI 页（消息列表）↔ 终端。
页面切走 run 不死（server 缓冲），切回自动 attach
补流——与 tmux-tabs 的「socket 断开会话不死」同哲学。

**composer 全局化**（2026-09-04 真机拍板① + 同日二拍换序⑦）：composer 从
AI 页拆出，钉在中央终端页面**最底**全局常驻（TERMINAL/AI_PAGE 两态都在、
都可发送；位置 = 贴软键盘/视口底、随软键盘上浮——visualViewport 跟踪，
钉 vv 同哲学；**换序后 keybar 钉在 composer 正上方**——点开软键盘时输入栏
必须与软键盘直接接触，旧序 keybar 垫底把输入栏和键盘隔开了）。发送
永远去 AI；终端输入照旧走 IME 诱饵。焦点语义三立：点 composer=跟 AI 说话、
点终端=跟 shell 说话（kb 诱饵照旧）、keybar 继续服务终端——三者焦点不打架
（composer 在 overlay 层，点击不触达终端容器的 kb.focus 路径，IME 防线纪律
不回退）。

**无返回按钮**（拍板②）：AI 页顶栏左侧返回按钮删除——orb 即唯一开关
（A2 = 点 orb）。

**入场动画**（拍板③）：AI 页整体自顶部向下平移入场
（translateY(-100%)→0），收起反向（translateY(0)→-100%，播完才摘 DOM）；
时长/曲线走 tokens（--kfm-dur-normal/--kfm-ease-out），皮内禁硬编码（P11）。

**层级规则**（拍板④ + 主会话裁定⑤，从底到顶）：终端（含 tmux 控件 /
keybar）→ AI 页 → composer + AI orb。

- AI orb 与 composer 的层级恒在 AI 页之上（否则页盖住球关不掉）；
- AI 页打开时 tmux orb+标签栏**隐藏**（不渲染/不可见——
  `:root[data-kfm-aichat-open]` 下 display:none，不是被盖）；
- composer 钉底不被 AI 页盖：composer z43 恒在 AI 页（z42）之上。拍板⑧
  （同日三拍）+⑨（同日四拍方案1）：**AI 页底=composer 顶**——面板落到
  输入栏上面，打开时把 keybar 两排快捷键盖住（keybar 在 composer 上方，
  页落到 composer 顶正好仍盖着它——终端逻辑与 AI 对话逻辑是两套，keybar
  属终端，不应在 AI 页继续显示），且内容在面板内滚动到底时底部文字
  几何上不可能被钉底 composer 盖住（方案1要解决的病）；键盘弹起时页底
  随 composer 一起上浮（=键盘顶上的 composer 顶）。composer 高度经
  ResizeObserver 实测，`--kfm-aichat-composer-h` 单源下发（AI 页底公式
  与终端 scrollEl 预留/keybar 钉位同源）；终端 scrollEl 底部预留
  KEYBAR_H+composer-h（总量与换序前相同，内部次序颠倒：composer 在下贴
  软键盘/视口底、keybar 在上——不盖 shell 提示符）；TUI/ALT 态 composer
  同样常驻，TUI 底部数学不变（scrollClientH==vh−KEYBAR_H−composerH）。

### 3.1 BeautifulUI 三件搬运清单（诚实定性：是重写，不是搬源码）

三件剪藏件全部是**自运行演示组件**（chat.tsx = Phase 定时器剧本；
streaming-text.tsx = 假 token 循环播放；prompt-bar.tsx = AUTO_STEPS 自动
表演 + glimm 依赖），不存在「接入数据源即用」的搬运形态。实际工作 =
**借视觉词汇与结构，重写为数据驱动组件**（MIT 许可，无版权问题）：

| 件 | 借 | 裁 |
|---|---|---|
| chat.tsx（187 行） | 三段结构（头部/消息区/composer）、用户气泡右对齐软块、`fade-up` 入场动画 | Phase 剧本定时器、假数据、tabs、三个 action 钮、Section 组件 |
| streaming-text.tsx（207 行） | 流式中光标（竖条闪烁）、完成后行动条浮现的骨架思路 | 假 TOKENS 循环、SourceChip/SOURCES 来源 chips、follow-ups、四个 ACTION_ICONS；**逐词 blur 入场动画不搬**——WORD_MS 55 是假节奏，真流是 token 不是词，按 delta 驱动逐词动画既不对拍真节奏又有每词一次 animation 的渲染成本；A1 正文直接渲染 + 光标，动画后置 |
| prompt-bar.tsx（669 行） | composer 外壳（边框聚焦态 / 圆角 / 发送钮配色）、**自动长高 textarea 方案**（隐藏 measure span 量宽 + scrollHeight 定高 + min 28/max 100） | **glimm 彩虹扫光**（glimm 依赖 09-03 已裁决不搬）、AUTO_STEPS 自动表演、@ 数据源菜单（SOURCES/BRANDS/附件）、/ 命令菜单、听写钮、expanded 双栏 grid（手机窄屏直接竖排）；model picker **保留极简版**（数据来自 `GET /ai/providers` 只出 id/name/models，理由见 §八③） |

### 3.2 Tailwind → tokens 翻译方法

nz 不引入 Tailwind。翻译规则（学 keybar P5 先例）：

- **颜色/阴影/圆角/动画时长 → tokens.css `--kfm-*` 语义变量**，皮文件出现
  十六进制色值 = 钉红；**结构尺寸**（padding/gap/字号/宽高）留组件 inline，
  不受禁令管。
- tokens.css 新增 `ai-chat` 专用段（学 keybar/tmux-tabs 专用段先例）：
  `--kfm-field: #2b2c2f`（BeautifulUI dark field，气泡/输入框底）、
  `--kfm-accent-ink: #7ec0ff`、`--kfm-accent-tint: rgba(61,154,255,0.16)`、
  `--kfm-shadow-hairline/card/raised`（照 BeautifulUI globals.css 深色段
  原值收编）。**存量 token 一律不改**——注意 nz 现有 `--kfm-line: #3a3b3f`
  与 BeautifulUI dark `--line: #2e3033` 不一致（nz 的 line 更像 BU 的
  line-strong），新段按 BU 原值收编新 token，不回头「修正」存量
  （存量已被 keybar/tmux-tabs 占用，改 = 视觉事故）。
- 选择器照既有形态：`[data-kfm-aichat] …` 挂在 tokens.css，组件只标
  data 属性。

### 3.3 交互状态机（清单体例；词汇表唯一真源）

**状态枚举**：

| 状态机 | 状态 | 含义 |
|---|---|---|
| 页面机 | `TERMINAL` | 终端页（orb 常驻可见） |
| 〃 | `AI_PAGE` | 全屏 AI 对话页 |
| 运行机 | `IDLE` | 无活跃 run，输入栏可发 |
| 〃 | `WAITING` | 已发送、未收首事件（用户消息已入格） |
| 〃 | `STREAMING` | 事件流到达中（发送钮 = 停止钮） |
| 菜单机 | `CLOSED` / `MODEL_OPEN` | 模型选择器（挂在 prompt-bar 内） |

**转换表**（手势与环境事件同列）：

| # | 起点 | 触发 | 终点 | 底层动作 |
|---|---|---|---|---|
| A1 | `TERMINAL` | 点 orb / **composer 发送**（拍板⑪：发送=主动说话意图，等效点 orb 自动开页；反向不成立——AI_PAGE 态发送=页内发送，无转换） | `AI_PAGE` | 纯 UI；入场动画 translateY(-100%)→0（P11）；有活跃 run → attach from cursor 补流 |
| A2 | `AI_PAGE` | 点 orb（**唯一开关，无返回按钮**） | `TERMINAL` | 纯 UI；收起动画 translateY(0)→-100% 播完才摘 DOM；run 不死（server 缓冲） |
| A3 | `IDLE` | 输入非空 + **点发送钮**（拍板⑭：composer 回车=换行不发送，发送唯一路径=按钮） | `WAITING` | 用户消息入格 → POST /ai/chat/start |
| A4 | `WAITING` | 首个 SSE 事件 | `STREAMING` | cursor 起记，reducer 起约 |
| A5 | `STREAMING` | delta 事件 | `STREAMING` | applyEvent 原地 mutate → 重渲染气泡 |
| A6 | `STREAMING`/`WAITING` | `done` | `IDLE` | 收流（半截尾巴兜底：reasoning 归位 R3 生效） |
| A7 | `STREAMING`/`WAITING` | `error` 事件 | `IDLE` | 错误文案入流为消息内容（不是 toast） |
| A8 | `STREAMING`/`WAITING` | 点停止钮 | `IDLE` | POST cancel → error `已取消` 入流收尾 |
| A9 | 任意 | 通道断（fetch 流断/页面回前台） | 原状保持 | 重连 attach from cursor 补流；补不上 → error 事件入流 |
| A10 | `CLOSED` ↔ `MODEL_OPEN` | 点模型钮 / 选定 / Escape / **点菜单外任意处**（拍板⑬：动作同发——document pointerdown 捕获阶段 passive 监听，不 preventDefault，菜单 DOM 内与模型钮豁免） | 互转 | 数据源 = GET /ai/providers（只出 id/name/models）；拍板⑫两级路由：一级 provider 列表 → 点 provider 下钻二级 model 列表（下钻不收，返回钮回一级），二级点定 model 才选定收起；server 默认模型不在 models[] 就合成常驻行置顶（标注「默认」）；下钻层级是 picker 内部 UI 态，不进菜单机词汇 |

**禁止条款**：

- **P1** 禁止：key 出服务器——client bundle / 网络载荷 / 观测钩 /
  server 日志任何一处出现 apiKey = 钉红；`/ai/providers` 不出 apiKey；
  上游 Authorization 头只活在 DirectApiBrain 内。
- **P2** 禁止：流式期间并发第二 run——`WAITING`/`STREAMING` 中发送钮
  恒为停止钮（A8）；server 侧同会话新 start 取代旧 run 兜底。
- **P3** 禁止：配置/上游错误走 HTTP 500 或未捕获异常到 client——一律
  error 事件入流（§1.4 表即法）。
- **P4** 禁止：上游错误体超 300 字进 error 事件（完整体只落 /tmp 日志）。
- **P5** 禁止：取消后静默断流——必须有 `已取消` error 事件入流收尾。
- **P6** 禁止：每 delta 重建消息 DOM——streaming 气泡节点身份稳定
  （React key 稳定），delta 只追加文本；整条列表重挂载 = 钉红。
- **P7** 禁止：皮内硬编码样式字面量（颜色/阴影/圆角/时长全走 `--kfm-*`，
  keybar P5 同款）。
- **P8** 禁止：工具类事件（tool_use/tool_result/rule_warning）到达时抛错
  或断流——容忍忽略，不渲染。
- **P9** 词汇表强制统一：`TERMINAL`/`AI_PAGE`/`IDLE`/`WAITING`/`STREAMING`/
  `CLOSED`/`MODEL_OPEN`，清单外状态名 = 规格外状态 ≈ bug 候选。
- **P10** 层级禁止倒挂（2026-09-04 拍板④+裁定⑤）：composer 与 AI orb 恒在
  AI 页之上（z 序：终端/tmux 控件 < AI 页 < composer=AI orb）；AI 页打开时
  tmux orb+标签栏必须**隐藏**（display:none 不渲染档，不许「被盖」态）；
  composer 全局常驻——TERMINAL/AI_PAGE 两态都在且可发送，AI 页与终端内容
  区都不得盖住 composer（底部避让 `--kfm-aichat-composer-h`）。
- **P11** 动画时长/曲线禁硬编码：AI 页滑入/收起只许引用
  `--kfm-dur-normal`/`--kfm-ease-out`（JS 侧等待时长也从 token 计算样式读，
  不写魔法数）。
- **P12** 焦点禁止互抢：点 composer 不许触发终端 IME 诱饵的 kb.focus 链路，
  点终端/keybar 照旧走诱饵——composer 获焦后诱饵不得回抢（ime-pan 全卷
  不回退是这条的判卷腿）。

## 四、观测与自测纪律（用户硬要求：全程能测试 + 看到 API 调试结果）

### 4.1 echo 夹具脑断网开发

- `provider: 'echo'` 经 HTTP 全链走 EchoBrain（回放 probe fixture，pace 可配）
  ——B 档考卷与断网开发共用这一条腿，不需要任何真 key、不需要网络；
- `NZ_AI_BRAIN=echo` 全局强制（真 key 在场也不直连，排障隔离层）；
- echo 的节目单就是 na 抓的真流 fixture——**假数据的形状 = 真数据的形状**，
  这是「fixture 驱动断网可开发」的全部含义。

### 4.2 观测钩（随插件走，属公共契约，plugin-contract §2）

`__kfmNzAiChat()` 同步报：

```ts
{
  page: 'TERMINAL' | 'AI_PAGE',
  run: { phase, runId, provider, model, cursor, deltas, chars, startedMs } | null,
  messages: [{ role, blocks, chars }],        // 摘要，不回全文
  lastEvents: [{ t, type, idx }],             // 环形 ≥50 拍
  lastError: string | null,
}
```

### 4.3 API 调试结果对 agent 可见（server 侧落盘，学 IME/BOOT_MARKS /tmp 先例）

- **`/tmp/nz-ai-chat.log`（JSONL，env `NZ_AI_CHAT_LOG` 可覆盖）**，每个 run
  逐拍落：`start{runId,provider,model,msgCount,bodyBytes}` →
  `upstream-status{status,ttfbMs}` → `first-delta{atMs}` →
  `done{deltas,chars,usage,ms}` / `error{kind,message≤300字}`。
  **不落 key、不落完整消息正文**（摘要与计数足够判卷，正文在 UI/钩子里）。
- `NZ_AI_DEBUG_BODY=1` 时请求/响应全文落 `/tmp/nz-ai-chat-body-<runId>.log`
  （Authorization 头脱敏后）——深排障专用，默认关。
- agent 后台观测姿势：`tail -f /tmp/nz-ai-chat.log`（server 真值，L2 互证腿）
  + CDP 读 `__kfmNzAiChat()`（前端状态，L3 腿）——两条独立失败模式，
  合 nz AGENTS.md 验证纪律。

## 五、考卷映射

### A 档 · 纯逻辑钉（判卷基准 = na fixture，红先）

| 钉 | 验证 | 手段 |
|---|---|---|
| A1 | sse-parser：碎喂/粘包/半帧/CRLF/注释行/`[DONE]`/多 data 行 | 构造输入逐喂字节，断言帧序列 |
| A2 | translator：`upstream-kimi` fixture → 九事件序列形状（start→block→deltas→stop→done）、thinking/text 分流正确 | fixture 全文过 translator，断言事件类型序列 + delta 归并 |
| A3 | reasoning 归位 R3：text 空且 reasoning 非空 → 显示层归位正文 | translator+reducer 产物断言 |
| A4 | 方言容忍：role 每帧重复（glm）/ `choices:[]` usage 帧（kimi）/ 空 `delta:{}` / system_fingerprint 有无 / 未知字段 | `upstream-glm` fixture 全绿 + 构造异形帧 |
| A5 | 错误语义：双路 401 实录 → error 事件人话；非 200 截 300 字；配置错误 → error 事件不例外 | `upstream-error-cases` 实录回放 + 构造响应 |
| A6 | 代字 fuse：env 优先 / .env 其次 / missingVar 人话 / 绝不裸发代字 / **中文 id 塌缩回归**（两条目显式不同 `${VAR}` 不串号） | providers.ts 直接喂临时 providers.json/.env |
| A7 | reducer：probe fixture 44/40 事件 → messages 结构（流式混排/Error 收流成消息/工具事件容忍） | `probe-kimi`/`probe-glm` 全文过 reduceEvents |
| A8 | 简版 to-openai-messages：ts 前缀只盖 user / 占位符过滤 / 空壳 assistant 丢弃 | 构造 messages 断言载荷 |

变异抽检：thinking↔text 换轨必咬 A2/A3；归位删除必咬 A3；fuse 缺失裸发
必咬 A6（照 na 变异双咬先例）。

### B 档 · echo 脑驱动 UI 全链（Playwright headless）

| 钉 | 验证转换 | 手段 |
|---|---|---|
| B1 | A1/A2 orb 往返（A2 = 点 orb，无返回按钮；P10 唯一开关） | 点 orb → AI_PAGE；再点 orb → TERMINAL；词汇表钉 + 返回按钮不存在断言 |
| B2 | A3→A6 发送-流式-完成 | echo 节目单回放 → 消息只增、delta 逐字上屏、done 收流 |
| B3 | A8 取消 | 流式中点停止 → `已取消` 入流、回 IDLE |
| B4 | A7 错误入流 | echo 错误节目 → error 文案成消息、页面不崩 |
| B5 | P6 只增不重建 | streaming 期间气泡 DOM 节点身份断言（同一引用） |
| B6 | P9 词汇表 | `__kfmNzAiChat()` ring 状态名 ⊆ 清单枚举 |
| B7 | P1 key 不出服务器 | `/ai/providers` 响应 + 全链路载荷 grep 无 key 形态 |
| B8 | 滑入/收起动画（拍板③，P11） | 拨 `--kfm-dur-normal` 杠杆：中间帧 transform=负 ty 矩阵、animationName/Duration 跟随 token；收起 kfm-closing/page-out 播完才摘 DOM；中间帧截图存证 |
| B9 | 层级规则（拍板④，P10） | AI 页开 → tmux orb/标签栏 display:none；z 序数值断言（AI orb > AI 页 > tmux orb）；点 AI orb 可关页（可见可点唯一开关） |
| B10 | composer 全局常驻（拍板①，P10） | TERMINAL 态 composer 存在可见（关态可发送语义被拍板⑪改写，见 B13） |
| B11 | 焦点不打架（拍板①裁定，P12） | 点 composer → 焦点落 composer 且 400ms 不被诱饵回抢；点终端 → 焦点回落 IME 诱饵 |
| B12 | 底部避让（拍板①+换序⑦+⑧+⑨方案1，P10） | 终端 scrollEl 底=keybar 顶（预留 KEYBAR_H+composer-h 不盖提示符）；keybar 底=composer 顶；composer 底=视口底（无键盘）/键盘顶（弹起，直接接触）；AI 页底=composer 顶（落输入栏上面盖住 keybar：页接住 keybar 中心点=不可点，composer 仍可点；长内容滚到底末条消息底≤composer 顶不被盖）；钉底+键盘上浮+滚到底截图存证 |
| B12e0 | 被动 delta 不拽回（拍板⑩对照钉） | 上滚阅读中慢流式新 delta 到达 → 列表留在原地（st+ch<sh−40），不自动追底 |
| B12e | 点输入栏追底（拍板⑩主钉） | 上滚态点输入栏 + mock vv 键盘上浮 → 列表追底锚定最新（st+ch≥sh−5，末条底贴 composer 顶）；触发前 stillUp 断言确在上滚态；上滚态+追底两截图存证 |
| B13 | 发送后自动开页（拍板⑪） | TERMINAL 态 composer 发送 → 即转 AI_PAGE（等效点 orb）+ 滑入动画在场（token 杠杆取中间帧，page-in 负 ty）+ echo 全链收流 + 用户消息立即可见；反向钉：AI_PAGE 态发送 page 不往返；自动开页截图存证 |
| B14 | picker 两级路由（拍板⑫；默认=拍板⑮智谱 glm-5.3-flash） | 一级=provider 列表（数量=/ai/providers，当前 provider ✓ 可辨识，不出 model 行）→ 点 provider 下钻不收（返回钮在场）→ 二级=model 列表+默认模型行带「默认」标注（期值动态：默认在 models[] 内不合成——智谱现状 rows=2；不在则合成常驻行置顶——机制保留防未来）→ 点定默认行生效收起（btn 文案变）；二级当前 model 行 ✓ 可辨识；返回钮回一级仍 MODEL_OPEN；一级/二级截图存证 |
| B15 | picker 点外即关+动作同发（拍板⑬，tmux-tabs T15 同款） | 菜单开→点终端区→CLOSED 且终端诱饵同指聚焦（双断言）；菜单开→点 composer→CLOSED 且焦点同指进输入框（前置断言防假绿）；菜单内点 provider 下钻不收（回归）；点外即关前后截图存证 |
| B16 | composer 回车=换行不发送（拍板⑭） | 按 Enter → draft 含 \n 且 run 未起（messages 不变）；点发送钮 → run 起消息入格（发送唯一路径）；多行内容气泡换行保真（pre-wrap textContent 含 \n）；输入栏两行截图存证 |

### C 档 · 真机

| 钉 | 验证 | 手段 |
|---|---|---|
| C1 | 真 provider 发一条收流式（Kimi `kimi-for-coding-highspeed`） | 真机/实验台发「用一句话介绍你自己」，截图+CDP 读钩 |
| C2 | 第二路方言实测（智谱 `glm-5.3-flash`） | 同尺 |
| C3 | agent 后台观测闭环 | `/tmp/nz-ai-chat.log` 有 start/status/first-delta/done 全程 + `__kfmNzAiChat()` 读数互证 |

### 回归属（不许弄红的现有卷）

- `npm test`（tests/index.test.ts 全量：server / ws-bridge / term-connection /
  tmux-connection / keymap / permission / ctx-kernel / host / plugtest / eyes /
  card-types / palette-bold-bright / term-core-shared / bridge-heartbeat）；
- browser 卷：`keybar-click`（21 钉）/ `tmux-tabs.test` / `ime-pan` /
  `scrollback` / `term-hooks` / `kernel` / `bottom-anchor` / `cjk-*` 等——
  A1 改动面（index.ts 加路由 + main.ts 加插件挂载）碰了任何一卷 = 红先立钉。

## 六、验收判据（A1 DoD）

1. **真机发一条消息收到真实流式回复**：Kimi 与智谱两路各一次，逐字上屏
   可见（截图/CDP 证据），取消与错误各演一次；
2. **agent 可后台观测全过程**：`/tmp/nz-ai-chat.log` 全程记录（TTFB/首
   delta/usage/错误）+ `__kfmNzAiChat()` 报全机位，两腿互证一致；
3. A/B 档考卷全绿 + 变异抽检双咬；
4. 回归属现有卷零回退。

## 七、工作量预估

| 块 | 估 |
|---|---|
| 协议层四件复制 + 简版投影 + A 档钉 | 1 天 |
| server 薄层（sse-parser/translator/providers/brain×2/route）+ A 档钉 | 2 天 |
| echo 夹具 + fixture 借用 + B 档考卷 | 0.5–1 天 |
| client 插件（chat-link 脑 + 三件皮重写 + orb/页面） | 2 天 |
| C 档真机双路 + 观测闭环 + 通报 | 0.5 天 |
| **合计** | **约 5.5–6 天** |

## 八、异议与备选（读源码后的诚实登记，签收时逐条拍板）

1. **`to-openai-messages.ts` 全量搬不动**（与拍板决策的偏差，最大一条）：
   它 import 整个 `tool-compaction/` 树——那是比 run-manager 更重的 8.x
   重件，且全部语义服务工具调用压缩，A1 无工具。本文取「简版新写、保留
   三条事故规则」；备选 = 整树搬入（明确反对，违背「重件一件不搬」）。
2. **BeautifulUI 三件是演示组件不是库组件**：「搬运」实为重写，工作量已
   按重写估；streaming-text 的逐词 blur 动画建议 A1 不搬（假节奏对不上
   真流 + 渲染成本），只搬光标。若用户要逐词动画，单独立项做「delta 驱动
   的词边界缓冲层」，别在 A1 夹带。
3. **prompt-bar 的 model picker 建议保留极简版**（数据来自
   `/ai/providers`）：多 provider 方言差异需要真机实测通道，na 双路 live
   对拍的价值已实锤；裁掉则默认固定 Kimi `kimi-for-coding-highspeed`，
   换 provider 只能靠改请求。请拍板。
4. **配置直读 `~/.kfmv4/`**（本清单取此）：零重复配置，但耦合 kfmv4 数据
   目录；备选 = nz 自备 `~/.kfm-nz/`（na 的 deploy-ai-config.sh 模式，
   多一次同步，key 双份落盘）。`NZ_AI_CONFIG_DIR` 覆盖机制两边通用，
   9.0 收口再迁不迟。
5. **kfmv4 `routes.ts` 不可搬**（express 形态，nz 是 raw node:http）：
   与「新写薄层」拍板一致，无冲突；但意味着错误语义/cursor 语义只能靠
   fixture 钉住（A5/A7/B 档），没有代码移植的捷径。chat.ts 可搬的实质
   只有：SSE 逐行解析法、thinking+text 同块设计、网络重试参数、错误
   文案模板——已全部落进 §一/§二，不需要更多。
6. **run 登记表是薄层不是 run-manager**：内存 Map + 封顶缓冲 + 5min
   淘汰，约百行；不做落盘、不做会话档案。若用户认为 A1 连 attach/重连
   都不需要（纯 say hello），可再裁到「单 run 无缓冲」，但 B 档 A9 与
   页面切换补流（A1 转换）随之消失——建议保留。
