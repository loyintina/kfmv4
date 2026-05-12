# KFM v4 卡片系统设计方案

> 写于 2026-05-12，基于工作台（workbench）模式的统一卡片交互设计。
> 本文捕获设计共识，作为后续实现的参考基准。

---

## 一、核心理念

### 工作台

Canvas 背景网格 = 工作台。所有内容以"卡片"的形式在工作台上浮动。

```
  左栏             工作台                右栏
  (文件树)         ········网格·········    (工具坞)

  src/              ┌─────────────┐        AI
    a.txt ---->     │ a.txt       │        调试
    b.ts  ---->     │ [编辑器内容] │        设置
  docs/             └─────────────┘        笔记
    readme             AI 对话
```

### 统一卡片

一切浮动元素都是卡片。AI 对话、调试面板、文件编辑器、工具面板——唯一的区别是内容。

卡片生命周期：

```
  工具坞 ---拖出-->  浮动卡片  <---左栏点击（文件卡）
     ^                  |
     |                  | 点击标题栏
     |                  v
     +--拖回/关闭--- 展开面板
                       |
                       | 长按
                       v
                    编辑大小
```

## 二、视觉设计（已确认）

### 卡片样式

```

  |  AI 对话                     | <- 24-28px 极简标题栏
  |  ---------------------------    |    4px 色条（左边缘，专属色）
  |                                |    彩色图标
  |   (深色毛玻璃内容区)            |
  |                                |    背景: rgba(20,16,32,0.92)
  |                                |    backdrop-filter: blur(16px)
  |                                |    边框: 1px transparent
  |                                |    圆角: 12px
  |                                |    阴影: 同当前 orb 风格
  |                                |
  |  [输入...              发送]   |
  +--------------------------------+

```

### 配色系统

沿用卡片堆的星云光谱（CARD_COLORS），每种卡片分配一个 Accent Color：

| 卡片 | 色值 | 用途 |
|------|------|------|
| AI 对话 | `#7c3aed` 紫 | 全局默认展开 |
| 调试面板 | `#00c8a0` 青 | 默认 dock |
| 文件编辑 | `#50A880` 绿 | 文件类型映射 |
| 设置 | `#C88C5A` 琥珀 | dock |
| 新建文件 | `#5088C8` 蓝 | dock |
| 笔记 | `#B4AA50` 金 | dock |
| 插件 | `#9650C8` 紫罗兰 | dock |
| 统计 | `#6C5CC8` 靛蓝 | dock |
| 关于 | `#B46478` 玫瑰 | dock |

### 卡片状态

三种状态，统一命名：

| 状态 | 说明 | 视觉 |
|------|------|------|
| `dock` | 停靠在右侧工具坞 | 仅显示彩色圆点 + 图标 |
| `float` | 在工作台上浮动 | 完整卡片（标题栏 + 内容区） |
| `editing` | 长按进入调整大小 | 浮动卡片 + 加亮阴影 + 拖动改大小 |

## 三、卡片类型

### 文件卡（File Card）

| 属性 | 值 |
|------|-----|
| 触发 | 左栏文件树点击 |
| 初始状态 | 直接 `float`（无 dock 态） |
| 关闭 | 关掉即消失，不入工具坞 |
| 内容 | 文件编辑器/查看器 |
| 配色 | 按文件扩展名映射（复用 `getFileColor`） |

### 工具卡（Tool Card）

| 属性 | 值 |
|------|-----|
| 来源 | 右侧工具坞 |
| 初始状态 | `dock` |
| 交互 | 拖出 -> `float`，拖回工具坞 -> `dock` |
| 内容 | 工具面板（设置、调试、笔记等） |
| 配色 | 固定 Accent Color |

### AI 对话卡（特殊工具卡）

| 属性 | 值 |
|------|-----|
| 初始状态 | `float`（始终可见，不 dock） |
| 特殊性 | 唯一的全局常驻卡片 |
| 复用 | 保留现有聊天排版逻辑（消息气泡、输入栏、文字压缩） |

## 四、架构设计

### 目录结构

```
src/client/cards/
├── card-manager.ts          # 治理中心：注册、调度、生命周期
├── card-shell.ts            # 统一 DOM 渲染（标题栏 + 毛玻璃壳 + 拖动）
├── card-dock.ts             # 右侧工具坞渲染
├── types.ts                 # CardConfig 等类型定义
├── cards/
│   ├── ai-chat-card.ts      # AI 聊天（复用 orb.ts 内容）
│   ├── debug-card.ts        # 调试面板（复用 debug-panel.ts 内容）
│   ├── file-card.ts         # 文件编辑（新实现）
│   └── tool-cards.ts        # 设置/笔记/插件等工具卡片
└── README.md                # 卡片系统开发指南
```

### 核心接口

```typescript
// types.ts

type CardState = 'dock' | 'float' | 'editing';
type CardKind = 'file' | 'tool';

interface CardConfig {
  id: string;
  kind: CardKind;
  icon: string;             // 标题栏图标
  name: string;             // 标题文本
  accentColor: string;      // 主色 -> 色条 + 边框渐变

  // 几何（float 态生效）
  defaultWidth: number;
  defaultHeight: number;

  // 初始状态
  initialState?: CardState;

  // 内容渲染
  render: (shell: CardShell) => void;
  // shell 提供：
  //   shell.contentEl --- 内容区 HTMLElement，卡片填充到这里
  //   shell.headerEl  --- 标题栏 HTMLElement（可自定义）
  //   shell.cardEl    --- 整个卡片的容器

  destroy?: () => void;     // 清理事件监听等

  persistGeometry?: boolean; // 是否保存位置大小到 localStorage
}
```

### CardShell（统一 DOM 结构）

每个浮动卡片创建如下 DOM：

```html
<div class="card-shell" style="left:X; top:Y; width:W; height:H">
  <div class="card-header" style="border-left: 3px solid {accent}">
    <span class="card-icon">{icon}</span>
    <span class="card-name">{name}</span>
  </div>
  <div class="card-content">  <!-- 内容区，交给具体卡片渲染 -->
  </div>
</div>
```

### CardManager（治理中心）

```typescript
class CardManager {
  register(config: CardConfig): void;
  unregister(cardId: string): void;

  open(cardId: string): void;        // dock -> float
  close(cardId: string): void;       // float -> dock（工具卡）或销毁（文件卡）
  toggle(cardId: string): void;

  getCard(cardId: string): CardInstance | undefined;
  getAllCards(): CardInstance[];

  // 内部职责
  // - z-index 管理（最新打开的卡片在最前）
  // - 位置持久化（localStorage）
  // - 拖动事件统一调度
  // - 与 GestureRegistry 的协调
}
```

## 五、复用策略

### 从 orb.ts 复用的逻辑

| 逻辑 | 去向 | 说明 |
|------|------|------|
| 拖动事件绑定（mouse + touch） | `card-shell.ts` | 提取为公共函数 |
| 位置限制（clamp） | `card-shell.ts` | 加上下边界参数 |
| 长按检测 | `card-shell.ts` | 拖动阈值 5px |
| 面板跟随压缩 | `card-shell.ts` | orbCX - panelWidth 计算 |
| 状态切换（expand/collapse/edit） | `card-shell.ts` | 统一三态 |
| 聊天消息排版 | `ai-chat-card.ts` | 原地保留 |
| escapeHtml | `ai-chat-card.ts` | 原地保留 |

### 从 debug-panel.ts 复用的逻辑

| 逻辑 | 去向 | 说明 |
|------|------|------|
| 拖动事件绑定 | `card-shell.ts` | 与 orb 合并 |
| 日志渲染 + clear/copy | `debug-card.ts` | 原地保留 |

## 六、工具坞（Card Dock）

右侧工具坞的设计：

```
  AI     <- 紫色圆点 + 图标，点击切换 float/dock
  调试   <- 青色
  设置   <- 琥珀
  笔记   <- 金色
  插件   <- 紫罗兰
  统计   <- 靛蓝
  关于   <- 玫瑰
```

交互规则：
- 点击 dock 图标 -> 卡片从右侧滑入工作台（float）
- 拖动 dock 图标 -> 卡片跟随手指拖出
- 卡片 close 时 -> 飞回 dock 位置
- AI 卡片特殊：它始终 float，但点击其 dock 图标可 focus/隐藏

## 七、现有代码迁移路径

| 步骤 | 内容 | 状态影响 | 优先级 |
|------|------|----------|--------|
| 1 | 新建 `src/client/cards/` 目录 + 类型定义 | 无 | P0 |
| 2 | 实现 `card-shell.ts`（统一 DOM 渲染 + 拖动） | 无（纯新代码） | P0 |
| 3 | 实现 `card-manager.ts` | 无（纯新代码） | P0 |
| 4 | 实现 `card-dock.ts` | 无（纯新代码） | P0 |
| 5 | 将 orb.ts 迁入 `ai-chat-card.ts` | 替换现有 orb | P1 |
| 6 | 将 debug-panel.ts 迁入 `debug-card.ts` | 替换现有 debug | P1 |
| 7 | 将 card-stack 预设卡迁入工具坞 | 替换 card-stack | P2 |
| 8 | 实现 file-card | 新功能 | P2 |

## 八、未解决的问题

以下留待后续讨论确定：

1. **AI 聊天卡的隐藏**：用户如果不想看到 AI 卡片，该如何处理？右上角关闭按钮还是保持可见？
2. **文件卡自动布局**：打开文件时卡片出现在工作台的什么位置？自动居中？层叠偏移？还是记住上次位置？
3. **多张卡片同时 float**：是否限制同时展开的卡片数量上限？z-index 如何管理（新开卡自动置顶）？
4. **文件卡关闭时提示保存**：有未保存的修改时是否需要确认弹窗？
5. **卡片位置持久化**：刷新页面后是否恢复之前的卡片位置和状态？使用 localStorage 还是服务端存储？

---

> **本文档与代码同步。实现过程中如发现设计漏洞，先更新本文再改代码。**
