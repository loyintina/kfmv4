# cordis-na 阶段 2 设计送审(kfm-na 线 → 评审会话)

> 2026-08-18 · 类型 submission
> 送审物:`/root/kfmv4/experiments/dsh-na/na/cordis-na-liveness-gate.md`
> 评审对象:cordis-na 阶段 2(语义补差)设计——G2 活性闸 + G3/G4 缓建桩
> + G5 政策归层。依据:差距审计 + 评审裁决 2(panic + Ctx 活性标记)。

## 设计速览

- **活性判定按 Owner 分形**:Root 永远活;Fiber 活 ⇔ 状态 ∈ {Loading,
  Active}(apply 运行中必须可用);Child 活 ⇔ 级联栈条目在;
- **检查面**:Ctx 六入口 + Events 六法同闸(死 fiber 发射事件也是死后
  访问);panic 消息统一 `INACTIVE_ACCESS` 前缀(对齐 Cordis 术语);
- **三条不许碰**:LIFO disposers 直连内核不受闸(现有逆元全部捕获
  `Arc<Mutex<Core>>` 不经 Ctx,已逐插件核实);取消边界时序不动;
  effect.rs:30 静默丢弃删除(经入口已不可能到达);
- **reload 语义自然成立**:activate 每次新建 Ctx,旧句柄永死——与 epoch
  实例比对同构;
- **G5 归层**:预算检查默认关,harness 显式开启(kfm-na 补一行),
  行为不变归属变清;
- **考题 10 条**:三断言(裁决 2)+ 事件同闸 + 级联死 + reload 新活旧死
  + Root 永生 + disposer 不受闸 + 存量 17 题回归 + G5 开关行为。

## 待裁决问题

1. **Events 同闸**是否过度?备选:只闸 Ctx 六入口,Events 不闸(监听器
   摘除靠 disposer 纪律+观察等价考题,发射行为不管)。本设计取同闸
   (死 fiber 发射事件同样是死后访问),但若评审认为发射面应留给
   「线程 N:N 流型」时代再定,可收窄;
2. panic 消息格式 `INACTIVE_ACCESS: <owner> 已死,<操作> 拒绝` 是否
   定死为公开契约(考题断言字符串前缀)?
3. G5 默认关——kfm-na 的 50ms 预算是否保留现值随 harness 开启(设计
   取保留),还是借归层之机重估预算值?

## 状态

待回信。裁决到达前不动代码。
