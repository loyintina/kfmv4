> 这是什么：AI 对话运行时——后台挂机/重连续读/WS 存活/冷恢复的隐性时序契约（展开版）。
> 别的去哪找：压缩版硬规则与陷阱 → contract.md；Z-Index 层级 → ../client-shell/contract.md；压缩规则 → detail-tool-compaction.md。

# AI 对话运行时（AI Chat Runtime）

> 迁移注（2026-07-28）：自 docs/design/AI_CHAT_RUNTIME.md 迁入，§1-§8/§10 原文未删节（原文 v8.2 注销，git show v8.1.1 考古）。
> §9 Z-Index 层级已回家 ../client-shell/contract.md。§4 七条隐式契约的压缩版在 contract.md
> #陷阱 1/2/4/5/6——改代码时以 contract 为准，排查/加功能时读本文展开版。
> 改动 AI 对话流式、挂机持久化、WebSocket 重连、终端卡恢复前必读。

## 1. 为什么存在这个子系统

早期 AI 对话是"客户端发起 SSE 流，边收边渲染"。它有两个致命缺陷：

1. **流生命周期 = 客户端连接生命周期**。切后台、锁屏、刷新、断网 → 流中断 →
   已经在跑的生成（可能带工具调用）全部丢失，回来只能重发。
2. **没有半开连接检测**。浏览器在后台会冻结 JS（含 WebSocket），TCP 可能已经断了
   但 `onclose` 不触发（半开连接）。服务端往死 socket 写数据 → tmux 卡卡的终端
   彻底哑火。

现在的模型是 **tmux 式的后台挂机**：生成任务在服务端独立于任何客户端连接运行，
客户端只是"订阅者"，断开只是取消订阅、不取消生成，回来可以从任意事件位置续读。

---
```
┌─────────────── 浏览器 ───────────────┐        ┌─────────────── 服务端 ───────────────┐
│                                       │        │                                        │
│  orb-chat-host.ts (handleSend/重连)   │        │  ai/routes.ts (HTTP 端点)              │
│     │  abortCtrl 单例 + sendBtn.sending│        │     POST /ai/chat/start                │
│     ▼                                 │        │     GET  /ai/chat/:runId/stream?from=N │
│  orb-chat.ts                          │        │     POST /ai/chat/:runId/cancel        │
│     doSend → start → _consumeWith-    │  HTTP  │     GET  /ai/chat/active?sessionId=    │
│       Reconnect → _consumeRun         │◄──────►│     GET  /ai/chat/:runId/status        │
│       → applyEvent (reducer)          │  SSE   │                    │                   │
│     resumeRun (重连续读)              │        │                    ▼                   │
│     localStorage: {sessionId,runId}   │        │  ai/run-manager.ts (后台挂机核心)      │
│                                       │        │     startRun / attachRun / cancelRun   │
│  chat-dom.ts (唯一渲染路径)           │        │     Run{events[],done,subscribers}     │
│     patchEvent → DOM 投影             │        │     EVICT_MS=5min 淘汰                  │
│     mountUserMessage / mountAiMessage │        │                    │                   │
│     增量 DOM：思考框/文本泡/工具卡    │        │                    ▼                   │
│                                       │        │  ai/chat.ts (SSE 流式生成器)           │
│  session-client.ts (客户端会话管理)     │        │     streamChat() async generator       │
│                                       │        │       message_start → block_* →        │
│  shared/chat-protocol/ (协议层)       │        │       tool_result → message_stop → done│
│     messages.ts / events.ts           │        │                                        │
│     reducer.ts / block-idx.ts         │        │  ai/session-store.ts (会话日志落盘)    │
│                                       │        │     appendEvent / flush / flushSync    │
│  ws-channel.ts (WebSocket + 重连)     │        │     isIncomplete (冷恢复判据)          │
│     onReconnect/offReconnect          │        │                                        │
│     WATCHDOG_MS=75s 存活看门狗        │  WS    │  ws-server.ts (30s 协议级 ping)        │
│         │                             │◄──────►│     _isAlive 半开检测 → killAll + PTY  │
│         ▼                             │ ping/  │                                        │
│  terminal-card-04.ts / tmux-card.ts   │ pong   │                                        │
│     _onReconnect → 重开 PTY / re-attach│        │                                        │
│                                       │        │                                        │
└───────────────────────────────────────┘        └────────────────────────────────────────┘
```

两条**完全独立**的通道，别混淆：

- **HTTP/SSE 通道**：AI 对话生成。走 `src/server/ai/routes.ts` + `run-manager` + `chat.ts`。
- **WebSocket 通道**：终端 PTY、Registry snapshot、实时推送。走 `ws-channel.ts` +
  `ws-server.ts` + `terminal-pty.ts`。

它们唯一的交叉点是**用户体验**：WS 断线重连时，终端卡要重开 PTY（见 §6）；而 AI
生成的挂机与重连**不依赖 WS**，纯走 HTTP（见 §3）。

---

## 3. 后台挂机（server-side run）

### 3.1 生命周期

`startRun(sessionId, messages, model, provider, wsServer)` 在用户显式发送新消息时调用：

1. 分配 `runId`，建 `Run{ id, sessionId, events:[], done:false, subscribers:Set, abort }`。
2. **后台异步驱动** `streamChat()` 生成器（与任何请求连接解耦）：每 yield 一个事件就
   `run.events.push(event)` 并广播给当前所有 `subscribers`。
3. 生成器结束（正常/错误）→ `finally` 里 `run.done=true` + 通知订阅者 `onDone()` +
   `_scheduleEvict(run)`（`EVICT_MS=5min` 后从 `_runs`/`_bySession` 删除）。

客户端订阅走 `attachRun(runId, fromIndex, onEvent, onDone)`：

1. 先补齐 `events[fromIndex..]`（重连场景的历史事件）。
2. 若 `run.done` 已 true → 立即 `onDone()`（补齐即完成，无需实时订阅）。
3. 否则加入 `subscribers`，实时接收后续事件。返回退订函数。

### 3.2 端点契约（`src/server/ai/routes.ts`）

| 端点 | 用途 | 关键返回 |
|------|------|---------|
| `POST /ai/chat/start` | 启动生成 | `{ runId, fromIndex }`，`fromIndex` 是客户端应从哪个事件索引开始读 |
| `GET /ai/chat/:runId/stream?from=N` | SSE 续读 | 每行 `data: {index, event}` 信封；流尾 `data: {"type":"__end__"}` |
| `POST /ai/chat/:runId/cancel` | 用户主动取消 | `run.abort.abort()` |
| `GET /ai/chat/active?sessionId=` | 查该会话是否有活跃 run | 页面恢复时用 |
| `GET /ai/chat/:runId/status` | 查 run 是否 `exists`/`done` | 重连时判断是否还值得续读 |

### 3.3 事件协议（`src/server/ai/chat.ts` → 客户端 `_applyEvent`）

一次生成可能有**多轮**（每次工具调用后 AI 再请求一轮）。事件序列：

```
message_start
  content_block_start(index=0, text)          ← thinking/text 合并到同一 index=0 block
  content_block_delta(thinking_delta | text_delta)   ← 流式正文/思考
  content_block_start(index≥1, tool_use)      ← 工具块，index 从 1 起连续分配
  content_block_delta(input_json_delta)        ← 工具参数流式
  content_block_stop
  tool_result                                  ← 工具执行结果
message_stop        ← 若还有下一轮（finishReason=tool_calls），继续；否则：
done                ← 整个生成结束
```

> **`content_block` 的 index 连续性**：thinking+text 永远 index=0，工具块从 1 起按
> **首见顺序**连续分配（`clientIdx()` 映射 provider 的 `tc.index`）。provider 的
> `tc.index` 可能不从 0 起（如 Claude 从 1），若直接用会在客户端 content 数组留
> `undefined` 空洞，`.filter(b=>b.type)` 读空洞崩 `Cannot read ... 'type'`。见 chat.ts 头注。

---

## 4. ⚠️ 隐式契约（破坏会卡死，且难调试）

> 这些是本子系统最容易踩的坑。加功能前逐条对照。

### 4.1 `run.done` 在 finally 才置 true — 订阅者收尾必须在 finally 显式触发

**契约**：`startRun` 的生成器循环里派发最后一个 `done` 事件时，`run.done` **仍是
false**（它在循环结束后的 `finally` 才置 true）。因此**不能**依赖 `onEvent` 里
`if (run.done) onDone()` 来收尾实时订阅者——那一刻永远是 false。

**正确做法**：`Subscriber` 是 `{ onEvent, onDone }` 对象；`finally` 里 `run.done=true`
**之后**显式遍历 `subscribers` 调 `sub.onDone()`。

**违规后果**：`src/server/ai/routes.ts` 的 `onDone`（发 `__end__` 信封 + `res.end()`）永不触发 →
客户端 `_consumeRun` 死等 `__end__` 不返回 `'done'` → `doSend` 挂起 → **发送按钮永久
卡在"发送中"** + 最后一轮 `message_stop` 打开的等待提示**永不清除**。

**历史案例**：2026-07-19（run-manager Subscriber 单函数 → 对象，见 commit `a5bf0c4`）。

### 4.2 等待提示（onWait）在"首个实际内容"到达时停，不在 message_start 停

**契约**：`_applyEvent` **不能**在 `message_start` 就 `onWait(false)`。推理模型
（如 deepseek-v4-pro）`message_start` 后首个 `thinking_delta` 可能延迟数秒，过早停
提示 → 用户盯着**空白**直到思考框才出现。

**正确做法**：`onWait(false)` 挂在首个实际内容上——`text_delta`、`thinking_delta`
的首个 delta，或 `tool_use` 的 `content_block_start`。`message_stop` 则 `onWait(true)`
（工具轮次之间的空档继续显示"忙碌"）。

**违规后果**：非推理模型（mimo）看不出问题（内容紧跟 message_start），推理模型出现
"提示消失 → 白屏几秒 → 思考框才出现"。

**历史案例**：2026-07-19（commit `f46a551`）。

### 4.3 最后一轮 message_stop 打开的提示，doSend 必须主动清

**契约**：服务端在**每个** `message_stop` 后都可能有下一轮，所以 `_applyEvent` 对
`message_stop` 一律 `onWait(true)`。但**最后一轮**的 `message_stop` 之后只有 `done`，
没有内容来清提示。

**正确做法**：`doSend` 在 `_consumeWithReconnect` 返回后**立即** `onWait(false)`，不
等 `_finalizeRun` 的落盘网络往返（否则残留等待框会闪现数百 ms）。

### 4.4 `startRun` 语义是"取代"，不是"复用" — 重连另走 attachRun

**契约**：新消息发送 → `startRun` 一律取消该 session 的旧 run 并起全新 run（不复用
"看起来还活着"的旧 run）。保证新消息不会被丢弃、也不会错误地"接上"旧 run 的上下文。

**重连续读**走 `getActiveRun`/`attachRun`（`resumeRun` 客户端入口），**不经过**
`startRun`。两条路径别混。

### 4.5 run 持久化用 localStorage，不是 sessionStorage

**契约**：`orb-chat-run.ts` 的 `_persistActiveRun` 存 `{sessionId, runId}` 到
**localStorage**。sessionStorage 随标签页/浏览器关闭清空 → 杀浏览器重启后无法重连
挂机中的生成。localStorage 跨浏览器重启存活（配合服务端 `EVICT_MS=5min` 缓冲窗口）。

### 4.6 空 sessionId 会被服务端 400 拒绝 — 发送前必须确保有会话

**契约**：`POST /ai/chat/start` 校验 `!sessionId || !messages` → 400
`缺少 sessionId 或 messages 参数`。删除最后一个会话后 `sessionStore.activeId=''`，
若直接发送就会触发。

**正确做法**：`doSend` 在 `saveMessages`（它会在 activeId 为空时自动新建会话）之后，
`if (!_sendSessionId) _sendSessionId = sessionStore.activeId` 回填新建的 id。

**历史案例**：2026-07-19（commit `f46a551`）。

### 4.7 删除最后一个会话 → 派发的 sessionId 是空串 → 消费方必须处理空串

**契约**：`session.card` 删除最后一个会话时派发 `kfm-session-change {sessionId:''}`。
`orb.ts` 的监听器**不能** `if (!detail.sessionId) return`——那样会跳过空串，光球面板
残留旧消息不清空。

**正确做法**：空 `sessionId` 时清空 `chatMessages` + `_renderChat()` + 清空选择器。
（`session-client.ts` 的监听器则相反：它用 `if (e.detail?.sessionId)` 守卫是对的，因为
它只负责"切换到某个会话"，清空由 orb.ts 直接 `activeId=''` 处理。）

---

## 5. WebSocket 存活（真心跳，半开检测）

**问题**：浏览器后台冻结 JS → WebSocket 冻结 → TCP 可能半开（已断但无 FIN）→
`onclose` 不触发 → 服务端 `client.readyState` 仍是 OPEN → 往死 socket 写 PTY 输出 →
tmux 卡死。

**两端各一个检测器**：

- **服务端**（`ws-server.ts`）：30s 一轮 `setInterval`。每轮：若 `_isAlive===false`
  （上一轮 ping 后没回 pong）→ 判定死连接，`killAll(client)` 清 PTY + `client.terminate()`。
  否则 `_isAlive=false` 后 `client.ping()`（协议级 ping，浏览器自动回 pong 置回 true）。
  > **为什么用协议级 ping 而不是应用层 JSON ping**：应用层 ping 客户端会忽略、不回，
  > 无法做半开检测。协议级 `ws.ping()` 由浏览器底层自动 pong，才能真正探活。

- **客户端**（`ws-channel.ts`）：`WATCHDOG_MS=75000` 看门狗，任何服务端消息都重置它。
  75s 内（服务端每 30s 一 ping，正常 ≤30s 必有消息）没收到任何消息 → 判定半开 →
  强制重连。

---

## 6. WS 重连后的终端恢复（三层联动）

WS 重连成功后，**服务端旧 PTY 已随旧连接被 `killAll` 清除**，客户端却还拿着无效
`sessionId`。必须重新 `terminal-open` 拿新 sessionId，否则终端哑火（能连上但无法输入
输出）。

**三层**：

1. **`ws-channel.ts`**：`onopen` 时若 `wasConnected===false`（重连而非首连）→ 调用所有
   `reconnectHandlers`。公开 `onReconnect(handler)`/`offReconnect(handler)`。

2. **`terminal-card-04.ts`**：`initTerminalCore` 注册 `_onReconnect` → WS 恢复时清旧
   `sessionId` + 重新 `terminal-open` 拿新 sessionId；`disposeTerminalCore` 注销。

3. **`tmux-card.ts`**：额外注册 tmux 专属的 `_onWsReconnect` → 若有 `_lastCommand`
   （上次 `tmux attach -t xxx`），300ms 后（等 PTY spawn 完成）`reopenWithCommand`
   直接重新 attach，跳过 `list-sessions` 往返。`reopenWithCommand` 每次都存
   `_lastCommand`；`deactivate/dismiss` 注销回调 + 清 `_lastCommand`。

**历史案例**：2026-07-19（心跳 commit `e477264` + 终端恢复 commit `b2f74bc`）。

---

## 7. 取消（cancel）的收尾

用户在生成中点发送按钮（此时是"停止"）→ `abortCtrl.abort()`：

1. `doSend`/`resumeRun` 的 `catch` 捕获 `AbortError` → `POST /ai/chat/:runId/cancel`
   通知服务端取消后台 run。
2. `_cancelPendingTools(messages)`：给所有仍"执行中"（无 result）的工具块打上
   `{已取消, isError}` 结果 → 从"忙碌中"变完成态 → 自动折叠，不再卡住。清 toolHint +
   动画状态。
3. 追加 `[已取消]` 文本（**push**，不 clobber 已有正文）。

**契约**：取消**只 append 标注**，不覆盖已渲染的内容。abortCtrl 在 `orb.ts` 的重连
IIFE 与 `handleSend` 之间**共享单例**，保证重连态也能被同一个按钮中断。

**历史案例**：2026-07-19（commit `da39891`、`b80ccb3`）。

---

## 8. 相关文件一览

| 文件 | 角色 |
|------|------|
| `src/server/ai/run-manager.ts` | 后台挂机核心：runId 分配、事件缓冲、订阅、EVICT 淘汰 |
| `src/server/ai/routes.ts` | AI 对话 HTTP 端点（start/stream/cancel/active/status） |
| `src/server/ai/chat.ts` | SSE 流式生成器 `streamChat()`，事件协议源头 |
| `src/server/ws-server.ts` | WebSocket + 30s 协议级 ping 半开检测 |
| `src/server/terminal-pty.ts` | PtyManager：断开时 `killAll` 清该连接的 PTY |
| `src/client/modules/orb-chat.ts` | re-export 门面 + `setEventHook` 事件钩子（实现在 orb-chat-run/orb-chat-hints） |
| `src/client/modules/orb-chat-host.ts` | 客户端宿主：`handleSend` + 重连 + 等待提示编排 + 会话切换监听 + `chatMessages` 全量持有 + 消息窗口编排（ChatHostDeps 注入，自 orb.ts 拆出） |
| `src/client/modules/ws-channel.ts` | WebSocket 客户端 + 重连 + 看门狗 + onReconnect API |
| `src/client/modules/tmux-card.ts` | tmux 卡：`_lastCommand` + WS 重连 re-attach |
| `src/client/modules/terminal-card-04.ts` | 终端核心：`_onReconnect` 重开 PTY |
| `src/client/modules/session-client.ts` | 客户端会话管理（只读缓存 + pre-run 创建，实际存储在服务端 session-store.ts） |
| `src/client/modules/chat-dom.ts` | v8 唯一渲染路径：`patchEvent` DOM 投影 + 历史消息挂载（v8.1 窗口化：首屏尾部窗口 + 滚动翻页 prepend） |
| `src/shared/chat-protocol/` | 双端共享协议层（5 文件）：`messages.ts`（类型）/ `events.ts`（事件）/ `reducer.ts`（纯状态转换）/ `block-idx.ts`（工具块索引映射）/ `index.ts`（导出） |
| `src/server/ai/session-store.ts` | 服务端会话日志落盘：`appendEvent` / `flush` / `flushSync` |

---


## 10. 冷恢复（Cold Recovery）— kfm-restart 自动续跑

> v8 宪法第三条：**服务端可死，真相在磁盘**。工具只负责"触发 + 立即返回"，
> 架构负责恢复。

### 10.1 触发流程

1. AI 调用 `kfm-restart` 工具 → 写 `restart-pending.json` 标记 → POST `/api/system/restart`
   → 立即返回 `tool_result`（不轮询、不刷新）。
2. `run-manager` 的 `flush` 保障落盘先于进程死亡（`session-store.flushSync` 同步写）。
3. 旧进程死亡 → `systemctl` 拉起新进程 → 新进程启动时检测 `restart-pending.json`
   → WS 广播 `server-restarted` 事件 → 删除标记文件。
4. 客户端 WS 重连后收到 `server-restarted` → 触发冷恢复逻辑。

### 10.2 客户端冷恢复判据（`orb.ts` 重连 IIFE）

页面加载 / WS 重连时，客户端检测"未完成的对话"：

- **判据**：`chatMessages` 末尾是 `role:'ai'` 消息，且含 `type:'tool'` block 带 `result`
  （工具执行完了但 AI 还没回应——回应会是新 message）。
- **动作**：重建 `apiMessages`（复用 `doSend` 的格式转换）→ `POST /ai/chat/start`
  启动新 run → `resumeRun` 自动续读 → 面板自动展开 + 等待提示。

### 10.3 restartCount 防护（防无限循环）

**问题**：若冷恢复本身又触发 `kfm-restart`（如 AI 连续多轮重启），会无限循环。

**防护**：`localStorage` 存 `kfm-restart-count` 计数器，每次自动 resume 递增。
`MAX_RESTART_COUNT = 3`——连续自动 resume 超过 3 次则停止，清除计数器，用户可手动重发。

```
RESTART_COUNT_KEY = 'kfm-restart-count'
MAX_RESTART_COUNT = 3

on reconnect:
  restartCount = localStorage.getItem(RESTART_COUNT_KEY) || 0
  if restartCount >= MAX_RESTART_COUNT:
    localStorage.removeItem(RESTART_COUNT_KEY)
    return  // 停止自动恢复
  ...
  on successful auto-resume:
    localStorage.setItem(RESTART_COUNT_KEY, restartCount + 1)
```

### 10.4 服务端支撑

- **`session-store.ts`**：`isIncomplete(sessionId)` 检测未完成的对话（末尾是 AI 消息
  含 tool result 但无后续纯文本 AI 消息）。供自动 resume 判据使用。
- **`flushSync(sessionId)`**：同步落盘，用于 `kfm-restart` 的 `abort.finally` 路径——
  进程即将死亡前的最后保障。
- **`appendEvent` / `flush`**：异步落盘 + 防抖，正常流程每事件调度写盘。

**历史案例**：v8 重写（2026-07-27），冷恢复 + restartCount 防护。

### 10.5 kfm-restart t0-t10 时序（自 V8_ARCHITECTURE §五迁入，2026-07-28）

```
t0  AI 调用 kfm-restart → 工具立即返回 "重启已触发"
t1  chat.ts yield tool_result → SessionStore 同步落盘 ← 生死线
t2  工具触发 POST /api/system/restart → spawn detached systemctl
t3  systemd 杀进程（streamChat 死在 t2-t3 之间）
    ─── 进程死亡 ───
t4  systemd 启动新进程
t5  新进程检测 restart-pending.json → 删除 → justRestarted = true
t6  客户端 WS 重连
t7  服务端 WS 握手 → 发送 { type: 'server-restarted' }
t8  客户端重新 fetch session → 重建 DOM
t9  检测"会话末尾是 tool_result 且无后续 AI 消息" → 自动 resume
t10 POST /ai/chat/start（完整 history）→ LLM 看到 tool_result → 继续推理
```

AI 长程工作恢复。不是"进程没死"，是"真相在磁盘上，任何新进程都能接上"。
（自动 resume 判据与 restartCount 防护见 §10.2/§10.3。）
