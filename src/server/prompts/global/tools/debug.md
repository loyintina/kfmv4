# debug — Node.js CDP 调试器

通过 Chrome DevTools Protocol（CDP）调试 Node.js 进程——**基于 Node.js 22+ 自带
inspector，不是 DAP，无需额外安装适配器**。直接连目标进程的 inspector
WebSocket，支持断点/单步/变量/求值/自定义 CDP 请求。


<!-- gen:tool-params:start -->

## 参数

- `action`（必填）— 调试操作：launch, attach, terminate, sessions, set_breakpoint, remove_breakpoint, continue, step_over, step_in, step_out, pause, stack_trace, variables, evaluate, scopes, loaded_sources
- `program`（可选）— launch: 要调试的程序路径
- `args`（可选）— launch: 程序参数，空格分隔
- `host`（可选）— attach: 调试进程的 IP 地址
- `port`（可选）— attach: 调试进程的端口
- `file`（可选）— set_breakpoint: 文件路径
- `line`（可选）— set_breakpoint: 行号（1-based）
- `func`（可选）— set_breakpoint: 函数名（替代 file+line）
- `breakpointId`（可选）— remove_breakpoint: 断点 ID
- `sessionId`（可选）— 指定调试会话 ID
- `callFrameId`（可选）— variables / evaluate: 帧 ID（从 stack_trace 获取）
- `scopeIndex`（可选）— variables: 作用域索引，0=local, 1=closure...
- `expression`（可选）— evaluate: 要计算的表达式
- `method`（可选）— custom_request: CDP 方法名
- `cdpParams`（可选）— custom_request: CDP 参数

<!-- gen:tool-params:end -->
## 操作（action）

- `launch` — 以 `--inspect-brk` 启动程序（端口 0 自动分配），暂停在入口
- `attach` — 连接已开 inspector 的进程（host/port，默认 127.0.0.1）
- `terminate` — 终止调试会话
- `sessions` — 列出活跃会话
- `set_breakpoint` — 设断点（`file`+`line` 或 `func` 函数名）
- `remove_breakpoint` — 删断点（breakpointId）
- `continue` / `pause` / `step_over` / `step_in` / `step_out` — 执行控制
- `stack_trace` — 当前暂停帧栈
- `variables` / `scopes` — 暂停帧变量/作用域
- `evaluate` — 求值（暂停帧内用 callFrameId，否则 Runtime.evaluate）
- `loaded_sources` — 监听已加载脚本（仅注册监听后 parse 的）
- `custom_request` — 任意 CDP 方法（method + cdpParams）

## kfmv4 专属视图（action）

在已连接的前端浏览器里注入脚本，读取页面运行时状态：

- `renderer_snapshot` — 渲染器快照
- `animation_timeline` — 动画时间线（依赖 `window.__anim`）
- `gesture_trace` — 手势轨迹（依赖 `window.__gestureRegistry`）
- `state_history` — 状态历史（依赖 `window.KFMState`）
- `card_lifecycle` — 卡片生命周期（依赖 `window.__cardRegistry`）

## 行为细节

- 单会话时可省略 `sessionId`；多会话必须显式传
- 无会话 → `无活跃会话。先 launch 或 attach`
- `evaluate` 结果截 500 字符；`variables` 最多 50 属性、值截 200 字符
- `output` 返回输出缓冲末尾 50 条
- 未知 action → `[debug] 未知 action`

## 限制

- attach 目标需已开放 inspector 端口
- `tracepoint` 依赖目标进程的 `__kfmProbe` 基础设施，tsx 编译模式下不可用
- kfmv4 视图依赖前端全局对象存在 + wsServer 可用
