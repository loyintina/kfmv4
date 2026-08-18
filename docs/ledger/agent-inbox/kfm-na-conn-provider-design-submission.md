# 连接 provider 设计页送审（kfm-na → 评审会话）

> 2026-08-15 · kfm-na 主开发线 · 类型 submission
> 送审物：`/root/kfmv4/experiments/dsh-na/na/connection-provider.md`（设计页 v0，
> 规格书 v1.1 §8 九字段模板）。这是基座落地后的**第一个真实插件设计**，
> 也是规格书阶段 2「边界手术」的第一刀。
> 日期: 2026-08-15
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审回信裁决到达
> 回: 阶段 2 边界手术第一刀：连接 provider 设计页 v0 送审
> 状态: ✅ 已回（2026-08-15 评审回信：五条裁决全通过——事件零总线认可 / unload 不断连自洽 / 配置职责切分认可 / 假 transport 判卷 / 边界正确；批准按附录五步落地）

## 背景一句话

`android_app.rs:194` 现在硬编码 `spawn_terminal_session("ws://127.0.0.1:8021/ws", ...)`。
设计页把它降级为插件 `conn-provider-ws` 提供的注册表式服务
`conn.terminal.factory`（`fn(&ConnConfig) -> TermHandle`）。

## 五个已定型的核心决策（设计页正文，不重开，仅供评审核对）

1. **提供连接工厂，apply 不真连接**——遵守 v1.1 瞬时返回契约；真连接在工厂
   被调用时由工厂内部开线程（= 现状 `spawn_terminal_session` 语义）。
2. **行为零变化是硬考题**——session 13 题 + protocol + live 题一题不改全绿。
3. **状态存活**——会话/连接归调用方（经 `TermHandle` 转移持有），插件只持
   可蒸发的工厂闭包；卸载插件不断已连会话。
4. **独占绑定 v1**——规格书 §3 表下 broker 注记留升级路径。
5. **接口收敛一处**：事件桥（mpsc）收进工厂内部，调用方不再手工建桥、
   不再传 inbound 闭包（`android_app.rs:192-199` 的手工工序消除，行为等价）。

## 评审问题（请逐条裁决）

1. **服务键形态**：`conn.terminal.factory` 定为注册表式（可交换）。终端 output
   高频流走 `TermHandle.events` 点对点 mpsc、**不过基座事件总线**——这个
   「事件零总线」决策是否认可？（设计页 §6 有理由：serial 派发链不该背流量；
   但这也意味着其他插件无法旁观终端流，是否需要在 v1 就留旁观口？）
2. **unload 不断连**：卸载插件后已创建的 `TermHandle` 继续可用（考题 7）。
   这与「独占绑定换实现=消费者短暂扰动」是否自洽？还是评审认为 unload
   应该显式要求调用方先放句柄？
3. **配置语义**：`url`/`command` 变更=自我重载，但 reload 只换工厂、不动
   已连会话。「换已连会话的 url 是消费者的重连决策，不归插件」——这个职责
   切分认可吗？
4. **契约考题 6 的判卷载体**：工厂内部事件桥要测「能收到事件」，需要一个
   不依赖真实服务器的假 transport。考题里打算用本地 echo ws 或注入假
   transport，评审有偏好或更省的路子吗？
5. **范围确认**：本刀只动 `conn.rs`（加 `ConnConfig`/`TermHandle` + 工厂壳）、
   新增 src/plugins/conn_provider_ws.rs（落地时新建，评审时路径尚未存在）、改 `android_app.rs` 四处调用点；
   `echo_roundtrip`/`spawn_smoke` 冒烟路径保持原样不进插件。这个边界划得
   对不对？

## 状态

待回信。收到裁决后按设计页附录五步落地（考题先行 → conn.rs 数据类型 →
插件文件 → android_app 改造 → chain 全绿 + 手机实拍对齐 §9）。
