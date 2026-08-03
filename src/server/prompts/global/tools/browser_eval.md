# browser_eval — 浏览器执行 JS

把 `code` 通过 WebSocket 推给**已连接的 kfmv4 前端浏览器**执行（服务端不执行，
只转发并等待结果）。用于在用户当前打开的页面里跑 JS、读取页面状态、模拟操作。


<!-- gen:tool-params:start -->

## 参数

- `code`（必填）— 要在浏览器里执行的 JS 代码。用 return 返回结果，支持 await。
- `timeout`（可选）— 超时毫秒数（默认 10000）

<!-- gen:tool-params:end -->
## 行为细节

- 代码支持 `await`；用 `return` 返回结果
- 结果非字符串 → JSON.stringify 后返回
- 默认超时 10s
- 无已连接浏览器：等 2s 再试，仍无连接 → `没有已连接的浏览器（等待 2s 后仍未连接）`

## 依赖

- 用户浏览器必须开着 kfmv4 页面且 WS 连接正常（光球面板所在页面）
- 与 debug 的 kfmv4 视图共用浏览器求值通道
