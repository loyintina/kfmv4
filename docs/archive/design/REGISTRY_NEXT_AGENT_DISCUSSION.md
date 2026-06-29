---
status: superseded
created_at: 2026-06-02
archived_at: 2026-06-29
superseded_by: docs/design/UI_ELEMENT_REGISTRY_SPEC.md
---

# UI Element Registry — 下一轮讨论笔记

> 本文档记录本轮（2026-06-02）未能完全解决、需要下一个 agent 继续推进的问题。
> 关联文档：`docs/UI_ELEMENT_REGISTRY_SPEC.md`（活跃设计文档）

---

## ✅ 问题 5：服务端↔浏览器端通信通道（§5.5）— 已解决

**状态**：`[✅ 已解决 — 2026-06-02]`

### 实现方案

采用 **WebSocket** 双向通信通道：
- **服务端**：`src/server/ws-server.ts` — WsServer 类，封装 WebSocketServer，管理连接池、心跳、消息路由
- **服务端入口**：`src/server/index.ts` — 改用 `http.createServer(app)` + `WsServer` 附加到同一端口
- **服务端 API**：`src/server/ai-tools.ts` — 改造为接收 `WsServer` 实例，提供实时 snapshot 查询
- **客户端**：`src/client/modules/ws-channel.ts` — WsChannel 类，浏览器端自动连接、推送、重连

### 关键特性
- 浏览器端通过 `Registry.onChange()` 回调自动推送 snapshot 到服务端（100ms 防抖）
- 服务端 `GET /api/ui/snapshot` 现在返回实时数据（优先 WebSocket → 内存缓存 → 不可用提示）
- 服务端 `POST /api/ui/command` 可向浏览器端发送操作指令（AI → UI）
- 客户端支持断线重连（指数退避，1s → 30s）
- `POST /api/ui/snapshot/push` 保留作为 HTTP 后备通道
- 新增 `GET /api/ws/status` 调试端点
- 依赖：新增 `ws` + `@types/ws`

### 实现细节
- 协议：统一 `WsMessage { type, payload, timestamp }` 格式
- 浏览器→服务端：`hello`, `snapshot`, `capabilities`
- 服务端→浏览器：`ack`, `ping`, `command`
- 心跳 30s 间隔

### 仍待完善
- [ ] 多标签页支持（v2）
- [ ] 命令来源验证 token（v2）
- [ ] 各模块注册更精确的 command handler

---

## 🟡 问题 5：服务端↔浏览器端通信通道（§5.5）[历史]

**状态**：`[未解决，需架构级设计]`

### 问题描述

Registry 的 `snapshot()` 运行在**浏览器端**（JS 内存中），但 AI agent 通常运行在**服务端**（或通过 API 调用）。目前没有机制让服务端获取浏览器端的实时 snapshot，也没有机制让服务端通知浏览器端执行操作。

### 当前方案（本轮的临时方案）

`src/server/ai-tools.ts` 创建了一个 `POST /api/ui/snapshot/push` 端点——浏览器端可以主动把 snapshot 推送到服务端。但这需要浏览器端在适当时机（状态变化后）主动 fetch 推送，不是真正的"服务端拉取"。

### 已知的可行方向

| 方案 | 复杂度 | 优点 | 缺点 |
|------|--------|------|------|
| **WebSocket** | 高 | 双向实时，服务端可主动推送指令 | 需要管理连接生命周期，现有代码无 WS 依赖 |
| **轮询 GET /api/ui/snapshot** | 低 | 实现简单，浏览器端定时推送 | 延迟高，浪费带宽 |
| **SSE (Server-Sent Events)** | 中 | 服务端可推送事件到浏览器 | 单向（仅服务端→浏览器），浏览器→服务端仍需 HTTP |
| **扩展现有 Express API** | 低 | 浏览器在关键操作后 POST snapshot | 无法覆盖所有状态变化路径 |

### 需要讨论的关键问题

1. **这个通道是做"信息同步"还是"操作转发"？**
   - 仅同步（服务端获取 snapshot）→ 只需要浏览器→服务端单向
   - 还是也需要操作（服务端→浏览器通知执行 UI 操作）→ 需要双向
   - 如果双向，Registry 的 `action()` 要不要加回来？

2. **谁负责启动连接？**
   - 浏览器主动连接服务端（WebSocket 模式）
   - 还是服务端通过注入的脚本连接浏览器（反向连接）

3. **KFM 是否需要引入 WebSocket 依赖？**
   - 目前整个项目只有 Express HTTP，没有 WS
   - 加 WS 是架构级变更

---

## ✅ 问题 3：内容层的粒度控制（§5.3）— 已解决

**状态**：`[✅ 已解决 — 2026-06-02]`

### 实现方案

新增 `registerContentGenerator(id, generator)` 方法：
- 与 `registerContent` 并列存在，但语义不同：
  - `registerContent`：一次性注册静态 summary
  - `registerContentGenerator`：注册回调函数，snapshot 时实时调用
- `snapshot()` 中生成器优先于静态内容
- 同一 id 可以同时注册静态内容和生成器，生成器覆盖

### 实现位置
- `src/client/modules/ui-registry.ts` — `registerContentGenerator()` 方法
- 配合 `Registry.onChange()` 回调，内容变化自动推送

### 仍待完善
<!-- ✅ 已完成：文件树、卡片堆、光球聊天均已改用 registerContentGenerator -->

---

## 🟡 问题 3：内容层的粒度控制（§5.3）[历史]

**状态**：`[未解决]`

### 问题描述

当前内容层已注册 3 个 ContentBlock，但它们的 `summary` 都是注册时一次性生成的静态字符串。如果要动态反映当前状态（如文件树当前展开的目录、卡片堆当前聚焦的卡片名），目前的机制是：

- 要么在 snapshot 时实时生成（需要 getter 或回调）
- 要么在状态变化时主动更新（需要模块调 `registerContent` 覆盖）

### 建议

内容层是否也应该引入类似 `registerStateGetter` 的机制？比如 `registerContentGenerator(id, generator: () => ContentBlock)`，让内容块在 snapshot 时实时生成。

---

## ✅ 能力层的完整实现（§5.2）— 已解决

**状态**：`[✅ 已解决 — 2026-06-02]`

### 实现方案

新增 `src/server/capability-executor.ts`：
- **CapabilityExecutor** 类，维护能力 id → 执行函数的映射表
- 内置 3 个文件操作能力（file-search, file-read, file-write），直接调用 fs 模块
- 提供 `execute(capabilityId, params)` 统一执行接口
- 提供 `listCapabilities()` 返回可执行的能力定义列表
- 全局单例 `capabilityExecutor`

### 新增 API 端点
- `POST /api/capabilities/execute` — 执行指定能力
- `GET /api/capabilities/executor` — 返回服务端可执行的能力列表

### 与浏览器端 Registry 的对应关系
- 浏览器端注册的 `capability.entry` 字段指向 `capability-executor:<id>`
- 服务端 CapabilityExecutor 实际执行逻辑
- 未来可扩展为：浏览器端注册 → 服务端执行 → 结果返回浏览器端

### 仍待完善
- [ ] 自定义能力注册（`capabilityExecutor.register()` 已提供接口）
- [ ] 能力执行结果的缓存
- [ ] 与 WebSocket 通道联动（执行结果推送到浏览器端）

---

## 🟡 能力层的完整实现（§5.2）[历史]

**状态**：`[部分解决]`

### 现状

3 个能力（file-search, file-read, file-write）已在浏览器端注册，服务端 `ai-tools.ts` 也有对应的端点。但：

1. 能力目前只有"描述"，没有真正的执行入口——`entry` 字段写的是 `server.files.list` 等字符串，但没有实际的 function calling 绑定
2. 如果 AI agent 要通过 function calling 调用这些能力，需要一个适配层把 REST API 包装成 LLM 可调用的 tool

### 建议

下一个 agent 可以考虑：
- 在 `ai-tools.ts` 中增加实际的 API 调用逻辑（调用 server/index.ts 的现有端点）
- 或者为 OMP / Claude Code 等 Agent 引擎写适配器

---

## 🟢 其他小问题

### `bounds` 是否加回来（§5.4）

当前状态：砍掉（v1 不考虑）。如果将来需要"AI 拖拽卡片到指定位置"，bounds 是必需的。建议在卡片系统完善后重新讨论。

### AI-tools 层是否需要 `action()`（§5.5 关联）

v0.2 砍掉了 action，但如果通信通道最终走 WebSocket + 指令转发，`action()` 可能会以另一种形式出现（服务端发送指令 → 浏览器端执行）。

---

## 当前完成状态（2026-06-02 更新）

| 优先级 | 问题 | 状态 | 实现位置 |
|--------|------|------|---------|
| 🔴 P0 | §5.5 通信通道 | ✅ 已解决 | `ws-server.ts`, `ws-channel.ts`, `ai-tools.ts` |
| 🟡 P1 | §5.3 内容层动态化 | ✅ 已解决 | `ui-registry.ts: registerContentGenerator()` |
| 🟡 P2 | §5.2 能力层绑定 | ✅ 已解决 | `capability-executor.ts`, `POST /api/capabilities/execute` |
| 🟢 P3 | §5.1 状态动态化（已在 v1.0 解决） | ✅ 已解决 | `ui-registry.ts: registerStateGetter()` |
| ⬜ | §5.4 bounds 加回来 | 延期到 v2 | — |

### 下一个 agent 可以做的
1. <!-- ✅ 已完成（三处均已改用 registerContentGenerator） -->
2. **更精确的 command handler**：各模块注册具体的操作处理器（而不是默认的 DOM 查询 fallback）
3. **多标签页支持**：当前 WebSocket 不区分多个标签页，v2 可加 connection id
4. **bounds**：当需要"AI 拖拽卡片到指定位置"时讨论