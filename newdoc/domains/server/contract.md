> 这是什么：Express 服务端——HTTP 路由、PTY、WebSocket、路径安全。
> 别的去哪找：AI 子系统 → ../ai-chat/；构建与管线 → ../infra/。

# server 域契约

## 模块职责

Express 4 + WebSocket，`index.ts` 统一入口编排（协调层）。

- `routes/files.ts`：文件 CRUD API（list/read/write/copy/move/delete/rename/create/media + system/info）
- `routes/proxy.ts`：CORS 代理 `/proxy/fetch`（流式 SSE pipe + 非流式 JSON）
- `ai-tools.ts`：Registry snapshot → 服务端 API 端点（供 AI 查询页面状态）
- `capability-executor.ts`：能力名 → 可执行函数映射（AI 命令调用端点）
- **`path-utils.ts`（安全关键）**：`SAFE_ROOT` + `sanitizePath()` 路径逃逸守卫
- `terminal-pty.ts`：PTY 会话管理（spawn/write/resize/kill）
- `ws-server.ts`：WS 连接管理；**30s 协议级 ping 半开检测 → killAll 清 PTY**
- `ai/`：AI 对话子系统 → ../ai-chat/contract.md

## 数据目录

`$HOME/.kfmv4/`（`KFM_DATA_DIR`）：providers/active/sessions/roles/configs。
客户端经 API 端点以相对路径 `.kfmv4/...` 访问，`sanitizePath()` 解析到 `SAFE_ROOT`。

## #陷阱

1. **路径安全**：所有用户路径必须过 `sanitizePath()`，逃逸即拒。新端点不许例外。
2. **WS 半开**：后台冻结可导致连接假活——必须依赖协议级 ping，不可用 TCP 状态推断。
3. **express.static 不得挂载仓库根**——曾暴露 `.git`/`src`/`node_modules`（v8.1 已删）。
4. **CJS 依赖进 ESM bundle 即启动崩溃**——新增依赖同步 build.mjs external（见 ai-chat#陷阱 3）。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `WEBSOCKET_CHANNEL_PROPOSAL.md`：WS 协议 type 表 + token 验证/多标签 connection id 待决议。

## 文件清单

`index.ts` `routes/files.ts` `routes/proxy.ts` `ai-tools.ts` `capability-executor.ts`
`path-utils.ts` `terminal-pty.ts` `ws-server.ts` `ai/`（见 ai-chat 域）`prompts/`
