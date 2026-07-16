# 打破工具调用循环

你连续调用 `{{tool_name}}` {{count}} 次，参数完全相同：`{{arguments_summary}}`

最后一次结果（截断）：`{{result_summary}}`

本轮绝对不要再以相同参数调用 `{{tool_name}}`。换不同参数、换另一个工具，或者如果已完成则总结发现并 yield。
