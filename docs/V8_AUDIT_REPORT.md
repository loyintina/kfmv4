# v8 全量审计报告

> 审计时间：2026-07-27
> 审计范围：v8 Phase 0-6 完成后的代码 + 文档全量一致性
> 审计人：QoderCN

---

## 一、代码架构问题

### HIGH — chat.ts 中 saveSessionFile + serverMessages 是死代码

**文件**: `src/server/ai/chat.ts` (lines 102-151, 222, 386, 446-448, 484)

`saveSessionFile` 函数仍定义在 chat.ts 中但不再被调用（三处调用已在 Phase 3 删除）。`serverMessages` 累加器仍在维护（push aiMsg、更新 toolBlock.result）但不再触发任何磁盘写入——持久化完全由 run-manager → SessionStore 路径接管。

**建议**: 删除 `saveSessionFile` 函数和 `serverMessages` 累加器。`clientMessages` 参数仍需要（传给 streamChat 作为 LLM 上下文），但 serverMessages 的 push/update 逻辑是纯死代码。

---

### HIGH — _applyEvent 中的动画调度代码已冗余

**文件**: `src/client/modules/orb-chat.ts` (lines 400, 413, 427-457, 650-652)

`_applyEvent` 仍包含 v7 的打字机动画逻辑（`_animText`, `_animInput`, `_foldPhase`, `scheduleRender` 调用）。这些代码修改 `chatMessages` 中 block 的 UI-only 字段，但 v8 的 `chat-dom.ts` 通过 `patchEvent` 独立处理自己的动画（340ms 折叠、400ms 思考框折叠）。

`scheduleRender` → `_renderCb` → `onRender` → `scrollToBottom()`，所以这些定时器只是在反复调用 scrollToBottom，无实际视觉效果。

**建议**: 从 `_applyEvent` 中删除动画调度代码（~60 行），只保留纯状态变更（text 追加、tool result 设置、rule_warning push）。同时删除 `scheduleRender`/`_renderCb`/`_renderScheduled`/`_activeAnimTimers`/`_activeFoldAnims`/`clearAllAnimTimers`。

---

### MEDIUM — 自动 resume 判据的边界情况

**文件**: `src/client/modules/orb.ts` (auto-resume IIFE, ~line 604)

判据是"末尾 AI 消息含 tool result → resume"。潜在误触发场景：
- 用户正常对话中 AI 调了工具，工具返回了结果，AI 也回应了（新 message），但用户刷新页面时恰好 session 文件还没写入 AI 的回应（竞态窗口极小，因为 flushSync 是每事件同步的）
- 用户手动停止生成（cancel），此时末尾可能停留在 tool result 状态

当前 cancel 路径会在 messages 中追加 `[已取消]` 文本，所以 cancel 后末尾有 text，不会误触发。但如果 cancel 发生在 tool_result 和下一条 message_start 之间（极窄窗口），可能误触发。

**建议**: 加一个 `restartCount` 计数器（localStorage），连续自动 resume 超过 3 次则停止，防止无限循环。V8_ARCHITECTURE.md 已提到这个设计但尚未实现。

---

### MEDIUM — flushSync 每事件同步写入的性能

**文件**: `src/server/ai/run-manager.ts`

每个 SSE 事件都触发 `flushSync`（同步 writeFileSync）。对于长对话（500+ 消息），session JSON 可能达到 1-2MB，每次 writeFileSync 耗时 ~5-10ms。一轮 AI 回复可能有 10-50 个事件（thinking deltas + text deltas + tool events），总计 50-500ms 同步 I/O。

对于单用户系统这是可接受的（LLM API 延迟远大于此），但如果未来支持多用户或更长对话，需要改回防抖 + 关键事件同步的混合策略。

**建议**: 当前可接受。如果未来需要优化，改为"text_delta 防抖 + 其他事件同步"。

---

### LOW — content_block_stop 处理器同时触发 markdown 和 JSON 高亮

**文件**: `src/client/modules/chat-dom.ts` (content_block_stop case)

当 `content_block_stop` 事件到达时，代码同时：
1. 对 textEl 跑 `_renderMarkdown`（如果是 text block 的 stop）
2. 对最后一个 tool 的 inputPre 跑 `_highlightInput`（如果是 tool block 的 stop）

问题：当 text block 的 stop 到达时，`_findLastToolId()` 可能返回一个已经完成的旧 tool（如果之前有 tool 调用），导致对已高亮的 input 重复高亮。无害但浪费。

**建议**: 在 content_block_stop 中区分是 text block 还是 tool block 的 stop（通过 event.index 判断），分别处理。

---

## 二、文档同步性问题

### HIGH — HANDBOOK.md 模块审计表行数过期

**文件**: `docs/HANDBOOK.md` §七

- `orb-chat.ts` 行数标注为 1629，实际为 843
- `orb.ts` 行数标注为 697，实际为 743
- 缺少 `src/shared/chat-protocol/` 5 个文件的条目
- 缺少 `src/server/ai/session-store.ts` 的条目

---

### HIGH — AI_CHAT_RUNTIME.md 描述与现状不符

**文件**: `docs/design/AI_CHAT_RUNTIME.md`

多处描述已被 v8 改变：
- §4.6 仍描述客户端 `saveMessages` 为落盘路径（现为服务端 SessionStore）
- 仍描述 `_saveChain` 串行锁（已删除）
- 仍描述 `renderChatContent` 全量重建（已删除）
- 跨文件契约列表缺少 session-store.ts（服务端）和 chat-dom.ts（客户端）

---

### MEDIUM — HANDBOOK.md 版本历史和待办未更新

**文件**: `docs/HANDBOOK.md` §二

- 缺少 v8.0 版本条目（应记录：v8 所有权分离架构、renderChatContent 删除、SessionStore 单写者、kfm-restart 冷恢复）
- 待办表中可能有已完成的项目未标记 ✅

---

### MEDIUM — V8_ARCHITECTURE.md Phase 状态未更新

**文件**: `docs/design/V8_ARCHITECTURE.md` §六

Phase 0-4 应标记 ✅，Phase 5 应标注"推迟——客户端增量渲染已解决性能问题，服务端语义渲染为可选优化"，Phase 6 应标记 ✅。

---

### LOW — CLAUDE.md 文档体系图缺少新模块

**文件**: `CLAUDE.md`

文档体系图中 `design/` 下缺少对 `V8_ARCHITECTURE.md` 的说明（已在之前的 commit 中添加了文件名，但描述可能需要更新）。

---

## 三、技术债标识

| 项目 | 位置 | 严重度 | 说明 |
|------|------|--------|------|
| saveSessionFile 死函数 | chat.ts:102-151 | HIGH | 不再被调用，应删除 |
| serverMessages 累加器 | chat.ts:222,386,446-484 | HIGH | 不再触发落盘，应删除 |
| _applyEvent 动画代码 | orb-chat.ts:400-457 | HIGH | v7 打字机/折叠动画，v8 不需要 |
| scheduleRender 机制 | orb-chat.ts:177-185 | MEDIUM | 只调 scrollToBottom，可简化 |
| _activeAnimTimers/_activeFoldAnims | orb-chat.ts:189-200 | MEDIUM | 随动画代码一起删 |
| client session-store saveMessages | session-store.ts:367+ | MEDIUM | 仍被 doSend pre-run 调用（创建会话+标题），但 post-run 双写已删 |
| chat-dom.ts 客户端渲染 vs 宪法第一条 | chat-dom.ts | LOW | 有意的推迟，需在文档中明确标注 |
| orb-chat.ts 仍 843 行 | orb-chat.ts | LOW | 可进一步拆分（SSE 消费 vs 状态管理 vs 等待提示） |

---

## 四、不合理之处

1. **orb.ts 的 auto-resume IIFE 过于复杂**（~60 行内联 async IIFE）：包含消息格式转换、API 调用、面板展开、等待提示。应抽为独立函数 `tryAutoResume(base, chatMessages)`。

2. **chat-dom.ts 和 orb-chat.ts 的 tool_result 处理重复**：`_applyEvent` 设置 `toolBlock.result`（状态），`patchEvent` 渲染 tool result（DOM）。两者通过 `_eventHook` 串联但逻辑分散在两个文件中。理想状态：`_applyEvent` 只做纯状态变更，所有 DOM 操作在 `patchEvent`。

3. **session-store.ts（客户端）职责模糊**：它现在只负责 list/activeId/getMessagesRange（只读缓存）+ pre-run saveMessages（创建会话）。名字暗示它是"存储"，但实际存储在服务端。应考虑重命名为 `session-client.ts` 或合并到 orb.ts。

---

## 五、总结

v8 架构改动成功落地，核心目标达成：
- ✅ 增量 DOM 替代全量 innerHTML（性能）
- ✅ 服务端单写者（数据一致性）
- ✅ 冷恢复 + kfm-restart（服务端可死）
- ✅ 代码量净减 ~800 行

主要遗留：
- chat.ts 中 ~100 行死代码（saveSessionFile + serverMessages）
- orb-chat.ts 中 ~60 行冗余动画代码
- 文档同步性需要一次集中更新（HANDBOOK + AI_CHAT_RUNTIME）

建议下一步优先级：
1. 删除 chat.ts 死代码（10 分钟，零风险）
2. 删除 _applyEvent 动画代码（30 分钟，需验证）
3. 文档集中更新（1 小时）
4. auto-resume 加 restartCount 防护（15 分钟）

---

## 六、文档逐文件详细问题（补充）

### V8_ARCHITECTURE.md

| 位置 | 问题 | 修复 |
|------|------|------|
| L3 `v8.0-draft` | 实现已完成，不再是 draft | 改为 `v8.0` / status: active |
| §六 Phase 2-6 标"待做" | 实际已完成 | Phase 2-4 标 ✅，Phase 5 标"推迟"，Phase 6 标 ✅ |
| L153 "?renderer=v8 双跑" | flag 已删除 | 删除此句 |

### AI_CHAT_RUNTIME.md

| 位置 | 问题 | 修复 |
|------|------|------|
| frontmatter `kfm_version: 7.3.0` | 过期 | 改为 8.0 |
| 文件列表"跨 10 文件" | 缺 chat-dom.ts、shared/chat-protocol/、server/session-store.ts | 补充，计数改为 13+ |
| §2 架构图 | 仍描述 orb-chat.ts 做渲染 | 重绘 |
| §8 文件一览 | 缺 3 个核心文件 | 补充 |
| 缺失 | 无冷恢复文档 | 新增 §10 |

### HANDBOOK.md

| 位置 | 问题 | 修复 |
|------|------|------|
| frontmatter `kfm_version: 7.3.3` | 过期 | 改为 8.0.0 |
| L82 AI/通信分组 | 缺 chat-dom.ts | 补充 |
| 服务端模块树 | 缺 session-store.ts 等 4 个 | 补充，计数 11→15 |
| §七 审计表 | 缺 shared/chat-protocol/ 5 个文件 | 补充 |
| §七 行数 | orb-chat.ts 标 1629（实际 843） | 更新 |

### README.md

| 位置 | 问题 | 修复 |
|------|------|------|
| "v7.3.3" | 过期 | 改为 v8.0 |
| "会话持久化 localStorage" | **事实错误** | 改为"服务端单写者 + run 重连 localStorage" |

### 跨文档问题

| 问题 | 影响范围 |
|------|----------|
| package.json 仍为 7.3.3 | 所有版本号引用 |
| 两个 session-store.ts 文档中不加路径会歧义 | AI_CHAT_RUNTIME、HANDBOOK |
| 代码注释仍引用 renderChatContent | orb-chat.ts、session-store.ts |
| 测试计数 360 vs 实际 359+1fail | CLAUDE.md、README、HANDBOOK |
