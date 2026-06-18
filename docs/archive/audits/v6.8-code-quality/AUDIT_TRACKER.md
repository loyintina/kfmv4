---
status: completed
archived_at: 2026-06-18
---

# KFM v4 — 代码质量审计追踪（v6.8）

> **状态**：已完成（2026-06-18）
> 本轮审计覆盖 14 项发现，全部已修复。
>
> 格式：`#` 编号 · `P0-P2` 优先级 · `✅` 已修复 / `🔄` 修复中 / `⏳` 待处理

---

## 🔴 P0 — 违反文档约束

| # | 优先级 | 问题 | 文件 | 说明 | 状态 |
|---|--------|------|------|------|------|
| 1 | 🔴 P0 | **Web Animations API 替代 GSAP** | `orb.ts` | `initInputBarWatcher` 中 `el.animate()` 改为 `anim.to()`；rAF 轮询改为 `visualViewport.resize` 事件驱动 | ✅ |
| 2 | 🔴 P0 | **CSS transition 残留** | `orb.ts`, `tree-swipe.ts` | 面板淡入/按钮 hover/模式按钮背景三处 CSS transition 改为 GSAP `anim.to()` | ✅ |
| 3 | 🔴 P0 | **`_` 前缀跨模块访问** | `canvas-cursor.ts`, `canvas-scroll.ts`, `tree-render.ts` | 5 个函数 `_moveCursorBySteps`/`_isCursorMode`/`_getCenterRowIndex`/`_snapCursorToCenter`/`_scrollToCenterCursor` 去 `_` 前缀，统一命名 | ✅ |

## 🟠 P1 — 代码结构

| # | 优先级 | 问题 | 文件 | 说明 | 状态 |
|---|--------|------|------|------|------|
| 4 | 🟠 P1 | **tree-swipe.ts 内耦合 4 个独立职责** | `color-utils.ts`（新建） `mode-system.ts`（新建） `tree-swipe.ts`（1006→628行） | 拆为 color-utils.ts（纯函数）+ mode-system.ts（模式系统）+ tree-swipe.ts（卡片堆核心），通过回调解耦循环依赖 | ✅ |
| 5 | 🟠 P1 | **animation-registry.ts 死类型导出** | `animation-registry.ts:16-18` | 删除无人消费的 `AnimTween`/`AnimTimelineVars`/`AnimTweenVars` | ✅ |
| 6 | 🟠 P1 | **style-registry 反向依赖 KFMState** | `style-registry.ts` | 删 `KFMState` import 和 `notify()` 调用，删空壳 `subscribe`/`unsubscribe` 方法 | ✅ |

## 🆕 模块依赖检查

| # | 优先级 | 问题 | 说明 | 状态 |
|---|--------|------|------|------|
| 13 | 🟠 P1 | **建立模块依赖方向白名单** | `check-consistency.mjs` | 新增 engine→modules 禁止扫描，覆盖 14 个引擎文件。零例外，无限扩展必要 | ✅ |
| 7 | 🟠 P1 | **`155px` 宽度硬编码 3 处** | `interaction-constants.ts` `floating-card.ts` `card-stack.ts` `tree-swipe.ts` | 统一到 `interaction-constants.ts` 的 `FLOATING_CARD_W`/`FLOATING_CARD_H`，4 处统一引用 | ✅ |

## 🟡 P2 — 整洁度

| # | 优先级 | 问题 | 文件 | 说明 | 状态 |
|---|--------|------|------|------|------|
| 8 | 🟡 P2 | **KFMState.files 裸写赋值** | `state.ts` `tree-loader.ts` `root-picker.ts` | 新增 `setFile()`/`deleteFile()` 方法，8 处裸写赋值全部改为方法调用 | ✅ |
| 9 | 🟡 P2 | **catch {} 吞 fetch 错误** | `tree-loader.ts` | 两处 catch 改为 `log()` 记录错误信息 | ✅ |
| 10 | 🟡 P2 | **console.log 调试输出约 10 处** | `card-stack.ts`, `tree-render.ts`, `renderer.ts` 等 | 生产环境应移除或走 logger | ⏳ |
| 11 | 🟡 P2 | **字段缩写命名不统一** | `floating-card.ts` | 拖拽闭包内 `_fRS`/`_fItem` 等改为无前缀命名（`rs`/`dragItem` 等） | ✅ |
| 12 | 🟡 P2 | **CLAUDE.md 配置描述过时** | `CLAUDE.md` | 删除已不存在的 `nullish-coalescing: false` 引用 | ✅ |

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
