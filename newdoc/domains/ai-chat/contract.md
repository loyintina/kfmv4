> 这是什么：AI 对话子系统——光球面板、流式协议、会话存储、工具。
> 别的去哪找：运行时隐性时序 → detail-runtime.md；压缩规则 → detail-tool-compaction.md；browser 工具 → detail-browser.md；orb 骨架 → ../client-shell/。

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
   不是 message_start——否则白屏空档。最后一轮 message_stop 打开的提示由 doSend
   返回后主动清。
5. **空 sessionId → 服务端 400**：删除最后一个会话后 `activeId=''`；doSend 必须在
   saveMessages（自动建会话）后回填 `_sendSessionId`；`kfm-session-change` 监听器
   必须处理空串（清空面板），不能 `if(!sessionId) return`。
6. **run 持久化用 localStorage**：`{sessionId,runId}` 存 localStorage 才能跨浏览器
   重启重连（配 5min 服务端缓冲）；sessionStorage 会丢。
7. **面板渲染生命周期（v8.1 根洽契约，全 8 条）**：
   - **面板 DOM 只创建一次**：`ensurePanel()` 幂等创建，expand/collapse 只切显隐。
     禁止 expand 路径调 buildPanelContent/initChatDom/重挂历史——innerHTML 重建会让
     chat-dom 的 `_contentArea` 指向脱离 DOM 的节点，且全量重挂是展开卡顿根因。
   - **历史窗口化**：`chatMessages` 持全量，DOM 只挂尾部 `MOUNT_WINDOW` 条；滚动近顶部
     经 `setHistoryLoader` 回调 prepend（必须 `withScrollAnchor` 锚定）。unshift 补段致
     索引偏移后，必须 `_mountHistoryWindow()` 全清重挂窗口校正。
   - **批量挂载滚动抑制**：多条挂载必须 `suspendScroll()/resumeScroll()` 包裹——
     每条消息一次 scrollHeight 读取 = 一次强制同步布局。
   - **`clearChatDom` 连带清 history loader**：旧 loader 引用的索引随内容失效。
   - **拖拽期挂起面板 backdrop-filter**：每帧 GPU 模糊合成是卡顿主因；`onSavePosition`
     恢复，且 drag-handler 的 `pointercancel` 分支也必须调 `onSavePosition`。
   - **拖拽时面板跟随光球（rAF 合帧）**：`onMoveNormal` 必须每帧调 `updatePanelPosition`——
     「面板随光球移动」是设计契约，禁止用「整体跳过面板更新」治卡顿（226c2fb 治标）；
     拖拽期间不调 `_renderChat`，松手后 `onSavePosition` 统一滚。
   - **流式滚动 followBottom 门控**：`_renderChat('auto')`/等待提示/`_maybeScroll` 只在
     用户本就在底部时追底；强制追底只能走 `'follow'`（发送/首轮渲染）。违反 → 上滑看
     历史的用户被每个流式事件拽回底部。
   - **`_maybeScroll` 必须 rAF 合批**；但 `scrollToBottom` 本体保持同步语义
     （expandPanel/resumeScroll 依赖）。
   - **复制按钮走 contentArea 事件委托**：消息 DOM 动态增删，委托一次注册覆盖全部；
     禁止逐按钮绑定（v8.0 曾只建按钮不接处理，纯装饰）。
   回归钉：BAR-ORB-PANEL-01…21。
8. **content_block index 连续性**：thinking+text 永远 index=0，工具块从 1 起按首见顺序
   连续分配（`clientIdx()` 映射 provider 的 `tc.index`）——provider 的 index 可能不从 0 起，
   直接用会在 content 数组留 `undefined` 空洞，`.filter(b=>b.type)` 读空洞即崩。
   回归钉：BAR-106。展开版见 detail-runtime.md §3.3。

## 文件清单

客户端：`orb-chat.ts` `orb-chat-run.ts` `orb-chat-hints.ts` `chat-dom.ts`
`session-client.ts` `ws-channel.ts` + `src/shared/chat-protocol/`（5 文件）
服务端：`ai/chat.ts` `ai/run-manager.ts` `ai/routes.ts` `ai/session-store.ts`
`ai/page-state.ts` `ai/prompt-assembler.ts` `ai/rule-engine.ts` `ai/tools/` `prompts/`
细节：detail-runtime.md · detail-tool-compaction.md · detail-browser.md
