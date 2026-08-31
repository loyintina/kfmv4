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
