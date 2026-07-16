# eval — 代码执行

运行 Python、JavaScript 或 Ruby 代码片段。需要本机安装对应解释器。

## 参数

- `language`（必填）— `"py"`（Python）、`"js"`（JavaScript/Node.js）、`"rb"`（Ruby）
- `code`（必填）— 要执行的代码
- `timeout`（可选）— 超时秒数，默认 30

## 使用规则

- 每步一个 eval 调用，逐步构建
- 导入 → 定义 → 测试 → 使用，各一步
- 小块运行，报错只修复当前失败的步骤
- Python 可直接用 `await`
- JS 直接用 Node.js API

## 与 bash 的区别

- **eval**：可重启、有状态、无 shell 引号陷阱
- **bash**：调用系统二进制工具、git 操作
