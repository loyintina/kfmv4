---
status: superseded
superseded_by: docs/archive/design/HANDOFF_2026-06-03_TRIAGE_AUDIT_FIX.md
archived_at: 2026-06-03
created_at: 2026-06-03
context: UI Registry 审计修复 + ws-channel 悬空函数修复 + 文档对齐
supersedes: docs/notes/REGISTRY_AUDIT_2026-06-03.md（补充）
---

# 交接：Registry 审计修复（v6.3.0）

## 本轮做了什么

对照 `docs/UI_ELEMENT_REGISTRY_SPEC.md`（766 行）与代码，发现 6 处文档-代码偏差 + 4 处代码缺陷，已全部修复。

### 最大发现

**`registerDefaultCommandHandlers()` 从未被调用。** `initWsChannel()` 中注释写了"注册默认指令处理器"但没有实际调这个函数。这意味着 AI `click`、`set-input`、`file-search`、`refresh-snapshot` 这些通用命令自 WebSocket 通道实现以来从未工作过。模块注册的命名命令（`expand-orb`、`open-sidebar` 等）不受影响因为它们在各模块的 `init*()` 中单独注册。

### 其他发现

| 严重性 | 问题 | 修复 |
|--------|------|------|
| 中 | `registerContent()` 的生成器守卫逻辑倒置：先写脏数据再守卫 | 改为先检查生成器存在，早返 |
| 中 | `eye-btn` 无专用命令处理器，对称操作缺口 | 新增 `toggle-hidden-files` 命令 |
| 低 | 6 处文档-代码偏差（§S.3/S.4/S.5/S.6/§2.1/§2.4/§3.2） | 全部更新 |
| 低 | `notifyStateChange` 散布未跟踪（心法 12 违反） | 记入 `HANDBOOK.md` 陷阱 14 |

## 留给下一轮的

### notifyStateChange 散布根除（P3）

当前 6 个文件 ~41 处调用的手动 `notifyStateChange()` 散布是一个已知的补丁模式。KFMState.subscribe 已覆盖数据层变更，但 GSAP 动画回调和 DOM classList 操作路径仍需手动通知。根解方向：在 ws-channel 层建立自动覆盖检测，识别哪些 notifyStateChange 调用是冗余的（已被 KFMState 订阅覆盖）。

### sidebar 双重状态源（P3）

`KFMState.sidebarOpen` 字段与 DOM `.sidebar.open` classList 同时存在。当前 `openSidebar`/`closeSidebar` 已同步更新两者，但有两个来源意味着未来可能偏离。根解：移除 `KFMState.sidebarOpen`（仅从 DOM classList 派生），或反之——但需评估影响范围。

### 不是 bug：通用 click 对 DOM 元素坐标无关

审计发现 #13 声称 4 个元素依赖通用 click 不可靠——这是误判。对 DOM 按钮来说 `element.click()` 无论坐标都能触发原生事件。坐标问题只影响 Canvas 渲染的 `file-tree`。

## 已验证

- `npm run check` — 零错误
- `npm run test` — 105/105 通过
