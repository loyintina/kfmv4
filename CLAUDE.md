# KFM v4 (Kaf Fee Mew / 咖啡猫)

AI 人机交互个人工作台，面向移动端浏览器。核心理念：**一切皆盒子**。

> ⏱ **TL;DR 给新来的 AI**：这是 AI 生成的个人工作台原型，Canvas 自研渲染引擎。
> 改代码前必须先读 `docs/KFM_V4_INVARIANTS.md`（修改约束协议）。
> 新开对话还需通读 `docs/SESSION_MEMORY.md` + `docs/HANDOFF_AUDIT.md`。
> 架构参考见 `docs/ARCHITECTURE.md`，愿景见 `docs/VISION_AND_ROADMAP.md`。

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
CLAUDE.md                          # 本文件——项目入口 + 快速参考
docs/
├── HANDOFF_AUDIT.md               # 待办总览 + 版本摘要（新对话/规划时必读）
├── SESSION_MEMORY.md              # 当前会话快照（新开对话必读）
├── KFM_V4_INVARIANTS.md           # AI 修改约束协议（改代码前必读）
├── ARCHITECTURE.md                # 架构参考（动画系统、依赖方向、调用链）
├── VISION_AND_ROADMAP.md          # 核心理念 + 演进路线（规划设计时参考）
├── DEBUG_SOP.md                   # 调试标准流程（遇到 bug 时先翻）
├── BUG_AUDIT_REGISTRY.md          # 隐性契约 + 根因案例库（SOP 排查无果后翻阅）
├── PRINCIPLES_INDEX.md            # 所有原则/约束/契约的索引表
├── CARD_SYSTEM_DESIGN.md          # 统一卡片系统设计蓝图
├── UI_ELEMENT_REGISTRY_SPEC.md    # UI 元素注册表设计规范
├── TESTING.md                     # 回归检查清单
└── archive/                       # 历史归档（按类别分目录）
```

## 核心架构

### 注册中心模式

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |
| `Registry` | `ui-registry.ts` | UI 元素注册表 |

手势优先级：`orb(100) > card-stack-panel(90) > card-stack-global(80) > picker-lock(110) > page-swipe(50)`

### 状态机

```
tree-render:        idle ⇄ animating (L.beginOp/endOp)
card-stack:         closed ⇄ opening ⇄ open ⇄ closing
floating-card:      compact → expanding → active ⇄ editing
orb (main):         collapsed ⇄ expanding/collapsing ⇄ expanded ⇄ editing
```

### 依赖方向

```
renderer-lifecycle (L)
  ↓
canvas-utils.ts          ← 最底层，只依赖 L
  ↓
canvas-cursor.ts         ← 不导入 tree-*
  ↓
canvas-scroll.ts         ← 不导入 tree-*
  ↓
tree-render.ts           ← 可以导入任何 canvas-*
```

## Bug 修复原则

**禁止打补丁。排查到最深层根因，通过调整架构间接消除 bug。**

详见 `docs/KFM_V4_INVARIANTS.md`（第三章：常见补丁模式 + 自查清单）。

## 完整性校验

```bash
npm run check   # sass + 3 个 check-*.mjs + tsc --noEmit，零错误
npm run test    # 74 个回归测试，覆盖 10 个模块
```

## 关键约定速查

- `_` 前缀 = 模块内私有
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问
- `(as any)` **零逃逸**（白名单已清空，`check-as-any.mjs` 扫描）
- `Box.data` 必须通过 `getFileRowData()` 守卫访问
- 所有 GSAP 调用通过 `animation-registry.ts`，禁止直接 `import gsap`
- Canvas 滚动/点击走元素级监听，不走 GestureRegistry
- overlay 元数据用 `(as Box & OverlayMeta)` 类型访问
- 向 `ts` 加 tween 的函数，必须在 `ts.call` 回调里 `ts.clear()`
- 动画中 `_stateSub` 不会触发 `rebuildTree`（`L.isAnimating` 守卫）

## 注意事项

- **esbuild**: `supported: { nullish-coalescing: false }` 要求 ES2019
- **Canvas 初始化**: `clientWidth=0`，需在 rAF 回调里 `rebuildTree()`
- **事件冒泡**: 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发

> 历史修复记录（v4.0.0 前）已清理。如需追溯：`git log --oneline v4.0.0..HEAD`
