# KFM v4 项目交接文档

> 写于 2026-05-09，基于对全部源代码的全面审计。

---

## 一、项目概况

KFM v4（咖啡猫 / Kaf Fee Mew）是一个面向移动端浏览器的 **AI 人机交互个人工作台**。

### 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 语言 | TypeScript 6 + ES2022 | 全栈 TypeScript |
| 服务端 | Express 4 | 文件读写 API，监听 `0.0.0.0:8021` |
| 客户端渲染 | Canvas 2D 自研引擎 (v2) | Box 树 → Renderer → Canvas |
| 动画 | GSAP 3.15 | 通过 `animation-registry.ts` 隔离 |
| 文本测量 | `@chenglou/pretext` | 零 reflow 离屏测量 |
| 构建 | esbuild 0.28 | TypeScript → bundle |
| 运行时 | Node ESM | 全项目 ESM 模式 |

### 目录结构要点

```
/root/kfmv4/
├── CLAUDE.md                   # 主文档（每个接手者必读）
├── src/
│   ├── server/index.ts         # Express 服务器
│   └── client/
│       ├── main.ts             # 入口
│       ├── engine/v2/          # Canvas 渲染引擎（Box → Renderer）
│       └── modules/            # 业务模块
├── docs/                       # 设计文档
├── tests/                      # 回归测试
├── public/                     # 静态文件
├── css/                        # 样式（与 public/css 重复）
└── js/                         # 遗留旧版 JS（死代码）
```

---

## 二、架构核心概念

### 一切皆盒子（Box）

`src/client/engine/v2/box.ts` — 项目中唯一的节点类型。Box 树构成整个视觉场景。

```
Box {
  id, x, y, width, height,      // 几何
  children, parent,              // 树形
  backgroundColor, gradient,     // 视觉
  textStyle,                     // 文本
  transform,                     // 变换（scale, rotate, translate）
  scrollable, scrollY,           // 滚动
  gesture,                       // 手势回调
  data,                          // 业务数据（类型不安全）
}
```

### 注册中心模式

三个核心注册中心，均以全局单例形式存在：

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `gestures` | `gesture-registry.ts` | document 级触摸事件统一调度（按优先级匹配处理器） |
| `L` (Lifecycle) | `renderer-lifecycle.ts` | 渲染器状态、光标状态、动画锁、rAF 句柄、DOM 监听器 |
| `KFMState` | `state.ts` | 全局状态层（文件树、展开状态、发布-订阅） |

### 动画系统

```
GSAP 的所有直接调用必须通过 animation-registry.ts，禁止直接 `import gsap`。

anim.scope('tree-render') → ts    # 模块级 timeline，clear() 只影响本模块
anim.timeline()                    # 独立 timeline（char-rain 用）
```

### 依赖方向

```
renderer-lifecycle.ts (L)
       ↓
canvas-utils.ts          ← 最底层工具
       ↓
canvas-cursor.ts         ← 光标移动/吸附
       ↓
canvas-scroll.ts         ← 滚轮/触摸/fling
       ↓
tree-render.ts           ← 文件树业务
```

**当前违规**: `canvas-cursor.ts` 导入了 `tree-model.ts` 的 `getShift`。

---

## 三、代码审计结论（核心摘要）

### 🔴 必须立即修复

1. **服务端路径遍历漏洞** (`src/server/index.ts`) — `/files/read`、`/files/write` 等 API 接受客户端传来的 `path`，无任何路径校验。`../etc/passwd` 即可穿透。
2. **服务端无认证** — 所有 API 开放，监听 `0.0.0.0`。

### 🟠 中优先级

3. **全局单例导致难测试** — `KFMState`、`L`、`gestures`、`anim` 全部是模块级单例，无依赖注入。
4. **`(as any)` 类型逃逸** — 多处违反 CLAUDE.md 约定，使用 `(as any).data.xxx`。
5. **死代码过多** — `engine/v2/scroll.ts`、`engine/v2/gesture.ts`、`js/` 目录、`public/card-demo.html`、`demo-leafer.ts` 均未使用。
6. **`canvas-cursor.ts` 违反依赖方向** — 导入了 `tree-model.ts`。

### 🟢 低优先级

7. `orbs.ts` 和 `debug-panel.ts` 大量重复拖动逻辑（约 60%）。
8. 每帧 `setRoot` 调用过多（`onUpdate` 回调中）。
9. `tsconfig.json` 使用 `ignoreDeprecations: "6.0"`。

---

## 四、接手工作指南

### 第一步：建立环境

```bash
npm run check    # tsc --noEmit 类型检查（必须零错误）
npm run build    # 完整构建（check-anim → tsc → esbuild）
npm run test     # 回归测试
```

### 第二步：理解核心文件

按此顺序阅读：

1. `CLAUDE.md` — 项目总览、架构、约定
2. `src/client/main.ts` — 初始化流程（所有模块的启动顺序）
3. `src/client/modules/state.ts` — 全局状态设计
4. `src/client/modules/renderer-lifecycle.ts` — 生命周期注册中心
5. `src/client/modules/gesture-registry.ts` — 手势调度
6. `src/client/modules/tree-render.ts` — 文件树渲染（最重要的模块）
7. `src/client/engine/v2/box.ts` + `renderer.ts` — 引擎核心
8. `docs/HANDOFF_AUDIT.md` — 本文件（审计结论 + 陷阱）

### 第三步：安全修复（如果还没做）

```typescript
// src/server/index.ts — 加路径校验
const SAFE_ROOT = path.resolve('/root');
function sanitizePath(userPath: string): string | null {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (!resolved.startsWith(SAFE_ROOT)) return null;
  return resolved;
}
```

### 第四步：按优先级推进

| 优先级 | 工作项 | 预计影响 |
|--------|--------|----------|
| P0 | 路径遍历漏洞修复 | 安全 |
| P0 | 全面检查所有 API 路由 | 安全 |
| P1 | 清理死代码 | 可维护性 |
| P1 | 修复 `canvas-cursor.ts` 依赖违规 | 架构 |
| P2 | 定义 `FileRowData` 类型，消除 `(as any)` | 类型安全 |
| P2 | 动画性能优化（减少 `setRoot`） | 性能 |
| P3 | `orb.ts` / `debug-panel.ts` 公共组件提取 | 代码复用 |
| P3 | DI 改造单例 | 可测试性 |

---

## 五、核心原则

### Bug 修复原则（来自 BUG_FIXING_PHILOSOPHY.md）

> **禁止打补丁。排查到最深层根因，通过调整架构间接消除 bug。**

具体实践：
- 不修症状（"字符雨不显示 → 加个 setTimeout"）
- 修根因（"字符雨不显示 → overflow:hidden 裁剪 → overlay overflow:visible"）
- 改完后代码应更短而非更长

### 编码约定

- `_` 前缀 = 模块内私有（目前被多处跨模块读写，需逐步修复）
- 动画 tween 必须加到 `ts` scope 上，不准直接 `gsap.to()`
- `ts.call` 回调内必须 `ts.clear()` 清理残留 tween
- overlay 元数据用 `(as Box & OverlayMeta)` 访问，**禁止 `(as any)._xxx`**
- `canvas-*` 模块不准导入 `tree-*` 模块

### 验证标准

任何改动后运行：
```bash
npm run check   # 类型检查零错误
npm run build   # 构建通过
```

---

## 六、已知陷阱（每个接手者注意！）

1. **Canvas 初始化时 `clientWidth = 0`** — 需在 `requestAnimationFrame` 回调里 `rebuildTree()`
2. **esbuild 构建时 `nullish-coalescing` 被禁用** — 但源码大量使用了 `??`，TS 6 编译时需确保正确降级
3. **事件冒泡** — 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
4. **动画锁超时** — `processClickQueue` 有 3000ms 的超时释放机制，长期依赖此兜底说明动画管理有设计缺陷
5. **测试 mock 脆弱** — GSAP mock 中 `tl.call(cb)` 同步执行回调，改变了动画时序
6. **两个光球** — `orb.ts`（紫色，AI 对话）和 `debug-panel.ts`（青色，调试面板）各自独立，互不知晓

---

## 七、文档索引

| 文档 | 位置 | 价值 | 说明 |
|------|------|------|------|
| **主文档** | `CLAUDE.md` | 必读 | 项目总览、架构、构建、已知坑点 |
| **本交接文档** | `docs/HANDOFF_AUDIT.md` | 必读 | 审计结论、接手指南、陷阱 |
| **Bug 修复原则** | `docs/BUG_FIXING_PHILOSOPHY.md` | 推荐 | 架构级 bug 修复哲学 |
| **卡片配色设计** | `docs/STACK_CARDS_DESIGN.md` | 参考 | 暮光/琉璃/星云三套配色 |
| **V2 存档** | `docs/archive/CLAUDE_v2.md` | 历史 | 上一版主文档 |
| **竞态方案存档** | `docs/archive/RACE_CONDITION_PLAN.md` | 历史 | P1-P5 竞态方案（已实现） |
| **蓝图存档** | `docs/archive/REFACTOR_THESIS_FULL.md` | 历史 | 愿景蓝图（大部分已过时） |
| **AI 操作协议存档** | `docs/archive/AI_OPERATION_PROTOCOL.md` | 历史 | 未实现功能设计 |
| **卡片堆叠交接存档** | `docs/archive/CARD-STACK-HANDOFF.md` | 历史 | 任务性交接（已完成） |
| **字符雨 bug 存档** | `docs/archive/BUG_HANDOFF_ROOT_CHAR_RAIN.md` | 历史 | 具体 bug 交接 |
| **P3 遗留存档** | `docs/archive/HANDOFF_P3_REMAINING.md` | 历史 | 具体任务单（已过时） |
