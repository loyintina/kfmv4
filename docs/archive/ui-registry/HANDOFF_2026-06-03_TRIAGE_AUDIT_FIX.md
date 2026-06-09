---
status: superseded
superseded_by: docs/archive/ui-registry/HANDOFF_2026-06-03_AUDIT_FIX_DEEP.md
archived_at: 2026-06-03
created_at: 2026-06-03
context: 三方对照审计 + 五项修复 + notifyStateChange 冗余清理 + 文档 frontmatter 全量修复
supersedes: docs/notes/HANDOFF_2026-06-03_REGISTRY_AUDIT.md
---

# 交接：审计修复 + 心法合规清理（v6.3.x）

## 本轮做了什么

对照 `docs/UI_ELEMENT_REGISTRY_SPEC.md`、`docs/KFM_V4_INVARIANTS.md`（13 条心法）、与代码行为，发现 6 项差距，全部修复。

### 修复清单

| 严重 | 问题 | 修复 |
|------|------|------|
| 🔴 | `check-as-any.mjs` 正则 `\([\w.\[\]]+\s+as\s+any\)` 只匹配简单标识符，漏检 `(expr) as any` 模式 | 改为 `\bas\s+any\b`；5 处新增逃逸全部修掉（card-stack.ts + root-picker.ts） |
| 🟡 | `capability-executor.ts` 三个内置能力直接 `path.resolve()` 用户输入，无路径逃逸检查 | 加 `SAFE_ROOT` + `sanitizePath()`，三个 handler 统一守卫 |
| 🟡 | `sidebar` 的 `effect` 字段未提及 AI 命令 | 补上 `"AI 可发送 open-sidebar/close-sidebar/toggle-sidebar 命令操作"` |
| 🟡 | `snapshot()` 内容生成器异常未被捕获 | 加 `safeGenerate()` try/catch 守卫，异常时返回 fallback 而非冒泡 |
| 🟡 | `check-docs.mjs` 不验证 frontmatter 完整性 | 新增 `checkFrontmatter()`：校验 status/superseded_by/路径有效性。同时修了 15 个归档文档的前置元数据不一致 |
| 🟢 | `notifyStateChange` 散布 ~41 处中 ui.ts 有 5 处冗余（KFMState.setSidebarOpen 已覆盖后未清理） | 移除 5 处；其余 ~36 处经追踪确认在 KFMState 无法覆盖的路径上（Canvas/GSAP/模块变量），更新 HANDBOOK 陷阱 14 |

### 验证

- `npm run check` → 零错误（sass → 4 个 check-*.mjs → tsc --noEmit）
- `npm run test` → 105/105 通过

## 留给下一轮的

### 和本轮相同的方向

无。本轮的 6 项全部在当前会话中完成。

### 持续观察

- **`notifyStateChange` 散布**：剩余 ~36 处已在 HANDBOOK 陷阱 14 中定位。根解方向是 ws-channel 层自动覆盖检测，但真正的冗余比例低（绝大多数来自 KFMState 无法覆盖的路径）。
- **`check-docs.mjs` 篇幅 warning**：4 个设计文档 >500 行。非阻塞，但可考虑按章节拆分或加 TL;DR。

## 一个心法层面的观察

本轮净增 ~67 行，看起来违反心法 5（代码越改越少）。但增量全在验证基础设施（check-as-any 正则增强、check-docs frontmatter 校验、capability-executor 安全守卫），不是业务逻辑膨胀。三处业务文件（card-stack、root-picker、ui.ts）的改动净负行数。

是否接受这个区分，看项目 owner 的判断。
