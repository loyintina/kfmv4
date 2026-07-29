# KFM v4（咖啡猫）v8.2.0

> AI 人机交互个人工作台原型，面向移动端浏览器。核心理念：**一切皆卡片**。
>
> 当前版本：**v8.2.0** | 构建管线：**25 个 check-* 脚本 + 452 个回归测试**

## 这是什么

一个完全由 AI 生成的个人工作台。文件浏览、终端、调试面板——都以"卡片"形式在屏幕上浮动，统一的拖拽、展开、缩放、关闭交互。

## 功能

| 功能 | 说明 |
|------|------|
| Canvas 文件树 | 自研渲染引擎，展开/折叠动画 + 字符雨 + 文件行右滑加入临时卡片堆 |
| 终端（xterm.js） | 支持 tmux mouse mode、触控滚动、键盘自动避让、双指缩放 |
| 卡片工作台 | 统一的浮动卡片引擎，拖拽/缩放/编辑模式/四角光球/全屏模式 |
| 模式按钮系统 | copy/move/delete 批量操作，色系联动光标 + 卡片 |
| AI 对话运行时 | 后台挂机持久化（run-manager）+ 重连续读 + WebSocket 真心跳半开检测 + WS 重连三层恢复终端 + content block 协议（Claude/OpenAI 标准）流式思考/工具调用渲染 + 打字机结果动画 + 等待期无厘头提示 + 会话持久化 服务端单写者 + run 重连续读 + Z-Index L8 焦点交互层 |
| 自动化检查管线 | 25 个 check-* 脚本 + 元检查器 + 文档-代码一致性验证 + 域契约新鲜度检查（contract-freshness），构建时零错误，452 个回归测试 |

## 快速开始

```bash
git clone https://github.com/loyintina/kfmv4.git
cd kfmv4
npm install
npm run build
npm run start        # http://localhost:8021
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KFM_ROOT` | `$HOME` | 文件浏览的根路径 |
| `KFM_PORT` | `8021` | 服务端口 |

## 技术栈

TypeScript 7 + Canvas 2D 自研渲染引擎（v2 Box → Renderer）+ GSAP 3.15 + Express 4 + WebSocket + esbuild + xterm.js

## 文档

入口路由在 [`CLAUDE.md`](CLAUDE.md)（会话启动 + 任务→工作流路由表），文档体系在 `docs/` 下：

| 层 | 用途 |
|----|------|
| [`docs/constraints/`](docs/constraints/invariants.md) | 约束层：invariants（宪法+心法）、diagnostics（诊断手册） |
| [`docs/domains/`](docs/domains/ai-chat/contract.md) | 域契约层：7 个子系统的 contract + detail |
| [`docs/guides/`](docs/guides/doc-architecture.md) | 指南层：文档体系设计原理、维护规则、测试、发版等 |
| [`docs/ledger/`](docs/ledger/history.md) | 账本层：history（版本线）、bugs（回归登记） |
| [`docs/workflows/`](docs/workflows/pre-code-gate.yaml) | 工作流层：15 张机械执行卡 |
| [`docs/active/`](docs/active/vision.md) | 活跃层：STACK（工作栈）、vision（远景） |

## 协议

MIT。公开仓库仅用于多台机器间存档，不接收 issue/PR。
