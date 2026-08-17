# cordis-na 活性闸(G2)+ 缓建桩(G3/G4)+ 政策归层(G5)设计页

> 2026-08-18 · kfm-na 线 · 状态:待评审
> 模板说明:本页是**内核机制**设计页非插件页,§8 九字段按机制语义改写
> (无服务键/配置 schema,代以「判定规则/检查面」)。依据:差距审计 G2/G3/
> G4/G5 + 评审裁决 2(panic + Ctx 活性标记,不许只换沉默方式)。
> 答案落点:`/root/kfm-na/crates/cordis-na/`。

## 一、身份与语义定义

**活性闸**(对应 Cordis `INACTIVE_ACCESS`,论文 Algorithm 6):fiber 卸载或
失败后,其 `Ctx` 句柄的一切操作 = **panic**。语义绑定观察等价判据:正确
实现下死后访问「不可能到达」(所有合法路径先经依赖图失效),到达即证明
有路径漏了排空——panic 让结构性 bug 在考题/实拍里立即显形,不被吞掉。

裁决边界(评审裁决 2):不是把 effect.rs:30 的静默丢弃换成 panic(那只是
换沉默方式),而是**操作入口先查活性**。

## 二、活性判定规则(按 Owner 分形)

| Owner | 活性判据 | 理由 |
|---|---|---|
| `Root` | 永远活 | 应用级 ctx 无生命周期 |
| `Fiber(name)` | fiber 状态 ∈ {Loading, Active} | apply 运行中(Loading)必须可用;Unloading/Inactive 即死——卸载期间跑的是 disposer 不是插件代码(见四) |
| `Child(id)` | `child_stacks` 含 id | fork 级联:父栈 dispose 时子栈条目摘除=死 |

`reload` 语义自然成立:activate 每次新建 `Ctx`(fiber.rs:309),重激活拿到
新活句柄,旧句柄永死——与 epoch 实例比对同构(旧逆元不许误删新绑定)。

## 三、检查面(操作入口清单)

- `Ctx`:provide / get / effect / config / fork / set_plugin_target——六个入口
  先查活性;
- `Events`:on_emit/on_serial/on_waterfall/emit/serial/waterfall——**同闸**。
  死 fiber 还能发射事件同样是死后访问;实现上 `Events` 增带 owner 活性
  信息(event.rs 已 import ctx 的类型,单向依赖不破)。

panic 消息统一格式:`INACTIVE_ACCESS: <owner 描述> 已死,<操作名> 拒绝`
(对齐 Cordis 术语,日志可 grep)。

## 四、与现有机制的交互(不许碰的三条)

1. **LIFO disposers 不受闸影响**:现有 disposer 闭包捕获的是 `Arc<Mutex<Core>>`
   直连内核(provide 逆元/监听器摘除条),不经 Ctx 入口——卸载路径上零
   活性检查,三相语义不动。考题验证。
2. **取消边界不动**:apply 完成后 target 翻转 → 栈 dispose → 落 Clean;
   此后旧 ctx 死。时序上 dispose 先于状态翻转(现状),考题锁死。
3. **effect.rs:30 静默丢弃删除**:EffectStack 不再接「死后注册」——因为
   经 Ctx 入口已不可能到达;栈的 `disposed` 标志保留(take-once 幂等语义)。

## 五、G3/G4 缓建桩(立考题,不实现)

- **G3 intercept**(中间件式派生 ctx):`#[ignore]` 考题桩,注明触发条件
  =「第一个需要改写注入行为的插件出现」;
- **G4 Parallel / 独立 bail**:`#[ignore]` 考题桩,注明触发条件 =「并发
  模型入档后」——同步基座下 Parallel 不可达,不手搓(v1.1 裁决延续)。

## 六、G5 政策归层

`apply_budget`/`BaseWarning` 是 kfm-na 的瞬时返回契约政策(规格书 §4.3),
不是 Cordis 机制。cordis-na 侧:`Base::new` 默认**关闭**预算检查,
`with_apply_budget` 由 harness 显式开启;kfm-na 侧 `android_app.rs` 建
Base 处补一行开启(政策归 harness)。行为不变,归属变清。

## 七、契约测试清单(cordis-na/tests/base_spec.rs 追加)

1. 卸载后 provide → panic(`#[should_panic(expected = "INACTIVE_ACCESS")]`);
2. 卸载后 get → panic;
3. 卸载后 effect → panic;
4. 卸载后 events 发射/监听 → panic(同闸);
5. 父卸载后 fork 出的子 ctx 操作 → panic(级联死);
6. reload 后:新 apply 拿新活句柄正常注册,旧句柄仍死;
7. Root ctx 永远活(卸载任意插件后根 ctx 操作正常);
8. disposer 不受闸:卸载路径 LIFO 跑通,观察等价判据(service_count/
   listener_count 归零)不回归;
9. 存量 17 题全绿(Loading 中 apply 可用的回归证明);
10. G5:默认 Base 不记 SlowApply;with_apply_budget 开启后超预算才记。

## 八、实拍判卷点

无新 C 档点(内核语义,host 考题全覆盖)。回归实拍:阶段 1 同款——
终端渲染/输入/快捷键行行为不变,装机即验证。

## 九、风险与不采用

- **风险**:插件若在自己开的线程里持有 ctx 副本并在卸载后调用——现在会
  panic 而非静默。这正是设计意图(显形),但排查现有三插件的线程用法是
  落地前必做项(conn.rs 线程不持 ctx,已核;termview/input_ime 无此模式);
- **不采用**:错误返回式活性检查(诱导吞错,裁决 2 已否);disposer 路径
  加闸(会打破三相);异步活性通知(v1 无此需求)。
