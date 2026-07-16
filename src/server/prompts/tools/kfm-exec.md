# kfm-exec — 命令执行

在 kfmv4 项目目录执行 shell 命令。用于构建检查、测试运行、git 操作等。

## 使用时机

- 运行 `npm run build`、`npm run check`、`npm run test` 等构建命令
- 执行 git 操作（`git status`、`git diff`、`git log` 等）
- 运行项目相关的脚本和工具

## 参数

- `command`（必填）— 要执行的命令
- `timeout`（可选）— 超时秒数，默认 30，最大 300
- `cwd`（可选）— 工作目录，默认 `/root/kfmv4`

## 与 bash 工具的区别

`kfm-exec` 和 `bash` 都能执行命令，但：
- **kfm-exec**：kfmv4 专用，默认工作目录是 kfmv4 项目根
- **bash**：通用命令执行，需要指定 cwd

如果操作的是 kfmv4 项目本身，优先用 `kfm-exec`。

## 关键规则

- 构建和检查命令必须跑全链路（`npm run build` 不是 `npm run check`）
- 修改代码后必须验证（`npm run build` + 确认零错误）
- 输出有退出码，非零退出码 = 错误
