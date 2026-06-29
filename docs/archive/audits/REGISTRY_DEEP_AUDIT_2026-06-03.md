---
status: completed
created_at: 2026-06-03
archived_at: 2026-06-29
---
---

# 交接：第三轮深度审计 + CI 基线固化

## 本轮做了什么

### 审计发现的 6 个新问题（前 N 轮均未发现）

1. **state getter 无异常保护** — `snapshot()` 和 `get()` 中 getter 抛异常会崩掉整个 Registry → 加 try/catch
2. **`registerContentGenerator(id, null)` 会 crash** — 上一轮我自己的 warn 消息写了不存在的注销路径 → 修了实现，传 null 时从 map 删除
3. **`wsChannel.onCommand()` 静默覆盖** — 两个模块注册同名命令时无警告 → 加重复检测 warn
4. **`registerStateGetter()` 允许孤立 getter** — 为不存在的元素注册 getter 不报错 → 加存在性检查 warn
5. **`registerElement()` 触发两次 onChange** — 导致 ws-channel 冗余推送 → 改为一次 notify
6. **click 命令失败无用户可见反馈** — AI 调 click 操作 Canvas 元素时只打了 console.warn，不返回失败信息 → 加 toast 提示

### 心法层级分类（元修复）

`KFM_V4_INVARIANTS.md §〇` 中 14 条心法加了 `[LEVEL 1/2/3]` 标签：
- **LEVEL 1**（不可违反）：心法 1, 9, 12, 13
- **LEVEL 2**（需要权衡）：心法 2, 3, 5, 8, 14
- **LEVEL 3**（流程建议）：心法 4, 6, 7, 10, 11

同时写了层级冲突处理规则和适用范围说明。

### CI 基线固化（防止振荡）

`check-registry.mjs` 新增两条自动化检测：

1. **孤立 state getter 检测** — 扫描 `registerStateGetter('id')` 是否有对应的 `register({ id })`/`registerElement({ id })`。没有则构建中断。
2. **命令注册重复检测** — 扫描 `wsChannel.onCommand('action')` 是否在多个文件中出现。有则构建中断。

这两条规则直接固化了本轮审计发现的问题 3 和问题 4，下一轮 agent 不会再在同样的坑上翻车。

### 代码清理

提取 `SAFE_ROOT`/`sanitizePath` 到 `src/server/path-utils.ts`，消除 `index.ts` 和 `capability-executor.ts` 之间的重复定义。

## 验证

- `npm run check` → 零错误（sass → 4 个 check-*.mjs → tsc --noEmit）
- `npm run test` → 105/105 通过

## 留给下一轮的

### 已知结构性待办（本轮不做）

| 优先级 | 事项 | 说明 |
|--------|------|------|
| 🟠 P2 | `CARDS` 数组迁移 | `card-stack.ts:30-38` 的硬编码数据源。14 处引用。当前不属于 Registry 问题（CARDS 不是 InteractiveElements），但属于心法 5（代码越改越少）未兑现的承诺 |

### 本轮净增行数

+148 / -70 = **净增 +78 行**。增量几乎全在验证基础设施（check-registry 新增 64 行）和异常保护（try/catch + null 处理～15 行）。业务逻辑的净负行数为 -8（SAFE_ROOT 提取后删除的重复定义）。

## 给下一位 agent 的建议

1. **先跑 `npm run check`。** 如果 0 错误，说明基线没有退步。如果有错误，永远是 CI 检查先修。
2. **心法有层级了。** 如果一个 LEVEL 2 心法和一个 LEVEL 1 心法冲突——优先 LEVEL 1，在代码中加 `// P3:` 注释登记例外。
3. **不要做"第四轮审计"了。** Registry 的 spec-vs-code 缺口已经收窄到 typo 级。如果有新功能需求（如 CARDS 迁移），直接按功能描述做即可。
4. **如果发现新的 spec-vs-code 偏差**——先看偏差出现在 §S（已定稿）还是 §2-§9（讨论记录）。§S 的偏差需要修，§2-§9 的偏差可能是"讨论比实现超前了"，更新文档就能修。
