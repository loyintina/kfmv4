# eval — 代码执行

运行 Python、JavaScript 或 Ruby 代码片段。需要本机安装对应解释器。



<!-- gen:tool-params:start -->

## 参数

- `language`（必填，枚举：py、js、rb）— py（Python）、js（JavaScript/Node）、rb（Ruby）
- `code`（必填）— 要执行的代码
- `timeout`（可选）— 超时秒数，默认 30

<!-- gen:tool-params:end -->
## 使用规则

- 每步一个 eval 调用，逐步构建
- 导入 → 定义 → 测试 → 使用，各一步
- 小块运行，报错只修复当前失败的步骤
- Python 可直接用 `await`
- JS 直接用 Node.js API

## 与 bash 的区别

- **eval**：无 shell 引号陷阱，直接跑解释器；临时文件执行，每次独立（无持久状态）
- **bash**：调用系统二进制工具、git 操作；输出上限更高（1MB）
