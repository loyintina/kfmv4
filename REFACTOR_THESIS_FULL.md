# Kalo File Manager (KFM v4) — 技术架构与演进记录

> AI 人机交互的个人工作台 — 手机浏览器移动端优先
> 核心理念：一切皆盒子

---

## 现状（2026-05）

当前版本是基于 **kfmv3 v2 自研引擎** 的移动端文件管理器 + AI 对话助手。

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

---

## 技术栈

```yaml
实际使用:

  kfmv3 v2 自研引擎 (renderer.ts):
    职责: Canvas 渲染（盒子树绘制、文本排版、粒子、光标）
    核心: Box 树 + 变换链 + Pretext 文本测量
    不依赖: 第三方 Canvas 框架

  GSAP:
    职责: 动画引擎（唯一动画驱动）
    场景: 展开/折叠动画、光标平滑过渡、char-rain 字符散落

  Pretext (@chenglou/pretext):
    职责: 离屏文本测量与换行（零 reflow）

  自研 Flexbox (flex.ts):
    职责: 轻量 Flexbox 布局计算（无 WASM 依赖）

  DOM:
    职责: AI 输入栏、按钮、手势层、光球特效
    不做: 文件树渲染（已 Canvas 化）
```

---

## 架构演进

### Phase 0 — 基础设施重建（已完成）

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

### Phase 1 — 侧栏重构（已完成）

左栏从 DOM 渲染迁移到自研 Canvas 引擎。

**核心变化：**

| 组件 | 旧实现 | 新实现 |
|------|--------|--------|
| 文件树渲染 | DOM + CSS Grid | Canvas Box 树 |
| 排版 | CSS line-height | Pretext 逐行测量 |
| 文本截断 | CSS text-overflow: ellipsis | Pretext 行宽判断 + measureText |
| 折叠状态 | CSS `grid-template-rows: 0fr` | Box height 动画 |
| 偏移 | CSS 自动流 | 自研 applyAnimOffset 逐层计算 |
| 光标 | DOM div 背景高亮 | Canvas Box（渐变上线 + 下线） |

### Phase 2 — 动画系统（已完成）

| 功能 | 实现 | 细节 |
|------|------|------|
| 展开动画 | GSAP → Box.height | 容器从 0→fullHeight，兄弟偏移 |
| 折叠动画 | GSAP Timeline | 三角旋转 + 容器收缩并行 |
| 子容器串行展开 | async/await + 递归 | 一个子容器展开完再展开下一个 |
| 字符散落 | char-rain.ts + GSAP | 展开时字符从屏幕顶端掉落到目标位置 |
| 光标平滑过渡 | GSAP to() | 位置/宽度/高度/动态线 0.18s power3.out |

### Phase 3 — 状态管理（已完成）

**事件堆栈 + 会话隔离：**

```typescript
// 事件堆栈：同一树内快速点击串行执行
let _clickQueue = [];
let _animBusy = false;

// 会话隔离：侧栏关/开后，旧会话异步操作自动失效
let _sessionId = 0;

export function onSidebarOpen(): void {
  _sessionId++;          // 新会话
  gsap.globalTimeline.clear();  // 杀残留 GSAP
  // ... 重建
}

export function onSidebarClose(): void {
  _sessionId++;          // 旧会话残留静默失效
  // ... 清理
}
```

关键设计：`char-rain.ts` 的 `finally` 块在执行前检查 `currentRoot !== root`，确保不会操作已重建的树。

---

## 侧栏渲染管线

```
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
  scrollY: number;  // 滚动容器
  parent: Box | null;
  data: Record<string, any>;
}
```

### 坐标系

```
变换链内 → 局部坐标（box.getAbsolutePosition）
变换链外 → 屏幕坐标（ctx.getTransform().transformPoint）

文字绘制和粒子系统在同一变换链内完成，坐标天然对齐。
```

---

## 颜色系统（2026-05 版本）

多次调优后的最终稳定方案：

| 元素 | 配色 | 描述 |
|------|------|------|
| 侧栏背景 | `rgba(10,10,15,0.85)` | 深色半透明 |
| 侧栏文字 | `#e0e0e0` | 浅灰 |
| 侧栏光标 | `rgba(46,213,163,0.15)` 背景 + 青色动态线 | 绿底 + 蓝紫渐变动线 |
| 侧栏边界 | 紫蓝色 2px border-top | 渐变紫蓝青 |
| 用户气泡 | 紫蓝青渐变边框 | 饱和度较高 |
| AI 气泡 | 青靛紫渐变左线条 | 饱和度较低 |
| 面板外光晕 | 紫色 | 统一紫色调 |
| 编辑模式光晕 | 紫色（亮度 0.55） | 明显可辨 |
| 光球 | 紫色 | 跟随系统色 |

---

## 调试系统

**当前状态：日志面板已彻底移除。**

经历了三次删除：
1. `index.html` 中 `#logPanel` DOM（`0bbbfaa` 用 display:none 隐藏）
2. `src/client/modules/app.ts` 中所有日志代码（`bf73996` 彻底删除 addLog/openLogPanel 等全部函数）
3. `src/client/modules/tree-render.ts` 末尾的自执行 IIFE 调试面板（`bf73996` 删除 "D" 按钮 + 第二个调试日志）

当前 `console.log` 不受任何劫持，直接输出到浏览器控制台。

---

## Git 历史（完整）

```
2025-04-xx  c6e5fb9  docs: 更新重构计划文档
2025-04-xx  e863424  refactor(phase4): GSAP 替换 Web Animation API
2025-04-xx  8af658a  refactor: 提取 selectFileItem 统一选中逻辑
2025-04-xx  a8da6b4  fix: executeCursorAction 改为 dispatch click
2025-04-xx  f6dc1db  refactor(phase3): GSAP 替换叠叠乐动画
2025-04-xx  5fc4071  refactor(phase2): GSAP 替换光标高亮动画
2025-04-xx  7187acc  refactor(phase1): Pretext 替换 offsetWidth
─── Phase 1-4 完成，转向 kfmv3 v2 引擎 ───
2025-05-xx  5630399  perf: 按 expandedPaths 只获取展开节点
2025-05-xx  91cdc9e  fix: 展开/折叠动画时光标高度闪烁等
2025-05-xx  a6ed195  fix: ensureCursorBox 居中保护
2025-05-xx  6ca8add  fix: 点击展开时光标闪烁
2025-05-xx  bc12f3c  fix: 展开/折叠后光标跳转
2025-05-xx  dded230  fix: 展开动画后光标模式卡死
2025-05-xx  3595445  fix: 快速滑动时光标消失 — GSAP 降级
2025-05-xx  d9df6cd  feat: 左栏右侧触摸盒子同步滚动
2025-05-xx  b7f51f0  feat: 手势控制 + 右滑关闭
─── 事件堆栈 + 会话隔离 ───
2025-05-xx  15bad60  feat: UI 优化 — 日志隐藏、按钮、光标删除
2025-05-xx  0bbbfaa  fix: 眼睛图标 + 日志面板彻底移除
2025-05-xx  bf73996  fix: 日志面板彻底删除 + 眼睛生效修复
─── UI 统一 ───
2025-05-xx  d002041  feat: 光球面板 UI — 渐变边框 + 青色光球
2025-05-xx  3ec24c6  feat: 对话气泡 — 用户渐变边框 + AI 青色线条
2025-05-xx  b8395b6  fix: 编辑模式不破坏渐变边框 + AI 冷色渐变
2025-05-xx  06c3621  fix: AI 气泡亮色渐变 + 四边光晕
2025-05-xx  40c4ff5  fix: AI 气泡降饱和度
2025-05-xx  b90cdeb  fix: 面板外光晕统一紫色
2025-05-xx  bd3264b  fix: 编辑模式紫色光晕加亮
2025-05-xx  b69507d  feat: 面板/气泡渐变青→紫 + 光球紫色
2025-05-xx  03fdee2  fix: 交换气泡配色
2025-05-xx  4c23ee7  fix: 侧栏工具条渐变紫蓝青边框 + 关闭按钮
```

---

## 已知设计决策

| 决策 | 结论 | 原因 |
|------|------|------|
| Canvas 框架 | 自研 kfmv3 v2（不用 LeaferJS） | 第三方框架约束过多，自研引擎完全可控 |
| 布局引擎 | 自研 flex.ts（不用 Yoga） | 文件树布局简单，无需 WASM |
| 动画引擎 | GSAP 独占（不用 CSS transition） | 动画可控、可链式编排、可全局 kill |
| 文本测量 | Pretext 独占 | 零 reflow，与 Canvas 坐标系无缝配合 |
| 状态管理 | KFMState 简单发布订阅（不用 Redux） | 小型项目，避免过度抽象 |
| 调试 | 无内嵌调试面板 | 浏览器 DevTools 已足够 |
| 隐藏文件 | 服务端返回全部，客户端过滤 | toggle 时无需重新拉取 API |

---

## 未来方向

```yaml
短期:
  - 光标 Canvas 化完善（边框粒子同步诞生）
  - 边框 Canvas 化（脱离 CSS border-left）
  - 背景 Canvas 化（装饰层完全脱离 DOM）

中期:
  - 中央画布 MVP（Canvas 可拖拽盒子）
  - DOM Island 验证（盒子内嵌编辑器）
  - AI 对话盒子集成

远期:
  - 工作流编排（盒子 + 连线 + 状态）
  - 持久化
  - 跨平台（桌面 → APK → EXE）
```
