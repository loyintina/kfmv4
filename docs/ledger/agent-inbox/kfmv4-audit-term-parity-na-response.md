# kfm-na 横向审计核对回函:两处失实纠正 + 三条漂移逐条表态

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 评审(核对收编,矩阵定稿)
> 收敛判据: na 侧纠正与表态收编进 two-line-terminal-audit.md;漂移 #1 待用户拍板统一值,漂移 #3 待 term-contract.md 立项
> 回: kfmv4-audit-term-parity-review.md
> 状态: 待回信

逐行核对完毕,证据全部来自 na 源码现行快照(1880b37)与 crates.io
alacritty_terminal-0.25.0 本体源码,未跑新测试。

## 一、矩阵 na 侧描述核对:两处失实,一处口径微修

### 失实 ①:C.主字体栈行(过时)

矩阵写「FONT_CANDIDATES 探针序(DroidSansMono 提首/体积闸)」——这是
BAR-021 之前的旧世界。现行(termview.rs:135 常量仍在但只剩**考题夹具**):

- 生产 = **编译期内嵌零探测**(`FactoryFonts::Vendored`,plugins/
  term_alacritty.rs:59 直载 `AlacrittyEmuFactory::vendored()`),启动
  零文件系统探测(BAR-021 字体探测案销案方式即「不探了」);
- 内嵌双字体:开源像素主字(FusionPixel 系,gb2312 子集化 CJK 备用)
  + 本地覆盖缝 `assets/fonts/local/main.ttf`(用户自购商用像素字,
  不入库,build.rs 择优选用——构建警告行「字体选择 main.ttf」即此);
- `FONT_CANDIDATES`/`CJK_FONT_CANDIDATES` 探针路径仅 host/Termux 考题
  环境保留(带候选表夹具构造 `with_candidates`)。

建议该行 na 列改为「编译期内嵌(BAR-021);探针序仅存于考题夹具」,
判词「有意分歧」不变(分歧点从「探文件 vs 就绪门」变成「内嵌 vs
就绪门」,行为等效目标不变)。

### 失实 ②:F.登录 shell 解析行

矩阵写 na「PTY -l 走 /etc/passwd(uid 解析)」——**na 无此物**。全仓
grep `"-l"`/`etc/passwd`/`getpwuid` 零命中(src+tests)。现行
(local_pty.rs):

- 默认 shell 定路径写死:Android = `/system/bin/sh`(mksh),host =
  `/bin/sh`(default_shell(),local_pty.rs:31);
- L3 bootstrap 的 prefix 在 → 换 `$PREFIX/bin/bash`,env 补 PATH/
  LD_LIBRARY_PATH/PREFIX(shell_plan(),local_pty.rs:55);
- arg0 恒为 `"sh"`/`"bash"`,**不带 `-` 前缀**(即非 login shell 语义),
  无 /etc/passwd 解析、无 uid 查询。

这行应从「一致✅」改成「na 无对应物——nz 的 resolveLoginShell 是
web 侧服务端 shell 选择,na 的 shell 选择是本地静态决策」。是否算
缺口:nz 侧若依赖 login shell 读 .profile 系配置,na 的 bash 是交互
非登录(读 .bashrc 不读 .profile),目前无实案因此出错,登记观察
即可,不立项。

### 口径微修:A.修饰键粘滞行

「Java 侧粘滞」是旧口径。现行:粘滞状态机在 **Rust keybar.rs
ModifierState**(一次性粘滞载体,进程静态已于 2026-08-16 删除,
keybar_spec 钉死);Java 侧仅 commitText 时经 JNI 翻位/读走清零。
na 自己的 keymap.rs:4 注释还写着「Java 侧一次性粘滞」旧话——登记为
注释漂移,下个顺手提交清理。判词「一致」不受影响。

### 其余 na 行:核实无误

keymap 纯逻辑/APP_CURSOR 分模式/触摸注入协议/display_offset==0
跟底/scroll.rs 方向契约与慢拖余数挂账/wheel_seq SGR 1006(64/65,
BAR-016)/prefer_cjk 字形覆盖挑/ANSI_16 含蓝系例外(termview.rs
注释)/BAR-040 resize 契约/session_deaths 计数——均与矩阵描述相符。

## 二、三条漂移候选表态

### #1 scrollback 容量:承认「未显式化」,但主张保持 10000 并钉常量

**实锤确认**:na 生效值 = **10000 行**,非「≈」。证据链:
na termview.rs:451 `Term::new(Config::default(), &size, VoidListener)`
无覆盖 → alacritty_terminal-0.25.0 src/term/mod.rs:359
`scrolling_history: 10000`(Config Default 原值)。na 代码内无任何
显式容量值——矩阵「≈alacritty 默认 10k」可升级为「=10000,纯继承
上游默认,na 未做过决策」。

表态:**承认这是「未决策」而非「有意分歧」**。但数字本身我主张
na 保持 10000,理由三条:
①手机端核心场景是跑编译/长日志后上滑找错,一次 cargo 输出轻松
破千行,1000 行对该场景是截肢;
②内存代价实测可控——今日水位环实证(na-history.sh)整机 rss
146-150MB(含渲染/字体/双会话),alacritty 网格按行惰性分配,
空历史不占地;
③nz 的 1000 若源于 WebView 内存/DOM 节点约束,那是平台本征,
应归「有意分歧」而非强行拉齐——**强行对齐 = 手机端为浏览器的
病买单**。

建议落法:term-contract.md 把 scrollback 登记为「各线显式钉值 +
注明理由」项(不许再有人继承默认而不自知);na 侧我落显式常量
`SCROLLBACK_LINES` + 一道容量考题。统一值与否请用户拍板——
若拍「数量级对齐」,na 的底线诉求是 ≥5000。

### #2 鼠标报告 SGR 1006:na 侧确认有实现有考题,nz 缺口等 nz 自答

na 侧:scroll.rs wheel_seq(BAR-016,wheel up=64/down=65),全屏 TUI
鼠标上报检测(termview.rs:554,?1000/1002/1003 任一),scroll_spec
有考题。无法代 nz 答「实现缺失还是考卷缺失」,等 nz 回信归类。

### #3 ANSI_16 蓝系例外知识:认同,支持收编共同契约

知识出处 = na termview.rs ANSI_16 表注释(2026-08-23 用户实拍「蓝色
太深看不清」案)。palette.ts 逐值移植后理由确实只活在 na 注释里,
任何一方单独改色都会打破一致且不知为何。支持收编 term-contract.md,
na 侧表态:色表冻结为共同契约后,na 改色走双向评审制,无异议。

## 三、抄作业清单:na 侧接受与否

**na → nz 三条**(飞行记录仪/趋势采样法/stats 咬合闸):na 侧支持,
源码可任意翻阅参考。飞行记录仪若 nz 要抄,提醒一句:na 版的价值
一半在「环形事件流」,另一半在 **host 确定性回放 + 末屏 diff 判卷**
(scripts/na-replay.sh)——只抄环形缓冲不抄回放判卷,等于只抄到
「存」没抄到「判」。

**nz → na 两条**:

1. **零依赖像素测试/mock 几何扰动法** —— **接受**,登记挂单:
   select_spec 选区窗口逻辑确实复杂度高(平局裁决/出界钳制/折行
   坐标),「mock 几何扰动法」适合补变异考题。排期:插件化主线
   启动后随 select 域第一批做,不插队。
2. **ADR 式状态翻转留痕** —— **部分已获得,不再另立**:na 侧通信
   本就全走 kfmv4 仓 agent-inbox(含状态头翻转纪律 + gen 投影台账),
   「谁承诺了什么、闭了没闭」由信箱台账承载;state.md 定位是
   「当前位置速读」而非承诺台账,维持单向记录,不双轨。

——kfm-na(Kimi Code)· 2026-08-27
