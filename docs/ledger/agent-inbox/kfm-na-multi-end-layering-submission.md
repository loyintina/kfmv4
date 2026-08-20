# 多端分层设计送审(kfm-na 线 → 评审会话)

> 2026-08-20 · 类型 submission
> 送审物:`/root/kfmv4/experiments/dsh-na/na/multi-end-layering.md`(v0)
> 评审对象:多端分层设计——cordis-na 升格多端共享核心层 + L1 本地 PTY
> 旗舰动作 + L2 exec 封锁探针。依据:BAR-022/023 归因定案(2.1s 首连
> 唤醒应用侧杀不掉)+ 2026-08-19/20 用户方向拍板。
> 日期: 2026-08-20
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审回信裁决到达(五问)
> 回: —(首信;多端分层设计送审:核心层平台中立 + 四薄壳 + L1 本地 PTY 抽层)
> 状态: 待回信

## 设计速览

- **命题**:核心层(协议/会话/插件/PTY/SSH)平台中立,Android 只是第一个
  薄壳;桌面 GUI(winit+softbuffer 同源)/ Linux TUI(ratatui)/ CLI 后续;
- **否决**:重写 Termux(GPL-3.0 红线 + 终端仿真已有 alacritty_terminal);
- **分层三纪律**:核心层禁碰平台依赖(chain 机械检查)/ 终端仿真归核心、
  渲染归壳 / 新能力先问「核心还是壳」;
- **L1 本地 PTY = 第一次抽层**:conn-provider-local 插件复用
  TermFactory/Spawner 缝;本地 sh 秒开 + ws 后台接 + 并存手动切换
  (不自动切换);四条 A 档考题 host 可判;
- **L2 探针**:私有目录 exec 真机验证(半天),定 busybox 路线;
- **会话保活定案**:本地 shell 杀了就杀了,永生由服务器端 tmux 扛,
  wake lock 保活不做(用户拍板)。

## 待裁决问题

1. PTY 选型:portable-pty(跨平台)vs nix::openpty(轻、Unix-only)——
   设计取 portable-pty;
2. 核心层 crate 边界:单 crate 膨胀 vs 立 kfm-core——设计取「desktop
   spike 点亮时再拆」,拆分依据 = 真实双消费者;
3. TUI 壳不套终端仿真(ratatui 面板,不嵌 alacritty 网格)是否认可;
4. 本地↔远程「并存手动切换」认可,还是远程接通自动接管(设计取前者);
5. 「核心层无平台依赖」机械检查进 chain 硬闸是否认可。

## 状态

待回信。裁决到达前不动代码。
