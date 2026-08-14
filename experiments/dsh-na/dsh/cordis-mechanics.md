# Cordis 机制解剖笔记（dsh 深挖 · 阶段 1）

> 2026-08-14。来源：`/opt/dsh-src/vendor/cordis/src/`（`@deepseek-ai/cordis`
> 4.0.0-rc.7 vendored 快照，上游 cordiverse/cordis 56b3d4f）。全部论断带
> file:line 出处。本笔记是规格书（na/plugin-architecture-spec.md）的
> 证据层；规格书引用本笔记的机制结论。

## 0. 源码地形（9 文件 2693 行）

| 文件 | 行数 | 职责 |
|------|------|------|
| `context.ts` | 146 | Context：proxy 服务解析 + extend/isolate/intercept 作用域 |
| `service.ts` | 115 | Service 基类：构造即注册、随 fiber 卸载、intercept 配置合并 |
| `events.ts` | 352 | 事件总线：五派发 + 上下文过滤 + 监听器随 fiber 卸载 |
| `fiber.ts` | 754 | Fiber：插件装载单位、状态机、disposers 逆序回滚 |
| `registry.ts` | 337 | RegistryService：插件/inject 注册表（ctx.plugin/ctx.inject） |
| `reflect.ts` | 418 | ReflectService：proxy 背后的服务查找（ctx.get/provide） |
| `utils.ts` | 287 | DisposableList、symbols、tracker |
| `logger.ts` | 270 | 日志服务 |
| `index.ts` | 14 | 出口 |

## 1. 服务注册 = 构造副作用，卸载 = 自动移除（service.ts:31-46）

`Service` 抽象基类：子类构造时 `super(ctx, name)` → `ctx.reflect.provide(name,
self, check)` 立即注册；注释明言「The service is registered immediately and
is automatically removed with the owning fiber」。**没有显式「注销」调用**——
服务生命周期完全绑定 fiber。

- `name` 即服务在 ctx 上的键（TS 类型层由 declaration merging 增补接口，
  context.ts:16-18 注释「augmented by core services and plugins」）
- `[Service.check]` 是可用性谓词，传给 provide（服务「存在但不可用」语义）
- `[Service.invoke]` 让服务可调用（`ctx.logger()` 形态，createCallable）

**Rust 映射**：`Service` trait + 构造注册在 Rust 没有「构造副作用」惯用法，
对应物 = `Plugin::apply(ctx)` 显式注册 + `PluginHandle` drop 时注销（RAII）。
「可用性谓词」→ `Option<Arc<dyn Service>>` 或状态枚举。

## 2. ctx 是 proxy，作用域是子 ctx（context.ts:20-24, 49-75）

「A context is a proxy: normal property reads go through the service resolver,
while `extend()`, `isolate()`, and `intercept()` create scoped child contexts
without mutating their parent.」

- `extend(meta)` — 带元数据的子 ctx
- `isolate(name, label)` — 给服务名开独立作用域（**每个 agent 可有自己的
  ctx.agents 实例**——dsh「Scope a registration to one agent」的机制底座）
- `intercept(name, config)` — 服务级配置拦截，子 ctx 覆盖父配置

**Rust 映射**：类型化 `Ctx`（内核服务 struct 字段）+ 插件 registry
（trait downcast）。作用域 = 子 Ctx 借用/Arc 分层，或 `isolate` 表
（service name → scope label，context.ts:18-19 的 `[symbols.isolate]: Dict`）。

## 3. 事件五派发（events.ts:34-203）——修正文档「四派发」

源码实现五种派发模式（dsh 文档写「四种」+waterfall，源码实际是 **五种**）：

| 模式 | 语义 | 实现 | 行号 |
|------|------|------|------|
| `emit` | 同步观察，忽略返回值 | 同步 forEach | events.ts:186-189 |
| `parallel` | 并发运行，全部 settle | Promise.allSettled，有 reject 抛 AggregateError | events.ts:171-183 |
| `serial` | 顺序 await，直到一个 bail 值 | 顺序跑，isBailed 短路（值非 null/false/undefined） | events.ts:191+ |
| `bail` | 同步顺序，直到一个 bail 值 | 同步版 serial | （同族） |
| `waterfall` | 环绕委托：`next()` 委托下一监听器，不调即否决 | 最后一个参数是 next 延续 | events.ts:61-66 |

- **派发模式是事件公开契约的一部分**（dsh architecture.md 原文），事件名类型
  级声明（`declare module './context.ts'` 增补 `Events` 接口）
- `dispatch()` 做上下文过滤：监听器 `hook.global` 跳过过滤，否则按
  `Context[filter]`（isolate 标签匹配）过滤（events.ts:136-146）
- **监听器随 fiber 卸载**：`on()` 返回 disposer，且 fiber 卸载自动移除
  （events.ts:99-101 注释「automatically disposes listeners with their owning
  fiber」）
- `internal/*` 事件是框架自身的可观察扩展点（internal/listener、
  internal/dispatch、internal/update——监听器注册/事件派发本身可被插件观察）

**Rust 映射**：五派发全部可做——emit = 同步 for 循环；parallel = futures
join_all；serial/bail = 顺序循环 + `Result` 短路；waterfall = 委托链
（`next: Box<dyn FnOnce()>` 或参数里传 continuation）。Rust 无 TS 的事件名
类型级声明，对应物 = 事件枚举 + 每个事件标注派发模式（`enum Event { 
SessionChanged { mode: DispatchMode, ... } }`）。

## 4. 可逆效果：DisposableList 逆序回滚 + Fiber 状态机（fiber.ts:71-72, 144-147, 194-203；utils.ts:5-31）

- `DisposableList`：sn 递增注册，`clear()` 返回 **逆序**（最新注册先回滚，
  utils.ts:27-30 `values.reverse()`）
- Fiber 状态机：`PENDING → … → UNLOADING（disposers 运行中）→ DISPOSED`
  （fiber.ts:144-147）
- `fiber.dispose()`：卸载插件 → 等清理完成（fiber.ts:195-196）；disposers
  支持 async，卸载会 await（fiber.ts:71-72）
- 插件内部注册（监听器/服务/定时器）统一进 fiber 的 `_disposables`，
  卸载一次逆序跑完——**插件作者不需要手动配对注册/注销**

**Rust 映射**：`struct PluginHandle { disposers: Vec<Box<dyn FnOnce()>> }` +
`impl Drop` 逆序执行（RAII，作用域/生命周期退出自动回滚）。async disposer
在 Rust 里 Drop 不能 await → 用显式 `async fn unload()` 或
`spawn_blocking`/block_on 兜底——**这是 Rust 移植的真设计点**（规格书 §4.3
要补：卸载是 async 的显式调用 + drop 兜底路径）。

## 5. intercept 配置合并（service.ts:63-94）

`resolveConfig(base, head)`：按服务名沿祖先链收集 intercept config，
base 最优先、head 最后；服务声明 `Config.merge` 则用其合并，否则浅
Object.assign。**配置分层 = 祖先链 + 覆盖**——对应 dsh 的 profile/bundle
patch last-write-wins（架构层），这里在服务层也有同名机制。

**Rust 映射**：配置分层 = 简单覆写合并（`struct Config { … }` + 分层 map：
内核默认 → profile → 用户 patch，逐层覆盖）。NA 不需要 cordis 的
`[symbols.config]` 幻影类型体操，直接 `serde` 反序列化 + 覆写合并即可。

## 6. 对 NA 规格书的修正与增补

1. **四派发 → 五派发**：emit/parallel/serial/bail/waterfall（本笔记 §3）
2. **卸载是 async + 逆序**：Rust 的 Drop 不能 await，卸载接口定为显式
   `async fn unload()`（逆序跑 disposers）+ drop 兜底（规格书 §4.3）
3. **作用域机制**：isolate 标签给 NA 启发——终端会话/对话会话可各持独立
   服务作用域（规格书 §4 增补「作用域」小节）
4. **框架自观察**：`internal/*` 事件模式给 NA 启发——基座自身的注册/派发
   可被观测（对应 kfmv4 的 obs 观测台思路）
5. **inject 依赖**：registry.ts（337 行）的 `ctx.plugin`/`ctx.inject` 注册表
   是激活顺序的引擎——NA 规格书依赖图激活的论断在此有源码支撑（细节随
   深挖增补）
