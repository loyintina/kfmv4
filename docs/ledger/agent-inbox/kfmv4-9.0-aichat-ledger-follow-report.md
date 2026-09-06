# nz → 评审：AI 绑定跟随总账修复通报（「茉莉的测试2」bug 全链闭环 + §1.6 第二消费者接入）

> 日期: 2026-09-05
> 致: 评审
> 流型: 汇总
> 预期表态方: 评审（抽查权；按每 3-4 封自验收通报随机抽 1 单节奏）
> 收敛判据: 评审知悉修复方案、验证三路数字与两条降级/边界声明即可，无需回函
> 回: 无（用户报单直修，方案经用户两问定稿）
> 状态: 通报完毕（2026-09-05 nz：考卷 65/65+单元 191/191+真机钩子跟随，提交 2794e798）

## 一、报单与根因（用户报单直修）

用户实测：池页新建并激活会话「茉莉的测试2」，AI 窗口不切换。

真机 CDP 三路互相独立实证（8026 attach）：

| 路径 | 手段 | 读数 |
|---|---|---|
| L2 文件系统 | `cat /root/.kfmv4/active.json` | sessionId=茉莉的测试2 |
| L2 页内 API | CDP Runtime.evaluate 页内 fetch('/pool/active') | sessionId=茉莉的测试2 |
| L3 真机钩子 | `__kfmNzAiChat()` | sessionId=**茉莉的测试**（旧），ring 无 loadSession |

根因：总账变更无传播——`pool-link.activate()` 只 POST /pool/active + 刷池
自身数据，从不通知 ai-chat link；`loadSession()` 仅挂载/手动切/测试钩三
处被调，面板常驻不重挂，绑定永不跟随。连带隐患=错位发送（消息落旧会话
文件）。

## 二、方案裁定（用户两问定稿，择要）

- 用户问「最小改动（raise/menu 时机钩）是否最正确」→ **否**：右滑关池回
  AI 页无 raise/menu，时机枚举必有漏路径；对未来新写入方不闭。
- 用户问「是否 kfmv4 成熟设计」→ 哲学层是（cordis 唯一事实源/总线广播），
  机制层是 nz 自有 config-pool §1.6 契约（bus.ts→ws-bridge 订阅票，
  C10/C11/C13 已钉）；本次=给既有契约接第二个消费者，非新设计非移植。
- 用户拍板：nz 唯一写入方（仲裁②外部写入边界永不建）；两条不变式入账
  ——总账切换→视图立即跟随；所见即所附（发送仍按面板绑定落会话）。

## 三、修复内容（2794e798）

chat-link 增 pool-watch 订阅腿：/ws/term 多路复用订阅票（tmux-sessions/
pool 同款），activated 帧→读账跟随 realignLedger（账变且 IDLE→
loadSession，P18/并发闸天然复用）；done/error 流毕对账收口 P18 推迟窗；
重连 3s+回前台补连（C13 同款）；close 全链 teardown。deleted 帧不动绑
定：relied 守卫（409）使删正显示会话必须先切走激活，切换恰由本腿跟随。

## 四、验证（观测手段声明）

- **L1 考卷**：ai-chat B 档新增 B20 五钉，红先（stash src 重建旧码 62/65：
  B20a/a2/b 不跟随、环无帧）→ 新码 **65/65** 全绿；钉住=激活事件腿跟随且
  不重挂/环收 pool:activated 帧/P18 推迟窗流毕跟随/自反激活不重水合/
  播种幂等。单元卷 **191/191**。
- **L2 服务端真值**：激活前后 /pool/active 与 active.json 对读一致。
- **L3 真机**（8026 attach，reload 一次取新码=热更链同款）：服务器侧激活
  茉莉的测试→钩子跟随；复原测试2→跟随；ring 实录
  `pool:activated×2→pool:realign(activated)→ui:hydrate`
  （bus→ws-bridge→中继→真机页面全链）。
- **降级声明**：面板截图腿失败——Page.captureScreenshot 基线态亦超时，
  结合 na 线 BAR-029 档案（熄屏=硬墙）判定真机此刻不产帧；按纪律声明
  降级，钩子/环读数为 L3 主证据。用户下次亮屏可补拍。

## 五、纪律产出（详见 nz/docs/dev-flow-case-005-ai-chat-a1.md 闭环后迭代 1）

1. 考卷读 hook 必须走 B6 助手同款映射：phase 真路径=run.phase，顶层无
   phase 字段（B20b 连吃两轮假红才抓到）。
2. 激活帧是账级事件（{pool:'active',id:'active'} 不带会话 id），客户端
   「读账跟随」即契约，勿按 pool==='session' 过滤（首轮实现即栽）。
3. 选型口诀：状态分歧的解药是「单写多读+订阅跟随」，不是时机枚举。
