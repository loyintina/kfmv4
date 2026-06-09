---
status: proposal
created_at: 2026-06-02
context: UI Element Registry §5.5 通信通道方案提案
---

# WebSocket 通信通道方案

> 本文档讨论 §5.5 的通信通道问题，提出具体实施方案。
> 关联：`docs/UI_ELEMENT_REGISTRY_SPEC.md` §5.5，`docs/notes/REGISTRY_NEXT_AGENT_DISCUSSION.md`

---

## 问题回顾

Registry 的 `snapshot()` 运行在**浏览器端**（JS 内存中），AI agent 在**服务端**无法直接获取。目前已有的 `POST /api/ui/snapshot/push` 需要浏览器主动推送，无法覆盖所有状态变化路径，且是单向的。

## 需求分析

### 必须满足
1. **服务端能获取浏览器端的实时 snapshot**（浏览器→服务端）
2. **服务端能通知浏览器端执行操作**（服务端→浏览器）— 这是人与 AI 对称操作的基石

### 可选但推荐
3. **浏览器端能在状态变化时自动推送**（事件驱动的推送，而非轮询）
4. **连接生命周期可管理**（断线重连、心跳）

## 方案对比

### 方案 A：WebSocket（推荐）

| 维度 | 评估 |
|------|------|
| 依赖 | 新增 `ws` 包（~70KB，纯 JS，零原生依赖）|
| 双向性 | ✅ 原生支持 |
| 实时性 | ✅ 事件驱动，零延迟 |
| 实现复杂度 | 中（~80 行服务端 + ~100 行客户端）|
| 断线重连 | 客户端实现（~20 行）|
| Express 集成 | 共用端口，`server.on('upgrade')` 路由 |

### 方案 B：轮询增强（备选）

| 维度 | 评估 |
|------|------|
| 依赖 | 无新增 |
| 双向性 | ❌ 仅浏览器→服务端。服务端→浏览器需要额外 SSE |
| 实时性 | ❌ 依赖推送间隔（500ms 至少 500ms 延迟）|
| 实现复杂度 | 低（增强已有 POST /push 端点 + 定时器）|
| 断线重连 | 天然无状态 |

### 方案 C：SSE + HTTP POST

| 维度 | 评估 |
|------|------|
| 依赖 | 无新增（SSE 是 HTTP 标准）|
| 双向性 | ⚠️ 仅服务端→浏览器。浏览器→服务端仍需 HTTP POST |
| 实现复杂度 | 中（SSE 客户端 + 现有 POST 端点）|
| 适合场景 | 操作转发为主、snapshot 推送为辅 |

## 决策：采用 WebSocket（方案 A）

理由：
1. KFM 的最终愿景是"人和 AI 对称操作"——这**必须**双向实时通信
2. `ws` 包极轻量，不会膨胀项目依赖
3. 浏览器端 WebSocket API 是 Web 标准，无额外学习成本
4. 共用 Express HTTP 端口，无需开新端口
5. 未来可扩展为 AI agent 通过 WebSocket 直接发送操作指令

## 协议设计

### 消息格式

所有消息顶层统一包装：

```typescript
interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}
```

### 浏览器→服务端

| type | payload | 触发时机 |
|------|---------|---------|
| `snapshot` | `PageDescription` | 页面状态变化后 |
| `capabilities` | `Capability[]` | 注册时/变化时 |
| `hello` | `{ version: string }` | 连接建立时 |

### 服务端→浏览器

| type | payload | 用途 |
|------|---------|------|
| `command` | `{ action: string; params: Record<string, unknown>; id: string }` | 通知浏览器执行 UI 操作 |
| `ack` | `{ received: string }` | 确认收到消息 |
| `ping` | `null` | 心跳 |

## 实现计划

### Step 1: 安装 ws + 类型定义
```
npm install ws
npm install -D @types/ws
```

### Step 2: 服务端（src/server/ws-server.ts）
- 新建 `WsServer` 类，封装 WebSocketServer
- 管理连接池（当前只考虑单客户端）
- 提供 `broadcast(type, payload)` 和 `getLatestSnapshot()` 方法
- 心跳检测 + 断线清理

### Step 3: 修改 src/server/index.ts
- 通过 `http.createServer(app)` 替代 `app.listen()`
- 将 HTTP server 实例传给 WebSocket server
- WebSocket 路由路径：`/ws`

### Step 4: 修改 src/server/ai-tools.ts
- `GET /api/ui/snapshot` 改为返回实时数据（从 WsServer 取最新 snapshot）
- 新增 `POST /api/ui/command` 端点（服务端→浏览器发送操作指令）
- 能力列表也从 WsServer 获取

### Step 5: 客户端（src/client/modules/ws-channel.ts）
- 新建 `WsChannel` 模块
- 页面加载后连接 `ws://host:port/ws`
- 自动推送 snapshot（通过 `Registry._onChange` 或包装 snapshot 调用）
- 服务端命令处理（分派到对应模块）
- 断线重连（指数退避）

### Step 6: 集成
- 在 `main.ts` 中初始化 `WsChannel`
- 通过回调或装饰器在 Registry snapshot 变化时自动推送

## 未解决的问题

1. **snapshot 推送策略**：每次状态变化都推？还是节流后推？建议：状态变化后推，但节流 100ms（防抖）。
2. **命令执行的安全**：服务端发来的 `command` 需要验证来源吗？建议：初期不验证（同源信任），后续加 token。
3. **多标签页**：用户开多个 KFM 标签页时，WebSocket 连接有多个，snapshot 以哪个为准？建议：初期不考虑，v2 加 connection id。

---

## 如果 WebSocket 暂不可行

如果项目 owner 不希望引入新依赖，备选方案是**增强轮询**：
1. 浏览器端在关键模块的状态变化路径上加 `pushSnapshot()` 调用
2. 服务端 `GET /api/ui/snapshot` 从内存缓存读取
3. 浏览器端启动一个 rAF 节流的背景推送（~500ms 间隔）
4. 服务端→浏览器暂用 HTTP 长轮询或 SSE

此方案可立即实现，但延迟高、覆盖不完整。建议作为 WebSocket 之前的过渡方案。
