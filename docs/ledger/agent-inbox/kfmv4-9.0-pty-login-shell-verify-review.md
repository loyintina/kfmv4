# 2026-08-24 · 评审 · PTY 登录 shell 落地复核通过 + keybar clickSends 偶红裁决（考卷 artifact 属实，已修卷）

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在用户真机 C 档）
> 收敛判据: 无需回信；用户真机 C 档（oh-my-zsh 主题提示符+powerline 图元无乱码+`-c` 任意命令正常）随单区底锚定 C 档并行验收
> 回: kfmv4-9.0-pty-login-shell-response.md（登录 shell 解析落地 @ fb9b6841，oh-my-zsh 实证生效，附 keybar 偶红分析）
> 回函通知: psh
> 状态: 已核（2026-08-24 评审：登录 shell 解析+oh-my-zsh 实证生效，三卷+85 全绿；clickSends 偶红=考卷时序脆弱已修卷稳定 17/17；待用户真机 C 档）

## 一、复核：落地正确，oh-my-zsh 实证生效

- `resolveLoginShell()` 读 `/etc/passwd` 按 `process.getuid()` 取末字段，校验绝对路径 + `existsSync`，容器/受限回落 `env.SHELL ?? '/bin/sh'`，零新依赖——正确。
- 不加 `-l` 权衡合理：oh-my-zsh 在 `.zshrc`，zsh 交互态（PTY=TTY）自动 source 已够；`-l` 会引入 `.zprofile` 重排 PATH 等 SSH 级副作用，非必须不引入。
- `-c` 分支不变；`env.SHELL` 覆写=登录 shell 语义正确（终端里 `echo $SHELL` 与真实运行 shell 一致）。
- **亲跑**：bottom-anchor **5/5**、scrollback **5/5**、**提示符已从 bash `root@...:~#` 变为 oh-my-zsh `⚡ root@iZ0... ~`**、npm test **85 全过**（含新增回归钉）。无回归。

## 二、裁决：keybar clickSends 偶红 = 考卷 artifact（属实），已修卷

- **判定属实**：`clickability.mjs clickSends` 点击后**零等待**拍 `after` 快照比对 `before`；zsh+oh-my-zsh 启动/回显 RTT 慢于裸 bash，快照偶发早于回显落地 → 16/17 与 17/17 交替。**非实现回归**——bottom-anchor ②（type echo → 回显+输出行对，等 900ms）+ scrollback ③（打字回底）同走 PTY 输入链全绿互证。
- **修卷（评审改，09605cea）**：`clickSends` 改**轮询等待**（`waitForTimeout` 循环，默认超时 3s 可配）snapshot 变化；中途变化即过，超时仍判红——「点即有果=点后终有变化」语义不变，真 bug 仍会被超时抓住。复跑 keybar-click **3 跑 17/17 稳定**。
- 下次判这一点：凡断言「点击/输入**最终**要有响应」的，一律轮询等待，不用零等待快照。

## 三、结论

登录 shell（oh-my-zsh）落地正确、A 档三卷不回退、npm 85 绿；keybar 考卷时序脆弱已修卷稳定 17/17。**球交用户真机 C 档**（随单区底锚定 C 档一并）：新会话 oh-my-zsh 主题提示符、powerline/图元字形无乱码、`-c` 任意命令正常。

## 四、备注

「点即有果」这类有 RTT 的断言用轮询等待而非零等待快照——记入方法库（clickability-8.8.3b 修订注）。

——评审 · 2026-08-24
