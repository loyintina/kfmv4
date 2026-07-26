---
title: AI Agent 调试能力设计文档
status: draft
created: 2026-07-26
kfm_version: 7.3.2+
maintainer: AI agent (蔚然)
---

# AI Agent 调试能力设计

> **面向 AI agent 的调试基础设施——不是给人用，是给我用。**
>
> 本文定义 kfmv4 项目为 AI 开发者（agent）提供的调试能力体系：
> 哪些已经可用、哪些缺位、如何填补。

---

## 一、核心命题

### 1.1 我和人类开发者的本质区别

| 维度 | 人类开发者 | AI agent（我） |
|------|-----------|---------------|
| **信息来源** | 屏幕上的 UI、终端输出、DevTools | 工具调用的文本返回 |
| **反馈延迟** | 实时（<100ms） | 异步（工具调用→等待→返回文本） |
| **调试策略** | 直觉→断点→看变量→推断 | 信息不足→工具查询→推断→再查→确认 |
| **记忆持久性** | 有上下文记忆 | 会话之间无记忆（角色卡保留基线） |

**这意味着**：我需要的不是 VS Code 式的逐行调试器——而是**结构化信息获取 + 快速验证闭环**。

### 1.2 设计原则

1. **实事求是**：不为工具而造工具。每个能力必须回答「agent 真的需要它吗？」
2. **信息层次化**：从快照到深入，从只读到读写，按需逐层深入。
3. **零侵入**：调试操作不影响生产服务。断点=非侵入式探针，不暂停进程。
4. **可组合**：每个工具可独立使用，也可串联成验证流水线。

---

## 二、现有能力矩阵

### 2.1 通用工具层（无需项目改造）

| 工具 | 用途 | 状态 |
|------|------|------|
| `bash` | 运行构建、测试、git 操作 | ✅ 核心 |
| `read` | 读取代码、配置、历史记录 | ✅ 核心 |
| `grep` | 在源码中搜索模式 | ✅ 核心 |
| `glob` | 按模式查找文件 | ✅ 核心 |
| `eval` | 快速验证 JS/Python 逻辑片段 | ✅ 核心 |
| `todo` | 记录和追踪当前会话任务 | ✅ 已测试 |
| `web_search` | 搜索外部文档/参考资料 | ✅ 可用 |
| `browser` | 打开网页测试功能 | ⚠️ 受限（环境问题） |
| `debug` | CDP 调试器 + kfmv4 专属视图 | ✅ 已实现 |

### 2.2 kfmv4 专属工具层

| 工具 | 用途 | 状态 |
|------|------|------|
| `browser_eval` | 在浏览器端执行 JS 代码 | ✅ 核心 |
| `kfm-snapshot` | 查看页面元素和卡片状态 | ✅ 核心 |
| `kfm-logs` | 查看客户端日志卡内容 | ✅ 核心 |
| `kfm-exec` | 在项目目录执行命令 | ✅ 核心 |
| 「眼睛」系统 | 每次工具调用后自动推送页面状态 | ✅ 已启用 |
| `kfm-restart` | 安全重启 kfmv4 服务 | ⚠️ 需重构（见 P0） |

### 2.3 debug 工具内置能力

#### 5 个 kfmv4 专属视图（通过 browser_eval 通道，不依赖 CDP 连接）

| 视图 | 返回内容 | 验证状态 |
|------|---------|---------|
| `renderer_snapshot` | Box 树完整结构 + Canvas 尺寸 + activeOverlays | ✅ |
| `animation_timeline` | GSAP 时间线 + 活跃补间列表 | ✅ |
| `gesture_trace` | 注册的手势处理器 + 优先级排序 | ✅ |
| `state_history` | KFMState 当前状态 + 订阅者列表 | ✅ |
| `card_lifecycle` | card-registry 实例列表 | ✅ |

#### CDP 核心（生产模式，通过 attach 连接本地 9229 端口）

| 操作 | 用途 | 验证状态 |
|------|------|---------|
| `attach` | 连接到本地运行的 kfmv4 进程 | ✅ |
| `custom_request` | 发送原始 CDP 命令（Runtime.evaluate 等） | ✅ |
| `set_breakpoint` | 按文件+行号设断点 | ✅ |
| `remove_breakpoint` | 移除断点 | ✅ |
| `evaluate` | 在服务端执行表达式 | ✅ |
| `sessions` | 查看调试会话 | ✅ |
| `threads` | 查看线程 | ✅ |
| `loaded_sources` | 查看加载的源文件 | ✅ |
| `tracepoint` | 非侵入式探针（__kfmProbe 基础设施） | ✅ 已架构 |
| `launch` | 启动子进程调试 | ❌ AI 沙盒限制 |
| `step_in/over/out` | 单步执行 | ⚠️ 需暂停帧，生产不建议 |
| `variables/scopes` | 查看变量 | ⚠️ 需暂停帧，生产不建议 |

#### 基础设施

| 组件 | 位置 | 用途 |
|------|------|------|
| `globalThis.__kfmProbe` | `src/server/index.ts` | 运行时探针（set/read/restore） |
| `globalThis.__kfmDebugServer` | `src/server/index.ts` | 暴露 wsServer 实例供探针访问 |
| `window.__kfmDebug` | `src/client/main.ts` | 浏览器端调试桥 |
| `window.__L/__anim/__cardRegistry` | `src/client/main.ts` | 浏览器端模块暴露 |
| `inspect port 9229` | systemd drop-in | CDP 连接入口 |

---

## 三、缺位能力（P0/P1 优先级）

### P0 — 服务端结构化日志

**现状**：我无法直接查看服务端的 `console.log` 输出和错误堆栈。必须通过 `journalctl` 手动查。

**draft（当前分析）**：
已有统一日志函数：`log()` 在客户端 logger.ts，`console.warn/error` 在服务端各模块。
但系统缺少一个工具层命令让 agent 直接获取。最简单的方案是在现有的 `kfm-logs` 工具基础上
加一个 `server` 参数，通过 `journalctl -u kfmv4` 读取服务端日志。

**初步规模估算**：约 30-50 行代码改动（ws-server.ts 新增 `server-logs` 消息类型 + kfm-log.ts 加 `--server` 参数）。

### P0 — kfm-restart 安全重启重构

**现状**：`kfm-restart` 工具在 `executeTool()` 中触发 `systemctl restart kfmv4`，但工具代码本身运行在 kfmv4 进程内——杀死进程等于杀死自己。30s 轮询 + 浏览器刷新等逻辑在进程死亡前无法完成，导致工具调用被截断，结果标记为「未完成」。

**draft（当前分析）**：

有两个结构性缺陷：

| 缺陷 | 位置 | 表现 |
|------|------|------|
| **并行执行** | `chat.ts` 的 `Promise.all(todo.map(...))` | LLM 一轮可调多个工具，restart 可能和 write/edit 并行，进程被杀时其他工具结果丢失 |
| **进程内等待** | `restart.ts` 的 30s 轮询 + WS eval | 工具在将死的进程里做远程操作，轮询到一半进程被 kill |

**方案—两层改造**：

**第一层——独占标记**：`KfmTool` 加 `exclusive?: boolean` 字段，`kfmRestartTool.exclusive = true`。`chat.ts` 中 Promise.all 前做独占检查——若 todo 中有 exclusive 工具，只执行它，其余返回「因独占本轮而跳过」。LLM 下一轮看到跳过信息后自行决定是否重试。

改动文件：
| 文件 | 改动 |
|------|------|
| `tools/types.ts` | `KfmTool` 加可选 `exclusive?: boolean` |
| `tools/kfmv4/restart.ts` | `kfmRestartTool.exclusive = true` |
| `chat.ts` | Promise.all 前加 exclusive 检查，分离执行 |

**第二层——文件接力**：去掉轮询和浏览器刷新，改为「触发重启 → 写标记文件 → 立即返回」。利用进程死亡前约 100ms 的安全窗口（`POST` 返回与 `systemctl` 杀进程之间），工具在窗口内完成所有 yield，SSE 数据写入 TCP 缓冲区。新进程启动后检测标记文件 → 广播 `restart-completed` WS 事件。

改动文件：
| 文件 | 改动 |
|------|------|
| `tools/kfmv4/restart.ts` | 重写：触发 POST → 写 `.kfmv4/restart-pending.json` → 立即返回 |
| `server/index.ts` | 新增：启动时检测标记文件、广播 WS 事件 |
| `client/ws-channel.ts` | 新增：注册 `restart-completed` 处理器 |
| `client/orb-chat.ts` | 新增：收到事件后更新工具卡 UI |

**初步规模估算**：约 120-150 行总改动（类型 3 行 + restart 重写 25 行 + index 启动检测 15 行 + ws-channel 20 行 + orb-chat 20 行 + 独占逻辑 ~30 行 + 工具提示文档 ~15 行）。

**设计评论状态**：已与洛讨论确认，待实施。

### P0 — 一键健康检查（kfm-check）

**现状**：每次改完代码需要手动跑多个检查命令，步骤分散。

**draft（当前分析）**：
统一的健康检查脚本，串联全部检查项，输出结构化报告。
```bash
kfm-check → tsc --noEmit → build → test → smoke
           → 汇总: ✅ 4/4 passed (3.2s total)
```
可并行化执行以缩短总时间。

**初步规模估算**：约 80-100 行 bash/Node.js 脚本。

### P1 — 构建日志缓存

**现状**：每次 `npm run build` 输出只有最后一次可见。上次构建的完整日志需要重新跑一遍才能看到。

**draft（当前分析）**：
构建日志输出重定向到缓存文件（待实现），最多保留最近 5 次构建。
agent 可通过 `bash` 读取构建日志缓存文件（待实现的方案）。

**初步规模估算**：约 20-30 行改动（build.mjs + build.mjs 内部修改）。

### P1 — E2E 功能断言（kfm-check-e2e）

**现状**：改了 UI 逻辑（如 todo 面板渲染）后，只能依靠手动刷新页面验证。

**draft（当前分析）**：
通过 `browser_eval` 做结构化的页面断言：
```js
await assert('侧栏已关闭', () => KFMState.sidebarOpen === false);
await assert('文件树有至少3个条目', () => getTreeEntries().length >= 3);
```
封装为标准 `kfm-check-e2e` 命令，在构建通过后自动运行。

**初步规模估算**：约 100-150 行代码（客户端断言函数 + 服务端工具命令）。

---

## 四、能力演化路线

### Phase 1 — 补齐基础（现在做）
- [ ] P0: kfm-restart 安全重构（独占标记 + 文件接力）
- [ ] P0: 服务端结构化日志访问
- [ ] P0: kfm-check 一键健康检查
- [ ] P1: 构建日志缓存

### Phase 2 — 自动化测试（之后做）
- [ ] P1: E2E 功能断言框架
- [ ] 将 tracepoint 从实验性集成到完整工作流

### Phase 3 — 智能诊断（远期）
- [ ] 服务端崩溃自动捕获堆栈
- [ ] 性能回归自动检测（build 时间趋势）
- [ ] 跨模块调用路径可视化

---

## 五、相关文档

- `docs/design/AI_CHAT_RUNTIME.md` — AI 对话运行时架构
- `docs/design/VISION_AND_ROADMAP.md` — 远景与路线图
- `docs/KFM_V4_INVARIANTS.md` — 修改约束协议
- `docs/HANDBOOK.md` — 工作手册（架构速查 + 待办）
