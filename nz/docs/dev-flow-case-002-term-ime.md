# 开发流程案例 002 · 终端 IME 线（弹收洪峰根治）——term 插件档案

> 2026-08-31 归档。定位：term 插件（nz/src/client/plugins/term）IME 线
> 从用户报告到真机闭环的完整实录。功能账本在 nz/TASK.md（2026-08-30/
> 08-31 各条），本文是流程经验与教训的沉淀。
>
> **活文档纪律（沿用 case-001 用户拍板）：本文档随 term 插件持续生长——
> 未来对 IME/键盘/视口相关行为的任何修改、事故、调参，都追加到
> 「闭环后迭代」一节**，写清：为什么改（谁拍板）、改了什么、验收数字、
> 产出的纪律。不许只改代码不记账。

## 起点：用户一句话

「召唤/关闭输入法也会疯狂滚动，快速连点滚动更久。」

## 流程七段（每段：产物 / 坑 / 纪律产出）

### ① 复现定罪：先证明是谁在滚
- 产物：`experiments/dbg-ime-toggle-flood.mjs`——NzNative.tap 真触摸驱动
  真键盘，WS 字节计数 + 逐 150ms 采样。
- 数字：键盘弹 +423,004 / 收 +308,137 / 快速连 toggle×3 +712,996 字节
  （kimi 整史重绘洪峰）；**nz 自身滚动全程 st=0 无辜**——洪峰不是
  nz 在滚，是 rows 重测→PTY resize→tmux resize→SIGWINCH→kimi 重绘。
- 纪律产出：**先隔离嫌疑再开药方**——「滚动」的表象下真凶是 resize
  传导链，滚对地方比滚得快重要。

### ② 修法设计：格网解耦（a770faff）
- 设计：键盘占位期间行列格网**不动**（tmux/TUI 零感知=零洪峰），可视区
  变矮用视窗平移补——ALT(TUI) 程序化滚到底让输入行露键盘上方；行模式
  不抢滚动位。
- 难点：几何上「键盘」与「窗口缩/考卷 vv mock」信号**同款**，必须靠
  语义区分——入态闸=武装序曲（召唤键盘意图）+宽不变+跌幅双阈值。
- 纪律产出：**雷区处置**——checkDrift/scheduleResize/RO 三条自愈路
  全部要认得「故意不重测」，不认得=把洪峰放回来。自愈逻辑是修法
  的一部分，不是事后补丁。

### ③ 模拟键盘基建（用户拍板「后台模拟键盘」）
- 洞察（用户的）：键盘对终端的本质=底部占位+输入接口。输入接口已有
  `__kfmNzTermInject`，补占位半即可。
- 产物：vv 野生散装读取收编 `vvNow` 单源（生产=真 vv/测试=mock）+
  `__kfmNzTermMockIme(open, kbPx=271)`（真机实测参数重放，与真键盘
  走完全相同的几何链路）。
- 纪律产出：**模拟验证已知、真机发现未知**——地形探熟的区域模拟
  全权代理（后台零打扰回归），新地形第一刀真机开道。这条原则后来
  被终验①②连续验证（见⑤⑥）。

### ④ A 档考卷：ime-pan 红先造钉
- 产物：`tests/browser/ime-pan.test.mjs`（红先实过：武装 bug 版②③④红）。
- 验收：真机 mock 三段字节增量 16/11/17KB（kimi 心跳量级）vs 真键盘
  对照 423/308/713KB=**数量级根治**，rows 恒 44 格网未动。

### ⑤ 真手指终验①：模拟探不到的盲区（bf93d78e 修正二刀）
- 旁观器 `experiments/watch-ime-finger.mjs`（CDP 逐 300ms 采样，后台
  零打扰）+ 用户真手指。
- 实锤：**APK adjustResize 下真键盘连布局视口一起缩**（vv 812→541 时
  innerH 同缩），原 innerH 闸把真键盘误判成桌面拖窗→永不入态→rows
  44→28 旧行为复活。headless 模拟里 innerH 不随键盘缩，**这个盲区
  模拟永远照不到**。
- 修正二刀：innerH 从闸里退役（判别全押武装序曲）；打字只续闩不武装
  （武装挂 input 曾把 bottom-anchor 打回 7/10——桌面打字后拖窗是常态）。

### ⑥ 真手指终验② + 冷启动边（26fb1af4 武装窗两档）
- 主判据全过：6 次弹收（9s 长打字+4 次快速弹收）ime 精确跟随、rows
  恒 44、键盘期 st=258 平移、收键盘 st=0 还原。
- 又抓到一条模拟造不出的边：**会话首弹键盘冷启动，点击→vv 开始缩
  >2s**，2s 武装窗过期→漏武装→旧行为对一次（之后键盘热了次次全中）。
- 修法=武装窗两档：点击=真召唤序曲 3.5s（触屏召键盘必伴 tap），裸
  聚焦=弱信号 2s（bottom-anchor ④ 判别力不回退）。
- 两个实现坑（考卷当场抓的）：
  ①`addEventListener('focus', armIme)` 直挂把 FocusEvent 当 strong
    参数=恒强档（**事件监听器回调的参数是事件对象**，truthy 坑）；
  ②click→kb.focus 的 focus 事件紧随强档武装会把它覆盖回弱档
    →`Math.max` 防缩短。
- 踩出的边立刻固化成模拟钉：ime-pan ①d/①d2（真点击→等 3s→vv-only
  mock 跌 271px）红先复现（ime=false rows 32→16）→修后 11/11。
  **以后回归这条边不用再麻烦手指。**

### ⑦ 测试迁手机（资源纪律后用户拍板「以后涉及这种任务就放手机跑」）
- 背景：服务器 IO 挤兑两次团灭；手机 UFS4.0=服务器 24 倍 IO。
- 三坑全落账：Termux node 报 platform=android 被 Playwright 拒（换
  proot 官方 glibc node）；dpkg 中断残留（force-remove-reinstreq）；
  **chromium GPU 进程 FATAL 自杀**（fallback 构建在不支持 OS 上，
  --disable-gpu 都拦不住）→**`--use-gl=disabled` 一参救活**。
- 产物：`tests/browser/launch.mjs` 统一启动入口（服务器无副作用），
  11 考卷接入；TASK.md §2.5a 重负载任务落位纪律。
- 耗电发热实测可接受（六卷连跑≈10 分钟≈刷网页量级），用户确认无顾虑。

## 验收总账

| 判据 | 数字 |
|---|---|
| 洪峰字节 | 弹/收/连点 423K/308K/713K → mock 三段 16/11/17K（数量级根治） |
| 格网稳定 | 真机弹收全程 rows 恒 44∈[44,44] |
| 考卷 | ime-pan 11/11、bottom-anchor 10/10、scrollback 5/5、keybar-click 19/19、term-hooks 6/6、cjk-inktop 4/4、mouse-report 9/9、npm 90/90、cargo 9/9 |
| 真手指终验 | ①暴露 innerH 盲区（已修）②主判据全过+冷启动边（已修） |

## 本案例产出的可复用工具

| 工具 | 用途 |
|---|---|
| `experiments/dbg-ime-toggle-flood.mjs` | 真键盘洪峰复现定罪（tap 真触摸+WS 字节计数） |
| `experiments/watch-ime-finger.mjs` | 真手指旁观器（CDP 逐 300ms，后台零打扰判卷） |
| `experiments/verify-ime-pan-device.mjs` | 真机 mock 三段验收 |
| `__kfmNzTermMockIme(open, kbPx)` | 模拟键盘占位钩（vvNow 单源，几何链路同真键盘） |
| `tests/browser/launch.mjs` | 浏览器启动统一入口（手机 proot 救活参+服务器透明） |
| 手机测试链（TASK §2.5a） | 重负载浏览器考卷的默认跑场 |

## 闭环后迭代（活文档，新账往后追加）

### 2026-08-31 · keybar 点击召唤 IME（用户报告「点任何键都弹输入法」）
- **为什么改**：用户真机报告。历史修复（2026-08-24 click stopPropagation）
  防的是 **JS 召唤**（容器 click→kb.focus），本案是**原生召唤**——两层。
- **取证**（间谍 v2 坐标级，experiments/dbg-keybar-ime-summon.mjs）：点 ENTER
  87ms 后 vv 812→541，kb.focus 零调用、防线完好。真凶=Chromium 安卓
  **ShowImeIfNeeded**：tap 结束+可编辑元素持焦=召回 IME，不管点在页面
  哪里；诱饵 textarea 永久持焦的设计被这条原生规矩咬了。
- **改了什么**（9283eaa8）：键栏 `touchstart` preventDefault（取消整个
  tap 手势默认行为=原生召唤断源），挂 bar 冒泡全覆盖（按钮+缝隙通吃）；
  pointerdown 触发逻辑不伤。
- **验收**：keybar-click 新增「touchstart 已防」钉 20/20；用户真机手指
  终验 ENTER 不弹键盘。
- **纪律产出**：**JS 召唤与原生召唤是两层**——防了 JS 层不等于防了
  原生层；触摸类 UI 要同时问「我的代码会不会召唤」和「系统会不会
  替我召唤」。另：合成触摸（桥/CDP Input）唤不起真键盘，IME 召唤类
  验证只能真手指+仪器旁观。

### 2026-08-31 · 附案：僵尸页（热更 reload 卡死）+ 双看门狗（231cc375）
- **为什么改**：keybar 案验证期间发现真机页面热更失效。资源计时定罪：
  热更轮询 11:07 检测到新 build→location.reload()→**导航撞隧道抖挂起**
  →页面网络栈全瘫（新 HTTP/WS 全挂，连不过隧道的本机端口都挂）、
  终端 WS 悄悄死（无 close、inject 零回显）——页面僵尸 12.5 分钟，
  用户以为终端活着其实在打字进黑洞。CDP 补发一次 reload 即复活
  （证明重试路径有效）。
- **改了什么**：①bridge 应用层心跳（浏览器发不了协议级 ping，应用帧
  ping/pong，一拍无 pong=假死→onSilentDead→保留续命账 reload）；
  ②热更 reload 15s 没走掉=卡死→重试至多 3 次，①兜底。
- **验收**：tests/bridge-heartbeat.test.ts 三钉（协议钉/活链不冤报/
  死链必报只报一次），npm 93/93，手机四卷全绿。
- **纪律产出**（case-001 那条的第三次应验，升级表述）：**「等信号」
  链路必有看门狗，包括 reload 自己**——发起 reload 也是一次等信号
  （等导航成功），发起方要假设它永远不来。连接类资源（WS）不能信
  close 事件必然送达，**活性只能靠应用层心跳证明**。

_（下一条 term 相关修改从这里继续记）_

### 2026-08-31 · 附案：提示符 ⚡ 光标右移半格（宽字符表壳核失配）
- **为什么改**：用户实拍「输入内容后光标比预期右移半格」。真机
  Range 逐文本节点量墨迹：光标按格网 col×cellW 定位精确压格
  （col 39 整），但提示符墨迹只到 col 37——⚡（U+26A1，oh-my-zsh
  agnoster 主题主提示符）在 DOM 里墨迹宽 5.2px=1 格（走自然文本），
  核却给它算 2 格，其后整行相对格网左移 1 格，光标显得右移
  （用户观感「半格」= ⚡ 字形 ink 偏窄）。
- **根因机制**：壳 shell.ts 只把 WIDE_CHAR 正则命中的字符裁进
  2×cellW 固定格，其余走自然文本随字形前进量。v1 粗正则两类错：
  ①核宽壳漏——emoji 默认文本呈现区（U+26A1 等 66 字符，unicode
  Emoji 属性但默认文本呈现）+ A960-A97C + FE10-FE6B + 1F004-1F265；
  ②壳宽核窄——302A-302D/3099-309A 核 0 宽合并符、1F321 等非 emoji
  呈现符（核 1 格壳裁 2 格，反向漂）。
- **改了什么**：WIDE_CHAR 正则退役 → WIDE_RANGES 有序区间表（110
  区间）+ isWide 二分。**表单源 = rio-vt 核实测宽度**：全 BMP +
  1F000-1FAFF 逐字符扫面 + 20000-3FFFD 抽点共 66,304 码点零不一致
  （对拍尺 scripts/verify-wide-table.mjs 常驻，rio-vt 换版重跑）。
- **验收**：A 档 cjk-width-c4 加 C4-na6（"A⚡B"→+4 核推进）+ C4⑥
  （⚡ span=2×cellW 渲染层钉）——修复前 C4⑥ 红（spanW=7 vs 14）、
  修后 12/12 绿；手机四卷（c4 12/12、inktop 4/4、keybar 20/20、
  hooks 6/6）全绿；C 档真机 Range 复量：光标-墨迹右缘 gap 从
  2×cellW（10.39px）收至 1×cellW（5.19px）= 恰好一个提示符尾空格，
  压格精确。
- **踩坑自正**：手工抄表两连错（2F00-2FD5/2FF0-2FFF 康熙部首区漏
  加、[0x2ff0,0x2fd5] 倒置区间破二分有序性）——对拍尺当场抓住。
  教训：**派生表绝不手抄，生成-对拍-零不一致才算完**；二分表有序
  性靠对拍证明不靠眼检。
- **纪律产出**：壳核判定一致性不能抽查要**全量扫面**（emoji 默认
  文本呈现区散点分布，抽样式加单字符必漏）；「修一个 ⚡」的诱惑
  要挡住——宽度表是协议，协议要么全对要么全错。

_（下一条 term 相关修改从这里继续记）_

### 2026-08-31 · 附案：全面屏 edge-to-edge——顶 42px 黑条（刘海 letterbox）根治
- **为什么改**：用户实拍 nz 顶栏一条黑条什么都没有——其他软件都
  支持全面屏，nz 避让摄像头区。后台几何 eval 钉死病灶：屏 854 而
  innerH=812（42px 没给页面）、`env(safe-area-inset-top)=0`——
  **窗口层就被系统切了，页面连那块区域的存在都感知不到**，不是
  页面在避让。
- **根因**：targetSdk=28 下刘海模式默认 DEFAULT——全屏（状态栏
  隐藏）时短边刘海区拉黑信box。设备=vivo V2339FA API 36。
- **改了什么**（两刀才透）：
  ①a69fbd2c 壳层 onCreate setAttributes SHORT_EDGES + 页面
  viewport-fit=cover + :root --sat/--sab 变量单源 + 终端容器
  safe-area padding（box-sizing:border-box，绝对定位子元素以
  padding box 为包含块自动缩进，scrollEl.clientHeight 行数测量
  自洽）+ ?debug 遥测 sat/sab 字段。**真机复验仍 letterbox**
  （innerH=812→816 只涨 4px，sat 恒 0px）——API 36 只设运行时
  SHORT_EDGES 不够。
  ②980ab795 补刀：主题**声明式** windowLayoutInDisplayCutoutMode
  =shortEdges（窗口创建第一拍生效，国产 ROM 更买账）+ 状态/导航
  栏透明 + API30+ setDecorFitsSystemWindows(false) 显式放行。
- **验收**（后台 eval 数字收口，无需抓图）：innerH 812→**853**、
  sat 0px→**42px**（页面真拿到刘海账）、scrollClientH 733→769
  （多出 2 行可见区）、sab=0（手势条无占位）、用户真机实拍黑条
  消失内容不进摄像头洞。行列无超屏回归。
- **观测方法注**：黑条在 WebView **外面**（窗口层），canvasShot
  重画眼/CDP 截图都够不着——几何 eval（screen.height vs innerH
  vs env(safe-area)）才是这条症的尺，且后台随时能跑。
- **纪律产出**：①Android 全屏主题≠全面屏——刘海模式是独立一维，
  现代 API 要**声明式（主题）+ 运行时（setAttributes/decorFits）
  双写**，只写一边国产 ROM/新 API 可能都不买账；②页面感知不到的
  区域用几何差量诊（screen vs innerH vs env()），别试图截图；
  ③safe-area 变量立 :root 单源，容器 padding 与遥测同吃一源。

### 2026-08-31 · bg→fg 自弹键盘漏识别根治（visibilitychange 武装）+ 31s 重载死循环案中案
- **为什么改**：用户报告「从后台切回前台，键盘有概率自动跳出/不跳出，
  点击屏幕键盘弹出后盖住内容不跟随」。
- **排查一（案中案，先行定罪）**：`/tmp/nz-boot-marks.log` 里
  `term-page-started` 每 ~31s 一条累计 543 次=页面在重载死循环。根因=
  231cc375 给 bridge 加应用层心跳（15s 无 pong→reload），但 **server
  进程还是加心跳前的旧代码**，不认 ping 帧回「未知帧型」→客户端每 15s
  误报假死→reload→新页再 ping→循环（31s≈2×15s+reload 耗时）。修复=
  `nz-restart.sh` 重启 server（ping→pong 18ms 实测，73+ 分钟零新
  boot mark）。**用户感知的「键盘自动跳出有概率」高度疑似此循环表象
  （reload 后焦点态不定）——协议加帧型必须伴随 server 同重启**，记账：
  build.mjs 应检测 src/server 变更自动置 restart-req（待办）。
- **排查二（帧级追踪定罪）**：重载循环修掉后，埋 50ms 帧级 tracer
  （vv/ime/rows/cBot/vis）跑 bg→fg 全周期：自弹键盘路径页面 50-150ms
  内跟随到位、光标恒可见，**「盖住不跟随」在修复后版本复现不出**。
  但抓到真异常：**自弹键盘 ime=false**——Android 回前台为持焦诱饵
  恢复键盘，无点击/聚焦序曲，武装窗不开（代码注释原写「理论不存在」，
  真机证伪），走 resize 路径 rows 47→30=tmux 每回前台白吃一刀
  SIGWINCH 洪峰。对照：点击召唤路径 ime=true、rows 冻结（正确）。
- **改了什么**：`visibilitychange→visible` 且 APK 环境（NzNative 在）
  即 `armIme(true)` 视同召唤序曲——APK 无地址栏/窗口拖拽，回前台
  3.5s 内 vv 大缩唯一天命=键盘恢复。浏览器不武装（桌面 alt-tab 回来
  拖窗是常态，武装会误判）。
- **验收**：考卷红先 ①e2 精准红（14/15，①e0 浏览器对照绿=判别力成立）
  →修后 15/15；回归 bottom-anchor 10/10+scrollback 5/5+keybar-click
  20/20+term-hooks 6/6 全绿。真机数字收口（新 bundle v=77e03f90，
  defineProperty vv-only mock 路径）：A 对照（无武装）vv 跌 271px→
  ime=false、rows 47→30 跟随；B（HOME→fg 触发 visibilitychange 武装）
  同款 vv 跌→**ime=true、rows 47 冻结**，还原退闩回基线。
- **观测方法注**：①帧级 tracer（50ms setInterval 记 vv/ime/rows/几何）
  是 bg→fg 这类时序症的尺，单帧快照会骗人；②**页面 hidden=定时器
  全冻结**（屏幕熄灭/后台）——mock 实验事件同步生效（pin 落）但
  150ms 重测定时器不跑，读数像「resize 失灵」，先查 visibilityState
  再下结论（这轮差点误判一个假 bug）；③合成 tap 失灵谜 reload 后
  复发（NzNative.tap 落地但输入连接建不起来，TASK 已记账同款），
  真键盘 e2e 的最后一公里仍需真手指。
- **纪律产出**：①「键盘弹了但没召唤序曲」不是理论不存在，是 bg→fg
  自弹——注释写死「不存在」前先问真机；②协议/心跳类改动=客户端
  server 一体，单边上线=死循环，build 链应自动检测 server 变更要求
  重启；③同症异物：用户的「盖住不跟随」（重载循环表象）与「自弹
  漏识别」（真 bug）是两条病，分开定罪分开修。

_（下一条 term 相关修改从这里继续记）_
