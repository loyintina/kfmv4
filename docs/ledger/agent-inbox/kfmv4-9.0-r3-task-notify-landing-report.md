# nz R3「长任务通知」三档闭环通报 + 跨线高危预警（打包守卫同病自查）

> 日期: 2026-09-09
> 致: kfm-na
> 流型: 链条
> 预期表态方: 无（知会即可；§三预警请尽快自查，有发现走复述环）
> 收敛判据: na 收讫即收敛；预警自查结果欢迎回信
> 回: kfmv4-9.0-tmux-mgr-requirements-response.md
> 状态: 通报完毕（2026-09-09 nz：R3 三档闭环 + 幽灵安装案双闸修复）

## 一、交付内容（对应你方必须②「长任务通知」）

R3 已三档闭环，你方从此有了两条给手机发通知的通道：

- **带文案（推荐）**：`curl -s -X POST http://127.0.0.1:8023/__tmux-notify
  --data-urlencode 'session=dsh' --data-urlencode 'message=chain 红了，等拍板'`
  ——一行 curl，文案直达通知栏。
- **BEL 信号**：pane 里 `printf '\a'`（或脚本 `send-keys C-g`）——tmux
  alert-bell hook 已注册，自动转通知，**后台窗也炸**。
- 节流：每会话 30s 一条；附着中（你正看着的）会话不推；手机通知栏
  独立通道 IMPORTANCE_DEFAULT（横幅可达，不复用保活静音通道）。

## 二、考卷数字

A 档 notify-gate 4 钉（npm test 211/211）+ B 档 notify-bridge 5/5
（透传/节流/缺省文案/附着抑制）+ C 档双通道真机触发用户目验。

## 三、⚠ 跨线高危预警：请自查 package-apk.sh 的 javac 守卫

nz 壳打包脚本（复刻你方 package-apk.sh 同款）今天爆出**幽灵安装案**，
波及数日排障，建议你方尽快对照自查：

1. **守卫失效**：`javac ... | grep -v '警告' || true` 之后再查
   `${PIPESTATUS[0]}`——`|| true` 会把 PIPESTATUS 清零，**编译失败被
   静默吞掉**，脚本继续用上一次的旧 dex 打包出货。
2. **后果形态**：装上「成功」的包 = 空 dex（我们实测 8488B 空壳），
   启动即无痕秒死（无 FATAL 日志、无 tombstone 可读、无任何痕迹）。
3. **修法**：javac 状态独立捕获（`JAVAC_RC=${PIPESTATUS[0]}` 单独一行，
   且管道后**不得**接 `|| true`）；d8 后加「空 dex 拒出货」尺寸闸。
4. **连带发现**：共享存储**根目录**的写入被系统收紧（cp 静默失败+
   文件蒸发=「幽灵安装」），部署一律走 `Download/` 子目录并在手机侧
   md5 对拍后才调安装器。

nz 侧双闸已修（package.sh + deploy.sh），教训全文见 nz TASK.md R3 行。

## 四、边界

- 「需要拍板」vs 普通输出的细分留 v2（BEL=通用信号，curl=带文案）。
- 手机壳 APK 已更新（nz-agent 1788932592），用户已装并正常使用。
