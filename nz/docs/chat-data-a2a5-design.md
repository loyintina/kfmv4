# 对话数据落地 A2a.5 · 设计清单（行为层规格 + 实现清单）

> 这是什么：AI 专题（TASK.md §0.7）A2a.5 阶段「对话数据落地」的设计清单——
> 会话消息真落盘（session-store lineage）+ 角色激活真生效（prompt-assembler
> 最小版）+ 标题栏下拉真切换（快选接池路由）+ 上下文压缩与三数字
> （compact-core lineage）。**两阶段交付，只写本文档不写实现，用户签收后开工。**
> 照此可实现。
> 语义来源：ai-chat A1 清单（nz/docs/ai-chat-a1-design.md：消息核/reducer/
> run 登记表/错误语义）+ 配置池 A2a 清单（nz/docs/config-pool-a2a-design.md：
> 池数据层/session 池壳/激活总账）+ kfmv4 搬运源原文
> （src/server/ai/session-store.ts 337 行 / prompt-assembler.ts 123 行 /
> compact-core.ts 109 行 + chat.ts 的 system 组装与 usage 落盘段 +
> orb-chat-run.ts 的自动压缩段 + session-client.ts 的字段族 + routes/compact.ts
> / files.ts:187-258 会话元数据投影）+ nz 现状源码（chat-link.ts / brain.ts /
> route.ts / pool/*.ts / ai-chat/index.tsx）。
> 被吸收关系：TASK 8.12.1（session-store「会话日志唯一写者」承重墙）在 nz 的
> 落地立项点；config-pool §八①空白点（session 池 v0=壳、落盘留
> session-store lineage）由本清单收口；A2b 眼睛挂载点（dynamicPromptFiles）
> 本清单只保字段与函数占位不实现。
> 纪律：**清单用户签收 → 考题先行（红先）→ 实现 → 变异抽检**；
> 全程 agent 保有测试与 API 调试可见能力（§六）。
> 状态：**已签收**（2026-09-05 用户拍板，§八十二条全按推荐执行）。
> 仲裁记录补充（签收时逐条确认）：
> ① 水合=直挂归约后 messages，不需 reducer 重放（勘误）✅；
> ② 窗口口径=含 system+摘要段（与 API 实测直接可比）✅；
> ③ start 请求形状 break：{text, sessionId?}，messages 全量上行退役，无兼容过渡 ✅；
> ④ 会话 id 与标题解耦（不搬 v8「标题即文件名」重命名链——串档事故区）✅；
> ⑤ 唯一写者=独立 store 模块（字段族写者矩阵：壳=池层/消息族=store）✅；
> ⑥ provider 条目加可选 contextWindow（登记制，未登记不压）✅；
> ⑦ 摘要用当前 provider（回落总账，零新配置）✅；
> ⑧ 流式期间禁切会话（P18；切换+后台续流留 A3 run-manager lineage）✅；
> ⑨ v8 缺陷修正四条全收（压缩前强制 flush/异步化/当轮重算窗口/登记制）✅；
> ⑩ server 重启孤儿 run 知悉（不越拍板②边界，run 持久化留 A3）✅；
> ⑪ 总账写点三类白名单（会话切换恢复绑定=拍板③直接推论，仲裁变更乙）✅；
> ⑫ 压缩中发送可能撞超限错误入流、重发即好（知悉）✅。
> 排队登记（2026-09-05 用户拍板）：**上下文压缩可视化**——重要不紧急，
> 阶段②交付后立项（窗口/全量/实测三数字随轮次曲线+压缩事件时间线）。
> 考卷蓝本：A 档 `tests/ai-session-*.test.ts`（临时 dir 注入）+
> B 档 `tests/browser/`（echo 脑驱动全链）+ C 档真机（杀 App 重开续聊）。
> 仲裁记录（2026-09-05 用户拍板，本清单不许推翻、只许落实）：
> ① **两阶段**：阶段①=会话落盘+角色生效+下拉真切换（基础闭环，不依赖②）；
>    阶段②=上下文压缩+三数字 ✅；
> ② **搬两件半**：session-store 语义 / prompt-assembler 最小版（静态
>    promptFiles 拼接，dynamicPromptFiles 留 A2b 口）/ 简版投影（已有，接上）。
>    **不搬**：run-manager、compact 之外的重件、tools/permissions、paradigm、
>    AgentConfig ✅；
> ③ **会话切换恢复绑定**：切回会话=provider/model 恢复该会话记录值（写激活
>    总账），不是保持全局不动 ✅；
> ④ **压缩三纪律**：飞行记录仪原则（原始消息永不删除，压缩只改发送窗口，
>    全量永在文件里）；三数字语义钉死（全量=文件内实际消息、窗口=实际发送、
>    实测=上次 API usage.prompt_tokens 回填，会话条目+对话页角标可见）；
>    异步触发不挡路（窗口超阈值后台压缩，用当前 provider 生成摘要）✅；
> ⑤ **存储**：会话文件=~/.kfmv4/sessions/<id>.json（session 池同址同文件，
>    池条目即会话文件，消息数组进正式字段）；唯一写者=server；client 只读 ✅；
> ⑥ **下拉栏**：角色/会话变成真快选（条目来自池、当前项标识、选定即激活），
>    「管理」仍跳池页；切换角色=下一条消息起 system 生效+一声系统提示入流
>    （不搞魔术）✅。
> **仲裁变更（本清单对前作的修订，签收即生效）**：
> 甲、config-pool 仲裁①「session 池 messages 恒空禁写」**由本清单修订解除**——
>    messages 成为正式字段、获得真写者（server 侧 store 模块）；但「池 API
>    投影不出消息全文」保留（那是投影行为不是禁令，§一 1.3）；写路径分治见
>    §二 2.1 字段族矩阵；
> 乙、config-pool §2.4「激活总账只被池页/picker 显式动作改写」**扩展**：会话
>    切换恢复绑定（仲裁③）成为总账第三类合法写点（§五 D3）。

## 〇、范围与边界（什么做、什么不做）

**A2a.5 = 对话数据从内存到磁盘**：A1 的消息核仍是内存态、刷新即清；本清单
把「发送→流式→收尾」全链接上会话文件真相源，角色从「被记住」变成「真生效」，
下拉从「占位入口」变成「真快选」；阶段②再把长对话的窗口问题接上压缩线。

| 做 | 不做（A2a.5 边界，越界=返工源） |
|---|---|
| 〔①〕server 侧 session-store 模块（v8 语义照落：防抖落盘/强制 flush/hydrate 白名单/非法 id fail-closed） | 工具循环（tool_use 照旧容忍忽略——落盘后文件里会有 tool 块的形状兜底，但 nz 不执行工具；工具真接入留 A3） |
| 〔①〕发送管线改向：history 从会话文件来（server 侧投影→messages），client 不再上行全量 | run-manager（run 仍是内存登记表薄层；run 落盘/跨重启续流不做，§八⑩登记边界） |
| 〔①〕assistant 落盘点（done/error/abort 强制 flush + 防抖 200ms） | 多端协同写（kfmv4 面板与 nz 同机共读会话文件的双端边界不监听不锁——沿用池层仲裁②同款诚实边界） |
| 〔①〕会话水合：切换/重开拉全文挂消息核 | token 预算外的智能路由（按成本/延迟选模型、自动换 provider——发明，不做） |
| 〔①〕prompt-assembler 最小版：静态 promptFiles 拼接→system，每 start 重读；无角色出厂基线 | dynamicPromptFiles 装配（眼睛系统——函数占位留 A2b 口，§三 3.5） |
| 〔①〕下拉真快选（角色/会话两区、条目来自池、当前项 ✓、选定即激活、管理跳池页） | 压缩的 UI 编辑（手动编辑/删除摘要、改 cutIndex——只读展示，编辑不做） |
| 〔②〕压缩线：阈值触发+后台摘要+切点投影+固化 compacts | v8 工具压缩（tool-compaction 整族一条不搬——nz 无工具循环，无压可压） |
| 〔②〕三数字：全量/窗口/实测（文件字段+池壳投影+对话页角标） | 溢出恢复自动重试（v8 的「超限→压缩→重发」——阶段②不做，§八⑩登记） |
| 〔②〕provider 条目可选 contextWindow 登记（阈值用） | 会话标题自动改文件名（v8 setTitle 重命名链不搬，id 与标题解耦——§八④） |

## 一、数据设计

### 1.1 会话文件 schema（单文件双视角的真源）

```
~/.kfmv4/sessions/<id>.json          ← session 池同址同文件（仲裁⑤，NZ_AI_CONFIG_DIR 可覆盖）
{
  "id": "s-xxxxxxxx",                // 文件名裸名（池层 isBareName 同闸）；nz 自动建壳=时间戳随机，与标题解耦（§八④）
  "title": "新会话",                  // 壳字段——写者=池数据层（§2.1 矩阵）
  "manuallyNamed": false,
  "createdAt": "…", "updatedAt": "…",
  "providerId": "智谱", "modelId": "glm-5.3-flash",   // 会话绑定：首条消息时 store 盖章，切换恢复绑定的数据源（仲裁③）
  "messages": [ ChatMessage, … ],    // 全量真相源（飞行记录仪，永不删）——写者=store 模块
  "messageCount": 12,                // 有正文的消息数（store 每次落盘重算）
  "tokenCount": 4821,                // 【窗口】实际发送投影估算（§1.2 三数字）
  "fullTokenCount": 5233,            // 【全量】文件内全部消息估算（§1.2）
  "compacts": [ SessionCompact ],    // 〔②〕固化摘要数组，只增不改
  "lastUsage": { … }                 // 〔②〕上次 API 实测 usage（measuredPromptTokens 的数据源）
}
```

- **消息条目形状 = `nz/src/shared/chat-protocol/messages.ts` 的 ChatMessage
  原型**（双端唯一类型来源，不自造第二份）：`{role:'user'|'ai',
  content:ContentBlock[], ts?}`；content 块=text（含 reasoning 分字段）/
  tool（id/name/input/result）/rule_warning。v8 hydrate 白名单
  （role 归一 user/ai + content 数组 + ts 存活，其余字段不活过 hydrate）
  照搬——`_jsonBuf` 等 reducer 中间态不落盘存活（§八⑨）。
- **SessionCompact**〔②〕（v8 session-store.ts:298 原样）：
  `{cutIndex:number, summary:string, model:string, createdAt:string}`——
  **追加制**：数组只增不改，摘要一次生成永不重算；投影层按最后一条的
  cutIndex 构造发送窗口。
- **LastUsage**〔②〕（v8 session-store.ts:314 原样）：
  `{promptTokens, completionTokens, totalTokens, model, ts}`。

### 1.2 三数字字段（拍板④语义钉死 + 与 v8 的对照）

| nz 数字 | 文件字段 | 语义（钉死） | 计算点 | v8 对照 |
|---|---|---|---|---|
| **全量** | `fullTokenCount` | 文件内**实际消息**的体量：全部 messages 的 text+reasoning+工具 I/O 字符数 / 3（含已被摘要覆盖的压缩区） | store 每次 flush 时重算（`_computeStats`） | v8 c（fullTokenCount）同口径照搬 ✅ |
| **窗口** | `tokenCount` | **实际发送**的体量：`toOpenAiMessages(messages,{compactCutIndex})` 投影 + system 段 + 摘要段的字符数 / 3 | 同上（flush 时用当前 compacts 算） | v8 a（tokenCount=压缩投影载荷 chars/3）继承，**口径差异：nz 含 system/摘要段**（§八②请拍板）；v8 的 tool-compaction 压缩量恒 0 |
| **实测** | `lastUsage.promptTokens`（投影出 `measuredPromptTokens`） | 上次 API 返回的 `usage.prompt_tokens` **回填**——provider 自己数的数，含 system+tools+messages 全量 | usage 帧到达 → `recordLastUsage` → 防抖落盘 | v8 同名同语义（2026-08-18「精确尺」改造）照搬 ✅ |

- **v8 的 windowTokenCount（b：摘要边界后未压缩窗口全量）不迁**——它是
  「tool-compaction + L4 压缩」叠加后的观测口径（v8 注释：c−b=摘要覆盖量、
  b−a=工具压缩省量）；nz 无工具压缩，b=a 无信息量，三数字按拍板④重钉为
  全量/窗口/实测。此为对 v8 字段族的**删减**，不是遗漏（§八②登记）。
- **compactCutIndex 语义**（不单独存字段，恒= `compacts` 最后一条的
  `cutIndex`，无 compacts 时 = -1/不存在）：「覆盖到第几条消息（**不含**）」
  ——`messages[0..cutIndex)` 区间由摘要代表，不进发送载荷；它是投影循环
  的**起点**不是删除点（飞行记录仪：文件里 messages 全量恒在）。messages
  只追加，索引单调增，cutIndex 永不回退。
- **无压缩时**窗口=全量减 system 差值、实测≈两者之和（第一次 API 返回前
  实测位显示 `--`）——界面在阶段①退化为「双数字+空实测」，阶段②补齐，
  与 v8「无 compact 退化双数字」同款诚实形态。

### 1.3 与 session 池条目的关系（同文件双视角）

池条目**就是**会话文件（仲裁⑤），两个 API 门各自投影：

| 门 | 视角 | 消费者 | 返回 |
|---|---|---|---|
| `GET /pool/session` | **壳**：列表/快选/基本池槽位 | 池页、下拉快选、基本池 | 条目数组：id/title/createdAt/updatedAt/providerId/modelId/manuallyNamed + `messages:[]` **恒空**（不出全文）+〔②〕三数字投影字段；带 refs 池的 dangling 标注照旧 |
| `GET /ai/session/:id/messages`〔①新增〕 | **全文**：水合/续聊 | chat-link 水合、考卷 | `{session:{id,title,…}, messages:ChatMessage[], stats:{messageCount,tokenCount,fullTokenCount,measuredPromptTokens?}}`；id 过 isBareName 闸，非法=404 人话 |

- **「仲裁①修订解除」的准确表述**：解除的是「messages 恒空**禁写**」——
  消息数组成为正式字段、有唯一真写者（store，§2.1）；**「池 API 恒空投影」
  保留**（投影行为：列表页/快选不需要也不该拖全文）。池层
  `checkMessagesRule` 禁写闸**保留**：任何 `/pool/session/*` 写请求携带非空
  messages 仍 400——写消息的路只有 store（P13）。
- 池壳列表的统计字段〔②〕只**读**文件顶层已存数字（v8 files.ts:187
  「只读顶层不重算」同纪律），无字段=缺省不显示——stats 唯一生产者=store
  （§2.1），池层禁二次估算（防第二把尺）。

### 1.4 active.json 联动（写点总表）

总账四字段（`{providerId, modelId, roleFile, sessionId}`）不动；写点从
A2a 的两类扩展到三类：

| 写点 | 写哪些字段 | 触发 |
|---|---|---|
| 池页「设为激活」（C10） | 按池各写各字段 | 显式激活动作 |
| picker 选中（A2a §3.5） | providerId+modelId | 显式选中 |
| **会话切换恢复绑定**〔①新增，仲裁③〕 | sessionId 恒写；会话记录了 providerId/modelId 且在 providers 池内**存活**→一并写回（恢复绑定）；记录值已失效→只写 sessionId（诚实降级+系统提示，§五 D3） | 下拉/池页切会话 |

- 自动建壳（§2.2）首条消息时**只写 sessionId**（新会话无历史绑定可恢复；
  provider/model 随本次请求的显式选择由 store 盖进会话文件，总账不动——
  发送不动总账的 A1 纪律保持）。
- kfmv4 双端边界照旧：nz 只管自己的写点，kfmv4 改账 nz 下次读 mtime 校准
  （池层仲裁②既有语义，不新增监听）。

## 二、管线设计（阶段①）

### 2.1 唯一写者裁定：独立 store 模块（route 层只接线）

**裁定：唯一写者 = 独立模块 `nz/src/server/ai/session-store.ts`**（v8 同名
文件的 lineage，照语义重落、不适配处诚实登记 §八⑨）；route.ts 只做接线
（start 时调 store、挂 server 侧录音泵），**不在 route 层直写文件**。理由：

- v8 宪法第三条「服务端可死，真相在磁盘」的承重墙是 store 不是路由；写者
  收进一个模块，A 档才能把 round-trip/flush 时机当纯 IO 单元钉死（route 层
  直写=把落盘语义焊死在 HTTP 装配上，考卷只能走全链慢腿）；
- 脑（brain.ts）保持「消息进、载荷出」的插座纯度，不知 session 存在
  （usage 回填除外，§四 4.4 的回调注入）。

**字段族写者矩阵**（仲裁⑤「唯一写者=server」在字段级的精确化；client 对
两个字段族都只读——P13）：

| 字段族 | 唯一写者 | 路径 |
|---|---|---|
| 壳字段：id/title/manuallyNamed/createdAt | 池数据层（既有） | `/pool/session/create|:id/update|delete` |
| 消息/绑定/统计/compacts/lastUsage：messages/providerId/modelId/messageCount/tokenCount/fullTokenCount/compacts/lastUsage/updatedAt | **store 模块**〔①新增〕 | `/ai/chat/*` 管线内部（不暴露独立写端点） |

- 交叉点处理：池层 update 的 merge 保留未知字段（既有语义）天然不动消息族；
  池层 delete 会话文件 → **必须联动 `store.invalidateSession(id)`**（清内存
  缓存，v8 串档事故 BAR 的根治点，§八⑨）——挂在 route.ts 的 pool delete
  分支后一行（server 内部调用，不是 client 职责）。

### 2.2 发送管线：history 从会话文件来（拍板原文落实）

```
client chat-link.send(text)
  → POST /ai/chat/start  body{ text, sessionId?, provider?, model?, paceMs? }
route 层：
  1. sessionId 缺失/无效 → store.ensureSession()：自动建壳
     （id=`s-<时间戳36进制>-<4位随机>`，title='新会话'，落盘空壳文件）
     → 写总账 sessionId（§1.4 表第三行）
  2. store.appendUserMessage(sessionId, text, model, provider)：
     幂等（末条已是同文本 user → 跳过，v8 语义照搬）+ provider/model 盖进会话绑定
  3. messages = store.readMessages(sessionId)          ← 全量真相源
  4. system = assembleRoleSystemPrompt() + 出厂基线 +〔②〕摘要段（§三）
  5. apiMessages = toOpenAiMessages(messages)〔②加 opts.compactCutIndex〕
  6. brain.start({ messages: apiMessages, system, provider, model, paceMs,
                   sessionId, onUsage? })
```

- **start 请求形状切换（break change）**：A1 的 `{messages: ChatMessage[]}`
  全量上行形状**退役**——history 归会话文件后，client 上行全量=第二真相源
  （P13 的 client 侧变体，禁止）；chat-link 是唯一消费者，考卷红先同步改卷
  （§六回归属）。错误语义表（A1 §1.4）逐行保持：缺 text→400、形状非法→400、
  配置错→error 事件入流。
- **脑接口的唯一扩展**：`BrainStartRequest` 增 `system?: string`（route 层
  组装好整体塞入，DirectApiBrain 合并为**单条** system 放载荷首位——v8
  BAR-QWEN-01「多条 system 被严格端点拒」语义照搬）、`sessionId?` 与
  `onUsage?`（〔②〕观测回调，§四 4.4）。EchoBrain 忽略 system（echo 节目单
  不含 system 段，考卷对拍形状不碰内容——A1 既有分工不变）。
- 旧会话兼容：kfmv4 写的会话文件（role 已是 user/ai、带 messageCount 族）
  hydrate 天然可读；v8 的 `sessions/script/` 分流（paradigm 遗产）不搬，
  nz 只读写根目录（§八⑨）。

### 2.3 落盘管线：server 侧录音泵 + 防抖 + 生死线 flush

**v8 机制原样重落**（session-store.ts 语义，§八⑨列适配点）：

- **录音泵（route 层挂，server 侧自足）**：`brain.start` 返回 runId 后，
  route 用 `registry.attach(runId, 0)` 起**内部**泵逐事件喂
  `store.appendEvent(sessionId, event)`——**不依赖 client 是否 attach**（A1
  的「页面切走 run 不死」语义下，client 断流期间落盘照走；这是 v8
  run-manager 接管的那段职责在 nz 的最小编）。泵随 registry finish 自然
  终止，finish 后补一次 flush 兜底。
- **防抖 200ms**（`FLUSH_DEBOUNCE_MS` 照搬）：appendEvent 只标脏+排定时器，
  合并写入频率；**同步 writeFileSync**（v8 BAR-SESSION-FLUSH-01 尸检教训：
  异步 fd 线程池滞后把旧快照头覆盖在新快照上 → 事件循环单线程下同步写
  天然串行，从构造上根除交错）。
- **生死线强制 flush**：`done` 事件 / `error` 事件（含取消——A1 P5 的
  「已取消」error 入流收尾即覆盖 abort 分支）/ registry finish 兜底，三点
  立即清定时器同步写。v8 的 tool_result 强制点在 nz 阶段①无对应事件
  （无工具循环），语义等价物=流式中每事件都走防抖、收尾必同步——登记 §八⑨。
- **落盘内容**：meta 全量 + `messages`（内存 ctx 全量）+ 三数字重算 +
  `updatedAt`（v8 `_writeToDisk` 同构）；写失败保脏、下个事件/防抖窗重试
  （v8 同款）。
- **半截流诚实边界**：server 重启/杀进程 → run 亡，已收事件最多滞后 200ms
  落盘（尾巴丢失）；client 刷新同理会话文件为准（§八⑩登记，v8「服务端可死
  真相在磁盘」的承诺在 nz 打折——无 run 落盘）。

### 2.4 水合管线：切换/重开 → 拉全文 → 直挂消息核

```
D3 切会话 / 页面重开（总账 sessionId 在场）
  → GET /ai/session/:id/messages
  → { messages, stats } → AiChatState.messages = messages（msgIdx=-1，phase=IDLE）
  → 渲染（显示层 reasoning 归位 R3 照旧）→ 列表追底锚定最新（拍板⑩主动意图族）
```

- **reducer 重放的诚实修正**（拍板原文「拉全文→reducer 重放→渲染」的落点
  勘误，§八①）：落盘的是**归约后的 messages**（v8 session-store 语义：事件
  进 reducer、产物落盘，不是事件流日志），水合=直挂，**无需重放**；reducer
  的「重放」语义只活在 server 侧实时归约（appendEvent→applyEvent）。引入
  事件流日志=另一种存储形态（v8 都不这么做），不做。
- 水合后 composer 草稿**蒸发**（与池页 C2/C6 草稿语义同族）；活跃 run 在场
  时禁切（§五 D3/P18）。
- 页面重开路径：mount 时读总账 sessionId → 有则水合、无则空态（标题栏显示
  「新会话」，首条消息触发自动建壳）——A1 的「刷新即清空」就此退役。

### 2.5 改动面清单

| 文件 | 动作 |
|---|---|
| `nz/src/server/ai/session-store.ts` | 新写（§2.1 矩阵的消息族写者；v8 语义照落） |
| `nz/src/server/ai/prompt-assembler.ts` | 新写（§三） |
| `nz/src/server/ai/route.ts` | start 形状切换+自动建壳+录音泵+system 组装+新端点 `GET /ai/session/:id/messages`；pool delete 联动 invalidate |
| `nz/src/server/ai/brain.ts` | BrainStartRequest 增 system/sessionId/onUsage；DirectApiBrain 注入单条 system；其余不动 |
| `nz/src/shared/chat-protocol/to-openai-messages.ts` | 签名扩展 `opts?: {compactCutIndex?}`〔②用，①只加参数不改行为〕；三条事故规则一字不动 |
| `nz/src/server/pool/pools.ts` | session 池壳投影扩展〔②三数字字段；①不动〕 |
| `nz/src/client/plugins/ai-chat/chat-link.ts` | send 改 `{text,sessionId}`；水合 loadSession；selection 恢复绑定联动 |
| `nz/src/client/plugins/ai-chat/index.tsx` | 下拉真快选（§五）+会话名标题+系统提示条+〔②〕角标 |
| `nz/src/server/index.ts` | **零改动**（mountAiChatRoutes 内部扩展） |

## 三、prompt-assembler 最小版（阶段①）

### 3.1 v8 语义照搬（prompt-assembler.ts 123 行的 nz 落点）

- **角色→system，服务端每轮重组**：数据源=角色卡 `agents/roles/<roleFile>.json`
  的 promptFiles 列表，**每次 start 重读所有文件拼接**——v8「每轮 LLM 调用
  前实时重组」在 nz 的精确形态=**每次 start 重读一次**（nz 无工具循环，一轮
  run 恰一次 LLM 调用；A3 接工具循环时「每轮重读」语义天然延续到循环内）。
  用户改角色文件 → 下一条消息即生效，无缓存失效问题（v8 机制的红利照收）。
- `getActiveRoleFile()`：读总账 `roleFile` 字段——**复用池层
  `store.readActive()`**（mtime 缓存直读已有），不重写第二份读账代码。
- `loadRole()`：裸名防穿越（禁 `/`、`..`，池层 isBareName 同闸）；角色文件
  的 `prompt` 字段顺读（nz 池 schema 未收录该字段但 v8 实录文件可能有，
  loadRaw merge 语义下字段在场——v8 `role.prompt` 拼在最前，照搬）。
- **拼接**：`role.prompt? + promptFiles 逐个 readFileSync`，`\n\n` 连接；
  单文件读失败/不存在 → **跳过不崩**（v8 同款）；路径越界 → 跳过。
- `sanitizePath` 最小版需重落：v8 在 path-utils（SAFE_ROOT=$HOME 内放行、
  越界跳过）；nz 无此件——新写同语义函数进 prompt-assembler 内
  （约 15 行，§八⑨适配点）。

### 3.2 出厂基线（无角色时）

- roleFile 为空 / 角色文件缺失或坏 → system = **出厂基线**，内容=ts 前缀
  声明一条（v8 chat.ts:245 原文案：「用户消息前的 [ts MM-DD HH:MM:SS] 是
  系统加盖的时间元数据……你的回复从不带这个前缀」）——nz 简版投影已在
  user 消息盖 `[ts]` 前缀但从未声明，AI 把它当用户内容复读的风险一直在
  （BAR-TS-MIMIC-01 的声明半阙 A1 没做），本清单补上。
- 不注空 system：无内容就不放 system 消息（v8 `systemMessages.length` 判空
  同款）——省 token 且兼容对 system 位置挑剔的端点。
- **诚实边界**：nz 无 v8 的 globalPrompts/工具文档/alwaysApply 规则段——
  基线只有 ts 声明，角色声明「A2a.5 起生效」的 UI 标注（§五 D2）兑现承诺。

### 3.3 system 的消费点与摘要位

- 组装顺序（单条 system 内 `\n\n` 分段）：`角色拼接 +〔无角色时出厂基线〕
  +〔②〕固化摘要段`——摘要段（阶段②）照 v8 chat.ts:253-259 语义放 system
  **尾部**（「# 此前对话的固化摘要……原文在会话文件可回读」+ 摘要正文），
  摘要固化后跨轮不变、前缀缓存友好。
- 注入：route 层组装成 `system` 字符串 → brain 塞 `requestBody.messages`
  首位单条 system（§2.2）。

### 3.4 角色切换的生效语义（仲裁⑥）

- 切换角色=**只写总账 roleFile**（POST /pool/active），不动消息核、不改
  历史文件、不重发任何载荷——「下一条消息起生效」的机制就是 start 时重读
  总账+重拼文件，无魔术。
- 一声系统提示入流（§五 D2）：UI 层一次性提示条（消息区顶部灰字「角色已
  切换为「茉莉」，下一条消息起生效」，下一条发送或 3.5s 自散）——**不进
  消息核、不落盘、不进载荷**（它不是对话内容；v8 无此机制，nz 按「不搞
  拍板魔术」取 UI 提示而非伪造消息）。

### 3.5 dynamicPromptFiles 留口（A2b 眼睛挂载点）

- nz prompt 池 schema 的 dynamicPromptFiles 字段读写已在 A2a 保住
  （config-pool §3.3）——本清单**只在 assembler 里留函数占位**
  （`assembleDynamicPrompt()` 空实现+注释指向 A2b），不实现读取/包裹/注入。
- v8 的包裹文案（BAR-EYE-WRAP-01 分隔线+使用规则）与「注入对话尾部 user
  消息」的挂载方式记录在案不搬——那是工具循环配套，nz 无循环可注入。

## 四、压缩设计（阶段②）

### 4.1 触发：阈值 + 异步不挡路（拍板④③纪律）

- **尺**：provider 条目新增**可选**字段 `contextWindow: Record<string,number>`
  （模型名→token 数；schema 扩展，§八⑥请拍板）。v8 实锤纪律照搬：**未登记
  窗口的模型 → 不自动压缩**（宁漏勿错——v8 曾整表批量 131072 占位假尺，
  实测 119k 误触发，此后「绝不拿假尺误压缩用户上下文」）。
- **阈值**：窗口数字 ≥ `contextWindow[model] × 0.9`（v8 2026-08-18 定稿
  90% 同值，具名常量）。
- **检查点**：每次 run 收尾（done/error）录音泵 flush 后顺手判一次——**后台
  触发，绝不在发送路径上**（v8 病灶正相反：`await _autoCompactIfNeeded()`
  挡在发送里，§八⑨）。触发 → 起**后台压缩任务**立即返回；对话照常。
- **诚实后果（拍板的直接推论，登记 §八⑫）**：压缩进行中用户发下一条 →
  用旧窗口投影发送（可能超限 → 上游 error 入流）；压缩完成后的下一条才吃
  新窗口。同会话已有压缩任务在跑 → 跳过本次触发（并发闸）。

### 4.2 压缩执行：runCompact 语义重落（compact-core.ts 109 行照搬+两处修正）

```
runCompact(sessionId):
  1. store.flush(sessionId)            ← 修正①：先强制 flush（v8 从磁盘直读
     不刷内存脏缓冲，200ms 防抖窗里的尾巴会漏出摘要覆盖区——cutIndex 偏小）
  2. cutIndex = computeCutIndex(messages)
     （v8 算法照搬：从尾数第 12 个 user 消息处开切；不足 12 轮 → skipped
     「无需压缩」。v8 注释「8 全保+4 纯对话工具折叠」在 nz 退化为 12 轮直切
     ——无工具折叠概念，语义等价，§八⑨）
  3. covered = messages.slice(0, cutIndex) → 简版投影 → digest
     （role: content 截抄，总输入截 120k 字符——flash 级窗口保护，v8 同值）
  4. 摘要调用【修正②】：用**当前 provider**（拍板④）——会话绑定
     providerId/modelId 优先，缺项回落激活总账 → loadProviders+resolveKey
     代字 fuse → POST {baseUrl}/chat/completions 非流式 max_tokens 4096，
     system=SUMMARY_PROMPT（v8 结构化模板原样：任务状态/关键决策/文件路径/
     错误修复/未完成/用户偏好六栏目，≤2000 字，中文）
     （v8 硬编码 deepseek-v4-flash 专用卡——nz 无此卡，换当前 provider 是
     拍板不是优化，§八⑦）
  5. 滚动蒸馏：prev=最后一条摘要 → 拼「【旧摘要】+【新增对话】」输入（v8 同款）
  6. appendCompact(sessionId, {cutIndex, summary, model, createdAt}) 固化
     → flush → 下次发送投影从新 cutIndex 起
```

- 端点：`POST /ai/session/:id/compact`（单生产者 runCompact 的唯一门；v0
  UI 不挂手动按钮，考卷与排障用，接口位即手动压缩的将来挂点）。

### 4.3 窗口计算（发送侧投影）

- `toOpenAiMessages(messages, { compactCutIndex })`：`messages[0..cutIndex)`
  跳过不进载荷（投影循环起点=l4From，v8 to-openai-messages.ts:132 同构）；
  摘要本体不走载荷——由 system 尾部摘要段代表（§3.3）。
- 简版投影扩展**只加切点参数**：三条事故规则（ts 前缀只盖 user/占位符过滤/
  空壳丢弃）与工具块最小投影一字不动（A 档回归钉守住）。
- 窗口数字口径=该投影字符数 + system 段（角色/基线/摘要）字符数，/3 取整
  （§1.2 表）。

### 4.4 三数字采集点

| 数字 | 采集点 | 机制 |
|---|---|---|
| 全量/窗口 | 每次 flush（`_computeStats`） | store 落盘时顺手重算——stats 唯一生产者，无第二把尺 |
| 实测 | usage 帧到达 | DirectApiBrain 已在 translator 捕获 usage（A1 既有）——经 `BrainStartRequest.onUsage` 回调（route 装配时注入 `u => recordLastUsage(sessionId,u)`）落 `meta.lastUsage`，随防抖/生死线落盘。脑不自知 store（§2.1 插座纯度保持） |

- v8 教训照收（orb-chat-run.ts:496 死循环修复史）：压缩触发判据用**当轮
  flush 重算的窗口数字**，不用 lastUsage 旧快照——压缩后窗口自然变小，
  「每条都压」的死循环从结构上不存在。

### 4.5 展示：对话页角标 + 会话条目

- **对话页角标**：标题栏右端 `data-aichat-usage-badge`（三数字 `12k/9.8k/--`
  = 全量/窗口/实测，k 简写，实测缺位 `--`）；数据源=当前会话 stats（水合与
  每次 run 收尾后 refetch `/ai/session/:id/messages` 的 stats 段——服务端
  唯一真源，P7 同款）。压缩中=角标加「压缩中…」态；失败=「压缩失败」态
  （点击展开人话原因——只读展示，编辑不做）。
- **会话条目**（池页列表行+下拉快选行）：壳投影新增
  `messageCount/tokenCount/fullTokenCount/measuredPromptTokens`〔②〕，
  行内次行显示三数字（v8 session.card.ts:275「压缩/全量并列」同款精神，
  nz 取全量/窗口/实测新钉语义）。
- 手机版式：角标单行 ≤14 字符，下拉/池页行内三数字竖排小字——皮内禁硬
  编码样式（ai-chat P7 同款 tokens 纪律）。

### 4.6 失败降级：压缩失败 ≠ 对话失败（拍板④）

- 后台任务三类失败（key 缺失/上游非 200/空摘要）→ `{ok:false}` 记
  /tmp 日志 + 角标失败态；**本轮不重试**（下轮超阈值再触发）；对话与发送
  全链路零影响——压缩是优化不是依赖。
- 极端边界：未压缩 + 已超窗 → 上游 4xx error 事件入流（A1 §1.4 既有
  语义兜住）；v8 的「溢出恢复→自动压缩→重发」不做（§八⑩登记备选）。

## 五、下拉快选状态机（词汇表唯一真源；体例照前作）

**状态枚举**（P9：菜单机词汇不变，快选是 CONFIG_OPEN 内部 UI 态不进词汇）：

| 状态机 | 状态 | 含义 |
|---|---|---|
| 页面机 | `TERMINAL` / `AI_PAGE` | A1 既有，不动 |
| 运行机 | `IDLE` / `WAITING` / `STREAMING` | A1 既有，不动 |
| 菜单机 | `CLOSED` / `MODEL_OPEN` / `CONFIG_OPEN` | A1 既有词汇；CONFIG_OPEN 内容升级为真快选 |
| 快选数据态（UI 态，**不进词汇表**） | `loading` / `ready` | CONFIG_OPEN 打开时两池列表+总账的在取/就绪 |

**转换表**（新增触发词 D1-D7；A/C 系既有转换不动）：

| # | 起点 | 触发 | 终点 | 底层动作 |
|---|---|---|---|---|
| D1 | `CLOSED` | 点标题栏下拉钮 | `CONFIG_OPEN`(loading→ready) | 并发拉 `/pool/prompt` + `/pool/session` + `/pool/active`（双入口同源数据，P17）；标题钮文案=当前会话 title（截 8 字）+ ▾ |
| D2 | `CONFIG_OPEN` | 点角色条目 | `CLOSED` | POST /pool/active {roleFile}（激活唯一路径）→ 关菜单 → 系统提示条入流（§3.4，不落盘）→ 下一条消息 start 重读生效 |
| D3 | `CONFIG_OPEN` | 点会话条目 | `CLOSED` | **运行机非 IDLE → 条目灰、点击无效**（P18）；IDLE：水合（§2.4）→ POST /pool/active {sessionId + 会话绑定的 providerId/modelId（存活才写，断引用只写 sessionId+人话提示）}（仲裁③恢复绑定）→ picker 选中随总账同步（loadProviders 重拉）→ composer 草稿蒸发 |
| D4 | `CONFIG_OPEN` | 点「+ 新会话」行 | `CLOSED` | POST /pool/session/create（壳，池层既有语义）→ POST /pool/active {sessionId} → 消息核清空 → 标题钮文案随新壳 |
| D5 | `CONFIG_OPEN` | 点「管理」（角色/会话区各一） | `CLOSED` | 既有 C12 路由真发（kfm-nz-pool-open → prompt/session 池页）——拍板⑥「管理仍跳池页」 |
| D6 | `CONFIG_OPEN` | 点外任意处 / Escape | `CLOSED` | 拍板⑬同款 passive 捕获监听+动作同发（既有 A11 机制不变） |
| D7 | `CONFIG_OPEN` | pool/changed 推送到达 | 原状保持 | 列表/总账 refetch 校准（服务器唯一真源，P7；池页改了名/新建了会话，下拉开着即跟） |

**禁止条款**（新增 P13-P18；A1 P1-P12 全文保持）：

- **P13 唯一写者（字段族分治）**：messages/providerId/modelId/统计/compacts/
  lastUsage 的写路径只有 server store 模块；壳字段写路径只有 `/pool/session`
  路由族；client 与 `/pool/*` 禁写消息族（池层 checkMessagesRule 闸保留）；
  client 不上行全量 history（发送只带 text+sessionId）。
- **P14 切换恢复绑定**：切回会话**必须**恢复该会话记录的 provider/model 到
  总账（记录值存活时），禁止「保持全局不动」；记录值失效 → 只写 sessionId
  +人话提示，禁止静默吞掉或伪造绑定。
- **P15 非破坏压缩（飞行记录仪）**：任何代码路径禁止删除/改写 `messages`
  数组既有条目与 `compacts` 既有条目；压缩只允许 append compact + 改发送
  窗口投影；落盘 flush 恒写 messages 全量。文件里找不到原始消息=钉红。
- **P16 无角色基线**：无激活角色/角色缺失/文件坏 → 出厂基线（§3.2），禁止
  注入不存在角色的内容、禁止因此断流或 500；角色文件越界路径跳过不崩。
- **P17 下拉与池页双入口一致**：快选条目/激活标/统计与池页**同源**
  （`/pool/*` + `/pool/active`，禁第二份数据源）；快选选定与池页 C10 走同一
  激活门（POST /pool/active）；两处 ✓ 标恒一致（B 档钉）。
- **P18 流式禁切**：`WAITING`/`STREAMING` 中禁切会话（run 与会话绑定，切走
  =串档风险；条目灰+点击无效）；角色切换不在此列（只写总账，下一条消息
  生效，流式中可切）。

**可观测性**：`__kfmNzAiChat()` 扩展 `session:{id,title}` / `role:string` /
`stats:{tokenCount,fullTokenCount,measuredPromptTokens}` 三字段（摘要不回
全文，A1 §4.2 纪律）；`/tmp/nz-ai-chat.log` 的 start 拍增 `sessionId`、
done 拍增 usage（已有）与 compact 触发/结果拍；`/tmp/nz-pool.log` 照旧记
激活写点（会话切换的 activated 拍带 fields 清单——D3 写点可审计）。

## 六、考卷映射

### A 档 · 纯逻辑钉（红先；临时 dir 注入，NZ_AI_CONFIG_DIR 同款机制）

| 钉 | 验证 | 手段 |
|---|---|---|
| A1 | store round-trip：appendUserMessage/appendEvent/flush → 文件读回与内存态一致（ts 存活、role 白名单、`_jsonBuf` 不存活）；坏 JSON 文件=新起不崩；非法 sessionId fail-closed 不读写 | 临时 ~/.kfmv4 夹具直驱 store 模块 |
| A2 | flush 时机：事件流 200ms 防抖合并（两次 append 一落盘）；done/error 强制即时落盘；写失败保脏下轮重试 | 假定时器/注入写失败 |
| A3 | 投影：`toOpenAiMessages(msgs,{compactCutIndex})` 切点前跳过；三条事故规则回归（ts 前缀只盖 user/占位符过滤/空壳丢弃）不回退 | 构造 messages+compacts 断言载荷 |
| A4 | 角色 system：promptFiles 静态拼接；**改文件下次 start 即变**（每 start 重读）；无角色→出厂基线（ts 声明在场）；越界路径跳过不崩 | 临时角色文件+改写比对 |
| A5 | 压缩窗口计算：computeCutIndex 12 轮边界（11/12/13 轮三态）；runCompact 假 fetch 注入 → appendCompact 固化 → 切点生效（载荷变小、messages 全量不变） | 临时夹具+注入摘要响应 |
| A6 | 三数字：全量恒含压缩区；窗口随 compact 变小且含 system 段；实测=lastUsage.promptTokens 回填；无 compacts 时窗口=全量-基线差 | _computeStats 直接喂矩阵 |
| A7 | 池壳双视角：/pool/session 壳 messages 恒空+禁写闸 400；壳投影〔②〕带三数字且**不重算**（文件无字段=缺省） | 池路由族直驱 |
| A8 | 恢复绑定：D3 写点——会话记录存活→三字段写账；记录失效→只写 sessionId；自动建壳只写 sessionId | 临时总账 diff 断言 |

变异抽检：切点删消息（破坏飞行记录仪）必咬 A3/A5；flush 去掉生死线必咬
A2；投影丢 ts 前缀规则必咬 A3 回归；池壳放出消息全文必咬 A7。

### B 档 · echo 脑驱动全链（Playwright headless）

| 钉 | 验证转换 | 手段 |
|---|---|---|
| B1 | 发消息落盘：echo 发一条 → done → 会话文件含 user+ai 两消息+updatedAt（L2 文件互证，不只信前端） | 临时 dir 起 server+echo 全链+文件断言 |
| B2 | 重开加载：reload → 消息核恢复=文件全文（气泡数/内容一致）、标题钮=会话名、无活跃 run 相位 IDLE | B1 后 reload 断言 |
| B3 | 切换角色生效：D2 选角色 → 系统提示条在场 → 再发一条 → server 侧请求载荷含该角色 system（NZ_AI_DEBUG_BODY=1 载荷文件互证）；改角色文件再发 → 新内容生效（每 start 重读） | debug body 文件 grep |
| B4 | 切换会话恢复绑定：两会话各绑不同 provider/model → D3 切回 → 总账三字段恢复+picker ✓ 同步+消息核水合；断引用会话 → 只切 sessionId+提示条 | 两会话夹具+/pool/active 断言 |
| B5 | 下拉快选：条目=池列表、当前项 ✓、选定即激活、+新会话、管理=D5 跳池页、点外即关动作同发（D6）、流式中会话灰（P18） | echo 慢流（paceMs 杠杆）+双入口互证 |
| B6 | 角标（〔②〕）：三数字显示与文件一致；contextWindow 拨小触发后台压缩 → 角标「压缩中→完成」、窗口数字变小**全量不变**、流不断、消息条数不减（P15） | 临时 contextWindow 夹具+压缩后 refetch 断言 |
| B7 | 取消落盘：流式中点停止 → `[错误: 已取消]` 尾巴落盘文件（P5 收尾+生死线 flush 联动） | 取消后文件断言 |
| B8 | 观测钩扩展：`__kfmNzAiChat()` 报 session/role/stats；/tmp 双日志互证（L2 腿） | 钩子读数+日志 grep |

### C 档 · 真机

| 钉 | 验证 | 手段 |
|---|---|---|
| C1 | **杀 App 重开续聊**：真 provider 连发数条 → 杀浏览器（甚至杀 server 重启）→ 重开 → 消息全在 → 续聊「我刚才说了什么」AI 答得上（history 真从文件来） | 真机操作+截图+/tmp 日志互证 |
| C2 | 切换会话/角色真机手感：下拉快选点选、恢复绑定、提示条入流 | 真机截图+CDP 读钩 |
| C3 | 〔②〕长会话压缩真机：长对话触发后台压缩 → 角标三数字变化 → 对话不中断 → 摘要后 AI 仍记得任务要点（system 摘要段生效） | 真机+/tmp compact 拍互证 |

### 回归属（不许弄红的现有卷）

- `npm test` 全量 + browser 卷：ai-chat（59 钉——**B2/B13/B14 等用旧
  messages 全量形状的钉随请求形状切换红先改卷**）、config-pool（43 钉——
  session 池壳投影扩展只增字段，旧钉不回退）、keybar/tmux-tabs/ime-pan/
  scrollback/term-hooks/kernel/bottom-anchor/cjk-*；
- `/ai/providers` 响应形状一字不改；`/pool/*` 既有端点语义一字不改；
- brain.ts 除 BrainStartRequest 扩展外不动——EchoBrain 节目单/登记表/
  attach 语义原样（ai-server 既有钉不回退）。

## 七、验收判据（A2a.5 DoD）

1. **阶段①闭环**：真机发消息 → 会话文件逐字落盘（user/ai+ts+绑定）→
   杀 App 重开续聊 AI 记得前文（C1 截图+文件+日志三腿互证）；切换角色
   下一条起 system 真生效（载荷文件互证）；下拉快选/恢复绑定/池页双入口
   ✓ 恒一致；
2. **阶段②闭环**：超阈值后台压缩自动发生（不挡路——压缩期间发送照通），
   压缩后窗口数字变小、全量与消息条数不变（P15 飞行记录仪），对话上下文
   连贯（摘要进 system）；压缩失败演示一次（拔 key）→ 对话零影响；
3. A/B 档考卷全绿 + 变异抽检双咬 + 回归属零回退（旧 ai-chat 钉改卷后照绿）；
4. agent 可后台观测：`__kfmNzAiChat()`（session/role/stats）+
   `/tmp/nz-ai-chat.log`（sessionId/usage/compact 拍）+ `/tmp/nz-pool.log`
   （activated fields）三腿互证一致；
5. 密钥纪律零回退：摘要调用的 key 只活在 server，载荷/日志/钩子 grep 无
   明文（P1 全文继承）。

## 八、异议与备选（读 v8 源码后的诚实登记，签收时逐条拍板）

1. **水合不需 reducer 重放**（拍板原文勘误）：落盘=归约后 messages
   （v8 session-store 语义）不是事件流，水合=直挂消息核；「重放」只活在
   server 侧实时归约。备选=改存事件流日志+重放（**反对**：v8 都不这么做，
   存储体积×事件数、且丢 reducer 修正史）。请拍板。
2. **三数字是重钉不是照搬**：v8 a/b/c（tokenCount=压缩投影载荷 /
   windowTokenCount=摘要边界后未压缩全量 / fullTokenCount=全会话）→ nz
   全量/窗口/实测（§1.2 表）；v8 b 不迁（依赖工具压缩口径，nz 无此概念）。
   **窗口口径请拍板**：本清单取「含 system+摘要段」（更贴「实际发送」拍板
   字面，与实测值更可比）；备选=只算 messages 投影（与 v8 a 完全同口径，
   但与实测差一个 system 头）。请拍板。
3. **start 请求形状 break**：`{messages:[…]}` 全量上行退役 →
   `{text, sessionId?}`。备选=双形状兼容过渡（**反对**：第二真相源活一天，
   P13 就脏一天；消费者唯一，红先改卷成本低）。请拍板。
4. **会话 id 与标题解耦**（自动建壳=时间戳随机 id，title 只改字段不重命名
   文件）：v8「标题即文件名」的 setTitle 重命名链（写新删旧+active.json
   同步+事件广播+消息核清空）是串档事故高发区（session-client.ts:346-367
   整段防御性代码为它而生）。备选=照搬标题改名链（**反对**：移动端弱网下
   写新删旧两步失败即双文件；收益只有 grep 文件名好看）。请拍板。
5. **唯一写者落 store 模块**（裁定，§2.1）：字段族分治矩阵是仲裁⑤的
   精确化；「池层禁写闸保留」=仲裁①修订解除后的边界（写消息不走池门）。
   备选=route 层直写（**反对**：落盘语义焊死在 HTTP 装配上，A 档无法纯
   单元钉）。请拍板。
6. **provider 条目加可选 contextWindow**（阶段②阈值尺）：schema 扩展、
   未登记不自动压。备选=全局固定阈值（**反对**：v8 假尺事故的教训就是
   没有真尺宁可不动手）。请拍板。
7. **摘要用当前 provider**（拍板④，与 v8 冲突处）：v8 硬编码
   deepseek-v4-flash 专用卡；nz 无 deepseek 卡，取会话绑定 provider 回落
   总账。诚实风险：大窗口 provider 的 key 同时干摘要活，成本略高；好处=
   零新配置。请拍板。
8. **流式禁切会话**（P18）：run 与会话绑定，切走=串档。备选=允许切换+
   后台 run 继续落盘+回切补流（**反对**：attach 只认 runId 不认会话，回切
   补流要 run 检索新机制——A3 接工具时随 run-manager lineage 再议）。请拍板。
9. **v8 session-store / compact 机制缺陷与适配点清单**（移植时逐项处置）：
   - runCompact 从磁盘直读不 flush → 防抖尾巴漏出压缩区（cutIndex 偏小）
     ——nz 修正①=压缩前强制 flush（§4.2）；
   - 自动压缩同步挡路（`await` 在发送路径）→ nz 拍板反转为异步后台（§4.1）；
   - 溢出恢复死循环史（压缩后 lastUsage 未刷新→每条都压）→ nz 判据改当轮
     重算窗口数字，结构性规避（§4.4）；
   - 同步 writeFileSync 全量重写：600KB 大会话每 200ms 全量序列化+写盘，
     桌面无感、移动端有 IO 尖峰风险——nz 照搬（会话体量 v0 可控），登记
     A3 若大会话实测卡顿再议增量写/限频；
   - 防抖 flush 可落 `_jsonBuf` 中间态（工具流式中）——nz 阶段①无工具块
     零风险；hydrate 白名单照搬使其不活过水合，A3 接工具时须 flush 前清洗
     （登记适配点）；
   - `appendUserMessage` 幂等=末条同文本跳过：正常逐轮对话无恙，P2 取代
     场景下恰好防双写——语义照搬，边界（同文本连发无 AI 回复间隔）在
     server 驱动管线中不存在第二入口；
   - `sessions/script/` 分流注册表（paradigm 遗产）不搬——nz 只读写根目录；
   - `sanitizePath`（SAFE_ROOT）nz 无此件，assembler 内新写最小版（§3.1）；
   - v8 会话条目 `compactCutIndex`/`windowTokenCount` 顶层字段：nz 不落
     （compacts 派生/不迁，§1.2）——kfmv4 直读同文件时按缺省降级，双端
     互读不互毁（池层 merge 保留未知字段）。
10. **server 重启=孤儿 run，半截消息不保证落盘**：「服务端可死真相在磁盘」
    在 nz 打折为「已收事件最多滞后 200ms 落盘」（§2.3）——run 落盘/跨重启
    续流属 run-manager lineage，本清单不搬（拍板②）。备选=阶段①顺手做
    run 持久化（**反对**：越拍板②边界）。请拍板知悉。
11. **总账写点扩展**（仲裁变更乙）：会话切换也写 providerId/modelId 与
    A2a「总账只被显式激活动作改写」的字面冲突——本清单定性为拍板③的直接
    推论（恢复绑定**就是**显式动作），纪隧行改为三类写点白名单（§1.4 表）。
    请拍板确认。
12. **压缩中发送用旧窗口**（异步不挡路的直接后果，§4.1）：可能撞上游超限
    error 入流，用户重发即好。备选=压缩中发送挂起等待（**反对**：违背拍板
    ④「不挡路」字面）。请拍板知悉。

## 九、工作量预估（分阶段）

| 块 | 估 |
|---|---|
| 〔①〕session-store 模块（防抖/生死线/hydrate 白名单/stats/invalidation）+ A1/A2 钉 | 1 天 |
| 〔①〕route 管线改造（start 新形状/自动建壳/录音泵/全文端点/pool-delete 联动）+ brain system 注入 + 投影签名扩展 + A3/A8 钉 | 1 天 |
| 〔①〕prompt-assembler 最小版（拼接/基线/sanitizePath 最小版）+ A4 钉 | 0.5 天 |
| 〔①〕client 改造（chat-link send/水合/绑定联动 + 下拉快选 UI + D1-D7 + 系统提示条）+ B1-B5/B7/B8 卷 | 1.5 天 |
| 〔①〕旧 ai-chat 卷红先改卷（请求形状）+ 回归属复跑 + C1/C2 真机 + 通报 | 1 天 |
| **阶段① 小计** | **约 5 天** |
| 〔②〕compact-core 重落（触发闸/后台任务/摘要调用/固化）+ usage 回填 + A5/A6 钉 | 1.5 天 |
| 〔②〕三数字投影（池壳扩展+角标+条目统计+contextWindow 字段）+ B6 卷 | 1 天 |
| 〔②〕C3 真机压缩实测 + 观测三腿互证 + 通报 | 0.5 天 |
| **阶段② 小计** | **约 3 天** |
| **合计** | **约 8 天**（阶段①独立交付可用；②不依赖①以外任何前置） |
