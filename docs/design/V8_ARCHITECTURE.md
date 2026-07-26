# KFM v8.0 — 双端分离架构设计

## 一、设计原则

```
服务端：数据处理、格式化、渲染准备、持久化
客户端：DOM 操作、Canvas 渲染、手势交互、动画
```

一句话：**服务端产出可直接注入 DOM 的 HTML，客户端只需要 `el.innerHTML = html` 或 `el.appendChild(node)`**。客户端不再做任何内容处理——不跑 markdown、不跑高亮、不关心消息结构。

---

## 二、现状问题

### 2.1 消息渲染：双端重复处理

```
服务端                    客户端
  │                         │
  │  yield SSE events  ────→ _applyEvent() 拼 content blocks
  │                         renderChatContent() 全量 innerHTML
  │                         │
  │                         ├── 遍历 500 条消息 → 拼 HTML 字符串
  │                         ├── 遍历 DOM → marked.parse + highlightAll
  │                         ├── 遍历 DOM → renderMath + renderMermaid
  │                         ├── 工具输入 JSON 高亮
  │                         ├── 工具结果格式化（write/edit/grep/glob）
  │                         ├── 裁剪/虚拟滚动
  │                         └── 滚动策略
```

**问题**：客户端把所有消息从 data → HTML 每帧重建一次。手机端 500 条消息 + 工具卡 = 明显卡顿。

### 2.2 会话保存：双写竞争

```
服务端 saveSessionFile()  ─┐
                            ├── 同一文件，无锁
客户端 saveMessages()     ─┘
```

### 2.3 Content block 协议：state 双重镜像

服务端有 `serverMessages`，客户端有 `chatMessages`。两者独立处理同一组 SSE 事件。任何一个有 bug 就不同步。

### 2.4 消息加载：一次拉三段

`loadSessionInto()` 先拉 tail 12 条 → 渲染 → 再拉 head 剩余 → unshift 合并。需要维护 `_switchToken` 防竞态、`_msgHeights` 补高度。

---

## 三、v8.0 目标架构

```
服务端（全权处理）              客户端（纯展示）
  │                               │
  │  SSE 事件（含预渲染 HTML）────→ 增量 DOM 更新
  │                               │
  │  fs.writeFileSync 落盘        │  （不再保存会话）
  │                               │
  │  API 端点返回完整消息          │  加载时直接注入 HTML
```

### 3.1 SSE 事件协议 v3

旧协议（v2）传输原始数据块，客户端自行拼装+渲染：

```json
{ "type": "content_block_delta", "deltaType": "text_delta", "deltaText": "Hello" }
```

新协议（v3）在每个 `content_block_stop` 或 `message_stop` 时，附带服务端预渲染的 HTML：

```json
{
  "type": "text_block_complete",
  "index": 0,
  "text": "Hello **World**",
  "html": "<p>Hello <strong>World</strong></p>"
}
```

流式增量（`text_delta`）保持不变，继续发送原始文本——因为只有完整 block 才知道边界（markdown 段落、代码块开始/结束）。

关键事件：

| 事件 | 传什么 | 客户端做什么 |
|------|--------|-------------|
| `message_start` | `{ messageId }` | 创建空消息容器 |
| `text_delta` | `{ deltaText }` | 追加到 #current .orb-text-content |
| `text_block_complete` | `{ text, html }` | `el.innerHTML = html` |
| `tool_block_start` | `{ id, name }` | 创建工具卡骨架 |
| `tool_block_input_json` | `{ input, html }` | 填入工具参数（预格式化） |
| `tool_block_result` | `{ result, html }` | 填入工具结果（预格式化） |
| `tool_block_complete` | `{ id }` | 结束工具卡动画 |
| `reasoning_complete` | `{ reasoning, html }` | 已思考框内容 |
| `message_stop` | `{}` | 滚动追底，停等待动画 |
| `done` | `{}` | 正常结束 |

### 3.2 服务端新增职责

**`src/server/ai/renderer.ts`** — 消息内容渲染器（~200 行）

```typescript
// 纯函数：content blocks → HTML
renderTextBlock(text: string): { html: string }
renderThinkingBlock(reasoning: string): { html: string }
renderToolInputBlock(name: string, input: Record<string, unknown>): { html: string }
renderToolResultBlock(name: string, result: ToolResult, ext?: string): { html: string }
```

- Markdown 渲染：`marked.parse(text)`
- 代码高亮：`highlight.js`（服务端已有，`server/` 之外的 import 需要确认）
- 工具输入 JSON 格式化 + 语法高亮
- 工具结果按类型格式化（write 显示文件卡片、grep 分行渲染、glob 文件列表）
- KaTeX 渲染：`katex.renderToString()`（可选，公式场景少）
- Mermaid：保持客户端渲染（需要 DOM 环境，1MB+ 库不适合服务端）

**`src/server/ai/chat.ts`** 改动：

- `streamChat` 中的 yield 点改为输出预渲染 HTML 事件
- `saveSessionFile` 不再每轮重复写——只在 `done` 时最后写一次
- `streamChat` 不再堆积 `serverMessages` 数组（累加器职责取消，改为最终落盘用）

### 3.3 客户端新架构

**新增 `src/client/modules/chat-dom.ts`**（~250 行）

```
chat-dom.ts — 聊天面板 DOM 增量操作
─────────────────────────────────────
createMessageContainer(msgId) → HTMLElement
appendThinkingBlock(msgEl, html)
replaceTextBlock(msgEl, html)
createToolCard(msgEl, id, name) → { cardEl, inputEl, resultEl }
updateToolInput(toolEl, html)
updateToolResult(toolEl, html)
foldToolCard(toolEl)
scrollToBottom(panelEl)
```

每个 SSE 事件到达时，直接调用上述函数操作 DOM，不再维护 `chatMessages` state。

**保留的客户端状态**（最小化）：

- `_messageEls: Map<string, HTMLElement>` — 消息容器 DOM 引用（用于更新/定位工具卡）
- `_toolEls: Map<string, { card, input, result }>` — 工具卡 DOM 引用
- `followBottom: boolean` — 滚动追底状态
- `_currentMsgId: string | null` — 当前正在流式的消息

**删除的内容**：

| 文件 | 删除/大幅简化 |
|------|-------------|
| `orb-chat.ts` | 删除 `renderChatContent`（~600 行）及其全部子函数 |
|                       | 删除 `_mdCache`, `_toolCache`, `_msgHeights`, `_cullWeight`, `_computeCullWin` |
|                       | 删除 `_activeAnimTimers`, `_activeFoldAnims`（打字机动画改为 CSS transition） |
|                       | 删除 markdown/KaTeX/Mermaid 后处理管线 |
|                       | 删除 `RunConsumeCtx`（不再需要 ctx 回调） |
| `session-store.ts` | 删除客户端 `saveMessages` 调用（取消路径除外） |
|                         | 删除 `_saveChain` |
| `orb.ts` | 删除 `loadSessionInto()` 的两段加载逻辑，改为单次服务端全量渲染 |

### 3.4 消息加载

`/api/sessions/messages` 改为 `/api/sessions/render`：

```
GET /api/sessions/render?id=todo工具测试
→ { html: "<div class='orb-msg'>...</div><div class='orb-msg'>...</div>..." }
```

客户端只需 `panelEl.innerHTML = data.html`，一次性渲染全部历史消息。

### 3.5 会话保存

```
之前：服务端 saveSessionFile × N + 客户端 saveMessages × M = 双写竞争
之后：服务端 saveSessionFile × 1（仅在 done 时执行）
```

取消路径：客户端仍做一次 `saveMessages` 作为保底（服务端取消时可能已死）。

---

## 四、删除清单

| 删除项 | 文件 | 原因 |
|--------|------|------|
| `renderChatContent` 及相关 ~800 行 | `orb-chat.ts` | 全量 innerHTML 重建被增量 DOM 替代 |
| `_mdCache`, `_toolCache` | `orb-chat.ts` | markdown/高亮移服务端 |
| `_msgHeights`, `_cullWeight`, culling 逻辑 | `orb-chat.ts` | 裁剪被简单隐藏/懒渲染替代 |
| `_activeAnimTimers`, `_activeFoldAnims` | `orb-chat.ts` | 动画改为 CSS transition |
| `_applyEvent`, `RunConsumeCtx` | `orb-chat.ts` | 不再累积 state |
| `settlePendingToolBlocks`, `_cancelPendingTools` | `orb-chat.ts` | 服务端在取消前已完成 |
| `startWaitingIndicator` 复杂逻辑 | `orb-chat.ts` | 简化为 CSS class toggle |
| `_saveChain` | `session-store.ts` | 不再需要串行锁 |
| `loadSessionInto` 两段加载 | `orb.ts` | 单次服务端渲染 |
| `_switchToken`, `_renderedSessionId` | `orb.ts` | 不再有竞态 |
| KaTeX/Mermaid CDN | `renderers/` | 保留 Mermaid（客户端），KaTeX 可移服务端 |

---

## 五、不变清单

| 保留项 | 原因 |
|--------|------|
| Canvas 文件树渲染 (`tree-render.ts` 等) | 纯 UI，需要 Canvas 2D |
| 手势系统 (`gesture-registry.ts`) | 纯 UI |
| 卡片插件系统 (`card-registry.ts`, `floating-card.ts`) | 纯 UI |
| 动画 (`animation-registry.ts`, `char-rain.ts`) | 纯浏览器 API |
| WebSocket 传输 (`ws-channel.ts`) | 双向通道不变 |
| 服务端 `run-manager.ts` | 挂机逻辑不变 |

---

## 六、迁移计划

### Phase 1：服务端渲染器（~1 天）

1. 新建 `src/server/ai/renderer.ts`
2. 实现 `renderTextBlock`, `renderThinkingBlock`, `renderToolInputBlock`, `renderToolResultBlock`
3. 修改 `streamChat`：yield 新协议事件（附带 html 字段），同时保持旧事件兼容
4. 新增 `/api/sessions/render` 端点

### Phase 2：客户端增量 DOM（~1 天）

1. 新建 `src/client/modules/chat-dom.ts`
2. 实现 DOM 增量操作函数
3. 重写 SSE 事件处理：每个事件直接调 chat-dom 函数
4. 重写消息加载：单次 `innerHTML = serverHTML`
5. 删除 `renderChatContent` 及其全部子函数
6. 删除缓存、裁剪、动画计时器

### Phase 3：清理（~0.5 天）

1. 删除 `_saveChain`、客户端双重保存
2. 删除 `RunConsumeCtx`、`_applyEvent`
3. 更新 session-store.ts

### Phase 4：测试 + 回归（~0.5 天）

1. 消息渲染：发送各类消息，对比新旧渲染效果
2. 工具卡：tool_use → tool_result 完整周期
3. 思考框：reasoning 展开/折叠
4. 取消/中断：取消后恢复
5. 刷新恢复：重启后消息完整
6. 运行全量测试

---

## 七、其他可简化项

### 7.1 文件树数据加载

`tree-loader.ts` 通过 `files/list` + `files/list-recursive` 递归获取目录树，每次展开目录就调用一次 API。可改为：打开目录时一次性返回该目录下所有子目录内容（已有 `files/list-recursive`），减少请求数。

### 7.2 Session 接口统一

`session-store.ts` 和 `session.card.ts` 各自独立请求 `/sessions/list` 加载数据。统一为一个入口，卡片从 store 读 `list` 而不是独立加载。

### 7.3 删除 orb-panel.ts

当前 `orb-panel.ts`（209 行）只是几个下拉框的初始化。可合并回 `orb.ts` 或彻底简化。

---

## 八、预期效果

| 指标 | 现在 (v7.3) | v8.0 |
|------|------------|------|
| 流式渲染每帧耗时 | O(n) 遍历全量 messages | O(1) 追加/更新单个 DOM 节点 |
| 内存占用（500 条） | chatMessages + _mdCache + _toolCache + _msgHeights | 仅 DOM 树（消息容器引用） |
| Bundle 大小 | ~1.9MB (含 marked + highlight.js + KaTeX) | ~1.4MB (去掉 marked 等) |
| 消息加载 | 2 次 HTTP + 客户端整合 | 1 次 HTTP + innerHTML |
| 会话保存 | 服务端+客户端双写 | 服务端单写 |
| SSE 带宽 | ~200KB/轮（原始文本） | ~300KB/轮（含 HTML，+50%） |
| 手机端卡顿 | 明显 | 大幅改善 |
