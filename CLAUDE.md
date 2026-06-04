# KFM v4 (Kaf Fee Mew / 咖啡猫)

AI 人机交互个人工作台，面向移动端浏览器。核心理念：**一切皆盒子**。

> ⏱ **TL;DR**：这是 AI 生成的个人工作台原型，Canvas 自研渲染引擎。
> **改代码前先读** `docs/KFM_V4_INVARIANTS.md`（修改约束协议）。
> **日常干活翻** `docs/HANDBOOK.md`（架构+调试+待办+测试）。
> **规划设计时参考** `docs/VISION_AND_ROADMAP.md`（远景）。
> **做浮卡相关改动先读** `docs/CARD_SYSTEM_UNIFICATION_SPEC.md`（浮卡统一化规范）。
> **UI Registry 相关**已在 `docs/archive/design/` 归档。

---

## 技术栈

- TypeScript 6 (ES2022) + Express 4 服务端
- Canvas 2D 自研渲染引擎（v2 Box → Renderer）
- SCSS 编译（sass → CSS，语法校验 + 构建时编译）
- GSAP 3.15 动画（通过 `animation-registry.ts` 隔离调用）
- esbuild 构建（`tsc --noEmit` → esbuild bundle）
- `@chenglou/pretext` 文本测量

## 构建与运行

```bash
npm run check    # sass → check-* → tsc --noEmit（必须零错误通过）
npm run build    # check 通过后 esbuild 打包
npm run start    # 启动 http://localhost:8021
npm run dev      # ts-node ESM 直接运行
```

## 文档体系

```
CLAUDE.md                    # 本文件——项目入口
docs/
├── HANDBOOK.md              # 工作手册：架构-调试-待办-测试（日常翻）
├── VISION_AND_ROADMAP.md    # 远景文档：核心理念+演进路线（规划设计时参考）
├── KFM_V4_INVARIANTS.md     # 修改约束协议：心法原则+自查清单（改代码前必读）
├── UI_ELEMENT_REGISTRY_SPEC.md # UI Element Registry：设计讨论+产出定义+开放问题
└── archive/                 # 历史归档（按类别分目录）
    ├── handoff/             # 版本交接记录
    ├── design/              # 过时的设计文档
    ├── plan/                # 已完成的计划
    ├── bug/                 # 已修复的 Bug
    └── legacy/              # 旧版本文件
```

> 接手新对话的推荐阅读顺序：`CLAUDE.md` → `HANDBOOK.md` §2（当前状态）→ `KFM_V4_INVARIANTS.md`（修改规则）→ `HANDBOOK.md` §3（待办）。

## 完整性校验

```bash
npm run check   # sass + 4 个 check-*.mjs + tsc --noEmit，零错误
npm run test    # 74 个回归测试
```

## 注意事项

- **esbuild**: `supported: { nullish-coalescing: false }` 要求 ES2019
- **Canvas 初始化**: `clientWidth=0`，需在 rAF 回调里 `rebuildTree()`
- **事件冒泡**: 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发

> 历史修复记录（v4.0.0 前）已清理。如需追溯：`git log --oneline v4.0.0..HEAD`
