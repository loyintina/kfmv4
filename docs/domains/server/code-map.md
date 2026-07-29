> 这是什么：server 域**代码现状**测绘（实然）——代码此刻到底是什么，含与契约的漂移。
> 应然去哪找：设计契约 → contract.md。ai/ 子域运行时 → ../ai-chat/detail-runtime.md。
> 机械层对照：文件/行数/导出符号 → ../code-inventory.md（脚本生成，可重跑）。

# server 代码地图（code-map）

## 测绘元数据

- 基准：commit 03da8c9 · 2026-07-29 · 域规模 8 文件 / 1705 行（已逐行读；
  ai/session-store.ts、ai/routes.ts 因双实现嫌疑一并核查）
- 方法：subagent 七问侦察 + 主 agent 抽查核实

## 一句话职责

本机 HTTP/WS 服务器：Express 装配、文件 CRUD 路由、根切换、终端 PTY、tmux 桥、
AI eval/snapshot 桥、出网代理。**安全边界域**——只绑 127.0.0.1 是前提。

## 承重入口

| 入口 | 位置 | 调用方 |
|------|------|--------|
| index.ts（无导出，进程入口） | 装配 :26-51 + ai 路由 :112 + listen 127.0.0.1:8021 :157 | 进程 |
| `WsServer` | ws-server.ts:44 | index.ts:54 唯一构造；ai 路由/工具群依赖——本域被引用最广的出口 |
| `setupFileRoutes()` | routes/files.ts:41 | index.ts:46（唯一） |
| `setupProxyRoutes()` | routes/proxy.ts:13 | index.ts:47（唯一） |
| `PtyManager` | terminal-pty.ts | ws-server.ts:69 唯一实例化 |
| `sanitizePath` 等纯工具 | path-utils.ts | 全域 + ai/ 子域 5 文件 |

## 状态所有权

- `_activeRoot`：path-utils.ts:30，唯一写者 /root/switch（files.ts:231）
- `_latestSnapshot/_latestCapabilities`：ws-server.ts:47-48（WS 消息写，唯一持有者——
  ai-tools.ts 的 _cached 双份缓存已随 ADR-004 整删）
- PTY 会话：唯一持有者 PtyManager._sessions；ws-server 的 ClientState.terminalSessions
  只是镜像记录（不强制，见漂移 8）
- `_evalPending`：ws-server.ts:50；`justRestarted`：读后自清（ws-server.ts:87-91）
- `__kfmProbe`：index.ts:64-65 挂 globalThis，供 CDP evaluate（debug 工具）

## 核心流程

**WS 终端链路**：terminal-open → PtyManager.spawn（node-pty）→ onData →
send('terminal-output')；输入 → pty.write；close/error/心跳判死 → killAll。
**半开检测**：30s interval（ws-server.ts:120-139）pong 未回 → killAll+terminate；
配套客户端 75s 看门狗。
**AI eval 桥**：工具 → evalInBrowser（:285-308，无连接先等 2s）→ 发给第一个客户端
→ 客户端执行回 browser-eval-result → resolve。

## 持久化/外部边界

- 文件 CRUD 全部同步 fs 集中于 files.ts；写删类端点挂 `verifyLocalOrigin`
- **会话文件三条写路径**：① ai/session-store.ts（常规）② 客户端 session-client 经
  /files/write 直写（双轨残留，见 ai-chat code-map 漂移 1）③ 无（files.ts 回退只读）
- proxy.ts **每次请求同步读 providers.json**；对外 fetch 是本域唯一出站点，
  origin 白名单约束（:31-38）
- 子进程三处：node-pty、execFile('tmux')（ws-server.ts:217）、
  spawn systemctl detached（index.ts:135-139）

## 强制不变量（附证据）

- `sanitizePath` 三层防护 fail-closed：resolve 前缀拒 + 最深已存在祖先 realpath
  拒软链逃逸（path-utils.ts:61-76）
- WS 握手 verifyClient 同源校验（ws-server.ts:63-66）——PTY 即任意命令执行的主防线
- 文件写删端点 verifyLocalOrigin 跨源 403；/root/switch 五重校验（files.ts:221-230）
- /sessions/messages 会话 id 拒 / 和 ..（files.ts:184）
- 只绑 127.0.0.1（index.ts:165）；proxy origin 精确比对防子域冒名（proxy.ts:31-37）
- evalInBrowser 超时必清 _evalPending 并 reject（ws-server.ts:297-300）

## 漂移清单（实然 ≠ 应然）

1. **会话统计口径三份**：`_computeStats`（session-store.ts:69）与 /sessions/list 回退
   （files.ts:126-156）双实现；第三份 `listSessions()`（session-store.ts:203）**死代码**。
2. **死代码一簇**：session-store 的 getMessages/isIncomplete/listSessions；
   terminal-pty 的 getSession/sessionCount。（capability-executor 公开 register()
   已随 ADR-004 整删，不再列出。）
3. **【已结案】ai-tools 9 个端点疑似整体死端点**：经溯源确认为死重（成因 E，引入
   25a295e v6.1.0），ai-tools.ts + capability-executor.ts 已整删（ADR-004）。
   连带：POST /ui/command 是 `command` WS 消息的唯一服务端触发，删除后客户端
   19 个 command handler 无生产者——见 cross-domain.md 与 STACK #6/#7。
4. **ws-server 职责混杂证实**：一个 switch 混 PTY 四类消息、tmux 子进程桥（:200-224
   直接在 WS 层 execFile）、browser-eval 桥、snapshot 缓存——实为四合一。
5. **index.ts 自述与实际不符**：头注释「只做 Express 装配」，实含 50 行 __kfmProbe
   探针设施（:62-110）、/api/system/restart（:131-141）、权限检查与重启标记（:144-163）。
6. **陷阱 1「sanitizePath 不许例外」与实然矛盾**：/roots 直读 / 不过 sanitizePath
   （files.ts:208）、/root/switch 自带校验体系、/sessions/messages 自造 id 校验。
7. **【已结案】origin 防护覆盖不均**：四个敞口全部消除——/capabilities/execute、
   /ui/command 随 ADR-004 整删；/api/system/restart（BAR-RESTART-GUARD-01）、
   /ai/chat/start（BAR-ORIGIN-GUARD-01）已挂 verifyLocalOrigin（成因 E 机制没人走，
   opt-in 出生未接入）。教训升入契约：新端点默认挂 guard，例外需注释理由。
8. **【已结案·接受现状】PTY 会话无所有权校验**：terminal-input/resize/close 只按
   sessionId 操作——知道 sessionId 的任一已连客户端可写/关闭他人 PTY。用户裁决
   （2026-07-29）：本地单用户威胁模型下接受——「其他客户端」只是自己的另一个
   标签页，加所有权登记是机制建设而非修 bug。若未来暴露局域网/多用户再立项。
9. **【已结案·接受现状】evalInBrowser 落点随机**：只发给 clients 第一个，多标签页
   落点不确定。同上裁决：单标签使用无影响，「该发给谁」的语义待有多客户端
   场景时再定义。
10. **files.ts 职责超出契约**：除文件 CRUD 还挂 /sessions/*、/roots、/root/switch——
    sibling-switcher 基础设施藏在「文件路由」里。
11. **【已结案】能力清单双源注册**：执行面随 ADR-004 整删；listing 面（ui-registry →
    WS capabilities → page-state「你能做什么」）保留为「AI 之手」预留空管道——
    幽灵注册（file-search/file-read/file-write，无执行面误导 AI）已于追加裁决删除，
    当前注册数 0，page-state 空态输出「当前无额外可调用能力」。
12. **【已结案】proxy.ts 非流式分支**：method 未传/GET/HEAD 已归无 body 分支
    （BAR-PROXY-01，引入 678c6d2 v7.1.0 拆分）。
13. 次要：/api 与 /kfmv4/api 双挂载（index.ts:50-51）；应用层 'ping' 消息客户端不回，
    纯喂看门狗——疑似协议残留；files.ts:189 死条件（path.join 恒真）；心跳 interval
    清理依赖 close 事件触发（行为正确但脆弱）。

**已核实为真的契约声称**：30s 半开检测 → killAll、express.static 只挂 public、
只绑 127.0.0.1、sanitizePath 被 files/prompt-assembler 一致使用。

## 陷阱指针

已定型陷阱见 contract.md #陷阱（注意陷阱 1 的绝对化措辞已 drift，见漂移 6）。
测绘新捕获：漂移 7/8 是安全面缺口——本地绑定 ≠ 免跨源，复核后应升入契约并考虑
给敏感端点统一挂 verifyLocalOrigin。
