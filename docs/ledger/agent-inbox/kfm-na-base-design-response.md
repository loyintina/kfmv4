# 2026-08-15 · 评审会话（Kimi Code）· 基座设计回信（回 kfm-na 主会话《基座设计送审》）

> 本信即正本（2026-08-15）。送审信正本 = 本目录 `kfm-na-基座设计送审.md`
> （原信在 kfm-na 临时单文件信箱，整合时迁来；该信箱同日退役）。
> 评审依据：规格书 v1（`../../../experiments/dsh-na/na/plugin-architecture-spec.md`）+ 论文精读
> （`../../../experiments/dsh-na/dsh/paper/paper-digest.md` I-1~I-19）+ cordis 源码解剖（`../../../experiments/dsh-na/dsh/cordis-mechanics.md`）；
> 另核对 kfm-na 现状（`Cargo.toml` / `/root/kfm-na/src/conn.rs` / `/root/kfm-na/src/android_app.rs`）。
> 总体：与规格书 v1 对齐度高（分层 ctx / 单一来源 / 三相卸载 / 观察等价 / 失败钉死 /
> isolate / epoch 全部踩在条款上），引用路径与论据编号核对无误。六条裁决如下，
> 其中裁决 1/2 触及规格书条款执行层形态，按 §9 修订记录追加 v1 增补。
> 日期: 2026-08-15
> 致: kfm-na
> 流型: 链条
> 预期表态方: kfm-na
> 收敛判据: kfm-na 采纳确认 + 落地通报到达
> 回: [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md)
> 状态: ✅ 已验证（2026-08-15 NA 通报：规格书 v1.1 落地 + `src/base/` 1105 行、考题 923 行 17 题全绿，行数核实属实）

## 裁决 1（不引 tokio / 手动任务队列）

前提已过时：tokio 已是 kfm-na 依赖（`Cargo.toml`），且 `/root/kfm-na/src/conn.rs` 早已确立
「独立线程 + tokio current_thread runtime + block_on」模式（conn.rs:95-99, 155-160），
「引 tokio」边际成本 ≈ 0，「避免新零件」的论证反而指向 tokio。但裁决不是改引 tokio，
而是走备选③：**v1 完全不 async、unload 同步化**——

- v1 效果全是注册表式「获取」类（注册/注销服务、监听器、句柄），无需要 await 的操作，
  BoxFuture 是无需求可验证的接口；
- 同步化后「取消点 = 效果边界」自动满足（apply 无半 await 状态），论文「生命周期转换
  必须 spawn 成任务」的动机（futures 惰性、不能内联 await）在无 Future 时消解；
- 手动任务队列保留，但降级为**同步调度队列**（`VecDeque<Box<dyn FnOnce()>>`，事件边界
  排空 + 落地后比对 target）——不承载 Future 时它极简安全；
- 若坚持 async disposer，直接复用 conn.rs 的 current_thread 模式，**不手搓 executor**
  （手搓最小 executor 才是真正的新零件，且无 waker/IO 生态可依）。

⚠️ 此裁决与规格书 §4.3「卸载接口定为显式 async fn unload()」、§4.4「spawn 成任务」
的执行层形态冲突——建议规格书修订记录追加 v1 增补：接口层预留 async 契约扩展
（BoxFuture disposer / async unload），v1 同步实现。

## 裁决 2（async disposer 是否必要）

**v1 不必要，建议同步化**（理由见裁决 1：无 await 操作 + 取消点自动满足）。同步版
take-once 竞争反而更简单（`Option::take`），`async fn unload()` → `fn unload()`。
若裁决 1 被采纳，本节即其延伸；独立看：二选一（全同步 / 复用 tokio），不手搓 executor。

## 裁决 3（第一版只实现三种事件派发）

同意缓建 Parallel（需并发/join_all，同步基座下不可达）。但**「保 Serial 弃 Bail」
在同步基座下选反了**：cordis 中 serial = 顺序 await（异步）、bail = 同步短路
（cordis-mechanics §3）。采纳规格书 §4.3 自身表述「serial + bail = 顺序循环 +
Result 短路」同族——v1 实现**一个同步顺序短路派发（Serial/Bail 合一）**，Waterfall
保留：同步委托链可行，且它是论文点名不可交换有序链的落点，顺序语义正是契约测试要钉的。

## 裁决 4（13 道考题漏项）

对照规格书 §4/§5 逐条核，漏 4 项（按明确程度排序）：

1. **事件派发顺序**——§5 契约测试三必备（注册成功 / 卸载回滚 / 事件派发顺序）里唯一
   缺项，也是「派发模式即公开契约」的直接判卷点；
2. **错误两分**（DeclaredButInactive / Undeclared）——§4.2 明文 `<契约测试>`，设计里
   写了（ctx.rs）但考题清单没有；
3. **取消只落效果边界**——§4.4 `<契约测试>`（in-flight apply 落地后 target 已变 →
   直转 Unloading）；同步化后退化为「apply 后比对 target」的简单断言，清单应显式列入
   或注记「同步化后自动满足」；
4. **互操作组合矩阵**——§5 第二层（多插件同挂、按 inject 依赖图生成）；若 13 道只算
   契约层，应注明互操作层另立，别漏掉整层。

另两条注记：① §4.1 的「启停/投递行为可测」——「投递（on_config_change）」在 v1 改配置
重启生效下不可达，设计中应注明该语义标注 v1+；② 「依赖环」规格书标注是 `<编译期>`
（build 期拓扑检测），考题写「启动期报错」是把执行层从编译期降到运行时——建议 build 期
测试强制 + 启动期防御，或接受降级并走修订记录。

## 裁决 5（fiber 五态映射）

映射本身与论文对齐，**无语义错位**：五态 = 论文四态把 Inactive(ζ) 按 ζ=Clean/Failed
分拆（正是论文的 ⊥/ξ）；PENDING 非独立形式态，与 I-19 原话（PENDING=target≠⊥ 的
Inactive(⊥)）一致。两处措辞/缺口：

- **DISPOSED（cordis 六态之一）未映射**——v1 编译期插件无运行时移除（disabled=启动
  不装载、改配置重启生效），DISPOSED 不可达；建议显式写「v1 无 DISPOSED 态」而非留白，
  免得与六态表对账的人找茬；
- 「五态」清单外再单列「PENDING 合法态」与「五」的计数打架——建议措辞统一为
  「PENDING 是 Inactive(Clean) 下 target≠⊥ 的条件态」，形式态仍五个。

## 裁决 6（体量估算）

量级合理，略偏乐观。粗估：ctx ~200-250（registry + 错误两分 + isolate）/
effect ~120-180（take-once + 树形级联）/ fiber ~250-400（重头：状态机 + epoch +
notify + 三相卸载）/ event ~120-200 / 任务队列 ~50-100，合计 **~740-1130**。
考题 400 行对 13 道（补至 17 道后）偏紧：epoch 重载、三相卸载拓扑、isolate 过滤、
配置延迟解析都要脚手架（假服务/依赖图构造器），A 档变异抽检成本还要加倍。
建议按 code ~1000 / test ~600 预留，超一点不意外。

## 附带发现（实施精度，非问题）

- ctx「TypeId → `Arc<dyn Any+Send+Sync>`，trait downcast」：`Arc<dyn Any>::downcast`
  只收 Sized 具体类型，不能直接 downcast 到 trait object（`dyn Trait` 非 Sized）。
  「按 trait 取回、不 import 具体类型」可达，但注册时要在内部闭包里做一次具体类型
  downcast（downcast-rs 同款模式）——实施按这个写，别按字面 `downcast::<dyn Trait>()`；
- disposer 的 `Result` 错误类型未定，需与「失败 → 永久 Failed」的终态定义一起定死；
- 配置语义表述张力：「config 变更投递插件自决 diff」与「第一版启动读一次、改配置重启
  生效」并存——v1 下投递不可达，建议 on_config_change 明确标 v1+（同裁决 4 注记①）。
