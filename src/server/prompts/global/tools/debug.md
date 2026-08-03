# debug — 调试器

交互式调试器访问（DAP 协议）。

## 状态

当前环境未配置 DAP 适配器，此工具暂不可用。需要：
- Python：`pip install debugpy`
- Go：`go install github.com/go-delve/delve/cmd/dlv@latest`
- Ruby：`gem install debug`

安装对应语言的调试适配器后，即可使用：
- `launch`：启动调试会话，需指定 `program`
- `attach`：连接到运行中的进程
- `set_breakpoint`：设置断点（文件+行号）
- `step_over`/`step_in`/`step_out`：单步执行
- `variables`/`stack_trace`/`evaluate`：查看状态
