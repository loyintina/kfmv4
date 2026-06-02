# KFM v4 会话记忆（2026-06-02）

> **新会话必读。** 本文档是当前会话的实时快照——焦点、架构状态、陷阱。
> 
> 进度跟踪和待办总览在 `HANDOFF_AUDIT.md`，本文档不再重复维护。
> 开工前需通读 `KFM_V4_INVARIANTS.md`（修改约束协议）和 `ui-registry.ts`（新增注册逻辑）。

---

## 当前焦点

**v6.0.0 — UI Element Registry 已实现。**
- `(as any)` 逃逸全部清理（白名单清空，3 处修复）
- `ui-registry.ts` 已创建（类型定义 + Registry 类 + 全局单例）
- 10 个交互元素已注册（orb、orb-panel、sidebar、sidebar-toggle-btn、card-stack-toggle-btn、close-sidebar-btn、eye-btn、card-stack、input-bar、operation-toast）
- `check-registry.mjs` 已接入 `npm run check` 和 `npm run build` 管线
- 新增交互元素时必须同时：①在 init 函数中调 `Registry.register()` ②在 `check-registry.mjs` 的 MANIFEST 数组追加 id

---

## 关键架构状态

### 新增模块：UI Element Registry

| 文件 | 路径 |
|------|------|
| 注册表类 | `src/client/modules/ui-registry.ts` |
| MANIFEST 验证 | `check-registry.mjs` |

设计参见 `docs/UI_ELEMENT_REGISTRY_SPEC.md` §S（已定稿）。

已知缺口：
- **Problem 5（AI→浏览器通信通道）未解决** — Registry 目前只做"眼睛"（被动索引），"手"（服务端调用浏览器端函数）还需后续设计
- **动态状态更新未实现** — Registry 注册时记录初始状态，不跟踪模块的运行时状态变化。后续可通过 getter 集成（§5.1 方案 A）补充

### gesture-registry 现有 handler

```
picker-lock         110  →  picker 打开时拦截所有事件
orb                 100  →  主光球拖拽
floating-orb        100  →  浮卡角球拖拽
sidebar-scroll       60  →  文件树滚动/光标 + 左滑关闭
gestures-page-swipe  50  →  页面级侧滑
card-stack-global    80  →  卡片堆手势
```

### 当前设计模式

**Registry 黄页模式**（`docs/UI_ELEMENT_REGISTRY_SPEC.md`）：
- 模块在 `init*()` 中调 `Registry.register({...})`，只注册一次
- Registry 不存储业务状态，不监听事件，不启动 rAF
- `snapshot()` 聚合所有三层信息（交互层 + 内容层 + 能力层）
- MANIFEST 验证强制所有新 UI 元素完成注册

---

## 已知的隐式陷阱

1. **CSS 布局方程**（`BUG_AUDIT_REGISTRY.md` 1.10）：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**（`BUG_AUDIT_REGISTRY.md` 1.9）：连续调 `setExpanded` 会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法原则 9）：搬运代码必须 `git show` 原样复制后改，禁止重写
5. **改动前先说明**（SOP 步骤 5）：每项改动前需说清"改什么、为什么、效果、怎么验证"
6. **Registry MANIFEST**（`check-registry.mjs`）：新增交互元素必须同时注册 + 加入 MANIFEST，漏任意一个 `npm run check` 失败

---

## 测试状态

- `npm run check` 零错误（check-anim ✓ / check-as-any ✓ / check-registry ✓ / tsc ✓）
- `npm run test` 74 passed, 0 failed
- `(as any)` 逃逸：0 处（白名单已清空）
- 服务端：`node dist/server/index.js` → `http://localhost:8021`
