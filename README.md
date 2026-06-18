# KFM v4

一个拿来研究 **Vibe Coding** 能走多远的玩具项目。

## 这是什么

> 一切都从"AI 能不能替人写一个完整的文件管理器"这个随意的想法开始。经过无数次 agent 交接与架构重来，它长成了现在这个样子——
>
> 一个能动的、勉强可用的、完全由 AI 生成的个人工作台原型。

它不是生产工具。它是我用来理解 AI 编程能力边界的一个实验样本。

## 功能

| 功能 | 说明 |
|------|------|
| 文件树浏览 | Canvas 自研渲染引擎，支持展开/折叠动画 + 字符雨 + 文件行右滑加入临时卡片堆 + 行变暗效果 |
| 堆叠卡片面板 | 右边缘左滑唤出，垂直滑动切换焦点，左滑发射浮卡 |
| 临时卡片堆 | 文件树右滑→卡片堆叠→✓ 投放散落为浮卡 / ✗ 一键撤销 |
| 模式按钮系统 | copy/move/delete 三种批量操作模式，色系联动光标 + 卡片颜色 + 渐变按钮 |
| 浮卡系统 | 统一的浮动卡片引擎，支持拖拽/缩放/编辑模式/四角光球 |
| AI 对话面板 | 以浮卡形式存在，可展开对话、编辑缩放、输入法避让 |
| 光标液体粒子 | GSAP 驱动的玻璃管传送门粒子效果，沿光标上线→竖线→下线循环流动 |
| 自动化检查管线 | 10 个 check-* 脚本（版本号/tag/anim/as-any/Registry/console/文档/行数/一致性），构建时零错误 |
| 调试面板 | 独立浮卡，实时日志显示 |

## 快速开始

```bash
# 克隆
git clone https://github.com/loyintina/kfmv4.git
cd kfmv4

# 安装
npm install

# 构建
npm run build

# 启动（默认监听 http://localhost:8021）
npm run start
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KFM_ROOT` | `$HOME` | 文件浏览的根路径 |
| `KFM_PORT` | `8021` | 服务端口 |

## 技术栈

- TypeScript 6 + ES2022
- Canvas 2D 自研渲染引擎（Box → Renderer v2）
- GSAP 3.15 动画（通过 `animation-registry.ts` 隔离）
- Express 4 服务端 + `ws` WebSocket 双向通道
- esbuild 构建 + sass SCSS 编译
- `@chenglou/pretext` 零 reflow 文本测量
- 10 个自动化 check 脚本挂入 `npm run check`（版本号/动画/类型安全/Registry/console/文档等）

## 项目结构

```
src/
├── server/          Express + WebSocket + 能力执行引擎
├── client/
│   ├── engine/      Box 渲染引擎 + text-layout
│   └── modules/     32 个模块（状态、手势、动画、Registry、UI 等）
tests/               159 个回归测试
docs/                设计文档 + 审计体系
```

## 协议

MIT

## 说明

- 公开仓库仅用于多台机器间拉取存档，不接收 issue/PR
- 代码质量不保证，架构随时可能推翻重来
- 如果你不小心跑起来了，别期待它能做任何正经事
