# 多端分层设计页(kfm-na 核心层升格)

> 2026-08-20 立,v0 送审稿。定位:cordis-na 从「kfm-na 的插件运行时」升格为
> 「多端共享核心层」的分层宪法补丁——修订对象是《插件架构规格书》§2 分层。
> 源:2026-08-19/20 与用户的架构讨论(本地命令行可行性 → Termux 拆解 →
> 多端愿景),用户拍板方向:L1 本地 PTY 为旗舰动作,核心层平台中立,壳做薄。

## 0. 命题

kfm-na 的核心资产(协议、会话、插件、PTY、SSH、连接管理)收敛为**平台中立的
Rust 核心层**;Android 只是第一个前端壳,后续桌面 GUI / Linux TUI / CLI 都是
薄壳。本页不新增功能,只定**边界与纪律**——让每一步功能开发都在给多端铺路,
而不是堆在 Android 壳里日后拆不动。

**否决**:重写 Termux。termux-app 是 GPL-3.0(一行不抄);终端仿真我们已有
alacritty_terminal;Termux 的真正护城河是用户态生态(几千个包的发行版工程),
不属于「终端模拟器」范畴,不重写也不该重写。

## 1. 背景事实(讨论定案)

- **2.1s 首连唤醒成本是应用侧杀不掉的系统层成本**(BAR-022/023 归因定案:
  冷进程第一条连接恒吃 ~2.1s,预演/真握手对拍实锤,同刻隧道与服务器全健康)。
  Termux 秒开的秘密 = 本地 shell 零网络。→ 启动结构的正解是「本地秒开、
  远程后台接」,不是在黑屏观感上打补丁
- **Android exec 封锁**:Android 10+ 禁止 targetSdk≥29 应用从私有目录 exec
  (SELinux untrusted_app_29+ 域,app_data_file 无 execute);绕过 = jniLibs
  `lib*.so` 伪装(apk_data_file 有执行权)。我们 manifest 无 uses-sdk 落在
  旧域,**可能**天然免疫——待 L2 探针真机实证,不预设
- **共享存储 noexec**:/sdcard 内核挂载层禁止执行,可执行文件永远不放那里;
  数据/配置/脚本可以放(文件管理器可编辑是特性)
- **本地 tmux 不保命**:杀后台按 UID 杀整组,setsid 换爹无效;保活需前台服务
  + wake lock,烧电。**用户定案:本地 shell 杀了就杀了,会话永生由服务器端
  tmux 扛**,本地保活不做
- **Rust 生态盘点**(关键选型全是现成件):alacritty_terminal(已在用)/
  portable-pty(wezterm,跨平台含 Windows ConPTY)/ russh(纯 Rust SSH,
  含本地/远程端口转发)/ winit+softbuffer(已在用,桌面端同源)/ ratatui
  (Linux TUI 壳候选)

## 2. 分层架构(规格书 §2 修订提案)

```
┌──────────────────────────────────────────────────────┐
│ 前端壳(每端一个,做薄)                                │
│  ├─ android-app(现状: native-activity + softbuffer   │
│  │   + IME/JNI + 快捷键行——壳就是要厚的,渲染输入全在这)│
│  ├─ desktop-gui(winit+softbuffer 同源,近白送)       │
│  ├─ linux-tui(ratatui 面板 UI,不套终端仿真)          │
│  └─ cli(headless 最薄壳)                             │
├──────────────────────────────────────────────────────┤
│ 核心层(平台中立,禁碰 Android/Java/窗口系统)          │
│  ├─ cordis-na 插件基座(已有,ctx/事件/生命周期/配置)  │
│  ├─ 连接/会话抽象: TermFactory + Spawner 缝(已有)    │
│  │   ├─ transport: ws(已有)· 本地 PTY(L1)· SSH     │
│  │   │  (russh,含端口转发,远期)                     │
│  ├─ 终端仿真 alacritty_terminal(已有,核心层资产,    │
│  │   不强迫每个壳消费——TUI 壳不用)                    │
│  ├─ AI harness(远期,headless 可驱动同一会话层)       │
│  └─ 存储/配置(profile,远期)                          │
└──────────────────────────────────────────────────────┘
```

**边界纪律(三条)**:

1. **核心层 crates 禁依赖** winit/softbuffer/jni/android 任何东西——chain 加
   机械检查(cargo tree 断言核心层无平台依赖),不靠自觉;
2. **终端仿真归核心层,渲染归壳**:alacritty_terminal 是纯数据(网格状态),
   画像素是壳的事——现有 TermView 要劈成两半,grid 状态访问留核心,paint
   下壳(BAR 系列打磨的渲染逻辑全在壳侧,不动);
3. **新能力先问「核心还是壳」**:答不上来的不许写——这条进 AGENTS.md。

## 3. L1 本地 PTY:第一次抽层(旗舰动作)

一个动作吃两个目标:秒开(本地 shell 零网络,2.1s 唤醒退到后台)+ 核心层
第一次真实抽层。

- **插件**:`conn-provider-local`,与 `conn-provider-ws` 平级,复用
  TermFactory/Spawner 缝(考题用假 transport 的判卷模式原样照搬);
- **PTY 实现**:见待裁决问题 1(portable-pty vs nix::openpty);
- **启动结构**:默认本地 sh 秒开;ws 连接后台发起(BAR-023 的连接前移机制
  原样复用),接通后**用户一条命令/手势切换**到远程会话——不做自动切换
  (用户在本地敲到一半被切走是不可接受的);切换语义 = 两个会话并存,
  输出渲染目标可换,不是断一个起一个;
- **环境注入**:HOME=私有目录,PATH 前置(目前只有 /system/bin),
  TERM=xterm-256color;
- **考题**(A 档,host 侧可跑):openpty spawn sh → 写 `echo hi` → 读回
  `hi`;窗口 resize → TIOCSWINSZ 传播;子进程退出 → 会话关闭事件;
  与 ws 工厂同 trait 的可替换性(同一份假 TermEmu 消费两种工厂)。

## 4. L2 探针(exec 封锁真机验证)

半天活,决定 busybox/tmux 走哪条路:静态 hello-world 放私有目录 exec,
放行 → 旧域豁免成立,busybox 直接放 files/;拒绝 → jniLibs `lib*.so`
伪装路线(需翻 extractNativeLibs,与 BAR-013 的 `false` 冲突,届时再裁)。
**共享存储方案已否决**(noexec,§1)。

## 5. 远期占位(只登记,不动手)

- **russh SSH transport**:原生 SSH + 端口转发,AI 调 Rust API 而非拼命令行;
  与 ws 协议并存评估,时机在 L1 之后;
- **desktop-gui spike**:winit+softbuffer 同源,半天验证「核心层抽出后桌面端
  能否点亮」——这是分层是否诚实的试金石,建议在 L1 落地后立即做;
- **linux-tui / cli**:核心层 headless 化的自然产物,等核心层稳定再立;
- **内置浏览器**:Android 侧 JNI 嵌系统 WebView 做一块面板,壳层功能,
  不进核心层,远期单独立项。

## 6. 待裁决问题

1. **PTY 选型**:portable-pty(跨平台含 Windows,wezterm 生产验证,但依赖
   树重)vs nix::openpty(轻,Unix-only,Windows 端日后另补)?本设计倾向
   **portable-pty**——多端是本页命题,PTY 是负跨平台债最贵的地方;
2. **核心层 crate 边界**:现在 cordis-na 只有基座;连接/会话/PTY 抽进去后
   是继续单 crate 膨胀,还是立 `kfm-core`(会话/transport)与 cordis-na
   (基座)分家?本设计倾向**先单 crate,第二个壳(desktop spike)点亮时
   再拆**——拆分的依据应该是真实的双消费者,不是预想;
3. **TUI 壳不套终端仿真**是否认可:linux-tui 端是 ratatui 面板 UI(复用核心
   层的会话/协议,不嵌 alacritty 网格),「终端里跑终端」是套娃反模式;
4. **切换语义**:本地↔远程「并存可切换」认可,还是要求远程接通后自动接管?
   (本设计取前者,理由见 §3);
5. **核心层无平台依赖的机械检查**进 chain(§2 纪律 1)是否认可为硬闸。

## 7. 验收口径

- 设计落地 = 规格书 §2 分层图修订(加多端注记)+ AGENTS.md 加「核心还是壳」
  问句纪律 + L1 考题先行(§3 四条)全绿 + 真机实拍:本地 sh 秒开可输入,
  ws 后台接通后可切换;
- 分层诚实性的终极判卷 = desktop-gui spike 点亮(§5,不在本期范围)。

## 状态

v0 送审。裁决到达前不动代码(L1 考题也不写)。
