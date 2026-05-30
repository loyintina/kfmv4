# KFM v4 会话记忆（2026-05-29）

> 会话进入长上下文模式。如需新建会话继续推进，
> 新 agent 先读此文件理解当前状态，然后按需通读
> `KFM_V4_INVARIANTS.md` + `BUG_AUDIT_REGISTRY.md` + `HANDOFF_AUDIT.md`。

---

## 当前焦点

**文件树根目录切换器（root-picker）** — 已用 `buildTree` 重构，待测试和微调。

---

## 代码改动汇总

### 已完成的（无需再动）

| 改动 | 文件 | commit |
|------|------|--------|
| SCSS 迁移 | 所有 .css → .scss | b5a2dbe |
| 手势系统整合 | canvas-scroll.ts, tree-render.ts, debug-panel.ts | 7eeb035 |
| sidebar-nav 删除 | sidebar-nav.ts + 引用 | 9d6b1dc |
| 青色光球删除 | debug-panel.ts, theme.ts, main.ts | 550899e |
| 文档-代码审计 | 多个文档修正 + dead CSS 清理 | 4c30fe0 |
| BUG_AUDIT_REGISTRY 补充 | 诊断流程 + B.A.R. #006 + 隐性契约 1.9/1.10 | 多次提交 |
| KFM_V4_INVARIANTS 补充 | 心法原则 9/10 + SOP 步骤5 + 1.5/1.6 | 多次提交 |

### 正在进行（待测试/微调）

- **root-picker.ts** — `buildTree` 已替代手写 Box 树，视觉一致性待验证
- **KFMState.files 保存/恢复机制** — 打开/关闭 picker 时的数据恢复逻辑

### 未开始

- P2 `(as any)` 类型逃逸
- P3 `doExpand`/`doCollapse` 去重
- P3 `orb.ts`/`debug-panel.ts` 拖动逻辑合并（debug-panel 已删）
- P3 单例 DI 改造
- picker 左/右导航接口（受 SAFE_ROOT 限制，暂不实现）

---

## 关键架构状态

### gesture-registry 现有 handler

```
picker-lock         110  →  picker 打开时拦截所有事件
orb                 100  →  主光球拖拽
floating-orb        100  →  浮卡角球拖拽
sidebar-scroll       60  →  文件树滚动/光标 + 左滑关闭
gestures-page-swipe  50  →  页面级侧滑
card-stack-global    80  →  卡片堆手势
```

### 绕过的 3 条管道（已全部清理）

- ~~canvas-scroll.ts 直接 pointerdown/move/up~~ → 迁移
- ~~_createSidebarTouchArea 直接 pointerdown/up~~ → 删除
- ~~_bindBrDragEvents 直接 pointerdown/move/up~~ → 未调用（已确认是死代码）

### 现在 picker 打开的防御体系（单一防线）

```
picker-lock (priority 110, stopPropagation)
  → 阻挡 gesture-registry 所有 handler
  → click handler 通过 isPickerOpen() 守卫
  → 无需 pointer-events:none hack
```

### 设计模式

**Renderer 替换模式**（KFM_V4_INVARIANTS §1.6）：
- picker 打开时保存 L.renderer → 替换为 pickerRenderer
- 关闭时恢复
- 适用于文件树的变体面板，不适用于完全不同的交互模型

---

## 已知的隐式陷阱

1. **CSS 布局方程**（BUG_AUDIT_REGISTRY 1.10）：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**（BUG_AUDIT_REGISTRY 1.9）：连续调 `setExpanded` 会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法原则 9）：搬运代码必须 git show 原样复制后改，禁止重写
5. **改动前先说明**（SOP 步骤 5）：每项改动前需说清"改什么、为什么、效果、怎么验证"——写完代码再说，不要写成后补

---

## 测试状态

- `npm run check` 和 `npm run build` 零错误
- 测试 63 passed, 8 failed（全部 failures 在 gesture-registry，因为 JSDOM mock 不支持 touchstart，是预先存在的问题）
- 服务端：`serve public -l 8021` + `node dist/server/index.js` 双进程
