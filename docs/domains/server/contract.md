> 这是什么：Express 服务端——HTTP 路由、PTY、WebSocket、路径安全。
> 别的去哪找：AI 子系统 → ../ai-chat/；构建与管线 → ../infra/。

# server 域契约

## 模块职责

Express 4 + WebSocket，`index.ts` 统一入口编排（协调层）。

- `routes/files.ts`：文件 CRUD API（list/read/write/copy/move/delete/rename/create/media + system/info）
- `routes/proxy.ts`：CORS 代理 `/proxy/fetch`（流式 SSE pipe + 非流式 JSON）
- `routes/providers.ts`：providers.json 专用保存（粘贴即入库——明文 apiKey 转写 `.env` 只留 `${VAR}` 代字）
- **`env-store.ts`（安全关键）**：`.kfmv4/.env` 解析（mtime 缓存）+ apiKey 代字 `resolveKey`（process.env 优先）+ `upsertEnvVar`（chmod 600）
- **`path-utils.ts`（安全关键）**：`SAFE_ROOT` + `sanitizePath()` 路径逃逸守卫
- `terminal-pty.ts`：PTY 会话管理（spawn/write/resize/kill）
- `ws-server.ts`：WS 连接管理；**30s 协议级 ping 半开检测 → killAll 清 PTY**
- `ai/`：AI 对话子系统 → ../ai-chat/contract.md

## 数据目录

`$HOME/.kfmv4/`（`KFM_DATA_DIR`）：providers/active/sessions/roles/configs/page-state.md/restart-pending.json/.env（apiKey 代字的真实来源，chmod 600）。
客户端经 API 端点以相对路径 `.kfmv4/...` 访问，`sanitizePath()` 解析到 `SAFE_ROOT`。

## #陷阱

1. **路径安全**：所有用户路径必须过 `sanitizePath()`，逃逸即拒。新端点不许例外。
2. **WS 半开**：后台冻结可导致连接假活——必须依赖协议级 ping，不可用 TCP 状态推断。
3. **express.static 不得挂载仓库根**——曾暴露 `.git`/`src`/`node_modules`（v8.1 已删）。
4. **CJS 依赖进 ESM bundle 即启动崩溃**——新增依赖同步 build.mjs external（见 ../infra/contract.md 硬规则 3）。
5. **只监听 127.0.0.1**——无认证 API 禁止绑 0.0.0.0（v5.1.0 已修，index.ts 有注释；新端点不许例外）。
6. **本地绑定 ≠ 免跨源**：变更类/触发类端点默认挂 `verifyLocalOrigin`——恶意网页可
   drive-by 跨源 POST（restart/ai-chat 曾裸奔，2026-07-29 补齐）。新端点例外需注释理由。
7. **apiKey 代字必须在使用点展开**——加载点展开会让 API 卡编辑回写把 `${VAR}` 引用
   冲成明文（且明文流经客户端）。持久化/编辑视图永远 raw，resolve 只在请求前
   （env-store.ts `resolveKey`）；`.env` 行格式是冻结契约（agent-runner 有同语义副本）。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `WEBSOCKET_CHANNEL_PROPOSAL.md`：WS 协议 type 表 + token 验证/多标签 connection id 待决议。

## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`src/server/routes/files.ts` `src/server/ws-server.ts` `src/server/index.ts` `src/server/path-utils.ts` `src/server/ai/permissions.ts` `src/server/routes/obs.ts` `src/server/terminal-pty.ts` `src/server/env-store.ts` `src/server/routes/proxy.ts` `src/server/routes/providers.ts`
<!-- /gen:contract-list -->
