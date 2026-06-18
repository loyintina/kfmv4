# KFM v4 — 当前审计追踪

> **状态**：进行中（2026-06-18）
> 本表记录当前审计轮次发现的问题。修复完成后按下一个版本号归档至 `archive/audits/vX.Y.Z-code-quality/`。
>
> 格式：`#` 编号 · `P0-P2` 优先级 · `✅` 已修复 / `🔄` 修复中 / `⏳` 待处理

---

## 🔴 P0 — 违反文档约束

| # | 优先级 | 问题 | 文件 | 说明 | 状态 |
|---|--------|------|------|------|------|
| 1 | 🔴 P0 | **Web Animations API 替代 GSAP** | `orb.ts` | `initInputBarWatcher` 中 `el.animate()` 改为 `anim.to()`；rAF 轮询改为 `visualViewport.resize` 事件驱动 | ✅ |
| 2 | 🔴 P0 | **CSS transition 残留** | `orb.ts`, `tree-swipe.ts` | 面板淡入/按钮 hover/模式按钮背景三处 CSS transition 改为 GSAP `anim.to()` | ✅ |
| 3 | 🔴 P0 | **`_` 前缀跨模块访问** | `canvas-cursor.ts` → `canvas-scroll.ts` | `_moveCursorBySteps`、`_isCursorMode`、`_getCenterRowIndex`、`_snapCursorToCenter`、`_scrollToCenterCursor` 以 `_` 开头但被其他模块 import，违反 §1.2 | ⏳ |

## 🟠 P1 — 代码结构

| # | 优先级 | 问题 | 文件 | 说明 | 状态 |
|---|--------|------|------|------|------|
| 4 | 🟠 P1 | **tree-swipe.ts 内耦合 4 个独立职责** | `tree-swipe.ts` (1006行) | 行回弹动画、临时卡片堆聚焦、模式按钮系统（~400行含SVG图标/渐变色表/主题定义）、背景卡工具栏DOM构建混在同一文件，建议拆为 `temp-stack.ts` + `mode-system.ts` | ⏳ |
| 5 | 🟠 P1 | **animation-registry.ts 死类型导出** | `animation-registry.ts:16-18` | `AnimTween`、`AnimTimelineVars`、`AnimTweenVars` 被 `export type` 但没有消费者 import（仅 `AnimTimeline` 被使用） | ⏳ |
| 6 | 🟠 P1 | **style-registry 反向依赖 KFMState** | `style-registry.ts:162,174` | `set()`/`patch()` 直接调 `KFMState.notify()`，样式注册表不应知道状态层存在 | ⏳ |
| 7 | 🟠 P1 | **`155px` 宽度硬编码 3 处** | `floating-card.ts:33`(常量) vs `tree-swipe.ts:212` / `card-stack.ts:224`(内联) | 改浮卡宽度要改 3 个文件，应提取为共享常量 | ⏳ |

## 🟡 P2 — 整洁度

| # | 优先级 | 问题 | 文件 | 说明 | 状态 |
|---|--------|------|------|------|------|
| 8 | 🟡 P2 | **KFMState.files 裸写赋值 5+ 处** | `tree-loader.ts`, `root-picker.ts` 等 | 直接 `KFMState.files[key] = {...}` 没有守卫，改数据结构时难追踪所有写入口 | ⏳ |
| 9 | 🟡 P2 | **catch {} 吞 fetch 错误** | `tree-loader.ts:83` | 完全吞掉失败信息，至少应 `console.error` | ⏳ |
| 10 | 🟡 P2 | **console.log 调试输出约 10 处** | `card-stack.ts`, `tree-render.ts`, `renderer.ts` 等 | 生产环境应移除或走 logger | ⏳ |
| 11 | 🟡 P2 | **字段缩写命名不统一** | `floating-card.ts` 拖拽闭包 | `_fItem`/`_fRS`/`_fMARGIN` 使用 `_f` 前缀，与其他模块 `_` 命名风格不一致 | ⏳ |
| 12 | 🟡 P2 | **CLAUDE.md 配置描述过时** | `CLAUDE.md:75` | 引用 `supported: { nullish-coalescing: false }` 但 build.mjs 中已不存在此配置 | ⏳ |

---

## 审计范围

| 维度 | 覆盖情况 |
|------|---------|
| 源码文件 | 全部 50 个 `.ts` 文件 ✅ |
| 文档文件 | 全部 55 个 `.md` 文件 ✅ |
| 测试文件 | 5 个测试文件 ✅ |
| git 历史 | 854 个 commit，版本树完整梳理 ✅ |

## 已完成的修复

| 日期 | 事项 |
|------|------|
| 2026-06-18 | 补打 3 个缺失 git tag（v5.0.0 / v6.7.0 / v6.8.0） |
| 2026-06-18 | 升级 check-versions.mjs — 新增 tag 存在性检测 + 版本历史表扫描 |
| 2026-06-18 | 修复 HANDBOOK.md / WORKBENCH_SPEC.md / AGENTS.md 过期标记 |
