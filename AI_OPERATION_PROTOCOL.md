# AI 操作协议 — AI 操作项目自身的能力

> 让 AI 通过对话界面直接操作 kfmv4 项目：读/写文件、执行命令、自我修改。

---

## 架构

```
光球面板 (orb.ts) ─→ submit → POST /api/ai/exec ─→ 服务端
  ↕ AI 对话                     │                   │
  ↕ 用户输入                    │              ┌────▼────┐
                                │              │ AI API  │
                                │              │ (MiniMax│
                                │              │  /其他) │
                                │              └────┬────┘
                                │                   │
                           ┌────▼───────────────────▼──┐
                           │  AI 返回结构化指令数组      │
                           │                            │
                           │  [                          │
                           │    { "op": "readFile",     │
                           │      "path": "..." },      │
                           │    { "op": "writeFile",    │
                           │      "path": "...",        │
                           │      "content": "..." },   │
                           │    { "op": "exec",         │
                           │      "cmd": "npm build" }  │
                           │  ]                         │
                           └───────────┬────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   逐条执行       │
                              │   ✅/❌ → 结果  │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │  返回给 AI 做    │
                              │  下一步决策      │
                              └─────────────────┘
```

---

## AI 指令集

AI 返回一个 JSON 数组，每条是一步操作：

### readFile — 读取文件内容

```json
{ "op": "readFile", "path": "/root/kfmv4/src/server/index.ts" }
```

### writeFile — 写入文件（覆盖）

```json
{ "op": "writeFile", "path": "/root/kfmv4/src/server/index.ts", "content": "..." }
```

### createFile — 创建新文件

```json
{ "op": "createFile", "path": "/root/kfmv4/src/server/new-module.ts", "content": "..." }
```

### deleteFile — 删除文件/目录

```json
{ "op": "deleteFile", "path": "/root/kfmv4/src/server/old.ts" }
```

### renameFile — 重命名

```json
{ "op": "renameFile", "from": "/root/kfmv4/a.ts", "to": "/root/kfmv4/b.ts" }
```

### listDir — 列出目录

```json
{ "op": "listDir", "path": "/root/kfmv4/src/" }
```

### exec — 执行 shell 命令

```json
{ "op": "exec", "cmd": "cd /root/kfmv4 && npm run build", "timeoutMs": 30000 }
```

### think — AI 内部思考（不执行操作）

```json
{ "op": "think", "thought": "分析一下需要改什么..." }
```

### respond — 结束，向用户输出最终结果

```json
{ "op": "respond", "message": "已修改完毕，构建通过。" }
```

---

## 会话流程

```
用户: "把侧栏背景改成紫色"

  → POST /api/ai/exec { messages: [...], context: {...} }

服务端收到后:
  1. 收集系统上下文（文件树、server API、协议文档）
  2. 调用 AI API
  3. AI 返回指令序列

AI 返回示例:
[
  { "op": "readFile", "path": "/root/kfmv4/public/css/sidebar.css" },
  { "op": "think", "thought": "找到了sidebar.css，需要改background..." },
  { "op": "writeFile", "path": "/root/kfmv4/public/css/sidebar.css",
    "content": "..." },
  { "op": "exec", "cmd": "cd /root/kfmv4 && npm run build" },
  { "op": "respond", "message": "侧栏背景已改为紫色，构建通过。" }
]

服务端逐条执行 → 结果逐条返回给 AI API → AI 生成下一条

最终 respond 后 → 返回给前端显示 + 刷新 UI
```

---

## 执行规则

1. **单轮内指令串行执行**，前一条结果可影响下一条（AI 看到执行结果后决策）
2. **writeFile 先 readFile** — AI 需先读取再改写完整内容
3. **exec 默认安全** — 限制在项目目录内，禁止破坏性命令
4. **失败自动重试** — 构建失败时 AI 可读日志、修 bug、重试

---

## 服务端 API

`POST /api/ai/exec`

```json
// 请求
{
  "messages": [
    { "role": "user", "content": "把侧栏改成紫色" }
  ],
  "projectPath": "/root/kfmv4"
}

// 响应
{
  "success": true,
  "response": "侧栏背景已改为紫色，构建通过。",
  "steps": [
    { "op": "readFile", "status": "ok" },
    { "op": "writeFile", "status": "ok" },
    { "op": "exec", "status": "ok", "output": "Build OK" }
  ]
}
```

---

## 实现计划

### 第一步：服务端 — `/api/ai/exec` 路由

- 新建 `src/server/ai-exec.ts`
- 接收 `{ messages, projectPath }`
- 收集系统上下文（项目结构、文件内容索引）
- 调用 MiniMax API（或其他 AI）
- 解析 AI 返回的指令 → 执行 → 返回结果

### 第二步：前端 — 接入光球面板

- 修改 `orb.ts`，让 AI 对话走 `/api/ai/exec`
- 显示 AI 思维过程（正在读什么、改什么）
- 显示执行结果

### 第三步：AI 提示词

- 给 AI 项目上下文（src 结构、API 说明、代码风格）
- 给 AI 操作协议文档
- AI 通过 `readFile` 自取代码细节
