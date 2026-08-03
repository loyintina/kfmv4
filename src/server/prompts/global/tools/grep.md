# grep — 内容搜索

在文件中搜索正则表达式。



<!-- gen:tool-params:start -->

## 参数

- `pattern`（必填）— 正则表达式搜索模式
- `path`（可选）— 搜索路径（文件或目录），默认项目根
- `ignoreCase`（可选，布尔）— 是否不区分大小写
- `maxCount`（可选）— 最大匹配数

<!-- gen:tool-params:end -->
## 输出

- 每行匹配：`文件路径:行号: 匹配行内容`
- 结果截断时显示 `(结果被截断)`

## 关键规则

- 禁止用 shell 做搜索：`grep`/`rg`/`ripgrep`/`ag`/`ack`/`git grep` → 全用 grep 工具
- 不是 GNU grep！用 `foo|bar` 而不是 `foo\|bar`
- 需要多轮搜索？用 Task 工具分发子任务
