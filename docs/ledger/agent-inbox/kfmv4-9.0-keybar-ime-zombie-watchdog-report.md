# 汇总：keybar 点击召唤 IME 根治 + 僵尸页双看门狗通报（2026-08-31）

> 日期: 2026-08-31
> 致: 评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会；用户真机已验，两案收口）
> 回: 无（主动通报）
> 状态: 已收到（2026-08-31 评审：知悉两案收口——keybar 弹 IME 定罪 Chromium 原生 ShowImeIfNeeded 层（JS 防线不破、层次不对），touchstart preventDefault 断源真机已验；僵尸页双看门狗（WS 应用层心跳+reload 重试）落地；纪律「等信号链路必有看门狗包括 reload 自己」收编。）

评审（psh）：

## 一、keybar 召唤 IME（用户报告「点任何键都弹输入法」）

**取证**（间谍 v2 坐标级，真机 live 页埋点）：点 ENTER 87ms 后 vv
812→541，**kb.focus 零调用、click stopPropagation 防线完好**——
2026-08-24 的修复没破，是层次不对：

- JS 召唤（容器 click→kb.focus）——2026-08-24 已防；
- **原生召唤**（本案）——Chromium 安卓 ShowImeIfNeeded：tap 结束+
  可编辑元素持焦=召回 IME，**不管点在页面哪里**。诱饵 textarea 永久
  持焦（IME 输入靠它），于是点任何键栏按钮都被原生层弹键盘。

**修复**（9283eaa8）：键栏 `touchstart` preventDefault（取消整个 tap
手势默认行为=原生召唤断源），挂 bar 冒泡全覆盖（按钮+缝隙通吃），
pointerdown 触发逻辑不伤。

**验收**：keybar-click 新增「touchstart 已防」钉 20/20；用户真机
手指终验 ENTER 不弹。纪律产出：**JS 召唤与原生召唤是两层**；合成
触摸唤不起真键盘，IME 召唤类验证只能真手指+仪器旁观。

## 二、附案：僵尸页（热更 reload 卡死）——比主案更值钱

验证期间发现真机热更失效。资源计时定罪链：热更轮询检测到新 build
→ location.reload() → **导航撞隧道抖挂起** → 页面网络栈全瘫（新
HTTP/WS 全挂，**连手机本机不过隧道的端口都挂**）、终端 WS 悄悄死
（无 close 事件、inject 零回显）→ 页面僵尸 12.5 分钟，用户以为
终端活着其实打字进黑洞。CDP 补发一次 reload 即复活（证明重试有效）。

**双看门狗**（231cc375）：
1. bridge 应用层心跳（浏览器发不了协议级 ping，应用帧 ping/pong，
   一拍无 pong=假死→onSilentDead→**保留续命账** reload，与
   onSessionDead 共用 5s 防循环闸）；
2. 热更 reload 15s 没走掉=卡死→重试至多 3 次，①兜底。

**验收**：tests/bridge-heartbeat.test.ts 三钉（①协议钉 ping 必回
pong ②活链 4.5 拍不冤报 ③死链必报只报一次），npm 93/93，手机
keybar-click/term-hooks/bottom-anchor/ime-pan 四卷全绿。

**纪律升级**（case-001 那条的第三次应验）：**「等信号」链路必有
看门狗，包括 reload 自己**——发起 reload 也是一次等信号；WS 活性
只能靠应用层心跳证明，不能信 close 必达。

归档：TASK.md + nz/docs/dev-flow-case-002-term-ime.md 迭代节两连。
