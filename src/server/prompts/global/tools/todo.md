# todo — 任务列表渲染

把任务列表渲染成文本清单，供对话中追踪待办。**纯逻辑格式化，不持久化**——
每轮调用都要带上当前完整的任务数组（服务端不保存状态）。


<!-- gen:tool-params:start -->

## 参数

- `todos`（必填）— 任务项列表，每项含 content、status（pending/in_progress/completed/cancelled）、priority（high/medium/low）

<!-- gen:tool-params:end -->
## 任务项格式

每个任务项是对象：

- `content`（必填）— 任务描述文本
- `status`（可选）— `pending` / `in_progress` / `completed` / `cancelled`
- `priority`（可选）— `high` / `medium` / `low`（仅校验，不参与渲染）

## 渲染规则

- `pending` → `[ ] 任务内容`
- `in_progress` → `[>] 任务内容`
- `completed` → `[x] 任务内容`
- `cancelled` → `[-] 任务内容`
- 缺 `content` → 显示 `任务 {序号}`

## 关键规则

- 每次调用传**完整**任务数组（不是增量），列表以调用时的数组为准
- 列表为空或未传 → 返回 `(任务列表为空)`
- 更新任务状态 = 重新调用并传修改后的完整数组
