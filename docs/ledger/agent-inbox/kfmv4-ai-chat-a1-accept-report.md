# ai-chat A1「AI 接通最小闭环」验收通报：四阶段闭环 + C 档双路真连全绿

> 日期: 2026-09-04
> 致: 主会话，评审，kfm-na
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 用户/评审/na 知悉 A1 四阶段闭环、C 档双路真连实录与真机状态；Kimi 官方 kimi-k2.7-code 可通实锤入账；A1 不做清单留 A2+；无需回函
> 回: A1 设计清单签收（c6038411，§八六条异议全裁决）+ 用户 09-04 拍板（默认=Kimi 官方+kimi-k2.7-code「官方渠道此名可通，C 档实测」；orb 自右上挪右中）
> 状态: 通报完毕（2026-09-04 nz：A1 四提交+阶段四验收提交全落，npm test 155/155+browser 16 卷全绿）

**致**: 用户 + 评审 + na
**来源**: nz 9.0 线（AI 专题 §0.7 A1）
**提交**: 2a79b427（阶段一协议层）/ 3ce53fc5（阶段二 server 薄层）/ f145e76c（阶段三插件+皮）/ 本信随附两笔（阶段四：orb 挪位一笔、验收+文书一笔）
**时间**: 2026-09-04

---

## 1. 四阶段事实链

| 阶段 | 提交 | 产物 | 考卷 |
|---|---|---|---|
| ① 协议层 | 2a79b427 | chat-protocol 四件原样搬运 + 简版 to-openai-messages 新写（三条事故规则）+ sse-parser/translator/providers 纯逻辑三件 | A 档 8 钉红先 36 题全绿 |
| ② server 薄层 | 3ce53fc5 | BrainEndpoint 插座 + EchoBrain/DirectApiBrain 双脑 + run 登记表（内存 Map+封顶+5min 淘汰）+ /ai/chat 三端点 + /ai/providers + /tmp 落盘 | B 档雏形 8 钉红先全绿 + 变异双咬 |
| ③ 插件+皮 | f145e76c | chat-link 脑（cursor R2/gen 代际守卫/attach 补流/64 拍观测环）+ BU 三件皮词汇重写 + orb + 全屏 AI 页 + __kfmNzAiChat() 钩 | B 档 21/21 + 变异抽检（皮内塞 #f2f3f4→P7 钉红→还原）；npm test 154/154+browser 15 卷零回退 |
| ④ 挪位+验收 | 本信随附 | orb 右上→**屏幕右中**（拍板入账）+ C 档双路真连 + 畸形消息形状闸（C 档结晶真虫）+ 文书 | npm test 155/155（+1 回归钉）+ ai-chat 21/21 + tmux-tabs 11/11 + keybar-click 21/21 |

## 2. C 档实录（真连，2026-09-04 02:56 UTC，经 nz server 全链 POST start+GET stream）

| 钉 | 通路 | TTFB | 全程 | deltas/chars | usage（prompt/completion/total） | 结果 |
|---|---|---|---|---|---|---|
| C1 | Kimi 官方 `api.kimi.com/coding/v1` · **kimi-k2.7-code**（picker 默认，§八③拍板） | 2934ms | 5422ms | 88/169 | 104/104/208 | ✅ 真流式逐字上屏 |
| C2 | 智谱 `open.bigmodel.cn/api/coding/paas/v4` · glm-5.3-flash | 619ms | 4159ms | 160/628 | 82/162/244 | ✅ 同上 |

- **Kimi k2.7-code 可通实锤**：阶段设计 §八③ 用户拍板「官方渠道用此名可通，C 档实测验证」——本档实测 **upstream-status 200 + 真 usage + 真流式**，拍板验证成立。模型自述「我是 Kimi，由 Moonshot AI（月之暗面）开发的 AI 助手」。
- **C3 观测闭环互证**：/tmp/nz-ai-chat.log 的 start/upstream-status/first-delta/done+usage 四拍齐全（TTFB/first-delta/usage 只有真通路才产生，字段出现本身=证据）；`__kfmNzAiChat()` 钩读数对拍——C1 钩 ai chars=169 ↔ 日志 chars=169；C2 钩 628 ↔ 日志 628；钩 ring 尾部序列 content_block_stop→message_stop→done 与日志 done 拍一致。两腿独立失败模式，一致。
- **R3 归位真通路表现**（截图 nz/tests/assets/ai-chat-c-c1-kimi-streaming.png / -done.png）：流式期 text 空 reasoning 非空 → 思考内容灰档归位为正文+竖条光标；done 后 text 到位 → reasoning 收进「思考」折叠区。k2.7-code 的 reasoning_content 帧全程正确分流（thinking_delta），无混排事故。

## 3. 真机 C 档（8026 CDP attach，dev.kfm.nz.agent）

- **echo 腿 ✅**：真机 AI 页选 echo::echo 发「真机 echo 试一条」→ 回放 PONG 节目全链绿（钩 msgs user:11/ai:171），截图存证 nz/tests/assets/ai-chat-c-device-echo.png（真机像素：orb 右中、思考折叠区、picker 回显全对）。
- **真消息腿（半绿，诚实申报）**：真机发智谱 glm-5.3-flash「真机上用一句话介绍你自己」——**server 侧全链完成**（upstream-status 200/TTFB 982ms/done 7685ms/usage 59/281/340 落盘齐全），client 收到 1102/1103 字符后**设备息屏（visibilityState=hidden）WebView 流节流**，末拍 delta+stop/done 帧滞留，钩停 STREAMING。这是 A9 设计内的环境事件（亮屏 → visibilitychange → attach from cursor 补流；run 已 5min 淘汰 → __end__ → error 入流收尾），**非产品 bug**；但「息屏断流→亮屏补流」真机路径本次未能目击（截图需前台，后台不产帧已实测两法均超时），**留 A2 观察项：用户亮屏后复验补流收尾**。
- 真机截图只拿到 echo 一张（真消息时设备已息屏）；按 AGENTS.md 纪律此处声明降级：真机真消息的像素级证据缺位，server 落盘+钩读数（1102 chars 上屏）为凭。

## 4. C 档结晶真虫（随验收修复，回归钉入账）

**畸形消息打崩 server**：C 档前的试发中 `{role:'user'}`（缺 content 数组）经 extractText TypeError → `void pump` 成未捕获拒绝 → **整个 server 进程被打崩**。修法双闸：route.ts 消息形状闸（role/content 数组校验→400，与缺/空 messages 同族）+ brain.ts 装配期未预见异常 catch→error 事件入流（P3：配置/上游错误绝不例外到 client、绝不崩进程）。回归钉入 nz/tests/ai-server.test.ts（三形态 400 + 同进程后续请求照常=没崩的机器证明），npm test 154→155。

## 5. orb 挪位（09-04 拍板入账）

右上 → **屏幕右边缘垂直居中**（`top:50% + translateY(-50%)`），动因：右上与顶部伸出的 tmux 标签排 max-content 宽度冲突。设计清单 §3.0 已同步改写。browser 考卷无钉 orb 位置的断言（B1 只钉往返转换与 DOM 有无），无需改卷；存证走新脚本 nz/tests/browser/ai-chat-orb-shot.mjs（数值断言 right=12px/cy=vh/2/与标签排零重叠全绿）+ 同框截图 nz/tests/assets/ai-chat-orb-right-center.png（标签排展开态与 orb 同屏，无冲突）。

## 6. 诚实登记（观察项，留 A2+）

1. **picker 缺 kimi-k2.7-code 行**：server 默认 default={Kimi, kimi-k2.7-code}，但 ~/.kfmv4/providers.json 的 Kimi 条目 models 列表无此名（列表=for-coding/for-coding-highspeed/k3/k3-256k）——picker 行源自 models 列表，一旦切走就点不回默认。A2 候选：picker 行集 = models ∪ {server default}。
2. **息屏断流补流路径未目击**（见 §3），A9 的机器验证目前只有 B 档「切页补流」钉，真机亮屏补流收尾待复验。
3. 钩 ring（64 拍窗口）在 88+ delta 的长流下 deltaEvents 计数 < 日志 deltas——窗口语义如此，对拍以 chars/done 为准，不算缺陷。

## 7. A1 不做清单（照设计 §〇，留 A2+，越界=返工源）

工具调用执行与渲染（tool_use 只容忍忽略）/ 会话持久化（run 只在内存，刷新即清）/ markdown 渲染（纯文本气泡）/ 多会话历史列表 / 8.x 重件（run-manager/session-store/tools/permissions/eyes 一件未搬）/ 逐词 blur 入场动画（只搬光标）/ 光球眼睛手（A2/A3 的活）。A2 立项前先消化 §6 两条观察项，数据类型/文件组织/UI 逐阶段讨论签收后再动手。
