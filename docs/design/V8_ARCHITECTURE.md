# KFM v8.0 — 所有权分离架构

> 状态：active | 版本：v8.0 | 最后更新：2026-07-26
>
> 本文只讲架构（宪法 + 形状 + 契约）。迁移计划见 §六，实现细节在各模块头部注释。

---

## 一、宪法（不可妥协）

### 第一条：内容/呈现所有权二分

> 服务端拥有内容的语义，客户端拥有呈现的视觉。

| 所有权 | 含义 | 归属 |
|--------|------|------|
| 语义渲染 | markdown → DOM 结构、代码 → 高亮 span、grep → 分行结构、工具结果格式化 | 服务端 |
| 视觉合成 | 主题色、随机渐变、阴影、字体、动画时序、折叠编排、滚动追底 | 客户端 |

交接契约：服务端产出**带语义 class + data-attr 的 HTML**，不带颜色、不带 inline style、不带动画。客户端通过 CSS class 和 JS 投影赋予视觉。

### 第二条：随机组合是客户端的所有物

> 视觉的随机性（配色、节奏、姿态）不可上移到服务端。

工具卡随机双色、摸鱼提示随机文案、入场动画节奏——这些是设计核心，不是噪声。它们在客户端投影层（chat-dom.ts）生成，绑定 blockId 做稳定哈希（同一 block 每次渲染颜色相同，不同 block 之间"随机"）。

### 第三条：服务端可死

> 任何运行态要么已落盘，要么可从磁盘重建。客户端将服务端断连视为"暂时不可达"，而非"世界终结"。

run-manager 的事件缓冲是性能缓存，不是真相源。真相在磁盘（session JSON）。进程重启 = 较长断连，不是数据丢失。

---

## 二、现状病灶（v7.3）

| 病灶 | 根因 | 症状 |
|------|------|------|
| 全量 innerHTML 重建 | 内容/呈现焊死在同一字符串里 | 每帧 O(n) 重跑 marked+hljs，手机端卡顿 |
| 八个状态补丁 | 全量重建的并发症 | `_mdCache`/`_toolCache`/`_msgHeights`/`_cullWin`/`_activeFoldAnims`/`_thinkDoneAt`/`_collapsingUntil`/`_lastCullWin` |
| 三份消息镜像 | 所有权边界缺失 | `serverMessages` / `chatMessages` / `apiMessages` 各自独立处理同一事件流 |
| 双写竞争 | 客户端也是写者 | 服务端 saveSessionFile × N + 客户端 saveMessages × M |
| 重启即死亡 | 运行态只在内存 | kfm-restart 杀死自己 → AI 长程工作中断 → 无法恢复 |
| 两段加载 + 竞态 | 客户端持有 state | `_switchToken` / `_renderedSessionId` / tail→head 补拉 |

v8 不是优化这些症状，是让它们**不可能再出现**。

---

## 三、架构形状

```
┌─────────────────────────────────────────────────────────────┐
│  src/shared/chat-protocol/          ← 双端共享（已完成）      │
│    messages.ts    ContentBlock / ChatMessage 唯一类型         │
│    events.ts      StreamEvent 协议                           │
│    reducer.ts     applyEvent / reduceEvents（纯状态转换）     │
│    block-idx.ts   BAR-106 索引映射                            │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
┌──────────────────────┐         ┌──────────────────────┐
│  服务端：内容所有者    │         │  客户端：呈现所有者    │
│                      │         │                      │
│  ai/chat.ts          │         │  chat-dom.ts（新）    │
│   └ LLM → events     │         │   └ event → DOM patch│
│                      │         │   └ 随机配色/动画     │
│  ai/renderer.ts（新） │         │                      │
│   └ block → 语义 HTML │         │  chat-session.ts（新）│
│     (marked/hljs/    │         │   └ 只读会话缓存      │
│      katex/工具卡)    │         │   └ 冷/热恢复路由     │
│                      │         │                      │
│  ai/session-store.ts │         │  renderers/          │
│   （新）唯一写者       │         │   └ mermaid only     │
│   reduce + 防抖落盘   │         │                      │
│                      │         │  CSS class 系统       │
│  ai/run-manager.ts   │         │   └ 主题/色/动画      │
│   └ 事件缓冲（缓存）  │         │                      │
│                      │         │  ws-channel.ts       │
│  routes.ts           │         │   └ 断连=等待         │
│   └ /sessions/render │         │   └ 重连=恢复         │
└──────────────────────┘         └──────────────────────┘
```

四个核心模块，两条所有权链，零回边。

---

## 四、视觉契约（v8 必须等价的视觉规范）

面板的视觉效果是硬约束。以下行为在 v8 后必须可证明地保持：

| 视觉行为 | 协议事件 | 客户端责任 |
|---------|---------|-----------|
| 思考框弹出 + 流式文本 | `content_block_delta(thinking)` | append 裸文本到 `<pre>` |
| 思考完成 → 400ms 折叠 | `content_block_stop` | 计时器 + CSS 动画 |
| 正文流式打字机 | `content_block_delta(text)` | append 裸文本 |
| 正文完成 → 富文本 | `content_block_stop` + 服务端 html | 整段替换 innerHTML |
| 工具卡弹出（参数未到） | `content_block_start(tool_use)` | 创建骨架 + 随机配色 + 摸鱼提示 |
| 参数流式 | `content_block_delta(input_json)` | append 裸 JSON |
| 参数完成 → 高亮 | `content_block_stop` + 服务端 html | 替换 |
| 摸鱼提示滚动 | 无（客户端本地计时器） | 随机文案循环 |
| 工具结果 → 状态色 | `tool_result` | 更新标题栏 + 服务端 html 填入输出区 |
| 完成 → 自动折叠 | `tool_result`（隐含） | 打字机动画 → 折叠 |
| 用户展开/折叠 | 无（客户端本地） | Map<blockId, bool>，会话切换清空 |
| 规则警告框 | `rule_warning` | 红色框 + 折叠 |
| 等待提示 | `message_stop` / 发送时 | 独立 DOM 节点，随机文案 |
| 入场动画 | 新消息 mount | CSS class `orb-msg-new` |

流式期间客户端显示裸文本（`<pre class="block--streaming">`），完成时刻服务端语义 HTML 一次性注入。交接瞬间用 80ms fade 作为设计节拍。

视觉基准测试：`tests/visual-baseline.test.ts`（17 个 fixture，已固化 v7 结构）。

---

## 五、kfm-restart 路径（宪法第三条的验证场景）

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

自动 resume 判据：session 末尾 `role:'ai'` 含 `type:'tool'` block 且有 result，但无后续纯文本 AI 消息。超过 3 次连续 restart 停在确认态（防无限循环）。

---

## 六、迁移计划

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 视觉基准 fixture（17 个 DOM 快照 + 4 个结构不变量） | ✅ b50d721 |
| 1 | 抽取 `src/shared/chat-protocol/`（类型 + reducer + 索引映射） | ✅ 20be4c3 |
| 2 | 客户端投影：chat-dom.ts 增量 DOM，删 renderChatContent + 八个补丁 | ✅ |
| 3 | 服务端 SessionStore：唯一写者 + 落盘原子化 + 删客户端保存链路 | ✅ |
| 4 | 冷恢复 + kfm-restart 重写 + ws-channel 断连语义 | ✅ |
| 5 | 服务端 renderer.ts（语义 HTML）+ /sessions/render 端点 | 推迟——客户端增量渲染已解决性能问题，服务端语义渲染为可选优化 |
| 6 | 回归：视觉 diff + 协议幂等 + restart 端到端 | ✅ |

---

## 七、不变清单

| 保留项 | 原因 |
|--------|------|
| Canvas 文件树（tree-render 等） | 纯呈现，需要 Canvas 2D |
| 手势系统（gesture-registry） | 纯呈现 |
| 卡片插件系统（card-registry, floating-card） | 纯呈现 |
| 动画（animation-registry, char-rain, GSAP） | 纯呈现 |
| WebSocket 传输（ws-channel） | 通道不变，断连语义改变 |
| Mermaid 渲染 | 输出 SVG + 交互 → 属于呈现层 |

---

## 八、预期效果

| 指标 | v7.3 | v8.0 |
|------|------|------|
| 流式渲染每帧 | O(n) 全量重建 | O(1) 增量 patch |
| 状态补丁数 | 8 个 | 0（架构蒸发） |
| 消息表示份数 | 3（server/client/api） | 1（shared reducer） |
| 会话写者 | 2（双写竞争） | 1（服务端） |
| 重启后 AI 工作 | 丢失 | 自动恢复 |
| Bundle（marked+hljs+katex） | ~500KB | 移至服务端 |
| 主题/配色改动触碰文件 | orb-chat.ts 1621 行 | SCSS 一处 |
| 加新工具触碰文件 | orb-chat.ts（渲染）+ chat.ts（事件） | renderer.ts 一个 case |
