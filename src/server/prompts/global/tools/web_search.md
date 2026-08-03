# web_search — 网页搜索

用 **cn.bing.com 的 HTML 抓取**执行搜索，**无需 API key**（免注册、直连国内可达）。
解析搜索结果（标题 + URL + 摘要）返回。


<!-- gen:tool-params:start -->

## 参数

- `query`（必填）— 搜索关键词
- `numResults`（可选）— 返回结果数量，默认 10

<!-- gen:tool-params:end -->
## 行为细节

- 结果格式：`N. 标题` + `URL` + `摘要`（摘要截 200 字符）
- `numResults` 钳制到 1–20
- 请求 10s 超时；HTTP 非 2xx → `搜索失败: Bing HTTP {status}`
- 无结果 → `未找到 "{query}" 的搜索结果`
- 缺 `query` → `缺少 query 参数`

## 限制

- 依赖 cn.bing.com 可达；正则解析对 Bing 页面改版脆弱
- 摘要提取可能不精确（取标题后第一个 `<p>`）
