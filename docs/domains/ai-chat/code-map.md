> 这是什么：ai-chat 域**代码现状**测绘（实然）——代码此刻到底是什么，含与契约的漂移。
> 应然去哪找：设计契约 → contract.md；运行时隐性时序 → detail-runtime.md。
> 机械层对照：文件/行数/导出符号 → ../code-inventory.md（脚本生成，可重跑）。

# ai-chat 代码地图（code-map）

## 测绘元数据

- 基准：commit 0b77827 · 2026-07-29 · 域规模 52 文件 / 10918 行
- 方法：subagent 结构化侦察（入口/状态/数据流/持久化/边界/不变量/意外发现七问）
  + 主 agent 对承重结论逐一 `file:line` 抽查核实
- 用法：**语义审计的对比基准**。审计员不必重读全部代码，以本图 + 机械清单为
  「代码侧真相」，与 contract/detail 做文本 diff。「漂移清单」可直接立案。

## 一句话职责

光球对话的完整链路：发送 → 服务端代理上游 LLM（SSE）→ 事件流三向分发
（缓冲/落盘/广播）→ 客户端增量 DOM 投影 → 会话文件持久化。

## 承重入口

| 入口 | 位置 | 调用方 |
|------|------|--------|
| `doSend()` | orb-chat-run.ts:425 | orb.ts（handleSend，唯一） |
| `resumeRun()` | orb-chat-run.ts:367 | orb.ts（刷新恢复 + kfm-restart 冷恢复） |
| `patchEvent()` | chat-dom.ts:806 | 经 setEventHook 注入，SSE 事件 → DOM 唯一投影口 |
| `sessionStore` 单例 | session-client.ts:149 | orb.ts / orb-panel.ts / 域外两张卡片 |
| `streamChat()` | chat.ts:116（服务端） | run-manager.ts:86（唯一） |
| `promoteReasoningBlocks()` | message-normalize.ts:21 | 写时 orb-chat-run.ts:128；读时 session-client.ts:260,282 |
| `startWaitingIndicator()` | orb-chat-hints.ts:28 | orb.ts（发送/恢复三处） |

`orb-chat.ts` 只是薄 re-export 门面（orb-chat.ts:18-26），无自身逻辑。

## 状态所有权

| 状态 | 持有者 | 备注 |
|------|--------|------|
| 客户端会话消息数组 `chatMessages` | orb.ts:89 | 引用传给 doSend/resumeRun，orb-chat-run 原地写；chat-dom 只读事件不持数据 |
| 服务端消息数组 | session-store.ts（每 session 一份 SessionState） | reducer applyEvent 原地写 |
| 流式进行态（runId/cursor） | orb-chat-run.ts:58-59 | 服务端对应 run-manager.ts:43-44 |
| 思考框折叠态 `_foldState` | chat-dom.ts:78 | 会话切换随 clearChatDom 清空 |
| 等待提示定时器 | startWaitingIndicator 闭包（orb-chat-hints.ts:66） | stop 函数交 orb.ts 持有 |
| 工具卡内提示 `_hintTimers` | chat-dom.ts:66 | tool_result 到达即停 |
| todo 面板态 | orb-chat-hints.ts:126-128 | 手动 ✕ 指纹存 localStorage kfm-todo-dismissed |
| 取消/发送中标记 | orb.ts（按钮 .sending class） | 独占写 |

## 一次发送的链路（全 HTTP，无 WS）

1. orb.ts 发送按钮 → handleSend → 起等待提示
2. doSend：push 用户消息 → mountUserMessage 上屏（orb.ts:806 回调）
3. 读 .kfmv4/active.json 配置（orb-chat-run.ts:414）
4. **格式转换在客户端**：content blocks → OpenAI tool_calls 形态 + 压缩投影
   + 空壳 assistant 过滤（orb-chat-run.ts:598-647）
5. 新会话先 sessionStore.saveMessages 建文件（orb-chat-run.ts:659-661）
6. POST /api/ai/chat/start → session-store.appendUserMessage（幂等）→ run-manager.startRun
7. streamChat 组装 system + 边界规范化（chat.ts:151-178）→ POST 上游 → 解析 SSE
   → 工具本地并行执行（chat.ts:382），上限 50 轮（chat.ts:188）
8. 每事件三向分发：run 缓冲 / session-store 落盘 / 广播订阅者（run-manager.ts:114-126）
9. 客户端 SSE 续读 /api/ai/chat/:runId/stream?from=N → _applyEvent 写数据层
   → patchEvent 投影 DOM；首个 text/thinking delta 到达即停等待提示

## 持久化边界

- **常规写者唯一**：服务端 session-store.ts（防抖 200ms + flushSync 同步写，
  非 delta 事件立即 flush）。读路径：/api/sessions/list、/api/sessions/messages、
  /api/files/read；客户端读时 promoteReasoningBlocks 归一化（不改文件）。
- **双实现注意**：files.ts 与 session-store.ts 各自独立读/写同一批会话文件，
  _computeStats 统计口径两处各写一份。

## 跨域边界

- 依赖域外：state.js / tree-loader.js（文件树）、renderers/* + marked（渲染）、
  logger.js；orb.ts 依赖 client-shell 大量基础设施（gesture-registry、drag-handler 等）
- 被域外依赖：main.ts → initOrb（唯一启动口）；config.card / session.card → sessionStore；
  server/ai-tools 与 kfmv4 工具 → wsServer snapshot/eval 桥
- 无人 import orb-chat-run.ts / chat-dom.ts / orb-chat-hints.ts（orb.ts 门面之外）

## 代码强制的不变量（附证据）

- content 类型归一 fail-closed：非字符串一律 JSON.stringify（chat.ts:156）；
  无 tool_calls 的空 assistant 一律丢弃（chat.ts:165；客户端同策略 orb-chat-run.ts:643-644）
- 空壳消息 reasoning 归位：写时 + 读时双挂点（见承重入口表）
- 块索引连续化：block-idx.ts:13-23，text 恒 0、工具块从 1 连续
- 压缩硬性豁免：G2 ≤300 / G3 失败 ≤500 early-return（tool-compaction/index.ts:202-203）；
  压缩行强制单行（index.ts:219）
- 注册表完整性：构建期 tools/index.ts 与 COMPACTOR_REGISTRY 双向核对，失配中断
- 写前深拷贝剥 UI 字段：cleanBlockForSave（session-client.ts:74-97）；保存串行锁 _saveChain
- run 单活跃：同 session 新 start 强制取消旧 run（run-manager.ts:89-95）

## 漂移清单（实然 ≠ 应然 —— 语义审计立案源）

1. **session-client 职责漂移**：contract 称其「只读缓存 + pre-run 创建」，代码仍持有
   完整写盘链路 _doSaveMessages（session-client.ts:389）——双轨残留。
2. **格式转换双份实现已漂移**：orb-chat-run.ts:598-647（含压缩 + 空壳过滤）vs
   orb.ts:686-709 tryAutoResume 内重复实现（无压缩，且 push `content: mainText || null`
   不过滤空 assistant）——冷恢复路径发给严格端点的载荷不合上游边界契约。
   **（已修复 BAR-ORB-RESUME-01：收编 shared/chat-protocol/to-openai-messages.ts 唯一入口）**
3. **死代码三处**：renderMarkdownAsync（orb-chat.ts:37 全仓库无调用）；
   getToolHint（orb-chat-hints.ts:106 无调用，chat-dom 自给自足）；
   session-store.ts:190 isIncomplete 无人调用（冷恢复判据在 orb.ts:676-679 重复实现）。
4. **orb.ts 域归属**：注册在 client-shell 域（domain-src.mjs），但持有 ai-chat 核心状态
   （chatMessages、abortCtrl、发送按钮态）——域边界与状态所有权不一致。
5. **localStorage 协议五处散落无登记**：kfm-active-run、kfm-no-compact、
   kfm-restart-count、kfm-todo-dismissed、kfm-fontsize-orb。
6. **文件变更通知双路径并存**：initChatDom 的 onFilesChanged 是空 TODO（orb.ts:268），
   而 orb-chat-run.ts:184 自己直接调 loadFileTree——DOM 侧回调失效。
7. **switchTo 未 await patchActiveConfig**（session-client.ts:358，同文件 320/345/397
   均 await）——与自身注释强调的时序要求矛盾。
8. **ws-server 职责混杂**：名为通用 WS 通道，实际混终端 PTY、tmux 执行与 ai-chat
   snapshot/eval 桥（ws-server.ts:200-224）。

## 陷阱指针

已定型陷阱见 contract.md #陷阱（10 条，不重复）。测绘新捕获、待复核升级：
`_findLastToolId`（chat-dom.ts:1010）依赖 Map 遍历序兜底路由 input_json_delta，
跨会话残留 `_toolEls` 可能把 delta 路由到别的消息的卡。
