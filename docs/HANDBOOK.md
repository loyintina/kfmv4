# KFM v4 工作手册 (SOP)

> **日常开发参考**。改代码前先读 `KFM_V4_INVARIANTS.md`（修改约束协议），
> 规划设计时参考 `VISION_AND_ROADMAP.md`（远景文档）。
> 本手册整合了架构速查、调试流程、隐性契约、当前状态、待办和测试指南。

> ⏱ **TL;DR**：本文约 350 行，分六章。新接手者重点读 §2（当前状态）+ §3（待办）；
> 遇到 bug 读 §4；写代码前读 §6（原则索引）；架构疑问读 §1。

---

## 一、架构速查

### 注册中心

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |
| `Registry` | `ui-registry.ts` | UI 元素注册表（黄页模式） |
| `KFMState` | `state.ts` | 全局状态层（发布-订阅） |

### 手势优先级

```
picker-lock(110) > orb(100) > floating-orb(100) > card-stack-global(80)
> sidebar-scroll(60) > page-swipe(50)
```

### 动画状态机

| 模块 | 状态机 |
|------|--------|
| tree-render | `idle ⇄ animating` (L.beginOp/endOp) |
| card-stack | `closed ⇄ opening ⇄ open ⇄ closing` |
| floating-card | `compact → expanding → active ⇄ editing` |
| orb (main) | `collapsed ⇄ expanding/collapsing ⇄ expanded ⇄ editing` |

### 依赖方向

```
renderer-lifecycle (L) → canvas-utils → canvas-cursor → canvas-scroll → tree-render
```

`canvas-*` 模块不导入任何 `tree-*` 模块。`(as any)` **零逃逸**（`check-as-any.mjs` 扫描）。

### 关键调用链

```
main.ts → gestures.init() → initApp() → initUI() → initGestures() → initOrb()
        → initTreeRenderer() → loadFileTree() → initLazyLoader() → initCardStack()
```

---

## 二、当前会话状态

> **最后更新**：2026-06-02（v6.0.0 — UI Element Registry 已实现）

### 当前焦点
- `(as any)` 逃逸全部清理（白名单清空 ✅）
- `ui-registry.ts` 已创建，10 个交互元素已注册
- `check-docs.mjs` 已加入构建管线
- **新增交互元素时必须**：①在 init 函数调 `Registry.register()` ②在 `check-registry.mjs` 的 MANIFEST 追加 id

### 已知陷阱
1. **CSS 布局方程**：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**：连续调用会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法 9）：搬运代码必须 `git show` 原样复制后改，禁止重写
5. **Registry MANIFEST**：新增交互元素必须同时注册 + 加入 MANIFEST
6. **Canvas 初始化 `clientWidth=0`**：需在 rAF 回调里 `rebuildTree()`
7. **事件冒泡**：侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
8. **动画锁超时**：`processClickQueue` 有 3000ms 超时释放，说明动画管理有设计缺陷
9. **esbuild `nullish-coalescing` 禁用**：但源码大量使用 `??`，TS 6 编译时需确保正确降级
10. **测试 mock 脆弱**：GSAP mock 中 `tl.call(cb)` 同步执行回调，改变了动画时序

---

## 三、当前待办

### 活跃待办

| 优先级 | 事项 | 说明 |
|--------|------|------|
| **🟠 P2** | 拆分 `card-stack.ts`（1352 行） | 面板 ~400 行 + 浮卡 ~900 行两职责混合 |

### 持续观察

- 测试基础设施脆弱（GSAP mock 失真，无 UI/Canvas/手势覆盖）
- orb / card-stack 拖动逻辑重复（各自实现 pointerdown/move/up 循环）

### 历史版本归档

| 版本 | 焦点 | 归档位置 |
|------|------|---------|
| v4.1.0 | 卡片配色 + 浮卡系统 + BR 守卫 | `archive/handoff/v4.1.0.md` |
| v5.0.0 | CSS 语法安全 + SCSS 迁移 | `archive/handoff/v5.0.0.md` |
| v5.1.0 | root-picker 交互修复 | `archive/handoff/v5.1.0.md` |
| v5.2.0 | RenderContext 上下文隔离 | `archive/handoff/v5.2.0.md` |
| v6.0.0 | UI Element Registry + 代码审计 | `archive/handoff/v6.0.0-*.md` |

---

## 四、调试与 Bug 排查

### CSS/视觉 Bug 三步法

1. **CSS 解析检查**：在 DevTools 检查 `document.styleSheets`，争议规则是否存在？
   - 不存在 → 检查最近一条未闭合的 `{`/`(`/`[`
   - 存在但计算样式不匹配 → 检查 CSS 优先级和选择器拼写
2. **工具编辑安全**：`edit` 替换 CSS 块时，确保末尾包含了 `}`/`;`/`)` 等闭合字符
3. **浏览器二次确认**：强制无缓存刷新，用 `getComputedStyle(el)` 验证计算值

### 隐性契约（破坏会出 Bug）

| # | 契约 | 涉及模块 |
|---|------|---------|
| 1 | **全项目统一使用 PointerEvent** — 禁止直接添加 `touchstart`/`touchmove`/`touchend` | gesture-registry, canvas-scroll, card-stack, tree-render, orb |
| 2 | **`touch-action: none`** — 全屏单页应用全局设为 `none`，禁止 `pan-y`/`auto` | public/css/base.css, 所有 position:fixed 覆盖层 |
| 3 | **卡片堆是全局模式** — 打开后整屏都是操作区域，`targetFilter: () => true` 不是缺陷 | card-stack.ts, gestures.ts |
| 4 | **BR 光球双向切换** — 状态机必须闭环 `compact ↔ active`，不能单向 | card-stack.ts（浮卡状态机） |

### 根因案例索引

详细诊断过程见 `archive/bug/` 和已归档的 `archive/handoff/`。

| 案例 | 根因类型 | 症状关键词 |
|------|---------|-----------|
| B.A.R. #001 | 事件系统混用 | 外部区域滑动失效、不跟手 |
| B.A.R. #002 | 全局/局部模式误判 | 手势区域限定、外部滑动失效 |
| B.A.R. #006 | CSS 语法错误/编辑遗漏 | 边框看不见、CSS 规则不生效 |

---

## 五、回归测试

### 自动化测试

```bash
npm test   # 74 个测试，覆盖 10 个模块
```

### 手动回归清单

| # | 操作 | 预期结果 |
|---|------|----------|
| 1 | 打开页面 | 主页面正常，光球可见 |
| 2 | 右滑 / 三横线 | 左栏打开，文件树完整 |
| 3 | 左栏上下滑动 | 列表正常滚动 |
| 4 | 点击目录 | 展开/折叠动画正常，字符雨可见 |
| 5 | 快速连点同目录 | 展开/折叠正确切换，无闪烁 |
| 6 | 左栏左滑 | 左栏关闭 |
| 7 | 侧栏关闭时左滑 | 召唤卡堆 |
| 8 | 卡堆右滑 | 关闭卡堆 |
| 9 | 卡堆上下滑 | 切换卡片，焦点保持 |
| 10 | 点击光球 | AI 面板打开 |
| 11 | 多层嵌套文件夹展开 | 子容器串行展开，字符雨正常 |
| 12 | 展开后立即折叠 | 折叠动画流畅，文字自然被裁 |
| 13 | 浮卡 BR 展开/折叠 | 三颗角光球从 BR 位置滑入/滑回，同步无淡入淡出 |
| 14 | 浮卡 TR 关闭 | 所有光球 + 卡片向 TR 圆心收缩消失 |
| 15 | 展开动画期间误触 TR | 不触发关闭（状态守卫） |

---

## 六、原则索引

> 每条原则的完整定义见 `KFM_V4_INVARIANTS.md` §〇。此处仅列摘要。

| # | 原则 | 一句话 |
|---|------|--------|
| 1 | 先问"为什么" | 找到根因，不修症状 |
| 2 | 从源头简化 | 数据模型只存不可简化的原始信息 |
| 3 | 不跨模块依赖 | 模块的决策边界＝可见边界 |
| 4 | 状态在展示前就位 | 不要让用户看到"变化的过程" |
| 5 | 代码越改越少是正向 | 改完代码变多，大概率方向错了 |
| 6 | 先理解整体再拆解局部 | 理解→诊断→方案→执行，顺序不乱 |
| 7 | 选最匹配的一个方案 | 给出你推荐的那一个，附上理由 |
| 8 | 选能自然满足约束的方案 | 擦掉重做成本永远小于修修补补 |
| 9 | 搬运代码必须原样复制 | 禁止凭记忆重写，差异仅限于意图改动的部分 |
| 10 | 写代码前先口述 | 要做什么、可选方案、选哪个、为什么 |
| 11 | 步骤3暴露所有已知缺口 | 能继承的+不能继承的+填补方案 |
| 12 | 发现补丁立即根除 | 不留给"以后"，补丁越久风险越大 |

### 关键约定速查

- `_` 前缀 = 模块内私有
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问
- `(as any)` **零逃逸**（白名单已清空，`check-as-any.mjs` 扫描）
- `Box.data` 必须通过 `getFileRowData()` 守卫访问
- 所有 GSAP 调用通过 `animation-registry.ts`，禁止直接 `import gsap`
- Canvas 滚动/点击走元素级监听，不走 GestureRegistry
- overlay 元数据用 `(as Box & OverlayMeta)` 类型访问
- 向 `ts` 加 tween 的函数，必须在 `ts.call` 回调里 `ts.clear()`
- 动画中 `_stateSub` 不会触发 `rebuildTree`（`L.isAnimating` 守卫）
