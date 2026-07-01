# KFM v4（咖啡猫）

> AI 人机交互个人工作台原型，面向移动端浏览器。核心理念：**一切皆卡片**。

## 这是什么

一个完全由 AI 生成的个人工作台。文件浏览、终端、调试面板——都以"卡片"形式在屏幕上浮动，统一的拖拽、展开、缩放、关闭交互。

## 功能

| 功能 | 说明 |
|------|------|
| Canvas 文件树 | 自研渲染引擎，展开/折叠动画 + 字符雨 + 文件行右滑加入临时卡片堆 |
| 终端（xterm.js） | 支持 tmux mouse mode、触控滚动、键盘自动避让 |
| 卡片工作台 | 统一的浮动卡片引擎，拖拽/缩放/编辑模式/四角光球 |
| 模式按钮系统 | copy/move/delete 批量操作，色系联动光标 + 卡片 |
| 光标液体粒子 | GSAP 驱动的玻璃管传送门粒子效果 |
| 调试面板 | 独立浮卡，实时日志显示 |
| 自动化检查管线 | 10 个 check-* 脚本，构建时零错误，159 个回归测试 |

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

TypeScript 6 + Canvas 2D 自研渲染引擎 + GSAP 3.15 + Express 4 + WebSocket + esbuild

## 文档

详见 `docs/` 目录：

| 文档 | 用途 |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | 项目入口，文档导航 |
| [`docs/HANDBOOK.md`](docs/HANDBOOK.md) | 架构 + 调试 + 待办 |
| [`docs/KFM_V4_INVARIANTS.md`](docs/KFM_V4_INVARIANTS.md) | 修改约束协议 |
| [`docs/design/VISION_AND_ROADMAP.md`](docs/design/VISION_AND_ROADMAP.md) | 远景 + 路线图 |

## 协议

MIT。公开仓库仅用于多台机器间存档，不接收 issue/PR。
