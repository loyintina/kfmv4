# 三方语义映射表（文档世界 ↔ Cordis 本体 ↔ cordis-na）

> 这是什么：双终审任务的收尾产物——把卡萝的 Cordis 侧初稿
> （`nine-zero-semantic-map-cordis-side.md`）与 kfm-na 线的 cordis-na 侧初稿
> （`nine-zero-semantic-map-cordis-na-side.md`）拼成一张表：16 行 × 三侧。
> 每侧都有源码验证（Cordis 侧 `/opt/dsh-src/vendor/cordis/src/`；cordis-na 侧
> `/root/kfm-na/crates/cordis-na/src/`），拼接时不改任何一侧的原始判定。
> 别的去哪找：两侧初稿保留（本表是拼接视图）；降生协议（phase2 契约 1）附表
> 时直接引用本表。

## 三方映射主表

图例：✅ 本体覆盖 · 🟡 语义等价形态异 · 🔴 真差距 · ⚪ 刻意差异（不搬）

| # | 文档世界概念（9.0 侧） | Cordis 本体（卡萝侧） | cordis-na（NA 侧） | 备注 / 差异 |
|---|---|---|---|---|
| 1 | 发现（路由表/机制注册表/信箱归属行扫描） | 🟡 `inject` 声明式 + `ctx.get`（registry.ts:17-51） | 🟡 `Ctx::get` + 错误两分（ctx.rs:60,192） | 注入面机械生成；**错误两分是 NA 反哺项**（声明未激活 vs 从未声明） |
| 2 | 注入（constraints/降生静态·动态层） | 🟡 `internal/config` lazy 求值（fiber.ts:642） | 🟡 `Ctx::config::<C>` 依赖就绪后 take 一次（ctx.rs:227） | **同一行两种动机**：Cordis 动机=前缀缓存（dsh 实践），NA 动机=未激活不解析（rlib 无缓存问题）——同构结论 |
| 3 | 事件（信箱四流型） | ✅ 五派发 `DispatchMode`（events.ts:32） | 🟡 三派发 Emit/Serial/Waterfall（event.rs:16） | 链条≈Serial/征集≈Emit/汇总≈Waterfall；线程 N:N 缓建（两表同判）；Parallel 缓建（v1.1） |
| 4 | 生命周期（机制四态） | ✅ fiber 六态（fiber.ts:142-153） | 🟡 五态无 DISPOSED（fiber.rs:35） | 嵌套表述：机制四态=外层状态机（何时死），退役=卸载三相（怎么死）；无 DISPOSED 已入不采用清单 |
| 5 | 累积器（git 回滚） | ✅ revertible effects / `ctx.effect`（论文 §3.1） | ✅ EffectStack + Disposer take-once（effect.rs:14-49） | git revert ≈ Cordis recover；运行时累积器=栈本身 |
| 6 | 同名二次登记=报错 | ✅ provisions 不相交（论文 Def 45） | ✅ `AlreadyProvided`（ctx.rs:67,160） | 双终审定稿；同语义 |
| 7 | 代际戳（防过期回执覆盖） | ✅ epoch = fiber.uid 串接（fiber.ts:104） | ✅ 实例比对 + epoch 签名（ctx.rs:83-88） | 旧 epoch 覆盖新状态→判红 |
| 8 | 死后访问判红 | ✅ `INACTIVE_ACCESS`（论文 Alg 6） | 🔴 **G2 活性闸阶段 2 待落地**（现状 effect.rs:30 静默丢弃） | **唯一已知缺口行**；落地后转绿、届时回报 |
| 9 | 两种红（退役判据） | ✅ 观察等价（Def 33） | ✅ service_count/listener_count helper（fiber.rs:245） | 「删钉=确认消亡」文档仪式无运行时对应（两表同判） |
| 10 | 守卫四件 | 🟡 连现实纪律（dsh 强化 #8） | ⚪ 无运行时对应（守卫是仓库机制） | 递归终止：broker 停滞靠降生发现+抽查 |
| 11 | 隔离（各线职责域） | ✅ `ctx.isolate`（context.ts:121） | ✅ RealmId + `Ctx::fork` + notify realm 过滤（ctx.rs:20-23） | intercept 无对应（G3 缓建，需求驱动） |
| 12 | 户籍（文档身份） | ⚪ 超出域（plugin-inventory 只枚举） | ⚪ 超出域 | kfmv4 特有概念，不强行造对应 |
| 13 | 探针/失效信号 | ⚪ 超出域（测试体系在运行时外） | ⚪ 超出域 | 同上 |
| 14 | 契约优先原则 | ✅ 采用裁决 4 | ✅ 差异表+不采用清单 | 冲突时 Cordis 补契约，或契约修订注记录差异 |
| 15 | 降生协议（八步降生链） | 🟡 system-prompt 组装 + preset 声明式（配置驱动） | 🟡 `Base::new` 启动配置表 + 注册期环检测（fiber.rs:117,148） | 配置驱动降生同构；NA 拓扑序由 refresh 不动点保证 |
| 16 | 静态/动态注入分层 | 🟡 前缀缓存约束（request-cache e2e） | 🟡 静态=编译期插件集 / 动态=config 惰性解析（fiber.rs:61-65） | 静态吃缓存/动态低频刷新；NA 分层动机=未激活不解析 |

## 超出 Cordis 语义域的项（拼接标注）

| 概念 | 处理 |
|------|------|
| 户籍（#12）、探针（#13）、豁免区、机制注册表 21 条 | kfmv4 特有——标注「无 Cordis 对应，文档世界独立」，不强行造对应 |
| 线程 N:N 流型 | 缓建（与 Cordis 无对应，撞墙再补） |
| 两种红的「删钉」仪式 | 文档世界仪式无运行时对应（运行时卸载后无「钉」概念） |

## 降生协议（phase2 契约 1）直接引用行

| 侧 | 引用行 |
|----|--------|
| Cordis 侧 | #2（注入分层）、#15（降生形态）、#16（缓存约束） |
| cordis-na 侧 | #1（错误两分）、#2（注入时机）、#6（同名报错）、#7（代际戳） |
| **并集** | **#1 / #2 / #6 / #7 / #15 / #16** |

> 拼接注记：两表的引用行并集才是降生协议要看的完整清单（各侧只列了自己
> 侧的直接引用，读者勿只看一侧）。

## 拼接说明

1. 本表 16 行 × 三列，每行三侧判定互不覆盖（各侧保留原始判定）；
2. 唯一已知缺口 = #8（G2 活性闸），cordis-na 阶段 2 落地后本行转绿；
3. 差异（Parallel 缓建 / 无 DISPOSED / 无 intercept）全部已入不采用清单或缓建桩；
4. 原始初稿保留（本表是拼接视图，不是替代）。
