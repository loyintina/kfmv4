---
status: draft
version: v1.0
last_updated: 2026-06-26
---

# KFM v4 — 03 号终端卡设计规范

> **版本**：v1.1
> **状态**：设计阶段（draft）
>
> 本文档描述 03 号卡片（终端模拟器）的完整设计。
> 核心理念：在浮动卡片内嵌入**自研 Canvas 终端渲染器**（替代 xterm.js），配合 ANSI/VT 解析器，复用项目现有 Canvas 引擎基础设施，通过 WebSocket 桥接到服务端 PTY 进程。实现类似 Termux 的移动端命令行交互体验。
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
│  [03 号浮卡]  terminal-renderer.ts + terminal-card.ts        │
│  ┌─────────────────────────────────┐                         │
│  │ 标题栏: "> 终端 N"          [清屏] │                         │
│  ├─────────────────────────────────┤                         │
│  │                                 │                         │
│  │  Canvas 终端渲染器                │──键盘输入──┐            │
│  │  格子模型 + ANSI 解析 + 光标动画   │           │           │
│  │  DPR 处理 + theme.ts 配色        │←─PTY输出──┤           │
│  │                                 │           │           │
│  └─────────────────────────────────┘           │           │
│                                                 │           │
│  [全局辅助栏]  terminal-aux-bar.ts              │           │
│  ┌─────────────────────────────────┐          │           │
│  │ [ESC][TAB][CTRL][ALT][▲][|][-] │          │           │
│  │ [◀][▼][▶][DEL][   ENTER    ]   │──VT序列─┘           │
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

## §4 客户端：Canvas 终端渲染器

### 4.1 设计策略

**不用 xterm.js**，改用自研 Canvas 2D 渲染器。理由：
- 项目已有完整的 Canvas 2D 引擎基础设施（`fillText` / `measureText` / DPR / `theme.ts`）
- 终端本质是**固定格子字符画布**——不需要 xterm.js 337KB 的全功能 VT 仿真器
- 自研方案约 300 行 TS（≈5KB），零外部依赖，主题天然一致
- 功能可以按需增量添加，每步独立可测

### 4.2 模块拆分

| 文件 | 职责 |
|------|------|
| `src/client/modules/terminal-renderer.ts` (新建) | Canvas 格子模型 + ANSI 解析器 + 光标 + 渲染循环 |
| `src/client/modules/terminal-card.ts` (修改) | CardContentHandler，组装渲染器 + WebSocket 桥接 |

### 4.3 字体测量（步骤 0）

```
ctx.font = '11px monospace';
_cellW = ctx.measureText('A').width;         // ~6.6px
const m = ctx.measureText('Ag');
_cellH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;  // ~16-17px
```

### 4.4 Canvas 格子模型（步骤 1）

在浮卡 `contentEl` 内创建独立的 `<canvas>`：

```
cols = floor(containerW / _cellW)
rows = floor(containerH / _cellH)
_cells: Array<Array<{ char: string; fg: string; bg: string; bold: boolean }>>
```

DPR 处理（参考现有 Renderer 的 `resize()` 模式）：
```
canvas.width = cssW * dpr;
canvas.height = cssH * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

### 4.5 文字渲染（步骤 2）

遍历格子绘制：
- 有 bg 色时先 `fillRect` 画背景
- `ctx.fillStyle = cell.fg`，`ctx.font = '11px monospace'`
- `ctx.fillText(cell.char, col * _cellW, (row + 0.5) * _cellH)`
- 处理 `\n` / `\r` / `\b` 三个基础控制字符

### 4.6 光标动画（步骤 3）

- `_cursorR` / `_cursorC` 追踪当前输入位置
- 渲染时在光标格画半透明色块或字符反色
- `setInterval(() => _cursorOn = !_cursorOn, 530)` 控制闪烁
- 收到任意数据时重置光标可见

### 4.7 ANSI 解析器

#### 4.7.1 SGR 颜色（步骤 4）

状态机扫描字节流：

| 码 | 含义 | 码 | 含义 |
|----|------|----|------|
| 0 | 重置全部属性 | 30-37 | 前景 8 色 |
| 1 | 粗体/亮色 | 40-47 | 背景 8 色 |
| 3 | 斜体 | 90-97 | 前景亮 8 色 |
| 4 | 下划线 | 100-107 | 背景亮 8 色 |

从 Nebula 色板推导 ANSI 16 色：

| 索引 | 颜色 | hex |
|------|------|-----|
| 0 | 黑 | `#1a1a2e` |
| 1 | 红 | `#f07178` |
| 2 | 绿 | `#50a880` |
| 3 | 黄 | `#b4aa50` |
| 4 | 蓝 | `#5088c8` |
| 5 | 品 | `#9650c8` |
| 6 | 青 | `#00d4ff` |
| 7 | 白 | `#e0e0e0` |

亮色 = 标准色变体（8-15）。粗体参数 `1` 自动将前景映射到亮色。

#### 4.7.2 光标控制（步骤 5）

| 序列 | 动作 |
|------|------|
| `\x1b[nA` | 光标上移 n 行 |
| `\x1b[nB` | 光标下移 n 行 |
| `\x1b[nC` | 光标右移 n 列 |
| `\x1b[nD` | 光标左移 n 列 |
| `\x1b[n;mH` | 光标定位到 (n, m)，1-indexed |
| `\x1b[J` | 擦除显示（0=到尾, 2=全屏） |
| `\x1b[K` | 擦除行（0=到尾, 2=整行） |
| `\x1b[s` | 保存光标 |
| `\x1b[u` | 恢复光标 |

#### 4.7.3 256 色（步骤 8，可选）

`\x1b[38;5;Nm` / `\x1b[48;5;Nm` — xterm 标准 256 色调色板。需要时内嵌 256 个 hex 转换表。

### 4.8 卡片 DOM 布局

复用编辑器卡片的 flex column 模式：

```
┌─ wrapper (inset:0, flex column) ───┐
│ ┌─ 标题栏 (flex-shrink:0) ─────────┐ │
│ │  [>] 终端 1               [清屏]  │ │
│ ├─ 分隔线 ─────────────────────────┤ │
│ │                                   │ │
│ │  Canvas 终端画布 (flex:1)          │ │
│ │  <canvas> 元素                    │ │
│ │                                   │ │
│ └───────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4.9 WebSocket 集成（步骤 6）

- `terminal-open` → PTY 返回 sessionId
- 收到 `terminal-output` → `_write(data)` → ANSI 解析 → 更新格子 → 重绘
- 键盘输入 → `onInput(data)` → `wsChannel.sendMessage('terminal-input', ...)`
- 辅助栏按键 → VT 序列 → WebSocket → PTY（直发，不经渲染器）
- 卡片关闭 → `terminal-close` → kill PTY

### 4.10 尺寸自适应（步骤 7）

- `ResizeObserver` 监听 canvas 容器
- 重算 cols/rows，扩缩网格
- PTY 发送 `terminal-resize { cols, rows }`
- shell 进程收到 SIGWINCH 自动适配

### 4.11 清屏按钮

标题栏 [清屏]：重置格子为全空格，或发送 `\x0c` 到 PTY。

### 4.12 卡片注册（card-stack.ts）

```typescript
{ id: 'card03', icon: '>', name: '终端', desc: '' }
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

## §6 增量实施计划

> 每个步骤独立可测。完成后可自行决定下一步继续还是调整方向。
> "依赖"指的是**必须先完成**的步骤。

### 步骤 0：字体测量

| | |
|---|---|
| **目标** | 确定 11px 等宽字的 cellW 和 cellH |
| **做法** | 创建隐藏 canvas → `ctx.font = '11px monospace'` → `measureText('A').width` + boundingBox 高 |
| **产出** | `_cellW` / `_cellH` 常量 |
| **验证** | console.log 打印数值，估算卡片内格子数 |
| **估行** | ~10 |
| **依赖** | 无 |

### 步骤 1：Canvas 挂载 + 格子模型

| | |
|---|---|
| **目标** | 浮卡内容区挂 `<canvas>`，建 cols×rows 网格 |
| **做法** | `contentEl` 内建 `<canvas>`；DPR 处理；`cols = floor(w/cellW)`, `rows = floor(h/cellH)`；`_cells[][]` 初始空格 |
| **产出** | `_cells[row][col]` 可读写 |
| **验证** | 全涂绿色方块确认布局 |
| **估行** | ~40 |
| **依赖** | 步骤 0 |

### 步骤 2：基本文字渲染

| | |
|---|---|
| **目标** | 往格子写字符串能画出来 |
| **做法** | 遍历格子 → `fillRect` 背景 → `fillText` 字符；处理 `\n`、`\r`、`\b`；到达底部自动滚屏 |
| **产出** | `_write('hello\n> ')` 显示 |
| **验证** | `_write('hello\nworld')` 正确渲染两行 |
| **估行** | ~35 |
| **依赖** | 步骤 1 |

### 步骤 3：光标

| | |
|---|---|
| **目标** | 当前输入位的闪烁方块 |
| **做法** | `_cursorR`/`_cursorC` 追踪；渲染时覆盖高亮；`setInterval 530ms` 闪烁 |
| **产出** | 闪烁光标 |
| **验证** | 肉眼确认闪烁节奏 |
| **估行** | ~20 |
| **依赖** | 步骤 2 |

### 步骤 4：ANSI SGR 颜色

| | |
|---|---|
| **目标** | 解释 `\x1b[31m`、`\x1b[0m` 等 |
| **做法** | 状态机：ground → `ESC` → `[` → 参数 → `m` 终结；更新当前 fg/bg/bold 状态；写字符时继承状态写入格子 |
| **产出** | `\x1b[31m红\x1b[0m` 显示红字 |
| **验证** | `echo -e '\e[31mred\e[0m'` 输出正确 |
| **估行** | ~55 |
| **依赖** | 步骤 2 |

### 步骤 5：ANSI 光标控制

| | |
|---|---|
| **目标** | 方向键序列、定位、清屏、保存/恢复光标 |
| **做法** | 追加 CSI 终结符 A/B/C/D/H/J/K/s/u 的处理 |
| **产出** | `clear`、`top` 输出正确 |
| **验证** | `echo -e '\e[5;10HX'` → 第5行第10列出 X |
| **估行** | ~45 |
| **依赖** | 步骤 4 |

### 步骤 6：WebSocket 集成

| | |
|---|---|
| **目标** | 渲染器对接 8.2 已有 PTY 管道 |
| **做法** | `terminal-open` → sessionId；`terminal-output` → `_write(data)`；键盘 → `terminal-input`；关闭 → `terminal-close` |
| **产出** | 敲键盘 → shell 回应 |
| **验证** | 发射终端卡 → 见 zsh prompt → 敲 `ls` → 见文件列表 |
| **估行** | ~35 |
| **依赖** | 步骤 5 + 8.2 服务端 PTY |

### 步骤 7：尺寸自适应

| | |
|---|---|
| **目标** | 卡片 resize → 重算格子 → 通知 PTY |
| **做法** | `ResizeObserver` → 新 cols/rows → 重建网格 → `terminal-resize` |
| **产出** | 拖拽 BR orb 放大 → 行列增加 |
| **验证** | 放大卡片 → `echo $COLUMNS $LINES` 值变化 |
| **估行** | ~25 |
| **依赖** | 步骤 6 |

### 步骤 8（可选）：256 色 + 交替屏幕

| | |
|---|---|
| **目标** | 支持 vim/top/less 等全屏 TUI |
| **做法** | `38;5;Nm` 查表 256 色；`?1049h/l` 交替网格 buffer；`?25h/l` 光标显隐 |
| **产出** | 能跑 vim、top、less |
| **验证** | 打开 vim → 正常显示 → `:q` 退出 → 原内容恢复 |
| **估行** | ~45 |
| **依赖** | 步骤 7 |

### 步骤 9（可选）：滚动缓冲区

| | |
|---|---|
| **目标** | 保留被卷出屏幕的历史行 |
| **做法** | 额外 `_scrollback: CellRow[]` 数组；卷出行 push 进；终端上滑查看历史 |
| **产出** | 上滑回看历史输出 |
| **验证** | 运行 `seq 1 100` → 上滑看到前面的行 |
| **估行** | ~20 |
| **依赖** | 步骤 6 |

---

### 估行汇总

| 步骤 | 内容 | 行数 | 状态 |
|------|------|------|------|
| 0 | 字体测量 | ~10 | ⏳ |
| 1 | Canvas + 格子模型 | ~40 | ⏳ |
| 2 | 文字渲染 + 基础控制符 | ~35 | ⏳ |
| 3 | 光标动画 | ~20 | ⏳ |
| 4 | ANSI SGR 颜色解析 | ~55 | ⏳ |
| 5 | ANSI 光标控制 | ~45 | ⏳ |
| 6 | WebSocket 集成 | ~35 | ⏳ |
| 7 | 尺寸自适应 | ~25 | ⏳ |
| 8 | 256色 + 交替屏幕 | ~45 | ⏳ 可选 |
| 9 | 滚动缓冲区 | ~20 | ⏳ 可选 |
| **合计 MVP (0-7)** | | **~265** | |
| **合计 含可选 (0-9)** | | **~330** | |

> **历史**：原方案（xterm.js）估 ~570 行新代码 + 337KB 外部库。自研方案 MVP 估 ~265 行，零外部依赖。

---

### 增量子步骤依赖图

```
0 ──→ 1 ──→ 2 ──→ 4 ──→ 5 ──→ 6 ──→ 7 ──→ 8 ──→ 9
              ↘        ↗
               3 (光标独立，可随时插入)
```

步骤 3 不依赖 4-9，可在 2 完成后随时插入。步骤 8、9 是独立可选，不阻塞 0-7。

---

## §7 设计决策

### 7.0 为何用自研 Canvas 渲染器而非 xterm.js

| xterm.js | 自研 Canvas（选定） |
|---------|---------------------|
| 337KB ESM 外部依赖 | ~265 行 TS（≈5KB），零依赖 |
| 需动态 import 或捆绑进 bundle | 随代码直接进 bundle，无额外加载 |
| 完整 VT 仿真（大量用不上） | MVP 复用项目 Canvas 引擎，按需增量 |
| 需单独配置色表 | 直接用 `theme.ts` Nebula 色板 |
| CDN `<script>` 不兼容 v5 ESM | 不存在加载问题 |
| 首次使用有加载延迟 | 即时可用 |

项目已有 Canvas 2D 引擎基础设施（`fillText` / `measureText` / DPR 处理 / 主题系统），终端的本质是**固定格子字符画布**，不需要外部全功能 VT 仿真器。

### 7.1 为何辅助栏在浮卡外而非卡内

| 卡内方案 | 卡外方案（选定） |
|---------|----------------|
| 宽度受限（230px 有效宽） | 全屏宽（~390px），更多按键 |
| 始终占用终端视口高度 | 仅键盘弹出时出现，不占终端空间 |
| 需要模式切换概念 | 无模式概念，自然跟随手势 |
| 按钮偏小 | 按钮宽松，容错性好 |

### 7.2 为何辅助栏按键直发 WebSocket 而非经终端渲染器

辅助栏按键是 **VT 控制序列**（方向键、修饰键），逻辑上属于 PTY 层的输入语义。直发 WebSocket → PTY，不经终端渲染器的 ANSI 解析器，路径更短，职责更清晰。渲染器只负责把 PTY 输出画到 Canvas 上。

### 7.3 为何用 node-pty-prebuilt-multiarch 而非 child_process.spawn

- `child_process.spawn` 创建的是**管道**（pipe），不是伪终端
- 管道模式下，被调用进程会认为自己在被重定向，从而关闭交互特性（颜色、光标控制、vim/top 等不可用）
- `node-pty` 创建真正的 PTY，进程以为自己在真实终端中运行
- `prebuilt-multiarch` 版提供预编译二进制，避免 node-gyp 工具链要求

### 7.4 为何桌面端不显示辅助栏

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
