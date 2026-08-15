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
- Fiber 状态机**六态**（fiber.ts:147-154，§4 初稿只写了三态，实际六态）：
  `PENDING`（等依赖服务）/ `LOADING`（callback 运行中）/ `ACTIVE`（已加载提供
  中）/ `FAILED`（config 或 callback 抛错）/ `UNLOADING`（disposers 运行中）/
  `DISPOSED`（已移除不可重启）。**依赖缺失是合法状态 PENDING，不是错误**——
  服务出现后自动激活（机制见 §7）
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
   是激活顺序的引擎——源码级细节见本笔记 §7（六态状态机 / epoch 拓扑签名 /
   notify 传播闭环）

## 7. inject 依赖引擎：声明式反应式激活（registry.ts + fiber.ts + reflect.ts）

> 2026-08-15 深挖补记。**inject 不是一次性依赖解析，是持续追踪的声明式
> 反应式依赖**：服务上线/下线/换实现/失可用，依赖者自动激活/卸载/重载，
> 插件作者零胶水。这是「一切皆插件」组合式架构的激活引擎。

### 7.1 声明形态与规范化（registry.ts:19, 37-60, 71-88）

- `Inject` 类型两种形态（registry.ts:19）：**数组**（只要服务可用，不带
  intercept 配置）｜**对象**（服务名 → intercept 配置，依赖与配置二合一）
- `@Inject` 装饰器（registry.ts:37-60）：类级 → 贡献到静态 `inject` map
  （原型链继承，`symbols.checkProto` 标记，registry.ts:40-44）；**方法级** →
  延迟到依赖服务可用才调用（`ctx.inject(inject, callback)`，registry.ts:48-55）
- `Inject.resolve()`（registry.ts:71-88）：数组/对象/类继承元数据统一归一为
  plain map（服务名 → 配置或 `null`）

### 7.2 激活是状态机不是一次装载（fiber.ts:147-154, 314-319）

- 构造时先 publish `internal/plugin`，再对每个 inject 服务 `_checkImpl(name)`，
  最后 `_refresh()`（fiber.ts:314-319）——**加载延迟到依赖检查之后**
- `PENDING` 是合法状态：依赖未齐 → 挂起；依赖齐 → 自动 LOADING → ACTIVE。
  插件代码**不因依赖缺失而报错**

### 7.3 epoch = 依赖拓扑签名（fiber.ts:611-639）——本机制题眼

- `_refresh()`：遍历 inject，任一依赖缺失 → `epoch = INACTIVE`；否则
  `epoch += ':' + impl.fiber.uid`（fiber.ts:611-623）——epoch 是**依赖实现的
  身份串接**（fiber uid 唯一标识提供者）
- `_setEpoch()`：epoch 未变 → 无事；INACTIVE → 有效 → `_reload()`
  （LOADING）；有效 → INACTIVE → `_unload()`（UNLOADING）（fiber.ts:625-639）
- **依赖实现换人（uid 变）→ epoch 变 → 自动重载**。注入不是一次性解析，
  是持续追踪的拓扑签名比较

### 7.4 可用性谓词 + strict（fiber.ts:597-609; reflect.ts:237-243）

- `_checkImpl()`：`reflect._getImpl(name, strict)` 查找；`impl.check` 谓词
  为 false 或抛错 → 视为缺失（fiber.ts:600-607）——服务「存在但不可用」语义
- `_getImpl` strict：提供者 fiber 非 ACTIVE → 不可用（reflect.ts:241）——
  服务提供者自己还在加载/卸载中，依赖者拿不到

### 7.5 激活时解析配置（fiber.ts:646-673, 740-741）

- `_reload()`：`store = { ..._store }` 快照 → `await Promise.resolve()` 排掉
  一个 tick（stale epoch 不跑插件代码，fiber.ts:651-654）→ `_resolveConfig`
  （`internal/config` waterfall + 服务 intercept 合并）→ `_execute(runner)`
- **config 延迟到依赖就绪才求值**（fiber.ts:740 注释「Config resolution may
  access injected services, so defer it until the fiber can activate」）——
  插件配置可以引用注入的服务

### 7.6 卸载：拓扑序，先撤依赖者（fiber.ts:675-696; reflect.ts:297-303）

- `_unload()`：`_disposables.clear()` 逆序跑 disposers → `store = undefined`
  → 若 epoch 又有效则重载（依赖在卸载期间回来了）
- **provide 的 disposer 顺序**（reflect.ts:297-303）：`delete store[key]` →
  `notify([name])` → **await 所有依赖该服务的 fiber 排空** → 最后才删自己的
  `fiber.store[name]`（「ensure self access before dependencies cleanup」）——
  **提供者卸载时依赖者先撤干净**，拓扑序回滚

### 7.7 notify 传播闭环：事件驱动级联（reflect.ts:277-304, 314-336）

- `provide()`：owner ACTIVE → `notify([name])`；disposer 里再次 notify
  （reflect.ts:294-296, 297-300）——**服务上线、下线都广播**
- `notify()`：遍历 registry 全部 fiber，`name in fiber.inject` 且 isolate
  过滤匹配 → `_checkImpl` + `_refresh()`（reflect.ts:314-328）；最后 emit
  `internal/service`（可被插件观察）
- **级联激活**：A 提供 x → notify → B 依赖 x → 激活 → B 提供 y → notify →
  C 激活……依赖图驱动、无中心调度器
- `_updateState` 只在 ACTIVE ↔ 非 ACTIVE 变化时 `reflect.notify`（fiber.ts:588-594）
- **isolate 过滤**（reflect.ts:314, 332）：通知只到达同 isolate 作用域的
  fiber——A 会话的服务变更不惊动 B 会话

**Rust 映射**：依赖激活 = 注册表 + watcher：服务 registry 变更广播
「X 上线/下线」事件 → 依赖 X 的插件重算签名 → 缺则 Pending、齐则激活。
卸载顺序 = provide 的 drop 先 notify 依赖者并 await 其卸载（拓扑序）。
epoch → Rust 端用「服务实例 id 列表」做签名比较。

## 8. profile/bundle 分层组合（dsh 层机制，非 cordis 核心）

> 2026-08-15 深挖补记。五机制⑤在 dsh 架构层实现：`vendor/include`
> （`@deepseek-ai/cordis-plugin-include`，patch 语义）+ `packages/boot/app-boot`
> （profile 组装）。与 §5 服务层 intercept 是同构机制的配置面镜像。

### 8.1 分层顺序（profile.ts:5-13, 358-403）

profile = `$DSH_HOME/profiles/<name>/` 下的 `package.json`（`dsh.profile`
带**有序 bundles 列表**）+ `cordis.patch.yml`（用户 patch 层，最后应用）。
组合顺序：**空根 ← bundle 层（按 bundles 顺序）← 用户 patch ← launcher 层**
（`--patch` 文件 + flag 派生 patch）。

### 8.2 applyEntryPatches 语义（vendor/include/src/index.ts:58-128）

- **输入不 mutate**：`structuredClone(data)`，输出总是 detached——可重复应用，
  热重载能回退已移除/变更的 patch（index.ts:63, 47-52 注释）
- `entryMap` 按行 `id` 索引，**group 递归**（index.ts:66-75）
- `insert`：无 id → 追加到尾部；有 id 且目标是 group → push 进 group.config。
  **insert 的行立即索引**（index.ts:96-101）——同一列表更后面的 patch 可寻址
  刚插入的行（「a layer must be able to configure or disable a row an
  earlier layer inserted」）
- 非 insert：按 id 寻址；`name` 不匹配 → warn + skip（防错配，index.ts:116-119）；
  其余字段**整体覆写**（`target[key] = value`，含 `disabled`、`config`）
- 匹配不到 → warn + skip，不报错（index.ts:110-114）
- **last-write-wins**：同 id 被多层命中 → 后层覆盖前层

### 8.3 配置面与激活面分工——哲学核心

base patch 头注释（`packages/bundle/base/cordis.patch.yml`）：「A patch
replaces the targeted row's whole config rather than merging into it」+
「**Row order carries no load semantics (activation is service-availability
driven)**」。即：

- 配置层（patch）只回答「有哪些插件 + 参数」，**行序无加载语义**
- 激活顺序完全交给 §7 的 inject 引擎（服务可用性驱动）
- **config 是整行替换不是深合并**——行语义 = 整行覆盖

**Rust 映射**：配置分层 = `serde` 反序列化 + 覆写合并（分层 map：内核默认 →
profile → 用户 patch，逐层覆盖）；行 id 寻址 → 配置条目以 id 为键覆写。
「行序无加载语义」→ NA 的插件启动顺序同样由依赖图驱动，配置只声明清单。

## 9. 对 NA 规格书的增补（2026-08-15 轮）

1. **依赖缺失是状态不是错误**：PENDING 合法态，服务出现自动激活——规格书
   §4.3 依赖声明补「依赖未齐时插件挂起，不报错」
2. **epoch 反应式重载**：依赖实现换人自动重载——NA 插件基座需要「服务实例 id
   签名」比较，而非一次性依赖解析
3. **notify 的 isolate 过滤**：服务变更只广播到同作用域 fiber——NA 每终端
   会话独立 ctx 时，会话 A 的服务变更不惊动会话 B
4. **config 延迟解析**：插件 config 可引用注入服务——NA 的插件配置解析放
   到依赖就绪之后
5. **卸载拓扑序**：提供者卸载先 notify 依赖者并 await 排空——NA 的
   `PluginHandle` 回滚顺序依依赖图，非注册序
