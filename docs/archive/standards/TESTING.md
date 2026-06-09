---
status: superseded
archived_at: 2026-06-02
superseded_by: docs/HANDBOOK.md
---
# KFM v4 回归测试

## 自动化回归测试

```bash
npm test   # 74 个测试，覆盖 10 个模块
```

| # | 测试组 | 覆盖模块 | 断言数 |
|---|--------|----------|--------|
| 1 | click-queue | click-queue.ts (入队/出队/peek/clear) | 4 |
| 2 | state machine | renderer-lifecycle.ts (状态机/cancelAllRafs/resetForOpen) | 7 |
| 3 | tree-model | tree-model.ts (容器嵌套/高度) | 3 |
| 4 | debug-assert | debug-assert.ts (函数存在性) | 2 |
| 5 | state (KFMState) | state.ts (订阅/expanded/hooks/toggle/setViewport/FileRowData) | 12 |
| 6 | animation-registry | animation-registry.ts (scope/play/kill/reverse/killAll) | 11 |
| 7 | style-registry | style-registry.ts (模板/缩进/颜色/createBox/patch) | 14 |
| 8 | gesture-registry | gesture-registry.ts (优先级/过滤/条件/disable/事件模拟) | 14 |
| 9 | card-stack | card-stack.ts (状态机/开-关-聚焦循环) | 6 |
| 10 | overlay invariants | tree-render.ts (动画入口异常安全) | 2 |

## 手动回归检查清单

仍需要手动验证的交互（无法通过 CLI 自动化）：

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
| 13 | 紧凑态浮卡点击 BR 光球展开 | 三颗角光球从 BR 位置滑入，与卡片动画同步，无淡入淡出 |
| 14 | 展开态浮卡点击 BR 光球折叠 | 三颗角光球滑回 BR 位置，卡片同步收缩，无淡入淡出 |
| 15 | 展开态浮卡点击 TR 光球关闭 | 所有光球 + 卡片同步向 TR 圆心收缩消失，无淡入淡出 |
| 16 | 快速点击展开态 TR 光球 | 展开动画期间误触不触发关闭（状态守卫） |
| 17 | 展开后观察 BR 光球 SVG 图标 | 展开动画开始时图标已切换为十字+圈，折叠时同步清除 |
