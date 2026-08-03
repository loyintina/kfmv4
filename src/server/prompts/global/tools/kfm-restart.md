# kfm-restart — 重启 kfmv4 服务

触发 kfmv4 服务安全重启。**触发即返回**：写 `restart-pending.json` 标记 +
POST `/api/system/restart`（服务先响应后异步重启）。


<!-- gen:tool-params:start -->

## 参数

- `port`（可选）— kfmv4 服务端口，默认 8021

<!-- gen:tool-params:end -->
## 行为细节

- 服务约 5s 后恢复；重启后浏览器 WS 自动重连 → `server-restarted` → 会话冷恢复自动继续
- 重启触发即返回成功（即使内部 fetch 失败也返回「重启已触发」，不会 isError）
- `port` 缺省 8021

## 使用时机

- 部署/构建后需要让运行进程加载新包
- 服务状态异常需要恢复时
