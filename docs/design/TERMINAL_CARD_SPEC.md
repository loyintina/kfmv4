---
status: draft
version: v1.0
last_updated: 2026-06-26
---

# KFM v4 — 03 号终端卡设计规范

> **版本**：v1.0
> **状态**：设计完成，待实施
>
> 本文档描述 03 号卡片（终端模拟器）的完整设计。
> 核心理念：在浮动卡片内嵌入真实的 Web 终端（xterm.js），通过 WebSocket 桥接到服务端 PTY 进程，实现类似 Termux 的移动端命令行交互体验。
>
> **关联文档**：
> - WORKBENCH_SPEC.md — 卡片工作台总体设计（Phase 8 入口）
> - HANDBOOK.md — 工作手册（架构、模块清单）
> - KFM_V4_INVARIANTS.md — 修改约束协议
>
> **阅读顺序**：§1（核心意图）→ §2（架构总览）→ §3（服务端 PTY 管理）→ §4（客户端终端卡）→ §5（全局辅助栏）→ §6（实现计划）→ §7（开放问题）

---

## §1 核心设计意图

### 1.1 目标

将 KFM 的 03 号卡片占位符实现为**完整的 Web 终端模拟器**，用户可以在浏览器内获得真实的 Linux shell 会话：

- 支持任意命令执行（`ls`、`cat`、`vim`、`top`、`npm`、`git` 等）
- 支持交互式程序（PTY 原生支持 stdin）
- 流式输出（非请求-响应模式）
- 多卡同时运行独立会话
- KFM 统一主题配色
- 移动端辅助键盘栏（Termux 风格）
- 为未来 AI 直接操作终端预留通道

### 1.2 非目标

- 不在本次实现 SSH 远程连接（本地 shell 即可）
- 不在本次实现 ANSI 超链接解析
- 不在本次实现终端会话历史持久化（shell 自带的 `.zsh_history` 已足够）
- 不在本次实现桌面端的辅助键盘栏（桌面有物理键盘）

### 1.3 与 AI 的协同设计

终端卡的全部输入输出都经过 WebSocket，这意味着 AI 可以在未来**无缝接入**：

- AI 发送 `terminal-send` 命令往任意终端会话注入输入
- AI 订阅 `terminal-output` 感知终端输出
- AI 可同时读写多个终端会话，协调跨终端工作流

这些 AI 能力不是本 Phase 的实现范围，但架构设计已为其预留。

---

## §2 架构总览

```
┌─ 浏览器 ────────────────────────────────────────────────────┐
│                                                              │
│  [03 号浮卡]  terminal-card.ts                                │
│  ┌─────────────────────────────────┐                         │
│  │ 标题栏: "> 终端 N"          [✕] │                         │
│  ├─────────────────────────────────┤                         │
│  │                                 │                         │
│  │  xterm.js Terminal (CDN 加载)    │──onData──┐              │
│  │  主题: Nebula 暗色板             │          │              │
│  │  尺寸: cols×rows 自适应卡片      │←─write──┤              │
│  │                                 │          │              │
│  └─────────────────────────────────┘          │              │
│                                                │              │
│  [全局辅助栏]  terminal-aux-bar.ts              │              │
│  ┌─────────────────────────────────┐          │              │
│  │ [ESC][TAB][CTRL][ALT][▲][|][-] │          │              │
│  │ [◀][▼][▶][DEL][   ENTER    ]   │──VT序列─┘              │
│  └─────────────────────────────────┘                         │
│          ↑ 仅当: 虚拟键盘弹出 + 终端聚焦                     │
│                                                              │
│              WebSocket ◄─────────────────────┐               │
│              ws-channel.ts                    │               │
└──────────────────────┬───────────────────────┼───────────────┘
                       │                       │
┌─ 服务端 ─────────────┼───────────────────────┼───────────────┐
│                      │                       │               │
│  ws-server.ts        │                       │               │
│  ┌───────────────────▼───────────────────────┴─────────────┐ │
│  │  消息路由 (handleMessage switch):                        │ │
│  │    terminal-open   → PtyManager.spawn()  → sessionId    │ │
│  │    terminal-input  → PtyManager.write()                  │ │
│  │    terminal-resize → PtyManager.resize()                 │ │
│  │    terminal-close  → PtyManager.kill()                   │ │
│  │    PTY.on('data')  → send('terminal-output', data)       │ │
│  │    PTY.on('exit')  → send('terminal-exit', code)         │ │
│  │                                                          │ │
│  │  会话追踪: Map<WebSocket, Set<sessionId>>                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  terminal-pty.ts (PtyManager)                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Map<sessionId, PtySession>                               │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ PtySession { id, pty, ws, cols, rows, cwd, pid }    │ │ │
│  │  │   spawn(): node-pty-prebuilt-multiarch.spawn(shell)  │ │ │
│  │  │   write(): pty.write(data)                           │ │ │
│  │  │   resize(): pty.resize(cols, rows)                   │ │ │
│  │  │   kill():  pty.kill() + 清理                          │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  依赖: node-pty-prebuilt-multiarch (原生模块, 预编译)         │
└───────────────────────────────────────────────────────────────┘
```

### 2.1 数据流

```
用户按键 → xterm.onData → WS 'terminal-input' → PtyManager.write → shell 进程
                                                                        ↓
xterm.write ← WS 'terminal-output' ← ws.send ← PtySession.onData ← shell 输出
```

辅助栏按键**直发 WebSocket → PTY**，不经 xterm.js input，因为它们是 VT 控制序列（方向键/修饰键），不是文本输入。

### 2.2 会话生命周期

```
发射终端卡              关闭/销毁卡
  ↓                       ↓
'terminal-open'       'terminal-close'
  ↓                       ↓
PTY spawn              PTY kill
  ↓                       ↓
sessionId 返回          进程终止 + Map 清理
  ↓
xterm.write() ← 'terminal-output' 持续流

多卡 → 多 sessionId → 多个独立 shell 进程
```

### 2.3 尺寸同步

```
浮卡 resize → 重算 cols/rows
                ↓
         'terminal-resize' → PTY.resize(cols, rows)
```

---

## §3 服务端：PtyManager

### 3.1 模块定位

`src/server/terminal-pty.ts` — 管理 PTY 会话的创建、读写、尺寸同步和销毁。

### 3.2 接口

```typescript
interface PtySession {
  id: string;           // crypto.randomUUID()
  pty: IPty;            // node-pty 进程实例 (process ID)
  ws: WebSocket;        // 归属的 WebSocket 连接
  cwd: string;          // 工作目录
  cols: number;
  rows: number;
}

class PtyManager {
  // 创建会话，返回 sessionId。自动绑定 PTY.on('data') → ws.send
  spawn(ws: WebSocket, cwd?: string): string;

  // 往指定会话写入数据
  write(sessionId: string, data: string): void;

  // 调整 PTY 窗口尺寸
  resize(sessionId: string, cols: number, rows: number): void;

  // 终止会话
  kill(sessionId: string): void;

  // 获取会话信息（用于状态展示）
  getSession(sessionId: string): PtySession | undefined;

  // 客户端断开时，终止其所有会话
  killAll(ws: WebSocket): void;

  // 内部：PTY 进程退出时清理
  private onExit(sessionId: string, code: number): void;
}
```

### 3.3 shell 选择

```typescript
const SHELL = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'zsh');
```

优先 `$SHELL`，未设置时默认 zsh（Linux/macOS）或 powershell（Windows）。

### 3.4 集成到 ws-server.ts

`ws-server.ts` 已有的 `Set<WebSocket>` 追踪改为 `Map<WebSocket, ClientState>`：

```typescript
interface ClientState {
  terminalSessions: Set<string>;  // sessionId 集合
}
```

`handleMessage` switch 新增 4 个 case：

| 消息类型 | 方向 | 负载 | 处理 |
|---------|------|------|------|
| `terminal-open` | 客户端→服务端 | `{ cwd?: string }` | spawn PTY, 返回 `{ sessionId }` |
| `terminal-input` | 客户端→服务端 | `{ sessionId, input }` | pty.write(input) |
| `terminal-resize` | 客户端→服务端 | `{ sessionId, cols, rows }` | pty.resize(cols, rows) |
| `terminal-close` | 客户端→服务端 | `{ sessionId }` | pty.kill() |

服务端→客户端：

| 消息类型 | 负载 | 触发 |
|---------|------|------|
| `terminal-output` | `{ sessionId, data }` | PTY.on('data') |
| `terminal-exit` | `{ sessionId, code }` | PTY.on('exit') |

---

## §4 客户端：Terminal 卡片内容处理器

### 4.1 模块定位

`src/client/modules/terminal-card.ts` — 03 号浮卡的 `CardContentHandler` 实现。

### 4.2 xterm.js 加载

沿用 KaTeX/Mermaid 的 CDN 动态注入模式：

```typescript
const XTERM_CDN = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5/lib/xterm.js';
const XTERM_CSS_CDN = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5/css/xterm.css';

// _loadScript() → window.xterm 可用
// xterm.js CSS 通过 <link> 注入（~2KB，远小于 KaTeX 的 23KB）
```

### 4.3 卡片 DOM 布局

复用编辑器卡片的 flex column 模式：

```
┌─ wrapper (inset:0, flex column) ───┐
│ ┌─ 标题栏 (flex-shrink:0) ─────────┐ │
│ │  [>] 终端 1               [清屏]  │ │
│ ├─ 分隔线 ─────────────────────────┤ │
│ │                                   │ │
│ │  xterm-container (flex:1)         │ │
│ │  position:relative; overflow:hidden│ │
│ │  └─ xterm.js 挂载点              │ │
│ │                                   │ │
│ └───────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4.4 主题配色

```typescript
const TERMINAL_THEME = {
  background: '#0a0a0f',          // canvas.bg
  foreground: '#e0e0e0',          // canvas.text
  cursor: '#00d4ff',              // canvas.accent
  cursorAccent: '#0a0a0f',
  selectionBackground: 'rgba(0,212,255,0.2)',
  // ANSI 16 色
  black:   '#1a1a2e',
  red:     '#f07178',
  green:   '#50a880',
  yellow:  '#b4aa50',
  blue:    '#5088c8',
  magenta: '#9650c8',
  cyan:    '#00d4ff',
  white:   '#e0e0e0',
  brightBlack:   '#4a4a5e',
  brightRed:     '#f78c6c',
  brightGreen:   '#6cdf9c',
  brightYellow:  '#ffd54f',
  brightBlue:    '#82aaff',
  brightMagenta: '#c792ea',
  brightCyan:    '#89ddff',
  brightWhite:   '#ffffff',
};
```

### 4.5 ContentHandler 接口

```typescript
function createTerminalHandler(): {
  activate: (contentEl: HTMLElement) => void;
  deactivate: (contentEl: HTMLElement) => void;
}
```

**activate 流程**：
1. 构建 DOM（标题栏 + xterm 容器）
2. 加载 xterm.js CDN（首次） → 创建 Terminal 实例
3. `terminal.open(container)` 挂载
4. `ws.send({ type: 'terminal-open' })` → 获得 `sessionId`
5. 注册 `terminal.onData` → WebSocket 桥接
6. 注册 `ws.onCommand('terminal-output', ...)` → `terminal.write()`
7. 注册 `terminal.onFocus/onBlur` → 通知辅助栏管理器
8. 计算初始 cols/rows 并发送 `terminal-resize`

**deactivate 流程**：
1. `ws.send({ type: 'terminal-close', payload: { sessionId } })`
2. `terminal.dispose()`
3. 通知辅助栏管理器失焦
4. `contentEl.innerHTML = ''`

### 4.6 焦点管理

```typescript
// 全局活跃终端追踪（辅助栏需要知道往哪个会话发数据）
let _activeTerminal: Terminal | null = null;
let _activeSessionId: string | null = null;

terminal.onFocus(() => {
  _activeTerminal = terminal;
  _activeSessionId = sessionId;
  updateAuxBarVisibility();
});

terminal.onBlur(() => {
  if (_activeTerminal === terminal) {
    _activeTerminal = null;
    _activeSessionId = null;
    updateAuxBarVisibility();
  }
});
```

### 4.7 清屏按钮

标题栏的 [清屏] 按钮发送 `terminal.clear()` 或发送 `Ctrl+L`（`\x0c`）到 PTY。

### 4.8 卡片注册（card-stack.ts）

```typescript
// _cards 数组 card03 条目
{ id: 'card03', icon: '>', name: '终端', desc: '' }

// 注册处理器
_registerCardHandler('card03', createTerminalHandler());
```

---

## §5 客户端：全局辅助栏

### 5.1 模块定位

`src/client/modules/terminal-aux-bar.ts` — 全局单例，固定在键盘上方、输入栏下方，仅当虚拟键盘弹出且终端聚焦时出现。

### 5.2 触发逻辑

```
显示条件 (AND):
  ✓ window.visualViewport.height < window.innerHeight - 100
  ✓ _activeTerminal !== null
  ✓ 'ontouchstart' in window || navigator.maxTouchPoints > 0

隐藏条件 (OR):
  ✓ 虚拟键盘收起
  ✓ 终端失焦
  ✓ 桌面端（无 touch）
```

### 5.3 DOM & 定位

```html
<div id="terminalAuxBar" style="
  position: fixed;
  left: 0; right: 0;
  height: 60px;
  z-index: 260;
  display: none;
  flex-direction: column;
  background: rgba(14,11,22,0.95);
  border-top: 1px solid rgba(var(--accent), 0.15);
  padding: 3px 4px;
  gap: 3px;
  transition: bottom 0.25s cubic-bezier(0.4,0,0.2,1);
">
  <!-- 两行按键由 JS 动态生成 -->
</div>
```

`bottom` 值由 `visualViewport.resize` 事件计算：
```typescript
const kh = window.innerHeight - window.visualViewport.height;
const inputBarH = document.getElementById('aiInputBar')?.clientHeight || 56;
bar.style.bottom = (kh + inputBarH) + 'px';
```

位置关系：

```
┌─ visual viewport ──────────────┐
│                                  │
│  浮卡（终端）                      │
│                                  │
├─ #aiInputBar ───────────────────┤
│  [textarea] [发送]               │
├─ #terminalAuxBar ──────────────┤  ← bottom: kh + inputBarH
│  [ESC][TAB][CTRL][ALT][▲][|][-]│
│  [◀][▼][▶][DEL][  ENTER  ]     │
├─ 系统键盘 ──────────────────────┤
└──────────────────────────────────┘
```

### 5.4 按键布局

**上排（7 键，~48px/键）：**

| ESC | TAB | CTRL | ALT | ▲ | \| | - |
|-----|-----|------|-----|---|---|---|

**下排（5 键，ENTER 占 2 列宽）：**

| ◀ | ▼ | ▶ | DEL | ENTER (×2宽) |
|---|---|---|---|---|

### 5.5 按键→VT 序列映射

| 按键 | 发送 | 说明 |
|------|------|------|
| ESC | `\x1b` | VT 转义 |
| TAB | `\t` | 制表符 |
| CTRL | 粘滞切换 | 下个字母键发送 ctrl+key（如 C→`\x03`） |
| ALT | 粘滞切换 | 下个键前缀 `\x1b`（如 A→`\x1b`a） |
| ▲ ▼ ◀ ▶ | `\x1b[A/B/C/D]` | 方向键 VT 序列 |
| \| | `\|` | 管道符字面量 |
| - | `-` | 减号字面量 |
| DEL | `\x7f` | 退格 |
| ENTER | `\r` | 回车 |

**CTRL/ALT 粘滞键行为**：
- 首次点击：键高亮（底色调为 accent），标记粘滞态
- 下次按任意字符键：发送带修饰符的序列，清除粘滞态和高亮
- 若再次点击同一修饰键：直接清除粘滞态（取消）
- 最多一个修饰键处于粘滞态（ALT 优先覆盖 CTRL）

### 5.6 按键发送路径

辅助栏按键**直接通过 WebSocket 发送**，不经 xterm.js：

```typescript
function sendKey(payload: string) {
  const sessionId = _activeSessionId;
  if (!sessionId) return;
  wsChannel.send({
    type: 'terminal-input',
    payload: { sessionId, input: payload }
  });
}
```

### 5.7 视觉设计

继承卡片 accent 色系：

| 元素 | 样式 |
|------|------|
| 栏背景 | `rgba(14,11,22,0.95)` — 比卡片更暗，聚焦键盘区 |
| 栏顶边框 | `1px solid rgba(accentColor, 0.15)` |
| 按键默认 | `bg: rgba(20,16,32,0.5), border: rgba(255,255,255,0.06), text: rgba(224,224,224,0.8), radius: 6px` |
| 按键按下 | `bg: rgba(accentColor, 0.2), border: rgba(accentColor, 0.35), text: #00d4ff` |
| CTRL/ALT 粘滞 | `bg: rgba(accentColor, 0.25)` 持续亮 |
| ENTER 键 | 可能使用更强的 accent 底色以突出 |
| 字体 | `10px monospace` |

accentColor 取当前活动终端的 `item.accentColor`（卡片 color2）。

---

## §6 实现计划

### Phase 8 — 03 号终端卡

#### 8.1 依赖安装

| 步骤 | 操作 | 说明 |
|------|------|------|
| 8.1.1 | `npm install node-pty-prebuilt-multiarch` | 原生 PTY 支持（预编译二进制，无需 node-gyp） |
| 8.1.2 | `build.mjs` 服务端 external 加 `node-pty-prebuilt-multiarch` | 原生模块不进 esbuild bundle |
| 8.1.3 | `build.mjs` 客户端 external 加 `xterm` | CDN 动态加载，不进 bundle |
| 8.1.4 | `check-as-any.mjs` 白名单登记 `window.xterm` | 同 katex/mermaid 模式 |

#### 8.2 服务端 PTY 管理

| 步骤 | 文件 | 内容 | 估行 |
|------|------|------|------|
| 8.2.1 | `src/server/terminal-pty.ts` (新建) | PtyManager 类：spawn/write/resize/kill/onExit/killAll | ~120 |
| 8.2.2 | `src/server/ws-server.ts` | Set→Map 追踪扩展；handleMessage 加 terminal-* case；集成 PtyManager | ~40 |
| 8.2.3 | `src/server/index.ts` | import PtyManager，初始化传入 wsServer | ~5 |

#### 8.3 客户端终端卡

| 步骤 | 文件 | 内容 | 估行 |
|------|------|------|------|
| 8.3.1 | `src/client/modules/terminal-card.ts` (新建) | xterm.js CDN 加载、Terminal 实例创建、主题配置、WebSocket 桥接、activate/deactivate、焦点管理 | ~250 |
| 8.3.2 | `src/client/modules/card-stack.ts` | card03 条目填充 + `_registerCardHandler('card03', ...)` | ~10 |
| 8.3.3 | `src/client/modules/ws-channel.ts` | handleMessage 加 `terminal-output`/`terminal-exit` case | ~15 |

#### 8.4 辅助栏

| 步骤 | 文件 | 内容 | 估行 |
|------|------|------|------|
| 8.4.1 | `src/client/modules/terminal-aux-bar.ts` (新建) | DOM 构建、visualViewport 联动、按键布局+VT 映射、CTRL/ALT 粘滞态、accent 继承 | ~200 |

#### 8.5 文档更新

| 步骤 | 文件 | 内容 |
|------|------|------|
| 8.5.1 | `docs/HANDBOOK.md` | §2 版本历史加 v6.10.0；模块清单加新模块 |
| 8.5.2 | `docs/design/WORKBENCH_SPEC.md` | Phase 8 条目加到状态表 |

#### 8.6 估行汇总

| 层 | 新建 | 修改 | 合计 |
|----|------|------|------|
| 服务端 | ~120 | ~45 | ~165 |
| 客户端 | ~450 | ~25 | ~475 |
| 构建/配置 | 0 | ~5 | ~5 |
| 文档 | 0 | ~5 | ~5 |
| **总计** | **~570** | **~80** | **~650** |

---

## §7 设计决策

### 7.1 为何辅助栏在浮卡外而非卡内

| 卡内方案 | 卡外方案（选定） |
|---------|----------------|
| 宽度受限（230px 有效宽） | 全屏宽（~390px），更多按键 |
| 始终占用终端视口高度 | 仅键盘弹出时出现，不占终端空间 |
| 需要模式切换概念 | 无模式概念，自然跟随手势 |
| 按钮偏小 | 按钮宽松，容错性好 |

### 7.2 为何辅助栏按键直发 WebSocket 而非经 xterm

xterm.js 的 `onData` 设计用于捕获**文本输入**（来自物理键盘或 IME）。辅助栏按键是 **VT 控制序列**（方向键、修饰键），逻辑上属于 PTY 层的输入语义。直发 WebSocket 避免了在 xterm.js 内模拟键盘事件，且路径更短。

### 7.3 为何用 node-pty-prebuilt-multiarch 而非 child_process.spawn

- `child_process.spawn` 创建的是**管道**（pipe），不是伪终端
- 管道模式下，被调用进程会认为自己在被重定向，从而关闭交互特性（颜色、光标控制、vim/top 等不可用）
- `node-pty` 创建真正的 PTY，进程以为自己在真实终端中运行
- `prebuilt-multiarch` 版提供预编译二进制，避免 node-gyp 工具链要求

### 7.4 为何不用 xterm-addon-fit

addon-fit 会根据容器尺寸自动调整终端行列。但 240×288 卡片尺寸下，手动计算 cols/rows 足够简单（`Math.floor(w / 6.6) × Math.floor(h / 17)`），无需额外 CDN 依赖。

### 7.5 为何桌面端不显示辅助栏

桌面端有物理键盘，辅助栏是冗余的。检测方式：`'ontouchstart' in window` + `navigator.maxTouchPoints`。但在有触摸屏的桌面设备（如 Surface）上，虚拟键盘可能弹出，此时 `kh > 100` 作为后备检测。

---

## §8 开放问题

### 8.1 卡片尺寸

- [OPEN-01] **终端卡的默认尺寸是否沿用 240×288？**
  - 240×288 给终端约 36 列 × 10 行（11px 等宽字体），对命令行操作而言偏小
  - 选项 A：沿用默认 240×288，用户可手动拖拽 BR orb 放大
  - 选项 B：终端卡默认尺寸略大（如 260×340 或 280×360）
  - 选项 C：自动检测屏幕宽度，在移动端用较大尺寸
  - 当前偏向：A（保持卡片系统一致性，拖拽放大足够）

### 8.2 工作目录

- [OPEN-02] **终端会话的初始 cwd 是什么？**
  - 选项 A：固定 `$HOME`（项目根）
  - 选项 B：文件树当前选中的目录
  - 当前偏向：A（语义清晰），后续可加 `cd` 命令智能跟随文件树

### 8.3 卡片 accent 颜色

- [OPEN-03] **终端卡用什么 accent 色？**
  - 选项 A：随机（和其他卡片一样，每次开卡堆随机生成）
  - 选项 B：固定绿色（`#50A880`），VISION_AND_ROADMAP 中 card03 预设为绿色
  - 选项 C：使用 `canvas.accent`（`#00d4ff` 青色）
  - 当前偏向：A（保持卡片堆随机五彩效果）

### 8.4 多终端卡与辅助栏的 accent 色

- [OPEN-04] **辅助栏的按键 accent 色跟随哪个终端卡？**
  - 方案：跟随当前 `_activeTerminal` 对应卡片的 `item.accentColor`
  - 切换焦点时，辅助栏按键色自动切换
  - 无焦点终端时辅助栏已隐藏，无需处理

### 8.5 PTY 进程残留

- [OPEN-05] **浏览器崩溃/断网时 PTY 如何清理？**
  - WebSocket `close` 事件触发 `PtyManager.killAll(ws)` — 自动清理
  - 心跳机制（30s ping）检测死连接
  - `node-pty` 进程在父 Node.js 进程退出时由 OS 自动回收
