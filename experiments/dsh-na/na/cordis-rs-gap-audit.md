# cordis-rs 差距审计：kfm-na 基座 → 通用 Rust 运行时

> 2026-08-16 · kfm-na 线 · 状态：**已裁决**（信箱 `kfm-na-cordis-rs-audit-review.md`，
> 四条全收、两条带实质修正，见 §六）
> 审计对象：`/root/kfm-na/src/base/`(ctx/effect/event/fiber/mod,约 1100 行)
> + `tests/base_spec.rs`(**18 个 `#[test]` 函数**;早前写的「37」是 grep `fn `
> 连辅助函数一起数进去的口径笔误，以实测为准)
> 审计基准:9.0 信箱《Cordis 本体采用送审》E3 对账表十行 + 「通用框架」要求
> 前置实证:`base/` 对 `crate::base` 之外**零业务依赖**(grep 无命中)——
> 物理边界已成立，通用化是搬家不是解剖。
> 验收口径钉（评审裁决 4)：全仓 `cargo test` 实测基线 = **126 通过 / 2 ignored**
> (2026-08-16 实测);早前通报的「363」是各刀考题的断言/参数化展开计数，
> 不可核实，弃用——一切验收以全量可实跑基线为准。

## 一、E3 逐行对账

图例:✅ 已覆盖 · 🟡 语义等价但形态/粒度异 · 🔴 真差距 · ⚪ 刻意差异(不搬)

| # | Cordis 本体(E3 行) | kfm-na 基座现状 | 判定 |
|---|---|---|---|
| 1 | Context + fiber 生命周期 + 事件派发 | `Ctx` + fiber 五态机(Inactive(Clean/Failed)/Loading/Active/Unloading)+ 三派发 | ✅(事件差异见行 6) |
| 2 | apply/unload 两栏(缺栏非法) | `Plugin::apply` 单栏；逆元强制走 `ctx.effect()` 栈,unload 由基座 target 翻转驱动 | 🟡 语义等价:卸载「栏」在契约模板层(规格书 §8)而非 trait 上;cordis 允许 apply 返回 disposer,我们唯一通道是 effect 栈——**我们的形态反而更硬**(唯一通道 = 考题可机械检查) |
| 3 | 卸载三相(停供→依赖者排空→LIFO) | `unload_fiber` 三相完整实装(ctx.rs `stopping` 标记 / 传递闭包排空 / take-once LIFO) | ✅ |
| 4 | 观察等价(Def 33)+ `INACTIVE_ACCESS` | 判据 helper 有(`service_count`/`listener_count`);**fiber 卸载后其 `Ctx` 仍可 provide/get/effect,无活性闸**(effect.rs:30 静默丢弃) | 🔴 半项差距 → **G2** |
| 5 | relied 守卫(有依赖者禁卸) | 反向实现:卸载时**传递排空依赖者**再自卸 | 🟡 语义差异，裁决维持排空。**措辞钉**（评审裁决 1):「卸载三相连带排空」与「broker relied 守卫（有依赖者禁卸）」是**两种不同语义**——前者=拆链时的消费者处置（运行时机制），后者=有活实例时拒绝拆（9.0 №6 业务层语义）。crate 差异表须分写，防两线对账时把两个「relied」混为一谈 |
| 6 | 事件四派发(emit/serial+bail/waterfall/parallel) | Emit / Serial(serial+bail 合一)/ Waterfall;Parallel 缓建 | 🟡 已拍板缓建;通用化时 Parallel 与独立 bail 立考题桩 → **G4** |
| 7 | isolate / intercept(派生上下文) | `fork(realm)` = isolate ✅;**intercept(中间件式改写注入的派生 ctx)无** | 🔴 → **G3**(v1 无插件需要,缓建) |
| 8 | 注册=效果(`ctx.effect`) | `Ctx::effect` + Disposer 逆元 | ✅ |
| 9 | inject 引擎(反应式重调) | `deps()` 声明 + epoch 实例签名 + notify 整 fiber 重载 | 🟡 粒度差异:cordis 是插件**内**回调局部重跑,我们是**整插件**重激活。结论等价(依赖者必见新实例),代价是我们重建成本高、纪律更硬(插件内不允许藏局部重订逻辑) |
| 10 | 配置 Schema 校验(standard-schema) | `ConfigParser` 延迟解析,无校验 | ⚪ 不采用(9.0 亦未采用;类型即校验) |

## 二、通用化差距清单(cordis-rs 必须解决)

- **G1 · Ctx 硬编码 `Term` 占位**(ctx.rs:136):harness 服务混进了内核。
  通用 crate 删除该字段,内核服务全走 registry;终端服务由 kfm-na 侧以
  普通插件身份提供(它本来就已是 `term-alacritty` 插件)。
- **G2 · 活性闸(INACTIVE_ACCESS 对应物)**:fiber 卸载/失败后,其 `Ctx`
  句柄仍可操作——Cordis 语义是死后访问即抛错。**裁决定为 panic**（评审
  裁决 2):死后访问 = 实现 bug,且与观察等价判据直接绑定——正确实现下
  「不可能到达」,到达即证明有路径漏了排空;错误返回会诱导插件吞掉它。
  实现注记:不是把 effect.rs:30 的 return 换成 panic(那只是换沉默方式),
  而是**在 Ctx 上挂活性标记**(owner fiber 的 active 状态),所有操作入口
  先查活性;考题 = 卸载后 provide/get/effect 三种操作各断言 panic。
- **G3 · intercept 缺失**:缓建,立考题桩(标注需求驱动)。
- **G4 · Parallel / 独立 bail**:缓建,立考题桩(同步基座下 Parallel
  不可达,需先定并发模型再实现,不手搓)。
- **G5 · `apply_budget`/`BaseWarning` 归层**:这是 kfm-na 的瞬时返回契约
  政策(§4.3),不是 Cordis 机制。通用 crate 做成可选配置(默认关闭),
  政策归 harness。
- **G6 · 并发模型入档**:单 `Mutex<Core>` 全同步是设计选择不是权宜——
  同步语义=安卓主线程可推理=观察等价判据可写。crate 级文档显式声明,
  不引 tokio(v1.1 裁决延续)。
- **G7 · crate 边界**:已实证零业务依赖,workspace 化是纯搬家;
  全量可实跑基线(实测 126 通过/2 ignored)全绿即搬家考题。

## 三、移植路线图

- **阶段 0(本审计)**:差距清单入档,信箱送审。
- **阶段 1 · workspace 化**:kfm-na 转 cargo workspace,`base/` 原样搬入
  `crates/cordis-na`(评审裁决 3:不叫 `cordis`——npm 官方同名包,
  防「同名不同物」认知污染);同刀切除 G1。**验收**(评审裁决 4 口径)=
  全量可实跑基线全绿 + 搬家前后行为快照对比 + **终端插件照常工作**
  (term_emu 5 题 + termview 33 题全绿且实拍终端画面正常)——term-alacritty
  搬家后从 `crates/cordis-na` 拿 Ctx,它就是「第二个消费者不改内核」的
  第一个实例。
- **阶段 2 · 语义补差**:G2 活性闸 + 考题;G3/G4 考题桩(缓建标注);
  G5 归层。
- **阶段 3 · crate 文档**:README 写明语义出处(论文定义号 +
  `cordis@4.0.0-rc.7` MIT 致谢)、与本体差异表(卸载排空 vs relied 拒绝 /
  inject 整插件重载 / 全同步 / 无 DISPOSED 态)、升级跟随策略(上游 rc→1.0
  语义 diff 评估归本线,跟随=契约化动作,与 9.0 评审约束②同构)。
  差异表中「effect 栈唯一通道」写成**显式优点**(评审附带发现 2):
  唯一通道 = 考题可机械检查,防将来有人为「对齐 cordis」放宽成 apply
  可返回 disposer,丢掉机械检查能力。
- **阶段 4+ · 按需**:真出现第二个消费者再谈独立仓库与发布;通用性的
  证明方式是「第二个消费者不改内核」,不是提前长旋钮。

## 四、不采用清单(显式记账)

- loader / HMR(Node 专属,9.0 同不采用)
- standard-schema 配置校验(类型即校验)
- async 一等效果 / BoxFuture disposer(v1.1 拍板全同步,接口预留不实现)
- DISPOSED 态(编译期固定插件集,无运行时移除)
- Parallel 派发(同步基座下不可达)

## 五、裁决记录(2026-08-16 评审回信,四条全收)

1. **relied 语义**:维持传递排空;措辞钉见行 5(排空 vs broker 禁卸分写)。
2. **G2 活性闸**:panic + Ctx 活性标记(论证与实现注记见 G2)。
3. **crate 名**:`cordis-na`。
4. **阶段 1 验收**:全量可实跑基线(126 通过/2 ignored)+ 快照对比 +
   终端插件第一个外部消费者无缝;「363」口径弃用(见文首口径钉)。

附带发现吸收:① §4.3 已补「全同步为设计选择」(规格书 v1.3);② 差异表
「唯一通道 = 显式优点」已入阶段 3 要求。
