---
status: superseded
superseded_by: src/client/modules/file-action-bar.ts
archived_at: 2026-06-22
version: v1.0
---

# 卡片工作台 Phase 7 — 长按抽屉栏

> 本文是 `WORKBENCH_SPEC.md` §11 Phase 7 的详细实施设计。
> 确认后再编码。

---

## 一、交互流程

```
用户长按文件树某行 >500ms
  → 侧栏内该行高亮（维持原 cursor 高亮不变）
  → 侧栏之外的页面区域变暗（半透明遮罩）
  → 侧栏底部平滑滑出操作抽屉栏（GSAP power3.out, ~300ms）
  → 手指抬起

用户在抽屉栏中选择操作
  → 重命名 | 复制路径 | 删除 | 新建文件夹（占位）| 新建文件（占位）

点击遮罩 → 抽屉栏向下滑出关闭
点击侧栏内其他区域 → 关闭
关闭侧栏 → 关闭
文件树滚动 → 关闭
切换模式按钮 → 关闭
```

### 边界条件

| 场景 | 行为 |
|------|------|
| 长按检测期间手指移动 >10px | 取消长按，转为滚动/滑动 |
| 长按触发后手指抬起 | 保持抽屉栏打开（遮罩可关闭） |
| 快速连续长按不同行 | 关闭旧抽屉 → 打开新抽屉 |
| 遮罩上双指操作 | 忽略（仅单指触控） |
| 长按时模式系统已打开 | 关闭模式系统，打开抽屉（模式优先级低于长按） |

---

## 二、长按检测机制

### 2.1 GestureRegistry 扩展

现有 `GestureHandler` 接口增加两个可选字段：

```typescript
export interface GestureHandler {
  // ... 现有字段
  longPressMs?: number;          // 长按触发毫秒
  onLongPress?: (event: PointerEvent) => void;  // 长按回调
}
```

### 2.2 时序逻辑

```
pointerdown (onStart)
  ├─ 记录 startX/startY/startTime
  ├─ 记录目标文件行路径（_touchRowPath）
  └─ 启动 setTimeout(longPressMs)

pointermove (onMove)
  ├─ 位移 < 10px → 不操作（timer 继续）
  ├─ 位移 ≥ 10px → clearTimeout（取消长按，正常走滚动/滑动）
  └─ 位移后回到原位 → 没有特殊逻辑（已被取消）

setTimeout 触发
  ├─ 设 longPressConsumed = true
  ├─ 调用 onLongPress(event)
  └─ 后续 onMove/onEnd 被 GestureRegistry 跳过（见下）

pointerup (onEnd)
  ├─ 如果 longPressConsumed → 跳过 onEnd，清空 _active
  └─ 否则正常 onEnd
```

### 2.3 定位目标行

`_findRowAtPoint(clientX, clientY)`: 遍历 `L._rowIndex`，用 `getAbsolutePosition()` 检测触摸点是否落在某行的 bounding box 内。返回 `FileRowData.path`。

### 2.4 注册位置

在 `canvas-scroll.ts` 的 `sidebar-scroll` gesture 中追加 `longPressMs: 500` 和 `onLongPress`。因为：

- sidebar-scroll 已有的 `condition: () => !L.isSidebarClosed()` 天然保证侧栏关闭时不响应
- 同一个 gesture handler 管理长按和滚动/滑动，不需要额外的手势优先级竞争
- 当一个 gesture handler 同时配置了 `onStart`/`onMove`/`onEnd` 和 `longPressMs`/`onLongPress`，交互模式由运行时行为决定：静止→长按，移动→滚动/滑动

---

## 三、遮罩层设计

### 3.1 DOM 结构

```html
<div id="action-dimmer">    <!-- 全屏半透明遮罩 -->
  <!-- 点击 → 关闭 -->
</div>

<div id="action-drawer">    <!-- 侧栏底部抽屉 -->
  <div class="action-item">重命名</div>
  <div class="action-item">复制路径</div>
  <div class="action-item">删除</div>
  <div class="action-item disabled">新建文件夹</div>
  <div class="action-item disabled">新建文件</div>
</div>
```

### 3.2 遮罩样式

```
position: fixed; inset: 0;
z-index: 1005;
background: rgba(0, 0, 0, 0.45);
pointer-events: auto;
```

- 比工具栏的 `z-index: 1010` 低，保证 ✓/✗ 按钮在遮罩之上
- 比侧栏的 `z-index` 高，保证遮罩覆盖侧栏外部区域

### 3.3 点击响应

- 点击遮罩 → 关闭抽屉栏（`dismissFileActionBar()`）
- 点击抽屉栏内部 → 事件不冒泡到遮罩（`e.stopPropagation()`）
- 点击侧栏内部（但不在抽屉栏内）→ 关闭抽屉栏

### 3.4 动画

```
打开：
  dimmer: anim.fromTo({opacity: 0}, {opacity: 1, duration: 200ms})
  drawer: anim.fromTo({y: '100%'}, {y: '0%', duration: 300ms, ease: 'power3.out'})

关闭：
  dimmer + drawer 同时
  anim.to({opacity: 0, y: '100%', duration: 200ms, ease: 'power2.in', onComplete: remove})
```

---

## 四、抽屉栏设计

### 4.1 定位与尺寸

```
position: fixed;
left: <侧栏左沿>;
right: 0;
bottom: 0;
z-index: 1006;
```

- left = `window.innerWidth - sidebarWidth`（侧栏右半部分全宽）
- 高度 = 5 项 × 44px + 上下 padding 12px = 244px
- 圆角：`border-radius: 16px 16px 0 0`
- 与 ✓/✗ 工具栏 `right: -12px` 一致（多出的 12px 覆盖侧栏右边界的阴影溢出）

### 4.2 视觉风格

| 属性 | 值 | 来源 |
|------|-----|------|
| 背景 | `rgba(18,18,26,0.92)` | 与 ✓/✗ 按钮背景一致 |
| backdrop-filter | `blur(12px)` | 玻璃质感 |
| 边框 | `1px solid rgba(0,212,255,0.2)` | 蓝紫渐变系 |
| 文字色 | `rgba(224,224,240,0.85)` | 与系统文字一致 |
| 禁用色 | `rgba(224,224,240,0.35)` | 占位项 |
| 分隔线 | `1px solid rgba(255,255,255,0.06)` | 项之间细线 |
| 字号 | `14px` | 系统字体 |
| ✓ 颜色 | `#4ade80` | 复制成功确认色 |

### 4.3 文本项

```
┌── 侧栏右边界 ──────────────────────┐
│                                      │
│  重命名                    重命名     │  ← 无图标，纯文字
│  ─────────────────────────────────── │
│  复制路径              ✓              │  ← 复制后 ✓ 显示
│  ─────────────────────────────────── │
│  删除                               │
│  ─────────────────────────────────── │
│  新建文件夹（灰色）                    │  ← disabled，不可点击
│  ─────────────────────────────────── │
│  新建文件（灰色）                      │  ← disabled，不可点击
│                                      │
└──────────────────────────────────────┘
```

### 4.4 ✓ 反馈机制

- 点击"复制路径" → `navigator.clipboard.writeText(path)` → 该行右侧显示 ✓
- ✓ 仅通过 `display: none/inline` 切换
- ✓ 持续显示到：
  - 抽屉关闭（再次打开时重置）
  - 页面刷新
- 用 `_copiedPaths: Set<string>` 追踪哪些文件已复制

### 4.5 重命名行覆盖

```
用户点击"重命名"
  → 关闭抽屉栏
  → 定位该行 Canvas Box 的屏幕坐标（getAbsolutePosition + canvas offset）
  → 在该位置创建 <input type="text">
     样式: 宽高匹配行尺寸，深色背景 + 蓝紫边框 + 亮色文字
     初始值: 文件名
     auto-focus + select()
  → 回车 / 失焦 → 提交 POST /api/files/rename
  → 成功 → forceRebuildTree()
  → 失败 → 保持 input，提示（或静默）
```

---

## 五、API 端点

### POST /api/files/rename

**Request:**
```json
{
  "path": "/home/user/project/file.txt",
  "newName": "renamed.txt"
}
```

**Response (success):**
```json
{
  "success": true,
  "source": "/home/user/project/file.txt",
  "dest": "/home/user/project/renamed.txt"
}
```

**Response (error):**
```json
{
  "error": "目标已存在",
  "path": "/home/user/project/renamed.txt"
}
```

**逻辑：**
1. `sanitizePath(path)` → 安全校验
2. 校验 `newName` 合法性（非空、不含 `/`）
3. `path.dirname(path) + newName` = 目标路径
4. 检查目标是否存在 → 已存在则报错
5. `fs.renameSync(src, dest)` → 返回成功

---

## 六、关闭条件汇总

| # | 触发事件 | 行为 | 实现方式 |
|---|---------|------|---------|
| 1 | 点击遮罩 | 关闭 | dimmer click handler |
| 2 | 点击侧栏内（非抽屉） | 关闭 | sidebar-scroll onStart 检测 `isFileActionBarOpen()` → dismiss |
| 3 | 关闭侧栏 | 关闭 | `ui.ts closeSidebar()` 内调 `dismissFileActionBar()` |
| 4 | 文件树滚动 | 关闭 | sidebar-scroll onMove 检测 → dismiss |
| 5 | 切换模式按钮 | 关闭 | mode-system 的 updateModeSelection 检测 → dismiss |
| 6 | 操作已完成（rename/delete） | 关闭 | 操作处理函数末尾调用 |

---

## 七、改动清单

| 步骤 | 文件 | 内容 | 估行 |
|------|------|------|------|
| 1 | `gesture-registry.ts` | 新增 `longPressMs`/`onLongPress` 类型 + `_handleStart/Move/End` 长按 timer 逻辑 | ~30 行 |
| 2 | `canvas-scroll.ts` | `sidebar-scroll` 追加 `longPressMs:500` + `onLongPress` + `_findRowAtPoint` + `_touchRowPath` 状态 | ~35 行 |
| 3 | `file-action-bar.ts` | **新模块**：`showFileActionBar()` / `dismissFileActionBar()` / `isFileActionBarOpen()` + 操作处理函数 + DOM 构建 | ~200 行 |
| 4 | `ui.ts` | `closeSidebar()` 内加 `dismissFileActionBar()` | ~1 行 |
| 5 | `src/server/index.ts` | `POST /api/files/rename` 端点 | ~15 行 |
| 6 | HANDBOOK.md | 模块表 + 待办状态更新 | ~5 行 |
| | **合计** | | **~286 行** |

---

## 八、不做的事

| 不做 | 原因 |
|------|------|
| 新建文件夹/文件的功能 | 占位，等 Phase 5 |
| 拖动排序抽屉项 | 只有 3 个启用项，不需要 |
| 抽屉栏从上方滑入 | 侧栏底部是最自然的手指位置 |
| 动画期间防止交互 | GSAP 会自动处理，~300ms 极短 |
| 多选行复制 | 单文件操作，批量操作由模式系统覆盖 |
| ✗ 按钮在抽屉栏中 | 点击遮罩关闭已够 |
| toast 提示 | 复制路径用 ✓ 替代，rename/delete 无 toast |
