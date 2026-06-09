---
status: superseded
superseded_by: docs/archive/design/VISION_AND_ROADMAP.md
archived_at: 2026-06-02
---
# Kaf Fee Mew — 技术架构与实施蓝图

> ⚠️ **存档文档**。本文提到的 `debug-helper.ts`、`tree-render-legacy.ts` 等清理候选文件已从项目中删除，部分架构描述已过时。仅供参考。

> AI 人机交互的个人工作台，创意与能力的延伸工具。
> 一切皆盒子。

---

## 愿景

```yaml
名字: Kaf Fee Mew (KFM / 咖啡猫)
本质: 面向 AI 人机交互的个人工作台
核心理念: 一切皆盒子——任何可拆分的要素都可以卡片形式加入工作流

交互模型:
  用户 → 直接操作盒子（触摸/点击/键盘）
  用户 → 通过对话盒子指挥AI
  AI → 通过盒子协议操作任何盒子（与用户对称）
  用户和AI → 通过标记系统共享上下文

  盒子类型:
    P0: 对话盒子 / 终端盒子
    P1: 文件树盒子 / 设置盒子
    P2: 编辑器盒子 / 文件管理器盒子
    FX: (未来) 更多…

  交互流:
    "标记某位置 → 回到输入栏说做什么" 而非 "切到某页面做某事"
    标记系统: 点击光标（操作目标）+ 路标标记（参考来源）

运行平台:
  当前: 手机浏览器（移动端优先 — 这是所有UI设计的约束条件）
  未来: 桌面浏览器 → APK → EXE → CLI
```

---

## 技术栈蓝图

```yaml
五技术各司其职:

  LeaferJS:
    职责: Canvas 渲染（画布、盒子外观、连线、粒子）
    不做: 文字编辑、表单、输入法
    
  GSAP:
    职责: 动画引擎（唯一）
    不做: 布局计算、状态管理
    
  Pretext:
    职责: 离屏文本测量（零 reflow）
    不做: 文字渲染、布局
    
  Yoga Layout:
    职责: Flexbox 布局计算（WASM，微秒级）
    不做: 渲染、动画
    
  DOM:
    职责: 盒子内容（编辑器、AI对话、输入框、表单）
    不做: 画布、连线、粒子
```

### 统一动画引擎

全项目动画由 GSAP 独占：

| 已淘汰 | 替换为 |
|--------|--------|
| CSS transition | gsap.to() / gsap.set() |
| Web Animation API (animate()) | gsap.fromTo() |
| setTimeout 嵌套编排 | gsap.timeline() |
| rAF 手动帧计数器 | gsap.ticker + delayedCall |

---

## 架构蓝图

```
┌─────────────────────────────────────────────────┐
│                 KFMState（统一状态层）                │
│  files / boxes / connections / aiContext / ui       │
└───────┬────────────────────────┬─────────────────────┘
         │                          │
    ┌───▼─────────┐           ┌────▼─────────────────┐
    │  侧栏      │           │  中央画布            │
    │            │           │                    │
    │  Leafer    │           │  Leafer Canvas     │ ← 画布、盒子外观、连线
    │  + Yoga    │           │      ↕             │
    │  + GSAP    │           │  DOM Islands       │ ← 盒子内容：编辑器、AI
    │  + Pretext │           │  (CodeMirror 等)   │
    └─────────────┘           └──────────────────────────┘
```

### DOM Island 模式

中央画布的核心设计：盒子内容用 DOM，但"浮"在 Canvas 上。

```
Canvas 层（Leafer）：盒子边框 / 阴影 / 缩放把手 / 连线 / 粒子 / 画布背景
DOM 层（覆盖在 Canvas 上）：编辑器 / AI对话 / 输入框 / 表单
```

每个盒子在 Canvas 上有 position / size / rotation，对应 DOM 内容用 transform 跟随。

---

## 中央画布路线图

### MVP 定义

第一个可验证版本：

- [ ] Leafer Canvas 画布（可平移/缩放）
- [ ] 第一个盒子：文件卡片（从左栏拖入或点击生成）
- [ ] 盒子可拖拽、可选中
- [ ] 点击文件卡片 → 打开侧栏对应路径

### 渐进式扩展

| 步骤 | 内容 |
|------|------|
| 1 | 画布 MVP：Canvas + 可拖拽盒子 |
| 2 | DOM Island 验证：盒子内嵌入 CodeMirror 编辑器 |
| 3 | 盒子间连线：拖拽连接两个盒子 |
| 4 | AI 对话盒子：内嵌聊天 DOM |
| 5 | 工作流编排：盒子 + 连线 + 状态 = 可视化流程 |
| 6 | 持久化：工作流保存/加载 |

---

## 当前实现现状（2026-05）

当前版本是基于 **kfmv3 v2 自研引擎** 的移动端文件管理器 + AI 对话����手，作为走向蓝图的第一步。

**核心运行形态：**

```
┌──────────────────────────────────────────┐
│            KFMState（统一状态层）            │
│  files / expandedPaths / showHidden / ui   │
└────┬─────────────────┬─────────────────────┘
     │                 │
┌────▼──────┐   ┌─────▼──────────┐
│  左栏     │   │  主页面        │
│           │   │               │
│ Canvas    │   │ AI 对话       │
│ 自研引擎  │   │ 输入栏        │
│           │   │ 光球动画      │
│ 文件树    │   │ 手势控制      │
│ 光标导航  │   │               │
└───────────┘   └───────────────┘
```

### 实际技术栈

```yaml
当前使用:

  kfmv3 v2 自研引擎 (renderer.ts):
    职责: Canvas 渲染（盒子树绘制、文本排版、粒子、光标）
    核心: Box 树 + 变换链 + Pretext 文本测量
    不依赖: 第三方 Canvas 框架（愿景中的 LeaferJS 尚未引入）

  GSAP:
    职责: 动画引擎（唯一动画驱动）
    场景: 展开/折叠动画、光标平滑过渡、char-rain 字符散落

  Pretext (@chenglou/pretext):
    职责: 离屏文本测量与换行（零 reflow）

  自研 Flexbox (flex.ts):
    职责: 轻量 Flexbox 布局计算（愿景中的 Yoga 尚未引入）

  DOM:
    职责: AI 输入栏、按钮、手势层、光球特效
    不做: 文件树渲染（已 Canvas 化）
```

---

## 架构演进（已完成）

### Phase 0 — 基础设施重建

将项目从复杂的第三方依赖中解耦，建立自研渲染管线。

| 步骤 | 内容 | Commit |
|------|------|--------|
| P0.1 | Pretext 替换 offsetWidth 测量 — 消除 2 处 reflow | `7187acc` |
| P0.2 | GSAP 替换光标 CSS transition | `5fc4071` |
| P0.3 | GSAP 替换 setTimeout 叠叠乐动画 | `f6dc1db` |
| P0.4 | GSAP 替换 Web Animation API | `e863424` |
| P0.5 | 统一展开路径 — executeCursorAction 改为 dispatch click | `a8da6b4` |
| P0.6 | 统一选中逻辑 — 提取 selectFileItem 公共函数 | `8af658a` |
| P0.7 | 侧栏 Canvas 化 — kfmv3 v2 引擎渲染左栏 | `91cdc9e` 起 |

### Phase 1 — 侧栏重构

左栏从 DOM 渲染迁移到自研 Canvas 引擎。

| 组件 | 旧实现 | 新实现 |
|------|--------|--------|
| 文件树渲染 | DOM + CSS Grid | Canvas Box 树 |
| 排版 | CSS line-height | Pretext 逐行测量 |
| 文本截断 | CSS text-overflow: ellipsis | Pretext 行宽判断 + measureText |
| 折叠状态 | CSS `grid-template-rows: 0fr` | Box height 动画 |
| 偏移 | CSS 自动流 | 自研 applyAnimOffset 逐层计算 |
| 光标 | DOM div 背景高亮 | Canvas Box（渐变上线 + 下线） |

### Phase 2 — 动画系统

| 功能 | 实现 | 细节 |
|------|------|------|
| 展开动画 | GSAP → Box.height | 容器从 0→fullHeight，兄弟偏移 |
| 折叠动画 | GSAP Timeline | 三角旋转 + 容器收缩并行 |
| 子容器串行展开 | async/await + 递归 | 一个子容器展开完再展开下一个 |
| 字符散落 | char-rain.ts + GSAP | 展开时字符从屏幕顶端掉落到目标位置 |
| 光标平滑过渡 | GSAP to() | 位置/宽度/高度/动态线 0.18s power3.out |

### Phase 3 — 状态管理

**事件堆栈 + 会话隔离：**

```typescript
// 事件堆栈：同一树内快速点击串行执行
let _clickQueue = [];
let _animBusy = false;

// 会话隔离：侧栏关/开后，旧会话异步操作自动失效
let _sessionId = 0;

export function onSidebarOpen(): void {
  _sessionId++;
  gsap.globalTimeline.clear();
  // ... 重建
}

export function onSidebarClose(): void {
  _sessionId++;
  // ... 清理
}
```

关键设计：`char-rain.ts` 的 `finally` 块在执行前检查 `currentRoot !== root`，确保不会操作已重建的树���

---

## 侧栏渲染管线

```yaml
每帧 _tickAndRender:
  1. 清空 Canvas
  2. 递归遍历 Box 树
  3. 每个 Box：
     - 计算变换链（translate → rotate → scale）
     - 裁剪（overflow: hidden）
     - 绘制背景/边框
     - _drawText（逐字符绘制，Pretext 精确换行）
     - 递归子元素
  4. _drawRain（粒子系统，在变换链外绘制）
```

### 盒子模型

```typescript
interface Box {
  id: string;
  x, y, width, height: number;
  transform: { rotate, scale, translateX, translateY };
  children: Box[];
  visible, opacity, interactive, disabled: boolean;
  overflow: 'hidden' | 'visible';
  backgroundColor, borderRadius, borderWidth, borderColor;
  textStyle: { content, font, color, lineHeight, align, verticalAlign, overflow, maxLines };
  icon: { char, font, color, size };
  gesture: { onTap };
  scrollY: number;
  parent: Box | null;
  data: Record<string, any>;
}
```

---

## 颜色系统（2026-05 版本）

多次调优后的最终稳定方案：

| 元素 | 配色 |
|------|------|
| 侧栏背景 | `rgba(10,10,15,0.85)` |
| 侧栏文字 | `#e0e0e0` |
| 侧栏光标 | 绿底 + 蓝紫渐变动线 |
| 侧栏边界 | 紫蓝色 2px border-top |
| 用户气泡 | 紫蓝青渐变边框 |
| AI 气泡 | 青靛紫渐变左线条（降饱和） |
| 面板外光晕 | 紫色 |
| 编辑模式光晕 | 紫色（亮度 0.55） |
| 光球 | 紫色 |

---

## 已知设计决策

| 决策 | 当前 | 愿景 |
|------|------|------|
| Canvas 框架 | 自研 kfmv3 v2 | LeaferJS |
| 布局引擎 | 自研 flex.ts | Yoga Layout |
| 动画引擎 | GSAP | GSAP（不变） |
| 文本测量 | Pretext | Pretext（不变） |
| 状态管理 | KFMState 发布订阅 | KFMState（不变） |

---

## Git 历史（完整）

```
2025-04-xx  c6e5fb9  docs: 更新重构计划文档
2025-04-xx  e863424  refactor: GSAP 替换 Web Animation API
2025-04-xx  8af658a  refactor: 提取 selectFileItem
2025-04-xx  a8da6b4  fix: executeCursorAction 改为 dispatch click
2025-04-xx  f6dc1db  refactor: GSAP 替换叠叠乐动画
2025-04-xx  5fc4071  refactor: GSAP 替换光标高亮动画
2025-04-xx  7187acc  refactor: Pretext 替换 offsetWidth
─── 转向 kfmv3 v2 自研引擎 ───
2025-05-xx  5630399  perf: 按 expandedPaths 只获取展开节点
2025-05-xx  91cdc9e  fix: 展开/折叠动画光标闪烁
2025-05-xx  a6ed195  fix: ensureCursorBox 居中保护
2025-05-xx  6ca8add  fix: 点击展开时光标闪烁
2025-05-xx  bc12f3c  fix: 展开/折叠后光标跳转
2025-05-xx  dded230  fix: 展开动画后光标模式卡死
2025-05-xx  3595445  fix: 快速滑动时光标消失
2025-05-xx  d9df6cd  feat: 左栏右侧触摸盒子
2025-05-xx  b7f51f0  feat: 手势控制 + 右滑关闭
─── 事件堆栈 + 会话隔离 ───
2025-05-xx  15bad60  feat: UI 优化
2025-05-xx  0bbbfaa  fix: 眼睛图标 + 隐藏日志面板
2025-05-xx  bf73996  fix: 日志面板彻底删除 + 眼睛生效
─── UI 统一 ───
2025-05-xx  d002041  feat: 光球面板 UI
2025-05-xx  3ec24c6  feat: 对话气泡
2025-05-xx  b8395b6  fix: AI 渐变边框
2025-05-xx  06c3621  fix: AI 气泡光晕
2025-05-xx  40c4ff5  fix: AI 气泡降饱和度
2025-05-xx  b90cdeb  fix: 面板外光晕统紫
2025-05-xx  bd3264b  fix: 编辑模式光晕加亮
2025-05-xx  b69507d  feat: 渐变青→紫 + 紫色光球
2025-05-xx  03fdee2  fix: 交换气泡配色
2025-05-xx  4c23ee7  fix: 侧栏渐变边框 + 关闭按钮
2025-05-xx  c820cff  docs: 同步更新技术文档
```

---

## 代码审计对照（2026-05-04）

### ✅ 文档对齐

| 文档章节 | 代码位置 | 状态 |
|---------|---------|------|
| 侧栏渲染管线 | `renderer.ts` 渲染循环 | 对齐 |
| 盒子模型 | `box.ts` Box 类 | 对齐 |
| 动画 GSAP 独占 | `tree-render.ts`/`char-rain.ts` GSAP 使用 | 对齐 |
| Pretext 文本测量 | `renderer.ts` _drawText + tree-render 光标 | 对齐 |
| 事件堆栈+会话隔离 | `tree-render.ts` _sessionId/_clickQueue | 对齐 |
| 颜色系统 | `index.html` CSS + `orb.ts` + tree-render 光标 | 对齐 |
| 调试系统删除 | `app.ts`/`gestures.ts`/`tree-render.ts` 已清理 | 对齐 |

### ⚠️ 文档遗漏

| 内容 | 代码位置 | 说明 |
|------|---------|------|
| 自研 Flexbox | `engine/v2/flex.ts` (244行) | 当前只做备用，文档未展开 |
| 边框绘制引擎 | `engine/v2/BorderDrawer.ts` | 圆角/渐变/虚线边框渲染，文档未提及 |
| 自研缓动函数 | `engine/v2/animation.ts` | 备选缓动（当前由 GSAP 替代） |
| 滚动事件处理 | `engine/v2/scroll.ts` | 触摸/鼠标滚轮，树内独立实现 |
| 手势框架 | `engine/v2/gesture.ts` + `GestureRecognizer.ts` | 文档对引擎层手势系统描述不足 |
| 样式配置 | `engine/v2/StyleConfig.ts` | 盒子样式类型，未记录 |
| 全局类型 | `engine/v2/types.ts` | 类型定义汇总，未记录 |
| 工具函数 | `engine/v2/utils.ts` | 零间距常量等，未记录 |
| onSidebarOpen 完全重建 | `tree-render.ts` onSidebarOpen | 文档只记录了会话ID，实际还做了 renderer.stop → null → 重建 canvas 和事件绑定 |
| 文件数据懒加载流程 | `tree-loader.ts` loadAndAnimate | 展开文件夹 → API拉取 → notify → rebuild → 展开动画，文档未完整描述 |
| 光球实现 | `orb.ts` | AI 对话面板 + 光球跟随触摸，文档只简略提及 |

### 🗑️ 残留文件（待清理候选）

| 文件 | 行数 | 状态 |
|------|------|------|
| `src/client/modules/debug-helper.ts` | 17 | 全量删除安全 |
| `src/client/modules/debug-panel.ts` | 54 | 全量删除安全 |
| `src/client/modules/tree-render-legacy.ts` | 163 | 全量删除安全 |

三个文件在 `src/client/modules/` 目录下，但未被任何模块 import 引用，属于死文件。

### 🔍 引擎层手势系统（补充 · 文档遗漏）

引擎层有两套互补的手势系统：

```yaml
gesture.ts — 边缘检测 + 滑动识别 + 磁吸:
  常量:
    EDGE_THRESHOLD:   20px   从屏幕边缘开始检测
    SLIDE_THRESHOLD:  60px   触发展开/折叠
    SNAP_THRESHOLD:   150px  磁吸阈值
    HOLD_THRESHOLD_MS: 300ms 按住触发
  用途: 侧栏边缘滑出/滑入、面板边缘操作

GestureRecognizer.ts — 独立手势识别器:
  用途: 与 Box.gesture 属性配合，识别点击/长按/滑动等
  状态: 已创建，当前与 gestures.ts 应用层配合使用
```

应用层 `gestures.ts` 进一步封装了主页面触摸手势（右滑开侧栏、左滑关侧栏），与引擎层手势框架为独立的两层实现。

### 🔍 文件懒加载与展开流程（补充 · 文档遗漏）

展开文件夹时的完整调用链：

```yaml
用户点文件行（第二次）:
  1. processClickQueue() → doExpand()
  2. 设 animatingPath = path
  3. hit.gesture.onTap()  → KFMState.setExpanded() → notify()
     4. _stateSub → forceRebuildTree()
        5. buildSidebarTree()
           6. 发现该目录 children 未加载
              → loadFileTree.lazyLoader 拦截
     ─── 如果数据已缓存，直接走 <- 8
   
  7. loadAndAnimate(path)
     7a. fetchDirRecursive → API POST /files/list-recursive
     7b. ingestTree() → 写入 KFMState.files
     7c. KFMState.notify() → rebuildTree()（树重建，含展开预设）
     7d. triggerExpandAnimation(path)
         → GSAP 展开容器 + slideInRows（子容器递归）
         → char-rain.ts 字符散落（fire-and-forget）

  8. 动画完成 → _animBusy = false → processClickQueue()
```

### 🔍 onSidebarOpen 完全重建流程（补充 · 文档遗漏）

每次打开侧栏并非简单刷新，而是**彻底销毁重建**：

```yaml
1. _sessionId++                        # 旧会话失效
2. gsap.globalTimeline.clear()         # 杀 GSAP
3. renderer?.stop()                    # 停旧渲染器
4. renderer = null                     # 释放引用
5. cursorBox = null, cursorRowId = null # 清光标
6. fileTree.innerHTML = ''             # 删旧 canvas DOM
7. 创建新 canvas → new Renderer()
8. requestAnimationFrame → rebuildTree()  # 等 layout
9. 重新绑定 scroll/click/gamepad 事件
```

---

## 盒子协议（设计决策 · 2026-05-04）

### 核心原则

```yaml
对称性: 用户能做什么，AI 就能做什么
  所有能力包装成盒子 -> AI 通过"盒子协议"操作
  Tool Call 只是"AI 操作盒子的统一接口"

自然生长: 能力不是预先设计，而是随盒子逐步解锁
  创建新盒子 = 用户和 AI 同时获得新能力
  没有独立注册的工具集

移动优先: 所有 UI 设计受限于手机屏幕
  侧栏可隐藏、光球可收起、命令置底
  不做桌面端的"平铺所有窗口"
```

### 盒子的本质

每个盒子必须实现三个接口：

```
interface BoxDefinition {
  id: string;              // 盒子类型标识
  name: string;            // 显示名称
  icon: string;            // 图标

  // 声明能力 — AI 通过它了解如何操作本盒子
  actions: Action[];

  // 提供当前上下文 — AI 调用前自动收集
  getContext(): BoxContext;
}

interface Action {
  name: string;
  description: string;
  params: ParamDef[];
}

interface ParamDef {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

interface BoxContext {
  activeSelection?: {
    type: "cursor" | "range" | "file" | "command" | "marker";
    value: string;
    metadata?: Record<string, any>;
  };
  markers?: {
    type: string;
    content: string;
    location?: string;
  }[];
}
```

### AI 调用盒子 vs 用户操作盒子

```yaml
用户操作:
  触摸/点击 -> 直接操作盒子 UI -> 键盘/手势输入

AI 操作:
  对话中 -> Tool Call -> { op: "box", boxId, action, params }
  -> 框架路由到目标盒子 -> 执行 -> 结果返回 AI

AI 的 Tool Call 统一格式:
  {
    "op": "box",
    "boxId": "terminal-1",
    "action": "exec",
    "params": { "cmd": "npm run build", "timeoutMs": 30000 }
  }

能力解锁:
  盒子未创建 -> 用户和 AI 都没有这个能力
  盒子已创建 -> 用户能操作它，AI 也能通过盒子协议操作它
  盒子更新 -> 能力同时增长，用户和 AI 同步
  不需要单独注册"AI 工具集"——每个盒子就是 AI 的工具
```

### 全局输入栏的定位

```yaml
全局输入栏只做一件事: 向 AI 发送消息
它不是其他盒子的统一代理键盘

为什么有效:
  编辑器里改代码 -> 直接在编辑器盒子里点 + 召唤键盘
  终端里输命令 -> 直接在终端盒子里点 + 召唤键盘
  跟 AI 说话 -> 全局输入栏（常驻入口，方便随时呼叫 AI）

两个路径共存:
  快速操作 -> 用 AI（全局输入栏输入指令）
  精确控制 -> 直接上手（盒子内点触输入）
```

### 共享上下文设计 — 标记系统

核心：用户不需要"展示"上下文给 AI，只需"标记"它。这在手机屏幕上尤为必要。

#### 两种标记模式

| 模式 | 数量 | 语义 | 给 AI 的理解 |
|------|------|------|------------|
| 点击光标 | 1 个 | "操作目标在这里" | AI 知道要修改/执行的目标位置 |
| 路标标记 | 多个 | "参考这些内容" | AI 知道用户引用了哪些上下文 |

#### 用户操作流示例

```
1. 在编辑器里点了一下第 42 行       -> 光标在那（操作目标）
2. 切换到文件树，点了一个对比文件  -> 文件路径被标记（参考来源）
3. 切换到终端，双击某行错误输出   -> 错误消息被标记（参考来源）
4. 回到底部输入栏说:
   "根据这个错误，参考 compare.ts 的写法，在这里改一下"

AI 收到的上下文:
  - 活跃盒子: editor-1, 第 42 行
  - 标记参考: compare.ts 路径、终端错误行
  -> AI 准确理解用户的组合意图
```

#### 在移动端的优势

```yaml
桌面端: 用户可以"展示"上下文（多窗口自然可见）
  用户: "看这个错误（指向终端），参考这个写法（指向编辑器），改这里（指向代码）"
  问题: AI 可能在多个窗口间猜错上下文

手机端: 用户无法同时展示多窗口，所以需要"标记"上下文
  用户: "看这个错误（已标记），参考这个写法（已标记），改这里（已标记）"
  优势: 手机端的标记反而比桌面端更精确
  -> 用户必须显式标记，AI 100% 确定上下文
```

### AI 自我进化闭环

```
AI 看工作台（文件树盒子 / 编辑器盒子）
  -> 发现问题
  -> 修改代码（编辑器盒子）
  -> 构建验证（终端盒子）
  -> 看输出（终端盒子 / 对话盒子）
  -> 再修改
```

第一批 P0 两个盒子（对话 + 终端）已经能让最小闭环跑通。

---

## 当前 UI 设计哲理解释

为什么当前 UI 是"隐藏侧栏 + 光球收起 + 命令置底"：

```yaml
这不是妥协，而是为盒化做的空间预留。

当前布局的设计理解:
  底部: 全局输入栏（常驻入口，随时呼叫 AI）
  中央: 中央面板（未来放其他盒子的空间）
  侧栏: 收起（需要时唤出 = 文件树盒子展开）
  光球: 收起（需要时展开 = 对话盒子）

理解方式:
  不存在"主页面"的概念
  只有"当前操作的盒子"——
  打开侧栏 = 文件树盒子展开
  展开光球 = 对话盒子展开
  收起全部 = 所有盒子最小化，留出空白工作台
```


## 盒子引擎与侧边堆叠卡片（设计决策 · 2026-05-04）

### 盒子引擎 — 从光球中提取通用模板

```
光球面板 (orb.ts) 分析:
  ├─ 创建: DOM div + CSS 样式（渐变边框 / 毛玻璃 / 圆角 / 阴影）
  ├─ 拖拽: 鼠标/触摸事件 → 更新 style.left/top
  ├─ 缩放: 长按进入编辑 → 拖拽调整宽高 → 松手退出
  ├─ 边界约束: getInputBarTop() + 屏幕边缘 → 自动压缩尺寸
  ├─ 展开/收起: 点击光球切换 + 过渡动画
  └─ 内容层: 内部 DOM 容器 + renderContent() 回调

提取为通用盒子模板后:
  所有盒子共享：
    · 框架样式（渐变边框 / 毛玻璃 / 阴影）
    · 拖拽 + 缩放 + 边界约束
    · 展开/收起状态切换
    · onResize(newWidth, newHeight) 回调给内容层

  每个盒子定制：
    · 内容插槽的 DOM
    · 生命周期行为（打开/关闭/缩放时做什么）
    · 最小尺寸约束（min-width / min-height）
```

### 设置盒子 — 第一个实例

```
设置盒子 = 盒子引擎模板 + 设置表单

表单内容:
  · API key 输入框（文本输入）
  · 模型选择（单选卡片或下拉）
  · 保存按钮

交互方式:
  · 展开/收起 → 复用光球面板机制（点击/下滑）
  · 但收起后不留常驻入口（不占用屏幕）
  · 入口：菜单图标 / AI 召唤 / 侧边堆叠卡片

为什么不用 Canvas + pretext 做内容:
  设置盒子的核心交互是"填表单"，不是"排版文本"
  DOM + flex 处理输入框/下拉/按钮更自然
  缩放时 flex 自动重排，无需手动计算位置
```

### 侧边堆叠卡片 — 盒子唤出方案

#### 方案对比

```
方案一 — 按住 → 右侧弹堆叠 → 上下滑选 → 松手确定:
  优点: 手势连贯，一次操作完成"找→选→确定"
  风险: 操作时手指不能松；上下滑动手感随卡片数增加变差；松手瞬间确定无反悔机会

方案二（选定）— 左滑唤出 → 上下滑选聚焦 → 左滑扔入 / 右滑关闭:
  优点: 每个动作有明确语义；手指有休息机会（呼出后可释手）
  风险: "上下滑切换"与"左滑扔入"方向不同，需区分起始区域
```

#### 选定方案的手势协议

```
右边缘 30px 内水平左滑    → 呼出堆叠卡片面板
卡片区域垂直滑动        → 切换聚焦卡片（突出那张）
聚焦卡片再左滑          → 卡片"飞入"中央（确认打开）
右滑（或点击背景）      → 关闭堆叠面板

手势判定区分离:
  边缘区（屏幕右沿 30px 内）→ 只判水平滑动（呼出/扔入/关闭）
  内区（卡片区域）         → 只判垂直滑动（切换选择）
  两个区域不混淆
```

#### 与文件树点击模型的操作同构

```
文件树                           堆叠卡片
─────────────────────────────────────────
点击不同行 → 光标切换         上下滑 → 聚焦卡片切换
再次点击同一行 → 执行操作     左滑扔入 → 确认选择（飞入中央）
点击右侧空白 → 关闭侧栏       右滑 → 关闭堆叠面板
_clickQueue 队列 + sessionId   事件队列（可复用）
点击判同行为确认               滑动判方向+距离为确认
```

#### 待定设计点

```
卡片物理尺寸:
  · 宽度: 固定值(240px?) vs 自适应
  · 高度: 固定 vs 内容撑开
  · 堆叠偏移量: 每张错开多少(5px/8px/12px?)

卡片视觉层次（三层结构）:
  最上层（聚焦卡片）:
    边框高亮色，阴影更亮，内容完全可见
  中间层（邻近 2-3 张）:
    边框半透明，阴影淡化，内容半透明遮挡
  底层（剩余卡片）:
    仅露边缘色条(2-3px)，不显示内容

颜色系统:
  现有颜色:
    --accent-prim: #0f0 (绿)
    --accent-sec:  #0cf (青)
    --bg-panel:    rgba(20,16,32,0.92)
  配色方案候选:
    · 紫青渐变（#7c3aed → #0cf）— 跟光球一致
    · 蓝绿系（#0cf → #0f0）— 冷静清晰
    · 单色系（同一色调不同明度）— 极简
```

---

## 节奏

```yaml
Phase I — AI 闭环基础:
  - 对话盒子加固（光球面板 -> 完整盒子协议）
  - 终端盒子（新做）
  - 服务端盒子协议路由

Phase II — 盒子系统:
  - 文件树盒子（现有左栏改造为独立盒子）
  - 设置盒子（统一配置入口）
  - 标记系统实现（点击光标 + 路标标记）

Phase III — AI 自我进化:
  - 编辑器盒子（语法高亮编辑器）
  - AI 自我修改完整闭环
  - 多端部署（Win/Linux/Termux）

Phase IV — 持续进化:
  - 更多盒子类型
  - 工作流编排（盒子 + 连线 + 状态）
  - 持久化与跨平台
```
