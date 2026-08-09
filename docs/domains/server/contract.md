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
- `routes/obs.ts`：观测台 HUD 数据聚合 `/obs/hud`（deepseek 余额 5s 缓存直连官方 +
  信箱/待办现场解析单一出处 + SYS 5s 独立采样器环形 40 点落 sys-metrics.json +
  端口 30s/cron 5min 缓存 + 星轨 archive 30s 缓存读 sessions/*.json 顶层字段）+
  守视校准页 `/test` 与 `/obs/viewport` 视口回传
- `ws-server.ts`：WS 连接管理；**30s 协议级 ping 半开检测 → killAll 清 PTY**
- `ai/`：AI 对话子系统 → ../ai-chat/contract.md。**唯一例外 `ai/permissions.ts`
  归 server 域**（权限引擎贴近路由/工具调度层；域归属单一出处 = scripts/check/
  domain-src.mjs，两域清单均由它生成，归属争议以它为准）

## 数据目录

`$HOME/.kfmv4/`（`KFM_DATA_DIR`）——**2026-08-09 重构定稿后的结构**（详见
`../guides/kfmv4-data.md`，机械门 check-kfmv4-data 执法）：
- 根：`providers.json` / `active.json` / `.env`（apiKey 代字真实来源，chmod 600）
- `agents/`：roles（角色卡）/ configs / prompts / paradigms（人设与配置四合一）
- `sessions/`（面板会话 + script/ 脚本分流）、`ledger/`（8 个观测账本：
  agent-calls / tool-exec / check-failures / build-metrics / permission-audit /
  semantic-chain-metrics / sys-metrics / discussion-log）、`experiments/`（含 materials）、
  `logs/` / `browser-relay/` / `workspaces/`（agent 工作区空位）
- `restart-pending.json` 仍在根目录
客户端经 API 端点以相对路径 `.kfmv4/...` 访问，`sanitizePath()` 解析到 `SAFE_ROOT`。

## #陷阱

1. **路径安全**：所有用户路径必须过 `sanitizePath()`，逃逸即拒。新端点不许例外。
   （枚举类端点不接收用户路径、无消毒对象，天然豁免：`/roots` 只回允许根清单
   （files.ts，verifyLocalOrigin 把守）、`/root/switch` 与 `/sessions/messages`
   各有自带校验体系——2026-08-08 语义裁决：陷阱表述从「不许例外」修订为
   「接收用户路径的端点不许例外」）
2. **WS 半开**：后台冻结可导致连接假活——必须依赖协议级 ping，不可用 TCP 状态推断。
3. **express.static 不得挂载仓库根**——曾暴露 `.git`/`src`/`node_modules`（v8.1 已删）。
4. **CJS 依赖进 ESM bundle 即启动崩溃**——新增依赖同步 build.mjs external（见 ../infra/contract.md 硬规则 3）。
5. **只监听 127.0.0.1**——无认证 API 禁止绑 0.0.0.0（v5.1.0 已修，index.ts 有注释；新端点不许例外）。
6. **本地绑定 ≠ 免跨源**：变更类/触发类端点默认挂 `verifyLocalOrigin`——恶意网页可
   drive-by 跨源 POST（restart/ai-chat 曾裸奔，2026-07-29 补齐）。新端点例外需注释理由。
7. **apiKey 代字必须在使用点展开**——加载点展开会让 API 卡编辑回写把 `${VAR}` 引用
   冲成明文（且明文流经客户端）。持久化/编辑视图永远 raw，resolve 只在请求前
   （env-store.ts `resolveKey`）；`.env` 行格式是冻结契约（agent-runner 有同语义副本）。
8. **cgroup 读取必须按 `/proc/self/cgroup` 相对路径拼**——主机 `/sys/fs/cgroup` 是
   整棵树，根下的 memory.high 是根 cgroup 的（max），直读根路径必失效
   （2026-08-07 RSS 限额参照第一版踩坑，8021 实测回退整机内存）。
9. **文件读取端点必须有体量防护**——`/files/read` 三层：二进制扩展名拒绝 / 2MB 硬
   上限截断（带 totalSize 标注）/ 前端截断提示。无防护 readFileSync 大文件
   （2026-08-07 事故：materials.db 250MB 单次峰值 700M+）会撞 cgroup MemoryHigh
   刹车，事件循环被踩死表现为「前端整体无响应」——内存墙下 OOM 不是崩溃是冻死。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `WEBSOCKET_CHANNEL_PROPOSAL.md`：WS 协议 type 表 + token 验证/多标签 connection id 待决议。

## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`src/server/routes/obs.ts` `src/server/routes/files.ts` `src/server/ws-server.ts` `src/server/index.ts` `src/server/path-utils.ts` `src/server/ai/permissions.ts` `src/server/terminal-pty.ts` `src/server/env-store.ts` `src/server/routes/proxy.ts` `src/server/routes/providers.ts`
<!-- /gen:contract-list -->
