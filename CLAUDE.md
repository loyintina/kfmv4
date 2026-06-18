# KFM v4 (Kaf Fee Mew / 咖啡猫)

AI 人机交互个人工作台，面向移动端浏览器。核心理念：**一切皆盒子**。

> ⏱ **TL;DR**：这是 AI 生成的个人工作台原型，Canvas 自研渲染引擎。
> **改代码前先读** `docs/KFM_V4_INVARIANTS.md`（修改约束协议）。
> **日常干活翻** `docs/HANDBOOK.md`（架构+调试+待办+测试）。
> **规划设计时参考** `docs/design/VISION_AND_ROADMAP.md`（远景）。
> **做浮卡相关改动先读** `docs/archive/design/CARD_SYSTEM_UNIFICATION_SPEC.md`（已归档：统一化方案失败，当前为双模块架构）。
> **UI Registry 相关**已归档到 `docs/archive/design/`。
> **引擎层改动先读** `docs/archive/design/ENGINE_ARCHITECTURE.md`（v2 管线 + text-layout 排版引擎架构）。

---

## 技术栈

- TypeScript 6 (ES2022) + Express 4 服务端
- Canvas 2D 自研渲染引擎（v2 Box → Renderer）
- SCSS 编译（sass → CSS，语法校验 + 构建时编译）
- GSAP 3.15 动画（通过 `animation-registry.ts` 隔离调用）
- esbuild 构建（`tsc --noEmit` → esbuild bundle）
- `@chenglou/pretext` 文本测量
- `ws` WebSocket 双向通道

## 构建与运行

```bash
npm run check    # sass → 8 个 check-*.mjs → tsc --noEmit（必须零错误通过）
npm run build    # check 通过后 esbuild 打包
npm run start    # 启动 http://localhost:8021
npm run dev      # ts-node ESM 直接运行
```

## 文档体系

```
CLAUDE.md                    # 本文件——项目入口
docs/
├── AGENTS.md                # AI 专属：文档维护规则（改文档前读）
├── HANDBOOK.md              # 工作手册：架构-调试-待办-测试（日常翻）
├── KFM_V4_INVARIANTS.md     # 修改约束协议：心法原则+自查清单（改代码前必读）
├── design/                  # 设计中（待实现的设计文档）
│   ├── VISION_AND_ROADMAP.md    # 远景：核心理念 + 演进路线
│   ├── WORKBENCH_SPEC.md        # 卡片工作台（购物车+顶栏+光标+编辑态）
│   └── WORKBENCH_PHASE7.md      # Phase 7：长按抽屉栏（设计中）
└── archive/                 # 历史归档
    ├── README.md            # 子目录导览
    ├── handoffs/            # 版本交接记录
    ├── design/              # 已完成的设计文档（Registry/卡片系统/引擎/愿景）
    ├── standards/           # 调试/Bug/测试规范
    ├── audits/              # 已完成的审计记录/修复
    ├── bugs/                # 已修复 Bug
    └── legacy/              # 旧版本文件
```

> 接手新对话的推荐阅读顺序：`CLAUDE.md` → `HANDBOOK.md` §2（当前状态）→ `KFM_V4_INVARIANTS.md`（修改规则）→ `docs/design/WORKBENCH_SPEC.md`（当前方向）→ `HANDBOOK.md` §3（待办）→ `HANDBOOK.md` §七（审计问题清单）→ `docs/archive/audits/v6.8-code-quality/AUDIT_TRACKER.md`（已完成审计记录）。引擎层改动前读 `docs/archive/design/ENGINE_ARCHITECTURE.md`。

## 完整性校验

```bash
npm run check   # sass + 4 个 check-*.mjs + tsc --noEmit，零错误
npm run test    # 159 个回归测试，覆盖 23 个模块
```

## 当前架构

光球（orb.ts）和浮卡（floating-card.ts）是两个独立模块，各管各的：
- `orb.ts`：光球 + AI 对话面板，从 HTML 读取 `#lightOrb` 元素
- `floating-card.ts`：浮卡发射/拖拽/缩放/编辑，仅服务 02 日志卡

两模块通过交互共享层（`interaction-constants.ts` + `drag-handler.ts`）共享常量和类型。统一化方案已放弃（两次回退），详见 `docs/archive/design/CARD_SYSTEM_UNIFICATION_SPEC.md`。浮卡拖拽完全通过 GestureRegistry 统一调度，无直接 addEventListener 逃逸。

完整模块清单见 HANDBOOK §七「客户端模块完整审计表」（33个模块 + 引擎层14个文件）。

## 注意事项
- **Canvas 初始化**: `clientWidth=0`，需在 rAF 回调里 `rebuildTree()`
- **事件冒泡**: 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
- **全项目统一使用 PointerEvent** — 禁止 `addEventListener('touchstart/pointermove/pointerup')`，都走 `gesture-registry.ts`
- **Git 推送认证**：项目根目录 `.env` 文件中配置了 `GITHUB_TOKEN` 环境变量（已 `.gitignore` 保护）。执行 `git push` 前先 `source .env` 或将该 token 加入 git credential。该 token 用于 agent 远程推送代码，不可删除。

> 历史修复记录（v4.0.0 前）已清理。如需追溯：`git log --oneline v4.0.0..HEAD`
