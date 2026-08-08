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
| `doSend()` | orb-chat-run.ts:406 | orb-chat-host.ts（handleSend，唯一） |
| `resumeRun()` | orb-chat-run.ts:356 | orb-chat-host.ts（刷新恢复 + kfm-restart 冷恢复） |
| `patchEvent()` | chat-dom.ts:806 | 经 setEventHook 注入，SSE 事件 → DOM 唯一投影口 |
| `sessionStore` 单例 | session-client.ts:151 | orb-chat-host.ts / orb-panel.ts / 域外两张卡片 |
| `streamChat()` | chat.ts:150（服务端） | run-manager.ts:86（唯一） |
| `promoteReasoningBlocks()` | message-normalize.ts:21 | 写时 orb-chat-run.ts:128；读时 session-client.ts:260,282 |
| `startWaitingIndicator()` | orb-chat-hints.ts:27 | orb-chat-host.ts（发送/恢复三处） |

`orb-chat.ts` 只是 re-export 门面 + 事件钩子（setEventHook），无业务逻辑。

## 状态所有权

| 状态 | 持有者 | 备注 |
|------|--------|------|
| 客户端会话消息数组 `chatMessages` | orb-chat-host.ts:32 | 引用传给 doSend/resumeRun，orb-chat-run 原地写；chat-dom 只读事件不持数据 |
| 服务端消息数组 | session-store.ts（每 session 一份 SessionState） | reducer applyEvent 原地写 |
| 流式进行态（runId/cursor） | orb-chat-run.ts:58-59 | 服务端对应 run-manager.ts:43-44 |
| 思考框折叠态 `_foldState` | chat-dom.ts:78 | 会话切换随 clearChatDom 清空 |
| 等待提示定时器 | startWaitingIndicator 闭包（orb-chat-hints.ts:27） | stop 函数交 orb-chat-host.ts 持有 |
| 工具卡内提示 `_hintTimers` | chat-dom.ts:66 | tool_result 到达即停 |
| todo 面板态 | orb-chat-hints.ts:99-101 | 手动 ✕ 指纹存 localStorage kfm-todo-dismissed |
| 取消/发送中标记 | orb-chat-host.ts（按钮 .sending class，按钮 DOM 属 orb.ts） | 独占写 |

## 一次发送的链路（全 HTTP，无 WS）

1. orb.ts 发送按钮（DOM 属 client-shell）→ orb-chat-host handleSend → 起等待提示
2. doSend：push 用户消息 → mountUserMessage 上屏（orb-chat-host.ts:300 直接调用）
3. 读 .kfmv4/active.json 配置（orb-chat-run.ts:399）
4. **格式转换在客户端**：content blocks → OpenAI tool_calls 形态 + 压缩投影
   + 空壳 assistant 过滤——唯一构造函数 shared/chat-protocol/to-openai-messages.ts
   （调用点：orb-chat-host.ts:197 冷恢复 / orb-chat-run.ts:438 doSend）
5. 新会话先 sessionStore.saveMessages 建文件（orb-chat-run.ts:458）
6. POST /api/ai/chat/start → session-store.appendUserMessage（幂等）→ run-manager.startRun
7. streamChat 组装 system + 边界规范化（chat.ts:193-241）→ POST 上游 → 解析 SSE
   → 工具本地并行执行（chat.ts:488），上限 50 轮（MAX_TURNS，chat.ts:266）
8. 每事件三向分发：run 缓冲 / session-store 落盘 / 广播订阅者（run-manager.ts:159-170）
9. 客户端 SSE 续读 /api/ai/chat/:runId/stream?from=N → _applyEvent 写数据层
   → patchEvent 投影 DOM；首个 text/thinking delta 到达即停等待提示

## 持久化边界

- **常规写者唯一**：服务端 session-store.ts（防抖 200ms + flushSync 同步写，
  非 delta 事件立即 flush）。读路径：/api/sessions/list、/api/sessions/messages、
  /api/files/read；客户端读时 promoteReasoningBlocks 归一化（不改文件）。
- **读路径注意**：files.ts 的 /sessions/list 只读会话文件并内联统计
  （messageCount/tokenCount），不写；写者确为 session-store 唯一
  （2026-07-30 语义巡逻裁决：旧文「双实现各自读/写」为过时表述，_computeStats
  现存仅 session-store.ts:131 一份）。

## 跨域边界

- 依赖域外：state.js / tree-loader.js（文件树）、renderers/* + marked（渲染）、
  logger.js；orb-chat-host 仅用 shell 的 Registry/ui-registry 与 OrbState 类型，
  面板/orb 状态经 ChatHostDeps 注入（不 import orb.ts）
- 被域外依赖：main.ts → initOrb（唯一启动口，initOrb 内部经 initChatHost 起宿主）；
  config.card / session.card → sessionStore；
  kfmv4 工具 → wsServer snapshot/eval 桥（server/ai-tools 已随 ADR-004 整删）
- orb-chat-run / orb-chat-hints 只被 orb-chat 门面与 orb-chat-host 使用；chat-dom
  例外——还被 orb.ts:34、orb-chat-run.ts:29、orb-chat-hints.ts:18 直接 import
  （2026-08-08 探针复核坐实，旧文「三者均只被门面与宿主使用」为过时表述）

## 代码强制的不变量（附证据）

- content 类型归一 fail-closed：非字符串一律 JSON.stringify（chat.ts:215）；
  无 tool_calls 的空 assistant 一律丢弃（chat.ts:224-226；客户端同策略
  to-openai-messages.ts:285-292）
- 空壳消息 reasoning 归位：写时 + 读时双挂点（见承重入口表）
- 块索引连续化：block-idx.ts:13-23，text 恒 0、工具块从 1 连续
- 压缩硬性豁免：G2 ≤300 / G3 失败 ≤500 early-return（tool-compaction/index.ts:202-203）；
  压缩行强制单行（index.ts:219）
- 注册表完整性：构建期 tools/index.ts 与 COMPACTOR_REGISTRY 双向核对，失配中断
- 写前深拷贝剥 UI 字段：cleanBlockForSave（session-client.ts:74-97）；保存串行锁 _saveChain
- run 单活跃：同 session 新 start 强制取消旧 run（run-manager.ts:114-120）

## 漂移清单（实然 ≠ 应然 —— 语义审计立案源）

1. **session-client 职责漂移**：contract 称其「只读缓存 + pre-run 创建」，代码仍持有
   完整写盘链路 _doSaveMessages（session-client.ts:389）——双轨残留。
2. **格式转换双份实现已漂移**：orb-chat-run.ts:598-647（含压缩 + 空壳过滤）vs
   修复前 orb.ts:686-709 tryAutoResume 内重复实现（无压缩，且 push `content: mainText || null`
   不过滤空 assistant）——冷恢复路径发给严格端点的载荷不合上游边界契约。
   **（已修复 BAR-ORB-RESUME-01：收编 shared/chat-protocol/to-openai-messages.ts 唯一入口）**
3. **【已结案】死代码三处已全部删除**：renderMarkdownAsync 与 getToolHint/clearToolHint
   整条链（orb 拆分专项）+ isIncomplete（批次二）。
4. **【已结案】orb.ts 域归属**：宿主编排已拆出为 orb-chat-host.ts（本域，331 行，
   ChatHostDeps 注入），orb.ts 剩 529 行纯 DOM 壳归 client-shell；chatMessages、
   abortCtrl、发送按钮态随宿主迁出——域边界与状态所有权已一致（ADR-004 裁决一）。
5. **localStorage 协议五处散落无登记**：kfm-active-run、kfm-no-compact、
   kfm-restart-count、kfm-todo-dismissed、kfm-fontsize-orb。
6. **文件变更通知双路径并存**：initChatDom 的 onFilesChanged 是空 TODO（orb.ts:209），
   而 orb-chat-run.ts:184 自己直接调 loadFileTree——DOM 侧回调失效。
7. **switchTo 未 await patchActiveConfig**（session-client.ts:358，同文件 320/345/397
   均 await）——与自身注释强调的时序要求矛盾。
8. **ws-server 职责混杂**：名为通用 WS 通道，实际混终端 PTY、tmux 执行与 ai-chat
   snapshot/eval 桥（ws-server.ts:200-224）。

## 陷阱指针

已定型陷阱见 contract.md #陷阱（计数不重复测绘——2026-08-06 漂移教训：手写计数 10 vs 实 13，去除计数面）。测绘新捕获、待复核升级：
`_findLastToolId`（chat-dom.ts:1010）依赖 Map 遍历序兜底路由 input_json_delta，
跨会话残留 `_toolEls` 可能把 delta 路由到别的消息的卡。
- **run 收尾时序（实测）**：run 结束在 `finally` 显式触发订阅者 `onDone`（run-manager.js/chat 循环；对照 contract #陷阱 1）。
