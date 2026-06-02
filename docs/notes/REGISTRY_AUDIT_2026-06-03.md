---
status: active
created_at: 2026-06-03
context: UI Registry 文档-代码偏差审计 + 心法 14 + CI 增强 + 五处代码修正
---

# UI Registry 审计：发现、根因与修复

> 本文记录 2026-06-03 对 UI Element Registry 的全面审计结果。
> 审计对照了 `docs/UI_ELEMENT_REGISTRY_SPEC.md`、`src/client/modules/ui-registry.ts`、
> 11 个交互元素的注册站点、`ws-channel.ts` 的命令处理器、和 `public/index.html` 的 DOM 属性。
>
> 关联文档：`docs/KFM_V4_INVARIANTS.md`（心法 14 + 心法 13 补充）、`check-registry.mjs`（data-registry-id 交叉验证）

---

## 审计发现（8 项，4 项已修复）

见 `docs/notes/REGISTRY_NEXT_AGENT_DISCUSSION.md` 的上一轮开放问题追踪。

### 已修复

| # | 问题 | 严重性 | 修复 |
|---|------|--------|------|
| 1 | `ui-registry.ts` 尾部的 `KFMState.subscribe()` 违反 §S.0（被动索引不订阅状态） | 高 | 移至 `ws-channel.ts` 的 `initWsChannel()`——通信层负责桥接状态层到推送，Registry 恢复纯被动 |
| 2 | `KFMState.sidebarOpen` 死字段：`openSidebar()`/`closeSidebar()` 不更新它 | 中 | 在 ui.ts 中补调 `KFMState.setSidebarOpen(true/false)` |
| 3 | `close-sidebar-btn` state 用 `'enabled'` 而非 `'visible'` | 低 | 改为 `'visible'`/`'hidden'` 配对 |
| 8 | `ai-send-btn` 有 `data-registry-id` 但无注册（孤儿） | 中 | 从 HTML 移除（无对应注册） |

### 未修复（前置存在，不在本轮 scope 内）

| # | 问题 | 严重性 | 原因 |
|---|------|--------|------|
| 7 | `file-tree`（Canvas）无 tree 命令处理器（expand-dir 等） | 中 | Canvas 元素无法通过通用 click 指令操作。需要新增 tree 命令（如 `expand-dir`/`collapse-dir`/`select-file`）才能让 AI 真正操作文件树 |

---

## 新增约束

### 心法 14（`KFM_V4_INVARIANTS.md` §〇）

"替换分散不等于解决根因——一份集中的违反仍是违反"
- 判断标准表（是否违反已写约束 / 去掉后散布是否会回来 / 新位置的角色）
- 正反例子（`KFMState.subscribe()` 是集中违规 vs KFMState 层直接触发推送是真正重构）
- 例外规则：有计划的阶段性过渡需在提交信息标注 P3 跟踪项

### 心法 13 补充

"跨模块机制的最后一公里"——建了 `data-registry-id` 查询、ws-channel 命令通道等跨模块机制后，必须至少有 1 个消费者完成端到端链路才能关 commit。

### SOP 步骤 6 扩展

"链路追踪：从 snapshot 到用户可见的操作结果"
- 为 MANIFEST 中每个受影响的元素走通 `snapshot → AI 指令 → 命令分发 → DOM 操作 → snapshot 反映变化` 路径
- 断点需修复或登记

### check-registry.mjs 增强

新增 `data-registry-id` 交叉验证：
- 扫描 `public/index.html` 收集所有 `data-registry-id` 属性
- 检查 1：MANIFEST 中需要 DOM 定位的元素是否在 HTML 中有对应属性（`NO_DOM_TARGET` 豁免表允许 Canvas/动态/非交互元素跳过）
- 检查 2：HTML 中的 `data-registry-id` 是否在 MANIFEST 中有对应注册（拦截孤儿属性）

---

## 三个 agent 失败模式的抽象

| 模式 | 表现 | 根因 | 对应约束 |
|------|------|------|---------|
| **基础设施优先，布线之后**（Agent A） | 建了 ws-channel 和命令通道但没有 data-registry-id 和完整命令处理器 | 施工顺序导致的信息丢失 | 心法 13 末段 + SOP 链路追踪 |
| **按清单修复，不推全量**（Agent B） | 修了审计报告列出的项，但没做 MANIFEST → HTML → handler 的端到端推导 | 修复者在边界处停下来了 | check-registry data-registry-id 交叉验证 |
| **用集中违规替代根解**（Agent C） | 用 KFMState.subscribe() 替代 41 处散布的 notifyStateChange，自称"根解" | 错误归因：把中央调控当作根因消除 | 心法 14 |

---

## 给后续 agent 的建议

1. **`file-tree` 的操作缺口是下一个值得做的 P2**——AI 能看到文件树但无法操作它。需要新增 `expand-dir`/`collapse-dir`/`select-file` 命令处理器，以及对应地在 tree-render.ts 中暴露这些操作函数。

2. **新增交互元素时，保证四件事在同一个 commit 中完成**：
   - `Registry.registerElement()` 调用
   - ELEMENT_MANIFEST 条目
   - `data-registry-id` 属性（或加入 NO_DOM_TARGET）
   - ws-channel 命令处理器（或确认通用 click 够用）

3. **不要在任何模块文件尾部做"自动订阅"式的 hack。** 如果状态变化需要触发推送，把监听放在通信层（ws-channel），不要在数据层（state）或索引层（registry）做。

4. **侧栏状态的双源问题已修（DOM + KFMState），但 ui.ts 的 import 顺序仍然是乱的**（`import { DOM }` 在函数定义之后）。如果有人重构 ui.ts，可以顺手把 import 全部提到文件顶部。
