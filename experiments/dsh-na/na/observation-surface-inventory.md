# na 观测面全家福（审计第二单素材包·na 侧）

> 这是什么：na（Rust 原生安卓终端）现有观测/注入/判卷设施的**单一
> 索引**——为「两线观测面对照」审计第二单预制的 na 侧素材。每件三行：
> 是什么/怎么用/判什么。全部条目可溯源（调试闸门.md §一~§十七 +
> scripts/README.md）。数据截至 2026-08-28（na 库 c6094b6）。
> 对照接口：nz 侧同构图（?debug 五组字段/sendBeacon/CDP/自验收通报），
> 第二单开张时逐行对表即可。

## 一、闸门通道（8024 ssh → na 沙箱值守线程，300ms 消费）

| 通道 | 文件协议 | 用途/判什么 | 脚本 |
|---|---|---|---|
| keys-in | 字节串（\r=回车） | PTY 字节注入（本地+远程活跃会话） | na-type.sh |
| touch-in | 行指令（tap/down/move/up/scroll±n/sleep） | 手势注入，与真手指同一入口 | na-touch.sh |
| text-req | 触发→screen.txt | 当前视野纯文本（判卷主力,可 grep） | na-text.sh |
| shot-req | 触发→PNG | 帧拍图（视觉判卷） | na-shot.sh |
| stats-req | 触发→key=value 21 项 | 运行时快照（帧/泵/CPU/RSS/死亡计数…） | na-stats.sh |
| history-req | 触发→30s×48 张 | 水位环序列（趋势判卷） | na-history.sh |
| trace-req | 触发→事件流 256 帽 | 行踪环（毫秒戳事件史） | na-trace.sh |
| replay | 带回放器 | 飞行记录仪确定性回放+末屏 diff | na-replay.sh |
| ping | 探活 | alive/stall/background/未起跳 四态 | na-ping.sh |
| restart-req | 触发→exit(0)+am start | 体面重启闭环（BAR-037 重跑防御） | na-restart.sh |
| autopsy | 组合 | 一键收尸八件档案 | na-autopsy.sh |
| 坠机记录 | panic.log/SIGNAL 行 | Rust panic 栈 + native 信号(sig+addr) | crash.rs |
| touch-in 补充 | na-regress.sh [卷名] | 七卷考官一键回归 | na-regress.sh |

**协议共性**：原子写（.new+mv）、值守 300ms 消费、判卷三查（读屏/拍图/
stats 交叉）。**三铁律**（踩坑实录）：pgrep -f 必自匹配禁作判据；
/proc/<na.pid> 对 sshd 不可见（扫不到≠死了）；进程活性唯一可靠判据
=kill -0 $(cat na.pid)。**GAP 即数据**：8024 失联窗口=Doze 冻结实录。

## 二、真机考官（na-regress 七卷，重启类自动排尾）

| 卷 | 契约 | 判卷法 |
|---|---|---|
| BAR-040 | 首屏标题不被顶出 | 重启后读屏第 1 行=标题（重启类） |
| PIN-boot | boot 段末行<3000ms | trace 末次 boot 最大毫秒（启动族绊线） |
| PIN-pump | 泵速率<1000/s | 水位环差分（57k 空转回潮闸） |
| PIN-touch | scroll ±5 首行精确往返 | 注入→读屏→往返分毫不差 |
| PIN-signal | URG 探针 SIGNAL 行+1 | kill -URG + 进程存活 |
| PIN-rehatch | exit 杀会话→自动重孵 | deaths+1→横幅→新 shell 回显 |
| PIN-standby-death | ws 掐断→远程死亡记账 | ss -K→deaths+1→活跃不受扰→自愈重连 |

 runner 语义：exit 0 过/非 0 挂/77 跳过；热更后 na-push-so.sh 第⑥步
 自动冒烟（SKIP_RESTART 直判当前 boot）。元契约自检：
 test-na-regress-meta.sh（假 ssh 桩四断言,秒级）。

## 三、故障注入探针（合法入口制造故障,阴性知识留档）

- **PIN-rehatch（本地）**：`exit\r` 杀本地 PTY → deaths+1 → 横幅
  「已重连=新 shell」→ 回显。覆盖本地传输全链。
- **PIN-standby-death（远程）**：服务器 `ss -K` 掐 8021 ws → 远程
  deaths+1 → 活跃不受扰 → ws 自愈重连。**阴性知识**：杀 tmux
  attach 客户端不产生死亡事件（death 定义=ws 断开）；待机死亡
  一生一发锁存（marker=na.pid）。
- **已知缺口**：Ctrl-] 切换为 UI 层有意留白——「活跃=远程死亡自动
  重孵」半边留人工。

## 四、辅助设施

- **chain 11 步**：防泄漏/零依赖/stats 咬合/fmt/clippy/android/javac/
  test/overlay/覆盖矩阵棘轮/build——机械红当场修。
- **考卷覆盖矩阵**：23 模块 pub 项×tests 引用对照，棘轮只许降
  （docs/ledger/test-coverage-matrix.md,gen 区）。
- **变异抽检**：scroll+keymap 56 针 54 抓/0 存活（首个存活体转化
  真修复：touchSlop 含边）；gate.rs 259 针夜班在跑。
- **决策轨迹 schema v2**：三样本（BAR-040/启动慢家族/nz ranger）
  13 类+四分类转移计数+链型命题（方向验证）。标注×3+终表在
  experiments/dsh-na/na/。
- **电耗脚手架**：probe-overnight-power.sh 双源（电池+na stats）
  对账，300s 一拍，GAP=冻结窗口即数据。

## 五、判卷法总纲与对拍接口

- **总纲**：用复现时同一把尺复验；「我觉得好了」不算数；负结果
  （修而不愈）是一等公民。
- **跨线对拍接口（待 nz 回贴）**：C4 宽字符期望值表——
  `中文AB`=6 / `English`=7 / `あいui`=6 / `中A中B`=6 / `┌─┐`=3
  （na 判卷尺=dump_text 跳 spacer 字符数；nz=measureCell）。
- **已知缺口（诚实清单）**：Ctrl-] 注入留白；告警②只验不误报侧；
  判据完全外部化需 adb 通道（登记未立项）。

——kfm-na(Kimi Code) · 2026-08-28 · 随线演化,重大变更随通报更新
