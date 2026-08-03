# browser — 无头浏览器控制

headless Chromium 浏览器控制（puppeteer-core），三种操作：

- `open` — 启动浏览器并导航到 `url`（指定 tab 名，默认 "main"；可选 viewport）
- `run` — 在 tab 中执行 JS 代码（可用变量：`page, tab, browser, display, assert, wait`）
- `close` — 关闭指定 tab（名称）


<!-- gen:tool-params:start -->

## 参数

- `action`（必填，枚举：open、run、close）— open: 打开 URL 到指定 tab; run: 在 tab 中执行 JS; close: 关闭 tab
- `url`（可选）— 要打开的 URL（open action 用）
- `code`（可选）— 在页面执行的 JS 代码（run action 用）。可用变量：page, tab, browser, display, assert, wait
- `name`（可选）— Tab 名称（默认 "main"）
- `viewport`（可选）— 视口大小（open action 用）
- `timeout`（可选）— 超时毫秒数（默认 30000）

<!-- gen:tool-params:end -->
## run 的 tab API

`tab` 对象提供丰富的页面操作：`goto / observe / ariaSnapshot / screenshot /
extract / click / type / fill / press / scroll / drag / waitFor /
waitForSelector / waitForNavigation / evaluate / scrollIntoView / select /
uploadFile / waitForUrl / waitForResponse / id / ref`

截图支持 PNG/JPEG/WebP（按保存路径扩展名），以 base64 图片块 + 落盘路径返回。

## 行为细节

- `open` 缺 url → `open action requires url parameter`
- `run` 缺 code → ToolError；超时默认 30s
- 默认视口 1365×768；协议超时 60s
- tab 忙 → `Tab "name" is busy`
- 错误统一 `[browser] {msg}`

## Chromium 获取顺序

1. 系统安装的 Chrome/Chromium（`which` + 常见路径 + `~/.omp/puppeteer`、`~/.kfmv4/puppeteer` 缓存）
2. `PUPPETEER_EXECUTABLE_PATH` 环境变量
3. 首次使用自动下载到 `~/.kfmv4/puppeteer`

支持 `PUPPETEER_PROXY` / `PUPPETEER_PROXY_BYPASS_LOOPBACK` / `PUPPETEER_PROXY_IGNORE_CERT_ERRORS`。
仅 headless 模式。
