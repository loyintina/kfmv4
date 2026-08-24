# 2026-08-24 · 评审 · web 终端 PTY 未用登录 shell：oh-my-zsh 失效，请 9.0 改默认 shell 解析

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 把 PTY 默认 shell 改为当前登录用户的 passwd 登录 shell（zsh，交互会话带登录态加载 oh-my-zsh）后，web 终端新会话显示 oh-my-zsh 提示符；A 档三卷不回退 + npm/smoke/cargo 全绿
> 回: —（首信；用户观察后请求）
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：登录 shell 解析落地 @ fb9b6841，npm 85 绿+headless 实证 oh-my-zsh ⚡ 提示符生效；附 keybar clickSends 偶红=考卷 artifact 分析请裁决修卷；球交用户真机 C 档）· 代际戳 gen-2026-08-24-登录shell

## 一、问题与证据

- 服务器 `/root` 登录 shell = `/usr/bin/zsh`；`/root/.zshrc` 明确 source 了 oh-my-zsh（`export ZSH=$HOME/.oh-my-zsh` + `source $ZSH/oh-my-zsh.sh`，2026-08-23 配置对齐手机）。
- 但 nz web 终端新开会话，prompt 是 `root@iZ0...:~#`（bash 默认），**无 oh-my-zsh**。
- 根因：`nz/src/server/term-connection.ts:73`
  ```ts
  this._shell = opts.shell ?? process.env.SHELL ?? '/bin/sh';
  ```
  `server/index.ts:54` 挂载 `mountTermConnection(serverCtx)` **未传 shell 参数** → 落到 `process.env.SHELL`，而启动 nz 服务的进程 `SHELL=/bin/bash`（已实测）。**代码没有用 `/etc/passwd` 里的真实登录 shell（zsh）**。

## 二、建议修法（请 9.0 实现）

把默认 shell 解析改成正则：

1. **优先解析当前登录用户的 passwd shell**（读 `/etc/passwd` 按 uid 取末字段，或 `getent passwd <uid>` 取 shell）→ zsh；取不到再退回 `process.env.SHELL ?? '/bin/sh'`。
2. **交互会话（command 空）用登录 shell 起**：让 zsh 以登录/交互态加载 `/root/.zshrc` → oh-my-zsh 生效。节点-pty spawn 出 `zsh`（pty=TTY 自动交互）即 source `.zshrc`；是否再加 `-l` 以贴近 SSH 体验（source `.zprofile/.zlogin`），**由 9.0 权衡**（oh-my-zsh 在 `.zshrc`，`-l` 非必须）。
3. **`-c` 命令分支行为不变**：`pty.spawn(shell, ['-c', cmd])` 照旧执行任意命令，不要因登录档引入额外副作用。

## 三、验收

- **A 档（headless 可测部分）**：断言 PTY 解析出的 `_shell` = passwd 登录 shell（zsh），且交互会话用登录 shell 起；(若可注入 mock 校验 spawn argv)。无回归：bottom-anchor 5/5 + scrollback 5/5 + keybar-click 17/17 + npm test + smoke + cargo 7/7 全绿。
- **C 档（真机）**：web 终端新会话显示 **oh-my-zsh 提示符**（主题风格，含 git 状态等），不再是 bash 默认 `root@...:~#`；提示符中 powerline/图元字形**无乱码**（web 终端用自定义字体，确认字体覆盖）；`-c` 任意命令仍正常。

## 四、备注

- 仅改**默认解析与启动方式**，不引入新依赖；若某些环境 `/etc/passwd` 不可读（容器/受限），走退回环境变量与 `/bin/sh`，不硬报错。
- 与键栏底层字体、主题无关，真机看一眼即可。

——评审 · 2026-08-24
