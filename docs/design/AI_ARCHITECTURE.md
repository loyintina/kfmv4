---
title: kfmv4 AI 架构设计
status: draft
created: 2026-07-11
based_on: omp v16.3.11 (oh-my-pi)
---

# kfmv4 AI 架构设计

## 1. 背景与目标

### 1.1 现状

kfmv4 是一个卡片式终端 UI 项目，已有：
- 光球面板（AI 对话入口）
- 卡片系统（终端卡、日志卡等）
- WebSocket 实时通信
- 基础的 AI 对话（通过 proxy 调用 API）

但缺乏：
- 工具调用能力（AI 只能对话，不能操作）
- 结构化输出（thinking/text 分离）
- 会话管理（无历史、无分支）
- 代码智能（无 LSP、无 AST）

### 1.2 目标

借鉴 omp（Oh My Pi）的成熟设计，为 kfmv4 构建完整的 AI 能力：
- 工具调用（bash、read、write、edit、grep、glob）
- 结构化输出（thinking/text 流式分离）
- 会话管理（历史、分支、压缩）
- 代码智能（LSP、AST）
- 调试能力（DAP）
- 多 Agent 协作

### 1.3 设计原则

1. **复用优先**：直接使用 omp 的 npm 包，不重新发明轮子
2. **渐进式**：分阶段实现，每阶段都可用
3. **解耦**：AI 层与 UI 层分离，可独立演进
4. **标准协议**：支持 MCP，可扩展

---

## 2. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器层                              │
├─────────────────────────────────────────────────────────────┤
│  光球面板 (orb.ts)                                           │
│    ├── 对话 UI                                               │
│    ├── 模型选择器                                             │
│    └── 工具结果显示                                           │
│                                                              │
│  卡片系统                                                    │
│    ├── 终端卡 (terminal-card-04.ts)                          │
│    ├── 日志卡                                                │
│    └── 文件卡                                                │
│                                                              │
│  WebSocket 客户端                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        服务端层                              │
├─────────────────────────────────────────────────────────────┤
│  API 层 (index.ts)                                           │
│    ├── POST /api/ai/chat        AI 对话                      │
│    ├── GET  /api/ai/models      模型列表                     │
│    └── POST /api/ai/tools       工具调用                     │
│                                                              │
│  WebSocket 层 (ws-server.ts)                                 │
│    ├── 流式输出                                              │
│    ├── 工具执行状态                                          │
│    └── 终端交互                                              │
│                                                              │
│  AI 层                                                       │
│    ├── AgentSession (会话管理)                               │
│    ├── ToolRegistry (工具注册)                               │
│    ├── PromptBuilder (提示词构建)                            │
│    └── StreamHandler (流式处理)                              │
│                                                              │
│  工具层                                                      │
│    ├── kfmv4 专用工具                                        │
│    │   ├── kfm-snapshot    获取页面状态                      │
│    │   ├── kfm-logs        读取日志                          │
│    │   └── kfm-exec        执行命令                          │
│    │                                                         │
│    └── omp 工具（复用）                                      │
│        ├── bash            命令执行                          │
│        ├── read            文件读取                          │
│        ├── write           文件写入                          │
│        ├── edit            文件编辑                          │
│        ├── grep            内容搜索                          │
│        ├── glob            文件查找                          │
│        └── lsp             代码智能                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        外部依赖                              │
├─────────────────────────────────────────────────────────────┤
│  @oh-my-pi/pi-coding-agent    omp 核心工具                   │
│  @oh-my-pi/hashline           哈希行编辑                     │
│  @oh-my-pi/pi-natives         Rust 原生模块                  │
│  @oh-my-pi/pi-utils           工具函数                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心模块设计

### 3.1 工具层

#### 3.1.1 工具接口

```typescript
interface KfmTool {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute(
    params: unknown,
    ctx: ToolContext,
    onUpdate?: (update: ToolUpdate) => void,
    signal?: AbortSignal
  ): Promise<ToolResult>;
}

interface ToolContext {
  cwd: string;                    // 工作目录
  session: KfmSession;            // 当前会话
  wsServer: WsServer;             // WebSocket 服务
  abortController: AbortController;
}

interface ToolResult {
  content: ContentBlock[];        // 文本/图片内容
  details?: Record<string, unknown>; // 结构化详情
  isError?: boolean;
}

interface ToolUpdate {
  content: ContentBlock[];
  details?: Record<string, unknown>;
}
```

#### 3.1.2 kfmv4 专用工具

**kfm-snapshot** — 获取页面状态

```typescript
const kfmSnapshotTool: KfmTool = {
  name: 'kfm-snapshot',
  description: '获取 kfmv4 页面完整状态（所有卡片、元素、能力）',
  parameters: z.object({}),
  async execute(params, ctx) {
    const snapshot = ctx.wsServer.getLatestSnapshot();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(snapshot, null, 2)
      }]
    };
  }
};
```

**kfm-logs** — 读取日志

```typescript
const kfmLogsTool: KfmTool = {
  name: 'kfm-logs',
  description: '读取指定日志卡的内容',
  parameters: z.object({
    cardId: z.string().optional().describe('日志卡 ID，默认最新'),
    lines: z.number().optional().describe('读取行数，默认 100')
  }),
  async execute(params, ctx) {
    // 通过 WebSocket 获取日志内容
    const logs = await ctx.wsServer.getLogs(params.cardId, params.lines);
    return {
      content: [{
        type: 'text',
        text: logs.join('\n')
      }]
    };
  }
};
```

**kfm-exec** — 执行命令

```typescript
import { executeBash } from '@oh-my-pi/pi-coding-agent/exec/bash-executor';

const kfmExecTool: KfmTool = {
  name: 'kfm-exec',
  description: '在 kfmv4 项目目录执行命令',
  parameters: z.object({
    command: z.string().describe('要执行的命令'),
    timeout: z.number().optional().describe('超时秒数，默认 30'),
    cwd: z.string().optional().describe('工作目录，默认 /root/kfmv4')
  }),
  async execute(params, ctx, onUpdate) {
    const result = await executeBash(params.command, {
      cwd: params.cwd || '/root/kfmv4',
      timeout: (params.timeout || 30) * 1000,
      onUpdate: (chunk) => {
        onUpdate?.({
          content: [{ type: 'text', text: chunk }]
        });
      }
    });
    
    return {
      content: [{
        type: 'text',
        text: result.output || '(no output)'
      }],
      details: {
        exitCode: result.exitCode,
        wallTimeMs: result.totalBytes,
        truncated: result.truncated
      }
    };
  }
};
```

#### 3.1.3 omp 工具复用

```typescript
import { executeBash } from '@oh-my-pi/pi-coding-agent/exec/bash-executor';
import { Patcher, Patch } from '@oh-my-pi/hashline';

// 包装 omp 工具为 kfmv4 工具格式
function wrapOmpTool(ompTool: any): KfmTool {
  return {
    name: ompTool.name,
    description: ompTool.description,
    parameters: ompTool.schema,
    execute: ompTool.execute
  };
}

// 注册所有 omp 工具
export const ompTools = {
  bash: wrapOmpTool(bashTool),
  read: wrapOmpTool(readTool),
  write: wrapOmpTool(writeTool),
  edit: wrapOmpTool(editTool),
  grep: wrapOmpTool(grepTool),
  glob: wrapOmpTool(globTool),
};
```

### 3.2 提示词层

#### 3.2.1 文件结构

```
src/server/prompts/
├── system/
│   ├── system-prompt.md          # 主系统提示词
│   ├── personalities/
│   │   ├── default.md            # 默认人格
│   │   ├── friendly.md           # 友好模式
│   │   └── pragmatic.md          # 务实模式
│   └── project-prompt.md         # 项目上下文
│
├── tools/
│   ├── bash.md                   # bash 工具说明
│   ├── read.md                   # 读取工具说明
│   ├── write.md                  # 写入工具说明
│   ├── edit.md                   # 编辑工具说明
│   ├── kfm-snapshot.md           # kfmv4 专用
│   ├── kfm-logs.md               # kfmv4 专用
│   └── kfm-exec.md               # kfmv4 专用
│
└── skills/
    └── kfmv4-dev.md              # kfmv4 开发技能
```

#### 3.2.2 系统提示词模板

```markdown
<!-- system-prompt.md -->
ROLE
==============
你是一个 kfmv4 项目的 AI 开发助手，运行在 Oh My Pi 编码工具中。

# 工程原则
- 正确性优先，然后是可维护性
- 你有自主权和品味：删除不必要的代码，拒绝不必要的抽象
- 考虑代码编译结果，避免不必要的分配和计算

RUNTIME
==============

# 工具
你必须使用专用工具，而不是 shell：
- 文件读取 → `read`
- 文件编辑 → `edit`
- 搜索 → `grep`
- 文件查找 → `glob`

# kfmv4 专用工具
- `kfm-snapshot`: 获取页面状态
- `kfm-logs`: 读取日志
- `kfm-exec`: 执行命令

TOOL POLICY
==============

# 通用规则
- 使用工具提高正确性、完整性和可靠性
- 必须完成任务才能使用工具
- 应该先解决前置条件再行动
- 空的、部分的或可疑的结果？用不同策略重试

# 探索策略
- 你永远不会打开文件碰运气
- 只加载必要的内容
- 用 grep 定位目标
- 用 glob 映射结构

EXECUTION WORKFLOW
==============

# 1. 范围
- 读取相关技能和规则

# 2. 研究
- 读完整的代码段，不是片段
- 必须重用现有模式
- 修改前先搜索引用

# 3. 分解
- 边做边更新 todo
- 只计划让请求工作的内容

# 4. 实现
- 从源头修复问题
- 删除过时代码
- 从用户角度审查更改

# 5. 验证
- 永远不要在没有证据的情况下交付
- 测试行为、边界、不变量

# 6. 清理
- 变更日志、测试、文档是最后阶段

DELIVERY CONTRACT
==============
- 永远不要在交付物未完成时让步
- 永远不要捏造输出
- 永远不要替代更简单的问题
- 永远不要问工具能回答的问题
```

### 3.3 会话层

#### 3.3.1 会话结构

```typescript
interface KfmSession {
  id: string;
  title: string;
  model: string;
  provider: string;
  messages: KfmMessage[];
  tools: string[];              // 可用工具列表
  createdAt: number;
  updatedAt: number;
}

interface KfmMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  thinking?: string;            // 思考内容
  timestamp: number;
}

interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: ImageSource;
  toolUse?: ToolCall;
  toolResult?: ToolResult;
}
```

#### 3.3.2 会话存储

```typescript
// 使用 SQLite 存储会话
// 类似 omp 的 JSONL，但用数据库
interface SessionStore {
  create(session: KfmSession): Promise<void>;
  get(id: string): Promise<KfmSession | null>;
  update(id: string, updates: Partial<KfmSession>): Promise<void>;
  delete(id: string): Promise<void>;
  list(limit?: number): Promise<KfmSession[]>;
  
  // 消息操作
  addMessage(sessionId: string, message: KfmMessage): Promise<void>;
  getMessages(sessionId: string, limit?: number): Promise<KfmMessage[]>;
}
```

### 3.4 AI 调用层

#### 3.4.1 统一接口

```typescript
import { Agent } from '@oh-my-pi/pi-agent-core';

export class KfmAI {
  private agent: Agent;
  private tools: Map<string, KfmTool>;
  
  constructor(options: KfmAIOptions) {
    this.tools = new Map();
    this.registerTools();
    
    this.agent = new Agent({
      model: options.model,
      provider: options.provider,
      tools: this.getToolDefinitions(),
      systemPrompt: this.buildSystemPrompt(),
    });
  }
  
  // 注册工具
  registerTool(tool: KfmTool) {
    this.tools.set(tool.name, tool);
  }
  
  // 流式对话
  async *stream(
    session: KfmSession,
    userMessage: string
  ): AsyncGenerator<StreamEvent> {
    // 添加用户消息
    session.messages.push({
      id: generateId(),
      role: 'user',
      content: [{ type: 'text', text: userMessage }],
      timestamp: Date.now()
    });
    
    // 流式调用
    const stream = this.agent.stream(session.messages);
    
    for await (const event of stream) {
      yield event;
      
      // 处理工具调用
      if (event.type === 'tool_call') {
        const tool = this.tools.get(event.toolName);
        if (tool) {
          const result = await tool.execute(
            event.params,
            this.createToolContext(session),
            (update) => this.emitToolUpdate(event.id, update),
            event.signal
          );
          yield { type: 'tool_result', id: event.id, result };
        }
      }
    }
  }
}
```

#### 3.4.2 流式事件

```typescript
type StreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; toolName: string; params: unknown }
  | { type: 'tool_result'; id: string; result: ToolResult }
  | { type: 'tool_update'; id: string; update: ToolUpdate }
  | { type: 'error'; error: string }
  | { type: 'done' };
```

---

## 4. API 设计

### 4.1 HTTP API

```
POST /api/ai/chat
  请求: { sessionId, message, model?, provider? }
  响应: SSE 流 (StreamEvent)

GET /api/ai/models
  响应: { models: Model[] }

GET /api/ai/sessions
  响应: { sessions: Session[] }

POST /api/ai/sessions
  请求: { title?, model?, provider? }
  响应: { session: Session }
```

### 4.2 WebSocket 事件

```
→ ai.chat         发送消息
← ai.thinking     思考中
← ai.text         文本输出
← ai.tool_call    工具调用
← ai.tool_result  工具结果
← ai.tool_update  工具进度
← ai.error        错误
← ai.done         完成
```

---

## 5. 实现路线图

### 阶段 1：基础工具 + 提示词系统（2-3 天）

**目标**：AI 能调用基础工具，提示词可配置

- [x] 封装 kfmv4 专用工具（kfm-snapshot, kfm-logs, kfm-exec）
- [x] 实现基础工具注册
- [x] 实现单次工具调用（关键词匹配）
- [ ] Agent 卡：提示词组装 + 文件选择
- [ ] 从 omp 复制提示词文件
- [ ] 系统提示词从文件加载（非硬编码）

**交付物**：
- `src/server/ai/tools/`（已完成）
- `src/server/prompts/`
- agent-card.ts（规划中，尚未创建；当前 Agent 配置由 `config.card.ts` 承担）
- `.kfmv4/configs/`（Agent 配置存储，由 config.card.ts 管理）

#### Agent 卡设计

Agent 卡负责组装系统提示词：从整个文件树中选择 `.md` 文件，按顺序拼接。

**核心理念**：整个项目文件树就是提示词池。不需要专用的提示词文件夹。

**UI 设计**（类似 API 卡）：

```
┌─────────────────────────────────────┐
│  🤖 Agent 池                        │
├─────────────────────────────────────┤
│  Agent: [代码助手 ▼]                 │
│  ┌─────────────────────────────────┐│
│  │ 名称: [kfmv4 开发助手        ]  ││
│  └─────────────────────────────────┘│
│  ─────────────────────────────────  │
│  系统提示词拼接                      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │INV..│→│HAND│→│CARD│→│base│      │
│  │ARIA.│ │BOOK│ │DEV │ │.md │      │
│  │.md  │ │.md │ │GUI.│ │     │      │
│  └────┘ └────┘ └────┘ └────┘      │
│  [+ 添加文件]                        │
│  ─────────────────────────────────  │
│  预览: 6k tokens                     │
│  [保存]  [新建]                      │
│  ─────────────────────────────────  │
│  Agent 池                            │
│  ┌─────────────────────────────────┐│
│  │ ▎代码助手 · 6k tokens           ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Agent 配置存储**（`.kfmv4/agents/` 目录下）：

```json
{
  "id": "code-assistant",
  "name": "代码助手",
  "providerId": "opencode-go",
  "modelId": "deepseek-v4-flash",
  "files": [
    "docs/KFM_V4_INVARIANTS.md",
    "docs/HANDBOOK.md",
    "docs/development/CARD_DEV_GUIDE.md",
    "src/server/prompts/base.md"
  ],
  "createdAt": "2026-07-11T10:00:00Z",
  "updatedAt": "2026-07-11T10:30:00Z"
}
```

**文件选择机制**：复用文件树的右滑多选

```
Agent 卡"添加文件"按钮
    ↓
进入"prompt 选择"模式
    ↓
文件树右滑选中 .md 文件 → 临时卡片堆
    ↓
[✓] [✗]   ← 简化工具栏
    ↓
✓ → 从 _tempCardEls.map(e => e.dataset._path) 取路径
    → 返回 Agent 卡
✗ → dismissAllCards()
```

**实现要点**：
- 在 tree-swipe.ts 新增 `selectFilesForPrompt(callback)` 函数
- 复用 `handleRowSwipe()` 创建卡片机制
- 工具栏简化为只有 ✓ ✗（无 copy/move/delete 模式按钮）
- 回调返回选中的文件路径数组

**系统提示词组装**（服务端 `buildSystemPrompt()` 改造）：

```typescript
// 从 Agent 配置加载文件列表，按顺序拼接
function buildSystemPrompt(agent: AgentConfig): string {
  const parts = agent.files.map(filePath => {
    return readFileSync(join(ROOT_DIR, filePath), 'utf-8');
  });
  return parts.join('

');
}
```

### 阶段 2：流式对话（2-3 天）

**目标**：AI 能流式输出

- [ ] 实现 SSE 流式输出
- [ ] 实现 thinking/text 分离
- [ ] 实现工具调用流式更新
- [ ] 集成到现有 orb 面板

**交付物**：
- 流式输出模块
- 更新 `src/client/modules/orb.ts`

### 阶段 3：会话管理（2-3 天）

**目标**：支持多会话

- [ ] 实现会话存储（SQLite）
- [ ] 实现会话列表
- [ ] 实现会话切换
- [ ] 实现历史消息加载

**交付物**：
- 会话管理模块
- 会话存储模块

### 阶段 4：高级工具（3-5 天）

**目标**：完整工具能力

- [ ] 注册所有 omp 工具
- [ ] 实现工具审批机制
- [ ] 实现 LSP 集成
- [ ] 实现 Hashline 编辑

**交付物**：
- `src/server/ai/tools/` 完整工具集

### 阶段 5：多 Agent（5-7 天）

**目标**：多 Agent 协作

- [ ] 实现 Task 工具（子 Agent）
- [ ] 实现 IRC 通信
- [ ] 实现并行执行
- [ ] 实现 MCP 服务器

**交付物**：
- 任务委派模块
- MCP 服务器模块

---

## 6. 依赖关系

```json
{
  "dependencies": {
    "@oh-my-pi/pi-coding-agent": "^16.4.2",
    "@oh-my-pi/hashline": "^16.4.2",
    "@oh-my-pi/pi-utils": "^16.4.2",
    "@oh-my-pi/pi-natives": "^16.4.2",
    "zod": "^3.22.0"
  }
}
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| omp 包更新破坏兼容 | 高 | 锁定版本，定期测试 |
| Bun 依赖问题 | 中 | 关键逻辑用 Node.js 重写 |
| 性能问题 | 中 | 使用 pi-natives 原生模块 |
| 提示词效果不佳 | 中 | 迭代优化，A/B 测试 |

---

## 8. 参考资料

- omp 源码: https://github.com/can1357/oh-my-pi
- omp 文档: /tmp/oh-my-pi/docs/
- 工具实现: /tmp/oh-my-pi/packages/coding-agent/src/tools/
- 提示词模板: /tmp/oh-my-pi/packages/coding-agent/src/prompts/
