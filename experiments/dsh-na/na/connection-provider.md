# 连接 provider 设计页 v0.1（评审裁决已落地，可执行）

> v0 → v0.1（2026-08-15）：评审回信五条裁决全通过 + 2 条附带发现落地——
> §6 补「数据通道非插件事件」措辞钉死；§8 考题 9 措辞对齐 serial+bail；
> 落地步骤第 1 步前置「考题 1-4 全绿基线记录」。

依据：插件架构规格书 v1.1 §8 九字段模板。域=连接 provider（§3，第一批）。
本页是**规格书阶段 2 的边界手术**：把 `conn.rs` 的常驻会话能力从
`android_app.rs` 的硬编码调用，降级为一个可插拔插件提供的服务。

现状实锤（设计钉在这上面，不许凭印象）：

- `src/conn.rs:149` `spawn_terminal_session(url, command, inbound) -> mpsc::Sender<TermCmd>`：
  独立线程 + tokio current_thread runtime；Opened 前 Input 全缓存、Resize 只留最新；
  读 Ping 主动 flush 顶 pong（30s 心跳实锤，函数文档在）。
- `src/conn.rs:125` `TermCmd::{Input(String)/Resize{cols,rows}/Close}` 出向命令枚举。
- `src/session.rs`：`Session` 状态机（Opening→Live→Exited/Failed）+ `SessionEvent`，
  A 档考题 `tests/session_spec.rs` 13 道。
- `src/protocol.rs`：`ClientMsg`/`ServerMsg`/`encode_client`/`decode_server`，
  A 档考题 `tests/protocol_spec.rs`。
- 调用方 `src/android_app.rs:194`：启动即硬编码
  `spawn_terminal_session("ws://127.0.0.1:8021/ws", None, ...)`，
  持 `outbound: Option<Sender<TermCmd>>` + `event_rx`（mpsc 桥回主循环）。

---

## 1. 身份

- 插件名：`conn-provider-ws`（kfmv4 ws 协议适配器，第一个实现=现有转发）
- 域：连接 provider（§3，第一批）
- 一句话职责：向基座注册「终端连接工厂」服务，把「连哪、怎么连」从应用主循环
  里拿走；真连接仍是插件自己的线程，应用只拿到一对句柄。

## 2. 提供（服务键）

| 服务键 | 接口形态 | 内容 |
|--------|----------|------|
| `conn.terminal.factory` | **注册表式**（可交换，卸载序自由；独占绑定 v1，§3 表下 broker 注记留升级路径） | `fn(&ConnConfig) -> TermHandle` |

`ConnConfig` / `TermHandle` 定义（放 `src/conn.rs`，纯数据，不进插件）：

```rust
pub struct ConnConfig {
    pub url: String,            // 现状："ws://127.0.0.1:8021/ws"
    pub command: Option<String>,// None = 交互 shell
}
pub struct TermHandle {
    pub outbound: std::sync::mpsc::Sender<TermCmd>,     // 应用→连接
    pub events: std::sync::mpsc::Receiver<SessionEvent>,// 连接→应用
}
```

- 工厂签名里**不暴露 inbound 闭包**——事件桥（mpsc）由工厂内部建好，调用方只收
  `Receiver`。这是对现状的唯一接口收敛：`android_app.rs:192-199` 现在手工建桥，
  收进工厂后调用方少一道手工工序，行为等价。
- 工厂本身**瞬时返回**（v1.1 瞬时返回契约）：它只做「开线程 + 建通道」，
  TCP/WS 握手在线程里异步发生，调用方拿到句柄时连接未必 Opened——
  这与现状完全一致（`spawn_terminal_session` 本来就是这个语义）。

## 3. 依赖（inject）

无。第一个插件，不 inject 任何服务键。
（`report` 飞鸽传书保持现状直连——它是诊断通道不是服务，不注册进 ctx；
日志纪律归 §4.5 共享态纪律管，不归依赖管。）

## 4. 生命周期语义（apply / unload / 失败）

- **apply(ctx)**：只做一件事——把工厂闭包注册进 `ctx` 服务表，瞬时返回。
  **不真连接**（规格书 v1.1 瞬时返回契约：慢活插件自开线程；真连接发生在
  工厂被调用时，由工厂内部开线程）。
- **unload 三相**（§4.3）：
  1. 注销：从 ctx 摘掉 `conn.terminal.factory`，此后新调用方取不到；
  2. 反注册：无事件监听、无配置监听，无额外反注册；
  3. dispose：`FnOnce` 同步释放注册闭包本身。
- **已建立的连接不随 unload 死**：`TermHandle` 一旦交出，其线程与通道归
  **调用方**持有（见 §7 状态存活）。插件卸载只影响「今后还能不能新建连接」，
  不影响「已经连上的会话」——这是独占绑定 v1 下「换实现=卸旧装新，消费者
  短暂扰动」的具体含义。
- **失败语义**（§4.4）：apply 唯一可能失败的步骤是注册冲突（服务键已被占）——
  返回 `Err`，插件进 Failed 态，基座按 serial+bail 停链。连接期失败
  （连不上、断线）不是插件失败：走 `SessionEvent::Failed` 事件通道，
  与现状逐字一致。

## 5. 配置 schema

条目 `{id, config, disabled}` 中 config：

| 字段 | 类型 | 默认 | 变更语义 |
|------|------|------|----------|
| `url` | string | `"ws://127.0.0.1:8021/ws"` | **自我重载**（§4.1 配置语义分层：工厂闭包捕获配置，换 url=换新工厂） |
| `command` | string? | `null` | 同上 |

v1 无 `on_config_change`（规格书已标 v1+）；配置变更 = 基座 reload 插件。
注意：reload 只换工厂，**已建立的会话不换**——要换已连会话的 url 是
消费者（android_app）自己的重连决策，不属于本插件职责。

## 6. 事件（派发模式）

无。本插件不发射也不监听基座事件。
连接事件（`SessionEvent`）走 `TermHandle.events` 通道直交调用方，
**不经过基座事件总线**——理由：终端 output 是高频流（每击键一回声），
过总线会让 serial 派发链背流量；点对点 mpsc 是现状且行为正确。
**措辞钉死（评审裁决 1）**：`TermHandle.events` 是工厂服务**内部**的数据
通道（服务接口的一部分），不是插件事件；规格书「事件五派发」管的是插件间
`emit/on`，两者不冲突。旁观需求（如 AI 会话插件要看终端流）出现前，
v1 不预设派发模式——届时是「新增事件」，不是「改接口」。

## 7. 状态存活

| 状态 | 归属 | 理由 |
|------|------|------|
| 工厂闭包（含 config 捕获） | 插件内，**可蒸发** | 注册表条目，unload 即消失，重建成本≈0 |
| 会话状态机 `Session` / ws 线程 / 通道 | **调用方持有**（经 `TermHandle`） | §4.1 状态存活规则：会话/连接是长寿命状态，归长寿命服务；v1 调用方=android_app（应用壳），它活得比任何插件久 |
| Opened 前出向缓存（pending_input/last_resize） | ws 线程内局部，随连接生灭 | 现状如此，本就是一次性 |

要点：插件里**不存任何会话**。插件只是工厂的注册处，工厂交出的句柄把
全部运行态转移给调用方。卸载插件 = 拆注册处，不拆房子。

## 8. 契约测试清单

**行为零变化是硬考题**（一题不改必须全绿）：

1. `tests/session_spec.rs` 13 道全绿（状态机不碰）；
2. `tests/protocol_spec.rs` 全绿（编解码不碰）；
3. `tests/term_session_live_spec.rs` / `tests/ws_live_spec.rs` 全绿
   （live 路径不碰；`echo_roundtrip`/`spawn_smoke` 保持原样）；
4. 变异抽检（A 档纪律）：session 状态机任一行为改动必须立刻有题变红。

**基座层新题**（写在 `tests/` 新考题文件，先写题后写码）：

5. 注册成功：apply 后 `ctx` 可取回 `conn.terminal.factory`，调用得 `TermHandle`；
6. 事件桥收敛：工厂内部建桥——调用方不再传 inbound 闭包，
   经 `TermHandle.events` 能收到事件（用假 transport/本地 echo ws 判，
   具体判卷载体在考题里定）；
7. 卸载回滚（观察等价，§5）：unload 后取工厂=无；**卸载前已创建的
   `TermHandle` 仍可正常收发**（连接不随插件死）；
8. 换 provider 实例（独占绑定语义）：reload 后新工厂用新 config，
   旧 `TermHandle` 不受影响；
9. 注册冲突：第二个同名服务键注册 → apply 返回 Err，插件 Failed，
   基座按 serial+bail 停该链（v1.1 同步顺序短路语义）；

**不进考题的**（防过度约束）：线程内部 select 泵的时序细节——那是 conn.rs
胶水，已有 C 档实拍盯着。

## 9. 实拍判卷点（C 档）

手机实拍，感官判定与现状逐格对齐（行为零变化的最终判卷在手机上）：

- `field-reports.log` 出现 `[ws] connected / opened / output 预览 / exited`
  四格（conn.rs 头部已钉的冒烟判卷）；
- 启动即进交互 shell：敲 `ls` 有中文目录名、无方框（IME 链路不受影响）；
- 切后台再回来：画面保持（连接与渲染状态都不因插件化而丢失）；
- 软键盘弹出/收起、快捷键行两排、触摸滚屏：全部与现状一致。

证据链位置：手机 `~/w/项目/kfm-na/` 实拍日志 + 飞鸽传书 `field-reports.log`。

---

## 附：落地步骤预告（送审通过后执行）

1. 先写考题：新考题文件（清单 5-9）+ 确认 1-4 全绿基线；
2. `src/conn.rs` 加 `ConnConfig`/`TermHandle`，`spawn_terminal_session`
   包一层工厂壳（内部仍调原函数，胶水不动）；
3. 写插件 `src/plugins/conn_provider_ws.rs`（apply 注册工厂）；
4. `android_app.rs:192-199` 改为经基座取工厂、传 `ConnConfig`（删手工建桥）；
5. chain.sh 全绿 → 档位 2 手机实拍对齐 §9 → 登记 + 通报。

预计动 4 个文件（2 改 2 新），不碰 session.rs / protocol.rs / 任何现有考题。
