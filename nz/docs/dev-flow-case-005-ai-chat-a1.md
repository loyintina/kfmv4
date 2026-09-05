# 开发流程案例 005 · ai-chat A1（AI 接通最小闭环）——插件档案

> 2026-09-04 归档。定位：AI 对话插件（nz/src/client/plugins/ai-chat/ +
> nz/src/server/ai/ + nz/src/shared/chat-protocol/）。AI 专题（TASK.md §0.7）
> A1 阶段——一条真实模型通路 + 一个能对话的最小界面（say hello 级）的
> 完整实录。行为规格在 docs/ai-chat-a1-design.md（2026-09-04 用户签收，
> §八六条异议全裁决），功能账本在 nz/TASK.md，通报在
> docs/ledger/agent-inbox/kfmv4-ai-chat-a1-accept-report.md。
> 提交 2a79b427 / 3ce53fc5 / f145e76c + 阶段四两笔。
>
> **活文档纪律（沿用 case-001 用户拍板）：本文档随 ai-chat 插件持续生长——
> 未来对对话链路/run 登记表/观测钩/皮的任何修改、事故、调参，都追加到
> 「闭环后迭代」一节**，写清：为什么改（谁拍板）、改了什么、验收数字、
> 产出的纪律。不许只改代码不记账。

## 起点：na 已踩平的雷区，nz 不重新趟

A1 的全部设计输入是**已实锤的事故档案**：kfmv4 chat.ts 的行号级教训
（thinking+text 拆两 block 导致正文永空 / 网络重试参数 / 300 字截断）、
na 风险清单 R1-R7（R2 cursor 跟踪 / R3 reasoning 归位）、401 双路方言
实录（智谱中文 id 塌缩成同名代字 → 串号 401）、BAR-TS-MIMIC-01
（assistant 盖 ts 前缀 = AI 学成复读）、BAR-PROVIDER-02（空壳
assistant → kimi 400）。**设计清单 §一每条规则都挂出处**，实现前没有
一条「我觉得应该这样」。

## 流程段（每段：产物 / 坑 / 纪律产出）

### ① 设计清单签收制（六条异议逐条拍板）

- 产物：docs/ai-chat-a1-design.md——数据类型（九事件协议原样搬 +
  简版投影三规则）/ 文件组织（na 三层分离：纯逻辑零 IO / 脑插座 /
  IO 装配）/ UI 设计（BU 三件定性=重写非搬运）/ 观测纪律（echo 夹具+
  /tmp 落盘+观测钩）/ 考卷映射 A/B/C 三档。
- **六条异议全裁决**（2026-09-04）：①简版投影新写不搬 tool-compaction
  整树；②BU 三件重写、逐词 blur 不搬只搬光标；③model picker 保留
  极简版，默认=Kimi 官方+kimi-k2.7-code（用户拍板「官方渠道此名可通，
  C 档实测」）；④配置直读 ~/.kfmv4/（NZ_AI_CONFIG_DIR 可覆盖）；
  ⑤kfmv4 routes.ts 不搬（express→raw http 形态不合）；⑥run 薄层
  登记表保留（内存 Map+封顶+5min 淘汰，保页面切换补流）。
- 纪律产出：**「不做清单」与「做清单」同权**——§〇边界表（工具调用/
  持久化/markdown/多会话/8.x 重件/逐词动画）是全期返工防火墙，A1
  全程零越界。

### ② 四阶段推进（协议层→server→插件→验收，每段红先）

- 阶段一 2a79b427：协议层四件**原样复制**（逐个核实零依赖纯 TS，搬=复制
  无拖拽）+ 简版 to-openai-messages 新写（~70 行，只保留三条有事故
  教训的规则）+ server 纯逻辑三件。A 档 8 钉红先 36 题全绿（判卷基准
  =na 六份 fixture：upstream-* 两族 + probe-* 两族 + error 两族）。
- 阶段二 3ce53fc5：BrainEndpoint 插座（start/cancel/attach 三方法）+
  DirectApiBrain（fetch 直连，TTFB/first-delta/usage 落盘）+ EchoBrain
  （回放 probe fixture 当节目单，pace 注入）+ run 登记表 + 三端点 +
  /ai/providers + /tmp/nz-ai-chat.log（JSONL，不落 key 不落正文）。
- 阶段三 f145e76c：chat-link 脑（SSE fetch+ReadableStream——不用
  EventSource：要带 method/自定义头且 cursor 查询参数自己控）+ 三件皮
  （message-list/streaming-text/prompt-bar，BU 词汇重写）+ orb + 全屏
  AI 页 + __kfmNzAiChat() 钩。tokens.css 新增 ai-chat 专用段（BU dark
  原值收编新 token；存量 --kfm-line 差异按 §八登记**不回改存量**）。
- 阶段四（本信随附两笔）：orb 挪右中 + C 档双路 + 形状闸 + 文书。
- 纪律产出：**红先不是仪式**——B 档 7 钉+补流钉先红（2/21），实现后
  21/21；每个阶段的提交消息自带考卷数字，没有数字的「完成」不算完成。

### ③ 九事件缝（双端共享协议，不自造第三份）

- 九事件词汇表 = 协议本身：message_start / content_block_start /
  content_block_delta（deltaType 分流 thinking/text/input_json）/
  content_block_stop / tool_result / message_stop / done / error /
  rule_warning。block 布局：index=0 恒 text（**thinking+正文同块混排，
  靠 deltaType 分流**——chat.ts 拆两 block 的事故直接写成结构约束）。
- SSE 分帧与 kfmv4 逐字节一致：帧=`data: {"index":N,"event":{...}}\n\n`
  （index=重连 cursor），无 event: 行，终结帧 `__end__`——B/C 档对拍
  基准，fixture 的形状=真流的形状。
- 纪律产出：**双端共享消除漂移**——nz 另起协议=自造第三份（v8 教训）；
  block-idx.ts 虽 A1 无工具块也一起搬（23 行零成本，防 A3 接工具再补）。

### ④ echo 夹具断网开发（B 档判卷腿 = 断网开发腿）

- EchoBrain 回放 na 抓的真流 fixture（probe-kimi 44 事件/probe-glm 40
  事件），pace 节奏注入（0-500ms 夹取），取消→error「已取消」收尾，
  attach 历史后缀回放；echo-error 错误节目（B4 钉）。`provider:'echo'`
  经 HTTP 全链走 EchoBrain（无需换进程），`NZ_AI_BRAIN=echo` 全局强制
  （真 key 在场也不直连=排障隔离层）。
- **假数据的形状=真数据的形状**——这是「fixture 驱动断网可开发」的
  全部含义：B 档 21 钉全程零真 key 零网络，C 档只验「真通路也长这样」。
- 纪律产出：echo 与 direct 同插座（BrainEndpoint），换脑零改动；B 档
  与断网开发共用一条腿，考卷即开发环境。

### ⑤ 变异抽检（钉必须证明能红）

- 阶段二：translator thinking↔text 换轨变异 → A2/A3 双咬；fuse 缺失
  裸发代字变异 → A6 咬（照 na 变异双咬先例）。
- 阶段三：皮内塞硬编码 `#f2f3f4` → P7 钉精确变红 → 还原。
- 纪律产出：考卷没经过变异抽检，等于没证明钉能红；抽检记录写进提交
  消息，不许口头「测过了」。

### ⑥ B 档结晶三真虫（考卷抓的，不是用户抓的）

1. **收起钮被 tmux orb 截点**（B1c 实锤）：AI 页头部原让开左右 56px
   不够——tmux orb（z=41）压在 AI 页（z=38）之上截走点击；修法=让开
   热区+orb 后挪右中（阶段四拍板，彻底不占头部）。
2. **WAITING 期间旧消息挂流式光标**（B5 实锤）：msgIdx 未归 -1，上一
   条消息的泡泡被当成流式目标；修法=WAITING 期 msgIdx=-1。
3. **流泵不重启**（补流钉实锤）：streaming 布尔标志在补流 attach 时
   挡住新泵；修法=gen 代际守卫（每次 attach 代际+1，旧泵自然失效）。
- 纪律产出：三虫全是「考卷先红、定位后修、修后钉留」——钉留在卷里
  当终身回归，不随修复删除。

### ⑦ C 档实录（真通路验收，2026-09-04）

- C1 Kimi 官方 kimi-k2.7-code：TTFB 2934ms/全程 5422ms/88 deltas/169
  chars/usage 104+104=208——**§八③ 用户拍板「官方渠道此名可通」实测
  成立**。C2 智谱 glm-5.3-flash：TTFB 619ms/4159ms/160/628/82+162=244。
- C3 互证：/tmp 日志四拍（start/upstream-status/first-delta/done+usage）
  ↔ 钩读数 chars 逐拍相等（169↔169、628↔628）；TTFB/first-delta/usage
  字段只有真通路产生，出现本身=证据。
- R3 归位真通路表现：k2.7-code reasoning_content 帧流式期灰档归位正文
  +光标，done 后收「思考」折叠区（截图 ai-chat-c-c1-kimi-*.png）。
- **C 档结晶第四真虫**：畸形消息（缺 content 数组）→ extractText
  TypeError → void pump 未捕获拒绝 → **server 进程整体崩**。修法双闸：
  route 形状闸 400 + brain 装配期 catch→error 事件（P3）；回归钉
  「三形态 400+同进程后续请求照常」入账（npm test 154→155）。
  **教训：void promise 是进程级引信——任何 `void asyncFn()` 都要问
  一句「它抛了谁接」。**
- 真机：echo 腿全绿（截图 ai-chat-c-device-echo.png）；真消息 server
  侧全链完成（usage 340 落盘），client 收 1102/1103 字符后设备息屏
  流断卡 STREAMING——A9 设计内环境事件，亮屏补流路径未目击，
  **留 A2 观察项**（诚实降级已按 AGENTS.md 声明）。

### ⑧ orb 挪位（09-04 用户拍板）

右上 → 屏幕右边缘垂直居中（`top:50% + translateY(-50%)`），动因：
右上与顶部伸出的 tmux 标签排 max-content 宽度冲突。设计清单 §3.0 同步
改写；browser 考卷无钉 orb 位置的断言（B1 只钉转换与 DOM 有无）无需
改卷；存证走 ai-chat-orb-shot.mjs 数值断言（right=12px/cy=vh/2/与
标签排零重叠）+ 同框截图。

## 闭环后迭代

### 迭代 1（2026-09-05）：AI 绑定订阅 pool-changed 跟随总账（「茉莉的测试2」bug）

- **为什么改**：用户实测——池页新建并激活会话「茉莉的测试2」，AI 窗口
  不切换。真机 CDP 三路实证（账=测试2 / 页内 API=测试2 / 钩子=测试，
  ring 无 loadSession）：总账变更无传播——面板只在挂载/手动切时读账，
  池页激活后绑定永不跟随；连带隐患=错位发送（消息落进旧会话文件）。
- **方案裁定（用户两问定稿）**：「最小改动（raise/menu 时机钩）是不是
  最正确」→ 否：时机枚举有漏路径（右滑关池回 AI 页无 raise/menu），对
  未来新写入方不闭；「是不是 kfmv4 成熟设计」→ 哲学层是（cordis 唯一
  事实源/总线广播），机制层是 nz 自有 §1.6 契约（bus.ts→ws-bridge 订
  阅票，C10/C11/C13 考卷已钉）。用户拍板：nz 唯一写入方（仲裁②外部
  写入边界永不建），方案随之减掉时机钩与幽灵消费者防御；两条不变式入
  契约——总账切换→视图立即跟随；所见即所附（发送仍按面板绑定落会话，
  不改成按总账落）。
- **改了什么**：chat-link 增 pool-watch 订阅腿（/ws/term 多路复用；重连
  3s+回前台补连=C13 同款）；onmessage 收 activated 帧→读账跟随
  （realignLedger：账变了且 IDLE→loadSession，P18/并发闸天然复用）；
  done/error 流毕对账收口 P18 推迟窗；close 全链 teardown。deleted 帧
  不动绑定：relied 守卫（409）使删正显示的会话必须先切走激活，而切换
  恰由本腿跟随。
- **考卷**：ai-chat B 档新增 B20 五钉。红先证据=stash src 重建旧码跑卷
  62/65（B20a/a2/b 不跟随、环无帧），新码 65/65 全绿；B20b 钉 P18 推迟
  窗（流式中激活不拆流、流毕跟随甲）、B20c 钉自反激活不重水合（消息数
  组引用恒定）。
- **验收（多路）**：L1=考卷 65/65+单元 191/191；L2=激活前后 /pool/active
  与 active.json 对读一致；L3=真机 8026 attach：服务器侧激活→钩子跟随、
  复原→跟随，ring 实录 pool:activated×2→pool:realign(activated)→
  ui:hydrate（bus→ws-bridge→中继→真机全链）+ 面板截图。
- **纪律产出**：①考卷读 hook 必须走 B6 助手同款映射——phase 真路径=
  run.phase，hook 顶层无 phase 字段（本轮 B20b 连吃两轮假红才抓到）；
  ②激活帧是账级事件（{pool:'active',id:'active'} 不带会话 id），客户端
  「读账跟随」即契约，勿按 pool==='session' 过滤（首轮实现即栽）；③选
  型口诀：状态分歧的解药是「单写多读+订阅跟随」，不是时机枚举——时机
  枚举必有漏路径。

## 观测手段库（本插件沉淀的基建）

| 手段 | 路径 | 用途 |
|---|---|---|
| A 档考卷 | tests/ai-*.test.ts（sse-parser/translator/providers/reducer/projection/server 六卷） | 协议/translator/fuse/reducer/错误语义钉（判卷基准=na fixture） |
| B 档考卷 | tests/browser/ai-chat.test.mjs | 21 钉（转换表全链+P 族禁令+补流钉） |
| C 档驱动 | tests/browser/ai-chat-c-accept.mjs | 真 UI 全链双路真连+截图（烧 token 受控，两三条短消息） |
| orb 存证 | tests/browser/ai-chat-orb-shot.mjs | 位置数值断言+标签排同框截图 |
| server 落盘 | /tmp/nz-ai-chat.log（NZ_AI_CHAT_LOG 可覆盖） | start/upstream-status/first-delta/done+usage/error 逐拍（L2 腿） |
| 观测钩 | __kfmNzAiChat() | page/menu/run/messages 摘要/64 拍 ring/lastError（L3 腿） |
| echo 夹具 | provider:'echo' / NZ_AI_BRAIN=echo | 断网开发+B 档判卷+排障隔离 |
| 深排障 | NZ_AI_DEBUG_BODY=1 → /tmp/nz-ai-chat-body-<runId>.log | 请求/响应全文（Authorization 脱敏），默认关 |

## 纪律产出汇总（通用，不限本组件）

1. 设计输入优先用「已实锤的事故档案」，每条规则挂出处，杜绝「我觉得」。
2. 不做清单与做清单同权，是全期返工防火墙。
3. 双端共享协议原样搬，不自造第三份；零依赖核实到 import 级再搬。
4. echo 夹具=断网开发腿=B 档判卷腿=排障隔离层，一物四用；假数据形状
   必须=真数据形状（真流 fixture 当节目单）。
5. `void asyncFn()` 是进程级引信——异步泵的异常必须有 catch 落点，
   崩 server 比错答严重一个量级（C 档第四真虫）。
6. 真机验收按环境诚实降级：息屏/后台不产帧是物理约束，声明降级+
   留观察项，不许拿 server 侧证据冒充像素证据。
7. 用户拍板的可证伪命题（「官方渠道此名可通」）用 C 档实测收口，
   验证成立即入账，不成立凭落盘定位再议——拍板→实测→入账是闭环。
