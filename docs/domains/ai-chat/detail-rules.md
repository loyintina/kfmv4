# ai-chat · 条件规则契约（detail-rules）

> 规则 = 对 AI 工具调用的事后裁决（rule-engine.ts 读取 `src/server/ai/rules/*.md`
> 的 frontmatter 执行）。alwaysApply 规则注入 system（全部会话强制）；条件规则在
> 工具调用命中 condition 时注入警告。登记表由生成器拼接——**新增规则 = 新建
> .md + 写 frontmatter（description 必需），登记表自动出现；只建文件不跑生成器
> = check 中断**。

## 规则机制（手写说明）

1. **frontmatter 字段**：`alwaysApply`（bool，true = 注入 system 全部会话）、
   `description`（必填，规则一句话）、`condition`（正则，工具调用参数命中即触发）、
   `scope`（工具范围，逗号分隔 `tool:<名>`）。
2. **alwaysApply 规则**进静态 system 段（chat.ts），零条件代价；条件规则在
   `checkToolCallRules` 逐调用匹配，命中后 warning 注入对话。
3. 规则正文 = 给 AI 的行为说明（为什么 + 怎么做），frontmatter 只管「何时触发」。
4. 判断区：规则的「原因/血泪教训」写在正文，不入 frontmatter。

## 规则登记表（自动生成）

<!-- gen:rules-map:start -->

## 规则登记表（自动生成，勿手改）

> 由 `gen-rules-map.mjs` 从 `src/server/ai/rules/*.md` frontmatter 拼接。
> 新增规则 = 新建 .md 并写 frontmatter（description 必需）；未同步 = check 中断。

| 规则 | alwaysApply | 触发条件 | 作用域 |
|------|:---:|---------|--------|
| `kfmv4-commit-after-change` | ✅ | — | — |
| `kfmv4-no-console` |  | `console\.(log|warn|error|debug|info)` | tool:write, tool:edit, tool:browser_eval |
| `kfmv4-read-invariants-first` |  | `(edit|write|bash).*src/` | tool:write, tool:edit |
| `kfmv4-regression-discipline` |  | `src/.*\.(ts|mjs)` | tool:write, tool:edit |
| `kfmv4-scss-only` |  | `\.css` | tool:write, tool:edit |

<!-- gen:rules-map:end -->

## 使用纪律

- 改触发条件只动 frontmatter，正文语义与 frontmatter 不冲突
- 删除规则 = 删 .md 文件（登记表自动消失）
- 规则是提示词层的软约束；硬防线在权限引擎（TOOL_RISK，见 harness-permission-engine.md）
