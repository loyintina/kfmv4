# 2026-08-24 · 9.0 · PTY 登录 shell 落地回函：oh-my-zsh headless 实证生效，附 keybar 偶红考卷 artifact 分析

> 日期: 2026-08-24
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核落地+裁决 keybar clickSends 偶红修卷建议；球交用户真机 C 档（oh-my-zsh 提示符随单区底锚定 C 档一并验）
> 回: kfmv4-9.0-pty-login-shell-review.md
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：登录 shell 解析落地 @ fb9b6841，npm 85 绿+三卷/冒烟全绿；8023 已重启生效，headless 实证 oh-my-zsh ⚡ 提示符）

## 一、落地内容（对应信二节）

1. **passwd 解析**：`resolveLoginShell()`（term-connection.ts，导出纯函数）——读 `/etc/passwd` 按 `process.getuid()` 取末字段，校验绝对路径+`existsSync`；passwd 不可读/无 uid/字段非法退回 `env.SHELL ?? '/bin/sh'`，不硬报错、零新依赖。构造器默认链改 `opts.shell ?? resolveLoginShell()`；新增只读 getter `shell` 作判卷锚点。
2. **登录态权衡（信留白②，我拍）**：**不加 `-l`**——oh-my-zsh 在 `.zshrc`，zsh 交互态（PTY=TTY）自动 source 已够；`-l` 会引入 `.zprofile` 重排 PATH 等 SSH 级副作用，非必须不引入。
3. **`-c` 分支不变**：`spawn(shell, ['-c', cmd])` 照旧；唯一同带变化=spawn env 覆写 `SHELL=登录 shell`（login 程序语义：不覆写则终端里 `echo $SHELL` 与真实运行 shell 不符；读 `$SHELL` 的命令两分支得到的都是登录 shell，语义正确）。

## 二、验证数字

- **回归钉**（term-connection.test.ts 新增一题，动态对照不写死 zsh）：①`resolveLoginShell()`=passwd 当前 uid 末字段；②`opts.shell` 优先；③默认挂载 `service.shell`=passwd 登录 shell；④真 PTY 交互会话 `ps -o comm= -p $$`=shell basename 且 `$SHELL`=登录 shell。
- **npm test 85 绿**（84+1）；smoke + build + typecheck 全绿。
- **8023 服务已重启**（tsx 直跑服务端源码，旧进程不重启不吃新代码）；**headless 实证生效**：bottom-anchor 考卷输出里提示符已从 bash 默认 `root@...:~#` 变为 oh-my-zsh 主题 `⚡ root@iZ0... ~`。
- **不回退**：bottom-anchor 5/5 + scrollback 5/5 全绿。

## 三、发现一枚考卷 artifact（请评审裁决修卷）

keybar-click **17/17 与 16/17 交替**，红项=「点即有果(ENTER 发送 \r)——无变化」。根因分析：

- `clickability.mjs clickSends` 的判定=点击后**零等待**直接 snapshot 对比 textContent；zsh+oh-my-zsh 的回显 RTT 慢于裸 bash，偶发快照早于回显落地。
- **非实现回归**：终端输入链路本身无恙——bottom-anchor 卷②（type echo → 回显+输出行对）、scrollback 卷③（打字回底）同链全绿互证；重跑两次 17/17 与 16/17 交替也符合时序性特征。
- **修法建议**：`clickSends` 点击后改轮询等待（`waitForFunction` textContent 变化，超时 ~2s 判红）——语义不变、消时序脆弱。按考题纪律考卷归评审修卷，请裁决；你批我执行或你直接改均可。

## 四、待办

- 评审复核落地 + 裁决 clickSends 修卷。
- 球交用户真机 C 档（随单区底锚定 C 档一并）：新会话显示 oh-my-zsh 主题提示符、powerline/图元字形无乱码、`-c` 任意命令正常。

——9.0 · 2026-08-24
