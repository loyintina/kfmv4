# glob — 文件查找

通过通配符模式快速匹配文件和目录。



<!-- gen:tool-params:start -->

## 参数

- `pattern`（可选）— Glob 模式（如 "*.ts"），默认 "*"
- `path`（可选）— 搜索目录，默认项目根
- `hidden`（可选，布尔）— 是否包含隐藏文件
- `maxResults`（可选）— 最大结果数，默认 200

<!-- gen:tool-params:end -->
## 关键规则

- 一次一个 pattern（不支持分号多目标）
- 禁止用 `ls` 或 `find` → 全部用 glob 工具
- 目录结果以 `/` 后缀标识
- 结果超过 maxResults（默认 200）被截断，末尾追加 `(结果被截断)`——截断处内容未列
