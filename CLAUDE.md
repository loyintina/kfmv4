# KFM v4 (Kaf Fee Mew / 咖啡猫)


> ⚠️ **改动后立即 `git add -A && git commit`。** 未提交的改动没有安全网。
> `git checkout -- <file>` 会永久回退该文件到上一次 commit——无法从 bundle 恢复。
> 历史：2026-07-05 浮卡全天工作丢失；2026-07-14 orb.ts ~200 行 AI 集成丢失。
> 违反此规则的 agent 需重做全部丢失工作。见 INVARIANTS 心法 14。

> **改代码前先读** `docs/KFM_V4_INVARIANTS.md`（修改约束协议）。
> **日常干活翻** `docs/HANDBOOK.md`（架构+调试+待办+测试）。
> **规划设计时参考** `docs/design/VISION_AND_ROADMAP.md`（远景）。
> **做带文档的大改动前先读** `docs/development/SPEC_DRIVEN_WORKFLOW.md`（设计→分阶段执行→追加约束→判断归档的元工作流）。
> **做浮卡相关改动先读** `docs/archive/design/CARD_SYSTEM_UNIFICATION_SPEC.md`（已归档：统一化方案失败，当前为 card-registry 数据层 + card-stack/floating-card UI 层）。
> **加新卡片前先读** `docs/development/CARD_DEV_GUIDE.md`（卡片插件开发指南）。
> **改 AI 对话流式/挂机/WS 重连/终端恢复先读** `docs/design/AI_CHAT_RUNTIME.md`（后台挂机运行时架构 + 跨 10 文件的隐式时序契约）。
> **改代码/修 bug 前先读回归纪律** `docs/BUG_REGRESSION_REGISTRY.md` + INVARIANTS 心法 24（修 bug 补钉子+登记+revert 验证；测试分层见 `docs/archive/design/REGRESSION_TESTING_SYSTEM.md`）。
> **设计讨论定稿后必跑沉淀五问**（INVARIANTS §七 步骤 7）：特性不算 done，直到五问被问过——被推翻的初版方案入契约错误示例，可泛化规则提名心法/宪法候选。
> **UI Registry 相关**已归档到 `docs/archive/design/`。
> **引擎层改动先读** `docs/archive/design/ENGINE_ARCHITECTURE.md`（v2 管线 + text-layout 排版引擎架构）。

---

## 技术栈

- **源码语言**：TypeScript（非 JavaScript）— 所有 `.ts` 文件由 tsc 编译
- **样式语言**：SCSS（非 CSS）— `sass base.scss → base.css`，直接改 `.css` 会被覆盖
- Canvas 2D 自研渲染引擎（v2 Box → Renderer）
- GSAP 3.15 动画（通过 `animation-registry.ts` 隔离调用）
- esbuild 构建（`tsc --noEmit` → esbuild bundle）
- `@chenglou/pretext` 文本测量
- `ws` WebSocket 双向通道

## 构建与运行

```bash
npm run dev      # 全链路（check → esbuild client+server → smoke → 启动）
npm run bundle   # 同 build.mjs（全链路，零快捷方式）
npm run watch    # 全链路通过后 → 持续监听、快速重编（开发时一直开着）
npm run check    # 20 个 check-*.mjs + tsc --noEmit（仅检查，不构建）
npm run build    # 同 bundle（全链路）
npm run start    # 启动生产构建 http://localhost:8021
npm run test     # 440 个回归测试
```

> **没有快捷方式**。`bundle`/`build`/`dev` 全部走 `build.mjs` 全链路。`watch` 初检不过不进 watch。
> 日常：终端 1 `npm run dev`，终端 2 `npm run watch`。改源码 → 自动重编 → 刷新。
## 文档体系

```
CLAUDE.md                    # 本文件——项目入口
docs/
├── AGENTS.md                # AI 专属：文档维护规则（改文档前读）
├── AGENT_PROMPT_REFERENCES.md # Agent 提示词设计参考资料
├── HANDBOOK.md              # 工作手册：架构-状态-待办（日常翻）
├── development/             # 开发指南
│   ├── CARD_DEV_GUIDE.md    # 卡片插件开发指南（加新卡前读）
│   └── SPEC_DRIVEN_WORKFLOW.md # 规范驱动工作流：怎么做带文档的大改动（大改动前读）
├── KFM_V4_INVARIANTS.md     # 修改约束协议：宪法+心法原则+自查清单（改代码前必读）
├── DIAGNOSTICS.md           # 诊断手册：隐性契约 + 排查流程 + 根因案例库（遇到 bug 先翻）
├── BUG_REGRESSION_REGISTRY.md # Bug 回归登记表：687 fix 蒸馏成「该不该测/测了没」追踪表
├── V8_AUDIT_REPORT.md         # v8 全量审计报告（代码架构 + 文档同步性 + 技术债）
├── design/                  # 设计文档
│   ├── AI_ARCHITECTURE.md          # AI 架构设计（基于 omp）
│   ├── AI_CHAT_RUNTIME.md          # AI 对话运行时：后台挂机/重连/WS存活（改流式对话前必读）
│   ├── AI_AGENT_DEBUG_TOOLS.md     # AI Agent 调试能力体系（能力矩阵 + 缺位分析 + 路线图）
│   ├── V8_ARCHITECTURE.md          # v8 所有权分离架构（三条宪法 + 视觉契约 + 迁移计划）
│   ├── VISION_AND_ROADMAP.md        # 远景：核心理念 + 演进路线（方向性，保留）
│   ├── CONTEXT_ASSEMBLY_SPEC.md     # 上下文拼接与 AI 工作空间（draft）
│   └── TOOL_IO_COMPACTION.md        # 工具 I/O 上下文压缩契约（与 AI_CHAT_RUNTIME 同级）
└── archive/                 # 历史归档
    ├── README.md            # 子目录导览
    ├── handoffs/            # 版本交接记录
    ├── design/              # 已完成/过时的设计文档
    │   ├── BOX_LOCATION_MAP_SPEC.md     # Box 位置映射 ✅
    │   ├── CARD_REGISTRY_SPEC.md        # 卡片注册表 ✅
    │   ├── ENGINE_ARCHITECTURE.md       # 引擎层架构 ✅
    │   ├── TEST_INFRASTRUCTURE_SPEC.md  # 测试基础设施 ✅
    │   ├── REGRESSION_TESTING_SYSTEM.md # 回归测试体系建设（8 阶段，方法论）✅
    │   ├── TERMINAL_CARD_SPEC.md        # 终端卡 ✅
    │   ├── FULLSCREEN_CARD_SPEC.md      # 全屏卡片 ✅
    │   ├── GESTURE_ARCHITECTURE_SPEC.md # 手势架构 ✅
    │   ├── WORKBENCH_SPEC.md            # 卡片工作台 ✅
    │   └── UI_ELEMENT_REGISTRY_SPEC.md  # UI 元素注册表 ✅
    ├── audits/              # 已完成的审计记录/修复
    ├── bugs/                # 已修复 Bug
    └── legacy/              # 旧版本文件

> 接手新对话的推荐阅读顺序：`CLAUDE.md` → `HANDBOOK.md` §2（当前状态）→ `KFM_V4_INVARIANTS.md`（修改规则）→ `docs/development/CARD_DEV_GUIDE.md`（卡片插件开发）→ `DIAGNOSTICS.md` §1-2（隐性契约+诊断流程，遇到 bug 先翻）→ `HANDBOOK.md` §3（待办）→ `HANDBOOK.md` §七（审计问题清单）。全量约束速查见 `docs/KFM_V4_INVARIANTS.md`。引擎层设计见 `docs/archive/design/ENGINE_ARCHITECTURE.md`。卡片工作台设计见 `docs/archive/design/WORKBENCH_SPEC.md`。

## 完整性校验

```bash
npm run check   # sass + 20 个 check-*.mjs + tsc --noEmit，零错误
npm run build   # check 全过 → esbuild client+server → smoke test
npm run test    # 440 个回归测试，覆盖 23 个模块
```

卡片系统是三层结构：
```
cards/plugins/*.card.ts          ← 卡片定义（registerCardType 自注册）
        ↓
card-registry.ts                 ← 统一注册表（类型 + 实例 + 生命周期）
   ↙              ↘
card-stack.ts          floating-card.ts
（堆叠抽屉 UI）        （浮卡拖拽 UI）
```

- **card-registry.ts**: 数据层。所有卡片类型在此注册，card-stack 和 floating-card 通过 `getAllCardTypes()` 动态读取。
- **card-stack.ts**: UI 层。右侧边缘左滑唤出的堆叠抽屉，按注册顺序展示 `kind:'tool'` 卡片。
- **floating-card.ts**: UI 层。单张卡片浮卡发射/拖拽/缩放/全屏，已拆为 floating-card + floating-shared + floating-fullscreen。

orb.ts 和 floating-card.ts 通过交互共享层共享常量。统一化方案已放弃（两次回退），详见 `docs/decisions/adr-001-orb-floating-card-independent.md`。

## 注意事项
- **Canvas 初始化**: `clientWidth=0`，需在 rAF 回调里 `rebuildTree()`
- **事件冒泡**: 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
- **全项目统一使用 PointerEvent** — 禁止 `addEventListener('touchstart/pointermove/pointerup')`，都走 `gesture-registry.ts`
- **touch-action: none** — 所有自定义 Canvas 控件必须显式设置，否则浏览器接管触控导致 `pointercancel` 截断手势
- **数据目录**：运行时配置/会话/角色数据存储在 `$HOME/.kfmv4/`（由 `src/server/path-utils.ts` 的 `KFM_DATA_DIR` 定义）。
  客户端通过 `/api/files/*` 端点以相对路径 `.kfmv4/...` 访问，服务端 `sanitizePath()` 解析到 `SAFE_ROOT` 下。
  原项目根目录下的 `.kfmv4/` 已废弃删除。
- **Git 推送认证**：项目根目录 `.env` 文件中配置了 `GITHUB_TOKEN` 环境变量（已 `.gitignore` 保护）。执行 `git push` 前先 `source .env` 或将该 token 加入 git credential。该 token 用于 agent 远程推送代码，不可删除。
- **代码注释约定**：设计决策写在所改动代码文件的头部注释块中，而非独立文档。
  关键分支处必写"为什么走A不走B"。改到哪个文件注释就更新到哪个文件。详见 `docs/KFM_V4_INVARIANTS.md` §九（设计注释规约）。
> 更多隐性契约见 `docs/DIAGNOSTICS.md` §一。

> 历史修复记录（v4.0.0 前）已清理。如需追溯：`git log --oneline v4.0.0..HEAD`
>
