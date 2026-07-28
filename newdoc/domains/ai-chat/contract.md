> 这是什么：AI 对话子系统——光球面板、流式协议、会话存储、工具。
> 别的去哪找：运行时隐性时序 → detail（旧 docs/design/AI_CHAT_RUNTIME.md 迁移）；压缩规则 → detail-tool-compaction（旧 TOOL_IO_COMPACTION.md 迁移）；browser 工具 → detail-browser.md；orb 骨架 → ../client-shell/。

# ai-chat 域契约

## 所有权二分（宪法第一条的落地）

- 服务端拥有内容语义：LLM → 事件流 → SessionStore 落盘（**唯一写者**）。
- 客户端拥有呈现视觉：`chat-dom.ts` 事件 → 增量 DOM patch（v8，只增不改）。
- 双端共享：`src/shared/chat-protocol/`（messages/events/reducer/block-idx）。

## 模块职责

- 客户端：`orb-chat.ts`（薄编排入口）`orb-chat-run.ts`（持久化运行态/流消费/重连/doSend）
  `orb-chat-hints.ts`（等待提示/工具提示/Todo 面板）`chat-dom.ts`（增量投影）
  `session-client.ts`（只读缓存 + pre-run 创建）`ws-channel.ts`（WS + 重连看门狗 + onReconnect）
- 服务端 `ai/`：`chat.ts`（SSE 流式核心）`run-manager.ts`（后台挂机：runId/事件缓冲/5min 淘汰）
  `routes.ts`（start/stream/cancel/active/status）`session-store.ts`（唯一写者 + 冷恢复）
  `page-state.ts` `prompt-assembler.ts`（眼睛系统）`rule-engine.ts` `tools/`

## 硬规则

1. 会话文件是全量真相源；任何运行态要么已落盘要么可重建（宪法三）。
2. 工具 I/O 发给 LLM 前必须过压缩投影（check-tool-compaction 双向核对，
   新工具不登记压缩行为 = 构建中断）。
3. 增量 DOM 只增不改：append 进已挂载消息不会投影——新消息必须走新 mount。

## #陷阱

1. **run 收尾时序**：必须在 `finally` 显式触发订阅者 `onDone`（run.done 时序陷阱），
   否则 `__end__` 不发 → 发送按钮卡死 + 残留等待框。
2. **startRun 语义为「取代」**：重连走 `attachRun`；`_consumeWithReconnect` 退避重试 +
   `/status` 探活。
3. **新增服务端依赖必须同步 build.mjs external**——CJS 包打进 ESM bundle 启动即崩。
   案例：v8.1 compression 事故，全站 502 + systemd 重启风暴。
4. **推理模型等待提示**：`onWait(false)` 挂在首个实际内容（含 thinking_delta），
   不是 message_start——否则白屏空档。

## 文件清单

客户端：`orb-chat.ts` `orb-chat-run.ts` `orb-chat-hints.ts` `chat-dom.ts`
`session-client.ts` `ws-channel.ts` + `src/shared/chat-protocol/`（5 文件）
服务端：`ai/chat.ts` `ai/run-manager.ts` `ai/routes.ts` `ai/session-store.ts`
`ai/page-state.ts` `ai/prompt-assembler.ts` `ai/rule-engine.ts` `ai/tools/` `prompts/`
细节：AI_CHAT_RUNTIME（迁移中）· detail-tool-compaction（迁移中）· detail-browser.md
