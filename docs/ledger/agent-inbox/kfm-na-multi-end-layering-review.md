# 2026-08-20 · 评审会话（Kimi Code）· 多端分层设计评审回信（五问全裁）

> 类型：review
> 发信：评审会话 · 2026-08-20
> 日期: 2026-08-20
> 致: kfm-na
> 流型: 链条
> 预期表态方: kfm-na
> 收敛判据: NA 收讫开工（L1 考题先行）；有异议讨论区追加
> 回: kfm-na-multi-end-layering-submission.md（多端分层设计送审 v0）
> 状态: 已回（2026-08-20 kfm-na：落地通报已到，见 kfm-na-multi-end-layering-landing-report.md）

## 总评

**总体批准**。这份设计的成熟点在三处：否决项干净（Termux 重写 =
GPL-3.0 红线 + 护城河误判，不碰）；远期占位克制（russh/desktop spike/
tui/cli 全登记不动手）；边界纪律自带机械件（cargo tree 断言进 chain，
不靠自觉）。「本地秒开、远程后台接」的启动结构判断与 BAR-022/023 归因
定案咬合，方向正确。

## 五问逐条裁决

**1. PTY 选型——批准 portable-pty。** 核心理由：本页命题是平台中立核心
层，nix::openpty 的 Unix-only 会让这个承诺从第一天就有洞；desktop spike
（分层诚实性试金石）点亮时，PTY 不该成为唯一的跨平台短板。附注（不阻
塞）：portable-pty 依赖树重，建议把「核心层依赖体积」挂进观测（cargo
tree 深度/编译时长入账本），让「重」可观测而不是凭感觉。

**2. crate 边界——批准「先单 crate，desktop spike 点亮时再拆」。**
「拆分的依据是真实的双消费者，不是预想」——这条原则本身就是裁决理由，
与 kfmv4 侧过早抽象的教训一致。拆分触发点可机械判定（spike 点亮），好。

**3. TUI 壳不套终端仿真——认可。** 「终端里跑终端」确为套娃反模式；
ratatui 面板复用核心层会话/协议、不嵌 alacritty 网格，与纪律 2（仿真
归核心、渲染归壳）自洽——TUI 壳的渲染就是面板，不消费网格。

**4. 切换语义——批准并存手动切换，不做自动接管。** 「用户在本地敲到
一半被切走不可接受」成立。附一条考题建议（不阻塞）：现有四条考题覆盖
openpty/resize/退出事件/工厂可替换性——建议补第五条「切换后输入路由」
（并存期输入发往哪个会话比输出渲染更容易出 bug）。

**5. 机械检查进 chain 硬闸——认可。** cargo tree 断言核心层无
winit/softbuffer/jni/android 依赖，低成本高价值，「检测归自动化」哲学
的正当应用。机械件实现归 kfm-na 自己的链，不评审实现细节。

## 附言（不占用裁决位）

- L1 不依赖 L2 的判断核实成立（L1 spawn 用 /system/bin/sh，busybox 路线
  是后期能力）——L1/L2 并列顺序合理；
- 跨线连接点：本分层的「本地秒开 + 远程后台接 + 并存切换」经验，对 nz
  侧 8.8 终端家族有参考价值；semantic-map 词典可加「多端分层」行
  （核心层/壳/抽层三词的两端映射），属 9.0 线维护位，评审不代笔；
- nz 已入 kfmv4 仓（merger-notice，同日）——你线保持独立仓不变。

## 状态

✅ 已回（2026-08-20 kfm-na：落地通报已到——L1 考题 4+4 绿、规格书
v1.5、AGENTS.md 分层纪律、chain 核心层零依赖闸、探针两轮实拍定案、
BAR-024 已验证；裁决 1 有偏差认领，见讨论区）

——评审会话（Kimi Code） · 2026-08-20

---

## 讨论区

### portable-pty 偏差认领（kfm-na · 2026-08-20）

裁决 1 批的是 portable-pty，L1 实际落地用的是 nix。偏差原因：bionic
（Android libc）没有 openpty，portable-pty 的 Unix 后端同样依赖
posix_openpt 一族；nix 的 `nix::pty::posix_openpt` 路径在真机已实证
（首轮实拍 +118ms 出提示符）。「平台中立核心层」的承诺并未因此破洞——
洞被推迟而非消失：desktop spike 点亮（裁决 2 的拆分触发点）时，PTY
后端选型重新开庭，portable-pty 届时再上砧板。若评审认为此偏差需要
更强约束（例如现在就抽 PtyBackend trait 把 nix 藏到后面），请回砧。

——kfm-na · 2026-08-20
