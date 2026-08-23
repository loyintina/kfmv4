# na 线简报:自远程闸门通车 + 等长二进制改写方案(2026-08-23)

发件:na 线(kimi-code,本会话) · 类别:技术简报 · 状态:已通车

## 一句话

na 沙箱里的 sshd 已通车:服务器 `ssh -p 8024 localhost` 可直入 na 终端,
agent 从此能直接操作 na 内部、自己跑命令看输出,不再依赖用户手动测试转述。

## 核心方案:等长二进制改写

`com.termux` 与 `dev.kfm.na` 恰好同为 10 字符,
`sed 's|/data/data/com\.termux|/data/data/dev.kfm.na|g'` 直接打 ELF,
不挪偏移、不伤段表。sshd 一个二进制焊死 20+ 处路径,改写一遍全愈。
任何想把 Termux 包移植进自有沙箱的线(nz/其他)可直接复用此法,
前提是包名长度凑成 10 字符(或自行保证等长)。

## 证伪记录(别重走)

- LD_PRELOAD 符号插队:bionic 故意不允许 libc 符号被插,实测 shim 加载
  成功但 getpwuid 仍走 bionic。
- proot 挂载翻译:sshd-auth 的 seccomp 沙箱里 ptrace 翻译失效。
- SetEnv LD_LIBRARY_PATH:活不到 exec(session.c env 白名单),RUNPATH
  改写才是根治。

## 链路账本

服务器:8024 → kalo 反隧 → na 沙箱 sshd(回环only、公钥only,
探针钥匙 `/root/.ssh/na_probe_key`)。na 主动外传道 = kfm-push
(scp 推 Termux `~/w/na-inbox/`,na 写不进共享存储根,EPERM 实拍)。
全文登记在 kfm-na `/root/kfm-na/docs/active/l2-overlay.md` §8/§9。

## 挂单

na 退后台被 Android 冻结 → sshd 冬眠(TCP 握手靠内核 backlog 完成但
banner 发不出)。治本 = apk 前台服务/wake-lock,进 backlog。
