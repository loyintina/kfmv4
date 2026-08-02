> 这是什么：AI 对话子系统——光球面板、流式协议、会话存储、工具。
> 别的去哪找：运行时隐性时序 → detail-runtime.md；压缩规则 → detail-tool-compaction.md；browser 工具 → detail-browser.md；orb 骨架 → ../client-shell/。

# ai-chat 域契约

## 所有权二分（宪法第一条的落地）

- 服务端拥有内容语义：LLM → 事件流 → SessionStore 落盘（**唯一写者**）。
- 客户端拥有呈现视觉：`chat-dom.ts` 事件 → 增量 DOM patch（v8，只增不改）。
- 双端共享：`src/shared/chat-protocol/`（messages/events/reducer/block-idx）。

## 模块职责

- 客户端：`orb-chat-host.ts`（宿主：会话状态/run 生命周期/消息窗口编排，ChatHostDeps 注入）
  `orb-chat.ts`（re-export 门面 + 事件钩子）`orb-chat-run.ts`（持久化运行态/流消费/重连/doSend）
  `orb-chat-hints.ts`（等待提示/Todo 面板）`chat-dom.ts`（增量投影）
  `session-client.ts`（只读缓存 + pre-run 创建）`ws-channel.ts`（WS + 重连看门狗 + onReconnect）
- 服务端 `ai/`：`chat.ts`（SSE 流式核心）`run-manager.ts`（后台挂机：runId/事件缓冲/5min 淘汰）
  `routes.ts`（start/stream/cancel/active/status）`session-store.ts`（唯一写者；冷恢复判据在客户端 orb-chat-host，detail-runtime §10）
  `page-state.ts` `prompt-assembler.ts`（眼睛系统）`rule-engine.ts` `tools/`

## 硬规则

1. 会话文件是全量真相源；任何运行态要么已落盘要么可重建（宪法三/四）。
2. 工具 I/O 发给 LLM 前必须过压缩投影（check-tool-compaction 双向核对，
   新工具不登记压缩行为 = 构建中断）。
3. 增量 DOM 只增不改：append 进已挂载消息不会投影——新消息必须走新 mount。
4. 动态感官注入（dynamicPromptFiles）必须经 `assembleDynamicPrompt` 包裹呈现：
   分隔线 + 「勿主动提及注入本身」使用规则（BAR-EYE-WRAP-01）——动态内容每轮刷新
   占据注意力焦点，无包裹时 AI 会主动叙述注入本身（出戏）。ts 前缀 `[ts MM-DD HH:MM:SS]`
   是元数据非正文，静态 system 段有防模仿声明（BAR-TS-MIMIC-01）。

## 视觉契约（自 V8_ARCHITECTURE §四迁入，2026-07-28）

面板的视觉效果是硬约束。以下行为在 v8 后必须可证明地保持：

| 视觉行为 | 协议事件 | 客户端责任 |
|---------|---------|-----------|
| 思考框弹出 + 流式文本 | `content_block_delta(thinking)` | 懒创建（PANEL-17）+ append 裸文本到 `<pre>` |
| 思考完成 → 400ms 折叠 | `content_block_stop` | 三路径 `_autoCollapseThinking`（首个 text_delta + message_stop 兜底 + tool_result）+ CSS 动画；尊重手动展开（PANEL-11） |
| 正文流式 | `content_block_delta(text)` | `_scheduleStreamingMd` 120ms 节流轻管线（marked+高亮，跳过 KaTeX/mermaid；不进 `_mdCache`）（PANEL-12） |
| 正文完成 → 富文本 | `content_block_stop` + 服务端 html | 整段替换 innerHTML |
| 工具卡弹出（参数未到） | `content_block_start(tool_use)` | 创建骨架 + 随机配色 + 摸鱼提示 |
| 参数流式 | `content_block_delta(input_json)` | append 裸 JSON |
| 参数完成 → 高亮 | `content_block_stop` + 服务端 html | 替换 |
| 摸鱼提示 | 无（客户端本地计时器） | 随机文案循环；恒在消息尾部 insertBefore（PANEL-10）；`_startToolHint`/`_stopToolHint` 生命周期（PANEL-14）；keyframes 静态定义禁 JS 注入（PANEL-15） |
| 工具结果 → 状态色 | `tool_result` | 更新标题栏 + 服务端 html 填入输出区 |
| 完成 → 自动折叠 | `tool_result`（隐含） | 打字机动画 → 折叠 |
| 用户展开/折叠 | 无（客户端本地） | Map<blockId, bool>，会话切换清空 |
| 规则警告框 | `rule_warning` | 红色框 + 折叠 |
| 等待提示 | `message_stop` / 发送时 | 独立 DOM 节点，随机文案 |
| 入场动画 | 新消息 mount | CSS class `orb-msg-new` |

流式期间走 120ms 节流轻管线部分渲染（`<pre class="block--streaming">`），完成时刻服务端语义 HTML 一次性注入。交接瞬间用 80ms fade 作为设计节拍。历史思考框的折叠容器必须用 `orb-fold-content`（死类 `orb-fold-open` 已清除，PANEL-13）。

视觉基准测试：`tests/visual-baseline.test.ts`（17 个 fixture，固化 v7 结构）。

## 不变清单（自 V8_ARCHITECTURE §七迁入——v8 故意不动的模块）

| 保留项 | 原因 |
|--------|------|
| Canvas 文件树（tree-render 等） | 纯呈现，需要 Canvas 2D |
| 手势系统（gesture-registry） | 纯呈现 |
| 卡片插件系统（card-registry, floating-card） | 纯呈现 |
| 动画（animation-registry, char-rain, GSAP） | 纯呈现 |
| WebSocket 传输（ws-channel） | 通道不变，断连语义改变 |
| Mermaid 渲染 | 输出 SVG + 交互 → 属于呈现层 |

## #陷阱

1. **run 收尾时序**：必须在 `finally` 显式触发订阅者 `onDone`（run.done 时序陷阱），
   否则 `__end__` 不发 → 发送按钮卡死 + 残留等待框。
2. **startRun 语义为「取代」**：重连走 `attachRun`；`_consumeWithReconnect` 退避重试 +
   `/status` 探活。
3. **新增服务端依赖必须同步 build.mjs external**（规则的家 → ../infra/contract.md 硬规则 3）。
   案例：v8.1 compression 事故，全站 502 + systemd 重启风暴（BAR-BUILD-03）。
4. **推理模型等待提示**：`onWait(false)` 挂在首个实际内容（含 thinking_delta），
   不是 message_start——否则白屏空档。最后一轮 message_stop 打开的提示由 doSend
   返回后主动清。
5. **空 sessionId → 服务端 400**：删除最后一个会话后 `activeId=''`；doSend 必须在
   saveMessages（自动建会话）后回填 `_sendSessionId`；`kfm-session-change` 监听器
   必须处理空串（清空面板），不能 `if(!sessionId) return`。
6. **run 持久化用 localStorage**：`{sessionId,runId}` 存 localStorage 才能跨浏览器
   重启重连（配 5min 服务端缓冲）；sessionStorage 会丢（展开版见 detail-runtime.md §4.5）。
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
9. **上游边界规范化（严格端点契约）**：发给 provider 的载荷必须满足 OpenAI 严格形态——
   `tool.content` 必须是 string（非字符串 `JSON.stringify`）、assistant 不得为空
   （无 tool_calls 的空 assistant 过滤）。宽松端点容忍不代表合法；上游错误体必须透传
   （只报状态码 = 扔掉诊断）。回归钉：BAR-PROVIDER-01/02。
10. **回复错放 reasoning 必须归位**：某些模型/端点把最终回复全写进 reasoning_content、
    text 留空——显示成「已思考+无回复」，进载荷成空 assistant。正常结束（message_stop）
    text 空且 reasoning 非空 → 归位为正文；历史加载读时归一化（不改文件）；
    取消残留不归位（真实历史）。回归钉：BAR-ORB-EMPTY-01。
11. **载荷构造唯一入口**：任何发送路径（doSend / tryAutoResume / 未来第三条）必须经
    `shared/chat-protocol/to-openai-messages.ts` 构造 OpenAI 载荷——压缩投影、标注、
    空壳过滤全在这一处；约束对象是端点载荷而非入口路径。禁止第三份手写转换
    （tryAutoResume 曾内联复制简化版 → 无压缩/不过滤空壳/content:null，严格端点 400）。
    回归钉：BAR-ORB-RESUME-01。
12. **sessionId 白名单（BAR-SEC-14）**：sessionId 拼进落盘路径，格式白名单
    `^[\p{L}\p{N}_-]{1,128}$/u`（Unicode 字母数字**含中文**——生产会话 id 即中文
    标题；初版 ASCII 白名单 2026-08-01 误杀全部中文会话 → 放宽）+ UTF-8 字节 ≤ 200，
    全入口校验——新入口必须复用 `isValidSessionId`（path-utils），落盘统一走
    `_sessionFilePath` 单点 + containment 复查。
13. **apiKey 代字在使用点展开（fuse-on-save）**：`chat.ts` 选定 provider 后立即
    `resolveKey`（`../env-store.ts`）；`missingVar` → 人话错误，绝不裸发 `${VAR}` 或报 401。
    加载点展开的回写陷阱见 ../server/contract.md 陷阱 7。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `AI_ARCHITECTURE.md`：omp 借鉴版初始接口草样 + Agent 卡未落地设计。
- `CONTEXT_ASSEMBLY_SPEC.md`：§3 优先级裁剪策略；**§7 两个开放问题未关闭**
  （多角色卡同载、工具卡工具定义来源）——detail-runtime 未覆盖。
- `AI_OPERATION_PROTOCOL.md`：九种 op 指令集 + 会话执行规则（被 capabilities 架构取代）。

## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`src/client/modules/chat-dom.ts` `src/client/data/waiting-hints.ts` `src/server/ai/tools/omp/browser/tab-worker.ts` `src/server/ai/tools/omp/browser/launch.ts` `src/client/modules/session-client.ts` `src/client/modules/orb-chat-run.ts` `src/server/ai/chat.ts` `src/client/modules/ws-channel.ts` `src/shared/tool-compaction/index.ts` `src/server/ai/tools/omp/debug.ts` `src/server/ai/tools/omp/debug/debug-operations.ts` `src/client/modules/orb-chat-host.ts` `src/server/ai/tools/omp/browser/tab-supervisor.ts` `src/server/ai/tools/omp/debug/kfmv4-views.ts` `src/shared/chat-protocol/to-openai-messages.ts` `src/server/ai/tools/omp/debug/cdp-connection.ts` `src/server/ai/session-store.ts` `src/server/ai/run-manager.ts` `src/client/modules/orb-chat-hints.ts` `src/server/ai/permissions.ts` `src/server/ai/page-state.ts` `src/shared/chat-protocol/reducer.ts` `src/server/ai/prompt-assembler.ts` `src/server/ai/tools/kfmv4/logs.ts` `src/server/ai/tools/omp/read.ts` `src/server/ai/routes.ts` `src/server/ai/tools/omp/browser/aria/aria-snapshot.ts` `src/server/ai/tools/omp/browser/tab-protocol.ts` `src/server/ai/tools/index.ts` `src/server/ai/tools/omp/browser/readable.ts` `src/server/ai/rule-engine.ts` `src/server/ai/tools/omp/web-search.ts` `src/server/ai/tools/types.ts` `src/server/ai/tools/omp/browser.ts` `src/server/ai/tools/omp/browser/run-cancellation.ts` `src/server/ai/tools/omp/bash.ts` `src/server/ai/tools/omp/native.ts` `src/server/ai/tools/kfmv4/restart.ts` `src/server/ai/tools/kfmv4/browser-eval.ts` `src/server/ai/tools/omp/eval.ts` `src/server/ai/tools/omp/edit.ts` `src/shared/chat-protocol/events.ts` `src/shared/chat-protocol/messages.ts` `src/server/ai/tools/omp/todo.ts` `src/server/ai/tools/omp/glob.ts` `src/server/ai/tools/omp/write.ts` `src/server/ai/tools/omp/grep.ts` `src/server/ai/tools/omp/browser/tab-worker-entry.ts` `src/shared/message-normalize.ts` `src/client/modules/orb-chat.ts` `src/shared/chat-protocol/block-idx.ts` `src/server/ai/tools/omp/checkpoint.ts` `src/server/ai/tools/omp/browser/tab-worker-entry.js` `src/server/ai/tools/omp/rewind.ts` `src/shared/chat-protocol/index.ts`
<!-- /gen:contract-list -->
