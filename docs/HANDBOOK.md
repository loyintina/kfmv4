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

> **最后更新**：2026-06-03（v6.3.1 — 第三轮 Registry 深度审计 + 心法 LEVEL 分类 + CI 基线固化）

### 当前焦点
### v6.3.x 新增（三轮审计 + CI 基线固化）
- 第三轮深度审计发现 6 个新问题全部修复（state getter 异常保护、`registerContentGenerator(id, null)` crash、命令重复注册静默覆盖、孤立 getter 检测、`registerElement` 双发 onChange、click 失败 toast 反馈）✅
- 心法原则加 LEVEL 1/2/3 分类，附冲突处理规则 ✅
- CI 基线固化：`check-registry.mjs` 新增孤立 getter 检测 + 命令注册重复检测 ✅
- 消除 `SAFE_ROOT`/`sanitizePath` 在 `index.ts` 和 `capability-executor.ts` 间的重复定义 ✅
- `_` 前缀跨模块访问显式接口化：`RendererLifecycle` 新增 8 个方法 + `animElapsed` getter ✅
- `orb-panel` 静态 state 从 `'collapsed'` 更正为 `'closed'`（与运行时 `panelState` 类型一致）✅
- `check-as-any.mjs` 正则增强覆盖 `(expr) as any` 模式 ✅
- `capability-executor.ts` 路径逃逸守卫（`SAFE_ROOT` + `sanitizePath`）✅
- `sidebar` effect 字段补上 AI 命令说明 ✅
- `snapshot()` 内容生成器加 try/catch 异常保护 ✅
- `check-docs.mjs` 新增 frontmatter 完整性校验，修复 15 个归档文档前置元数据 ✅
- 消除能力层 `entry` 硬编码 + `check-registry.mjs` 新增交叉验证 ✅
- `ai-send-btn`、`overlay` 补注册，`sidebar` 冗余 notify 移除 ✅

### 当前焦点（v6.2.0 延续仍有效）
- 文件树 AI 操作命令已添加：`expand-dir` / `collapse-dir` / `select-file` 通过 ws-channel 注册，AI 可远程操作文件树 ✅
- `select-file` 命令自带光标定位 + 居中滚动，通过 `L._pendingSelectFile` 标记在 `rebuildTree` 中消费 ✅
- 用户双击文件时 `KFMState.setSelectedFile()` 被正确调用（`onFileClick` 从无操作改为 `(p) => state.setSelectedFile(p)`），实现人和 AI 对称操作 ✅
- 内容层增强：`file-tree` 摘要含选中文件路径和已展开目录列表；`card-stack-content` 含索引/总数/已填充数 ✅
- `sidebar` 已加 `data-registry-id`，从 `NO_DOM_TARGET` 豁免表移出，通用 `click` 指令可定位 ✅
- `file-tree` 交互元素的 `effect`/`description` 已更新注明 AI 命令能力 ✅
- `orb-panel` 状态语义已修复：`panelState` 独立变量（`'closed'|'open'|'editing'`），不再与 `orbState` 共享 ✅
- 4 个元素（`file-tree`、`orb-panel`、`card-stack`、`orb`）运行时带 `data-registry-id`，AI `click` 指令可定位（v6.2 新增 sidebar）✅
- `registerContent()` 不再静默删除同 id 的生成器：生成器优先，静态内容作为 fallback ✅
- `snapshot()` 不再有副作用（移除了运行时 `warn`） ✅
- `window` 上 5 个死 `any` 声明已清除（`styleRegistry`、`DIMENSIONS`、`COLORS`、`TEXT_STYLES`、`__treeRenderer`）✅
- `ws-channel.ts` 中 `window.KFMState` 改为直接引用 import 的 `KFMState` ✅
- 服务端路由注册已修复：消除 `app.use() && app` 表达式 bug ✅
- Box 类 31 个单元测试已添加（覆盖构造、树操作、几何、事件、状态、序列化、动画、滚动）✅
- `ui-registry.ts` 不再 import `debug-assert.js` ✅

- `(as any)` 逃逸全部清理（白名单清空 ✅）

### 已知陷阱
1. **CSS 布局方程**：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**：连续调用会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法 9）：搬运代码必须 `git show` 原样复制后改，禁止重写
5. **Registry MANIFEST**：新增交互元素必须同时注册 + 加入 MANIFEST
5b. **Registry state getter**：如果元素的 state 会在运行时变化（几乎所有交互元素都如此），注册后必须同时调 `registerStateGetter()`，否则 `snapshot()` 返回的是过时的静态 state。**推荐使用 `registerElement()` 便捷方法**——它一次完成 register + registerStateGetter，避免遗漏配对。
6. **`notifyStateChange` 覆盖范围**：`Registry.notifyStateChange()` 只通知"状态发生了变化"，不传递状态值本身。snapshot 仍通过 `registerStateGetter` 读取实时状态。新增模块的状态变化如果漏调 `notifyStateChange()`，AI 看到的 snapshot 会滞后。**注意**：`check-registry.mjs` 现在会检查 `register()` 调用的必需字段完整性，但 notifyStateChange 的覆盖仍需人工保证。
7. **Canvas 初始化 `clientWidth=0`**：需在 rAF 回调里 `rebuildTree()`
8. **事件冒泡**：侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
9. **动画锁超时**：`processClickQueue` 有 3000ms 超时释放，说明动画管理有设计缺陷
10. **esbuild `nullish-coalescing` 禁用**：但源码大量使用 `??`，TS 6 编译时需确保正确降级
11. **测试 mock 脆弱**：GSAP mock 中 `tl.call(cb)` 同步执行回调，改变了动画时序

---

## 三、当前待办
12. **Canvas 元素的 AI click 无坐标**：`file-tree` Canvas 通过 `data-registry-id` 可被 AI `click` 指令定位并触发 `click()`，但合成的 PointerEvent 坐标为 (0,0)，不一定命中预期的行。
    **v6.3 部分缓解**：新增 `expand-dir`/`collapse-dir`/`select-file` 专用命令绕过坐标问题，AI 应优先使用这些命令而非通用 `click`。<a id='trap-12'></a>
13. **`registerContent()` 与生成器关系**：同一 id 下生成器优先，`registerContent()` 不会覆盖已注册的生成器。如需强制更新静态内容，先调 `registerContentGenerator(id, null)` 注销生成器。<a id='trap-13'></a>
14. **`notifyStateChange()` 散布**：`notifyStateChange()` 散布在 6 个文件的 ~36 处调用（2026-06-03 审计后从约 41 处清理了 ui.ts 中 5 处冗余——openSidebar/closeSidebar 中的 2 处及 3 个命令处理器的冗余调用，均在 KFMState.setSidebarOpen 已覆盖后被标记为冗余并移除）。剩余 ~36 处均为合理存在：tree-render.ts ~10 处（Canvas 渲染状态变化）、card-stack.ts ~9 处（DOM/GSAP 生命周期状态）、orb.ts ~8 处（orbState/panelState 模块变量）、app.ts ~2 处（toast DOM 回调）、tree-render/rebuildTree 等。根解方向未变：在 ws-channel 层建立自动覆盖检测，识别被 KFMState 订阅覆盖的冗余通知。但需注意，绝大多数通知来自 KFMState 无法覆盖的路径（Canvas/GSAP 回调/模块变量），真正的冗余比例较低。<a id='trap-14'></a>

### 活跃待办

| 优先级 | 事项 | 说明 |
|--------|------|------|
| **🟠 P2** | 拆分 `card-stack.ts`（1392 行） | 面板 ~400 行 + 浮卡 ~900 行两职责混合，v6.3.x 审计净增 ~40 行 |

### 持续观察

- 测试基础设施脆弱（GSAP mock 失真，无 UI/Canvas/手势覆盖）
- orb / card-stack 拖动逻辑重复（各自实现 pointerdown/move/up 循环）
### 历史版本归档

|------|------|---------|
| v4.1.0 | 卡片配色 + 浮卡系统 + BR 守卫 | `archive/handoff/v4.1.0.md` |
| v5.0.0 | CSS 语法安全 + SCSS 迁移 | `archive/handoff/v5.0.0.md` |
| v5.1.0 | root-picker 交互修复 | `archive/handoff/v5.1.0.md` |
| v5.2.0 | RenderContext 上下文隔离 | `archive/handoff/v5.2.0.md` |
| v6.0.0 | UI Element Registry + 代码审计 | `archive/handoff/v6.0.0-*.md` |
| v6.1.0 | Registry 全面接入 + 三层 MANIFEST 验证 | git `25a295e` |
| v6.1.1 | Registry 对齐修正 | git `462fe49` |
| v6.2.0 | 文件树 AI 命令 + 内容层增强 + 对称操作修复 | git `87a025d` |
| v6.3.0 | Registry 文档-代码对齐审计 + registerElement() 便捷方法 | git `47e82a2` |
| **v6.3.1** | **第三轮深度审计 + 心法 LEVEL + CI 基线固化** | **HEAD** (`847e988`) |
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
npm test   # 105 个测试，覆盖 11 个模块（含 Box 引擎）
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
| 13 | 能自己做完就别留半截 | 理解成本 > 执行成本，5 分钟能做完的事不要留给别人花 20 分钟理解 |

### 关键约定速查

- `_` 前缀 = 模块内私有
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问
- `(as any)` **零逃逸**（白名单已清空，`check-as-any.mjs` 扫描）
- `Box.data` 必须通过 `getFileRowData()` 守卫访问
- 所有 GSAP 调用通过 `animation-registry.ts`，禁止直接 `import gsap`
- Canvas 滚动/点击走元素级监听，不走 GestureRegistry
- overlay 元数据用 `(as Box & OverlayMeta)` 类型访问
- 向 `ts` 加 tween 的函数，必须在 `ts.call` 回调里 `ts.clear()`

### 交接（2026-06-03 v6.3.1 本轮完成）

**本轮完成（v6.3.x 三轮审计 + CI 基线固化）**：

- 第三轮深度审计发现 6 个新问题全部修复（state getter 异常保护、`registerContentGenerator(id, null)` crash、命令重复注册静默覆盖、孤立 getter 检测、`registerElement` 双发 onChange、click 失败 toast 反馈）
- 心法原则加 LEVEL 1/2/3 分类 + 冲突处理规则
- CI 基线固化：`check-registry.mjs` 新增孤立 getter 检测 + 命令注册重复检测（构建中断级）
- `check-as-any.mjs` 正则增强覆盖 `(expr) as any` 模式
- `capability-executor.ts` 路径逃逸守卫 + 消除 entry 硬编码
- `RendererLifecycle` `_` 前缀显式接口化（8 个新方法 + `animElapsed` getter）
- `check-docs.mjs` 新增 frontmatter 完整性校验，修复 15 个归档文档
- `snapshot()` + `get()` try/catch 异常保护
- `ui-registry.ts` 不再 import `debug-assert.js`
- `(as any)` 逃逸全部清理（白名单清空）
- 文件树 AI 操作命令（v6.2.0 延续）：`expand-dir` / `collapse-dir` / `select-file`
- 用户与 AI 对称操作（v6.2.0 延续）：双击文件调 `KFMState.setSelectedFile()`
- 内容层增强（v6.2.0 延续）：file-tree + card-stack-content 含实时摘要
- 服务端路由注册已修复
- Box 类 31 个单元测试 + 累计 105 个回归测试

**关键结论留给下一位**：

- Registry 的 spec-vs-code 缺口已收窄到 typo 级，不需要做"第四轮审计"了
- 下一个有意义的 P2 工作是 `CARDS` 数组迁移（`card-stack.ts:30-38` 的硬编码数据源，14 处引用）
- 分支 `feat/central-only` 含中央模式预览功能，`save-before-rollback` 含动画优化，均未合并
- 通用 `click` 指令能定位 5 个 DOM 元素 + 3 个 Canvas 元素；`file-tree` Canvas 元素仍优先使用 `expand-dir`/`collapse-dir`/`select-file` 命令
- 待办维持：card-stack 拆分（P2，1392 行）、动画锁 3000ms 超时（P3）、拖拽逻辑去重、`feat/central-only` 合并评估
