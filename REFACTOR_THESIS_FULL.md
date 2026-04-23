# Kaf Fee Mew — 技术架构与实施蓝图

> AI 人机交互的个人工作台，创意与能力的延伸工具。
> 一切皆盒子。

---

## 愿景

```yaml
名字: Kaf Fee Mew (KFM / 咖啡猫)
本质: 面向 AI 人机交互的个人工作台
核心理念: 一切皆盒子——任何可拆分的要素都可以卡片形式加入工作流

交互模型:
  左栏: 文件树（选择 / 创建 / 管理）
  中央画布: 盒子卡片桌面（工作流编排）
  盒子类型: 文件卡片 / 编辑器 / AI提示词 / 输入框 / 历史记录 / 设置面板 / …
  交互: 左栏选择文件 → 中央生成卡片 → 点击卡片进入编辑器

运行平台:
  现在: 手机浏览器（移动端优先）
  未来: 桌面浏览器 → APK → EXE → CLI
```

---

## 技术栈

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

全项目动画由 GSAP 独占。以下实现已淘汰：

| 已淘汰 | 替换为 |
|--------|--------|
| CSS transition | gsap.to() / gsap.set() |
| Web Animation API (animate()) | gsap.fromTo() |
| setTimeout 嵌套编排 | gsap.timeline() |
| rAF 手动帧计数器 | gsap.ticker + delayedCall |

保留不动的原生实现（已足够优雅）：

| 保留 | 原因 |
|------|------|
| CSS Grid 0fr→1fr transition | GSAP 无法控制 CSS Grid fr 单位 |
| @keyframes q弹-in | 与 Grid 展开配合精确 |
| scrollTo({ behavior: 'smooth' }) | 原生平滑滚动跟随系统偏好 |

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

中央画布的核心设计：盒子内容用 DOM，但“浮”在 Canvas 上。

```
Canvas 层（Leafer）：盒子边框 / 阴影 / 缩放把手 / 连线 / 粒子 / 画布背景
DOM 层（覆盖在 Canvas 上）：编辑器 / AI对话 / 输入框 / 表单
```

每个盒子在 Canvas 上有 position / size / rotation，对应 DOM 内容用 transform 跟随。拖拽由 Canvas 事件处理，文字编辑由 DOM 处理。

---

## 状态层设计（草案）

```typescript
interface KFMState {
  // 文件系统
  files: FileNode[];
  selectedPath: string;
  expandedPaths: Record<string, boolean>;
  
  // 画布盒子
  boxes: BoxNode[];
  connections: Connection[];
  viewport: { x: number; y: number; zoom: number };
  
  // AI
  aiContext: AIContext;
  activeTool: ToolType;
  
  // UI
  sidebarOpen: boolean;
  activeBoxId: string | null;
}

interface BoxNode {
  id: string;
  type: 'file' | 'editor' | 'ai-prompt' | 'input' | 'history' | 'settings' | 'custom';
  x: number; y: number;
  width: number; height: number;
  data: Record<string, any>;  // 类型相关数据
}
```

各渲染区域订阅状态变化，渲染器与数据解耦。

---

## 侧栏实施记录

### 已完成

| Phase | 内容 | 改动摘要 | Commit |
|-------|------|----------|--------|
| 1 | Pretext 文本测量 | offsetWidth → measureNaturalWidthSync，消除 2 处 reflow | 7187acc |
| 2 | GSAP 光标动画 | CSS transition → gsap.to/set，rAF帧计数器 → ticker+delayedCall | 5fc4071 |
| 3 | GSAP 叠叠乐 | 3层setTimeout嵌套 → gsap.timeline | f6dc1db |
| 4 | GSAP 名称盒子 | pathEl.animate() → gsap.fromTo()，getAnimations().cancel() → gsap.killTweensOf() | e863424 |
| + | 统一展开路径 | executeCursorAction 25行独立逻辑 → 3行 dispatchEvent('click') | a8da6b4 |
| + | 统一选中逻辑 | 5条重复路径 → selectFileItem() 公共函数，修复 restoreCursorPosition 缺失 updateSidebarPath | 8af658a |

### 跳过

| Phase | 内容 | 原因 |
|-------|------|------|
| 5 | GSAP 滚动居中 | scrollTo smooth 原生已足够，替换反失系统一性 |
| 6-7 | 连线 + 粒子 | 连线与简洁设计理念冲突；粒子需等 Canvas 化后同层实现 |

### 待做

| Phase | 内容 | 说明 |
|-------|------|------|
| 8a | 光标 → Canvas + 粒子 | 光标从 DOM 毕业，边框粒子同步诞生。独立闭环，零风险 |
| 8b | 边框 → Canvas | .tree-children-wrap border-left 在 Canvas 层渲染 |
| 8c | 背景 → Canvas | 渐变背景 Canvas 化，装饰层完全脱离 DOM |

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

## 跨平台策略

```yaml
原则: 移动优先，不锁死

当前: 手机浏览器（ESM + DOM + Canvas）

未来路径:
  桌面浏览器: 同一套代码，响应式布局
  APK: Capacitor / Tauri 封装
  EXE: Tauri（Rust + WebView）
  CLI: 状态层 + headless 渲染器

关键约束:
  - 状态层必须与渲染层解耦
  - 不依赖浏览器特有 API（用可替换的抽象层）
  - 移动端交互（触摸/手势）为第一公民
```

---

## 盒子类型枚举

| 类型 | 内容渲染 | 交互 |
|------|---------|------|
| file | Canvas（文件名+图标） | 点击进入编辑器 |
| editor | DOM（CodeMirror等） | 文字编辑 |
| ai-prompt | DOM（聊天界面） | AI 对话 |
| input | DOM（原生 input） | 全局输入 |
| history | DOM（列表） | 操作回溯 |
| settings | DOM（表单） | 配置修改 |
| custom | 混合 | 用户定义 |

---

## 节奏

```
短期（现在）:
  1. 侧栏 8a — 光标 Canvas 化 + 边框粒子
  2. KFMState 状态层设计
  
中期:
  3. 中央画布 MVP
  4. DOM Island 验证
  5. AI 对话盒子
  
远期:
  6. 工作流编排
  7. 持久化
  8. 跨平台
```

---

## Git 历史

```
c6e5fb9 docs: 更新重构计划文档，同步Phase1-4完成状态
e863424 refactor(phase4): GSAP替换Web Animation API
8af658a refactor: 提取selectFileItem统一选中逻辑
a8da6b4 fix: executeCursorAction改为dispatch click事件
f6dc1db refactor(phase3): GSAP替换叠叠乐动画
5fc4071 refactor(phase2): GSAP替换光标高亮动画
7187acc refactor(phase1): Pretext替换offsetWidth测量
```
