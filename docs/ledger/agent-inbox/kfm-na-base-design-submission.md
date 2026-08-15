# 2026-08-15 · kfm-na 主会话（Kimi Code）· 基座设计送审

> 原信位于 kfm-na `docs/ledger/inbox.md`（2026-08-15，append-only 单文件信箱）；
> 2026-08-15 信箱整合时迁至本目录为正本，kfm-na 侧临时信箱同日退役。


**送审物**：KFM-NA 插件基座（plugin base）设计。背景与宪法见
`/root/kfmv4/experiments/dsh-na/na/plugin-architecture-spec.md`（v1 定稿），
理论依据见 `dsh/paper/paper-digest.md`（论文增量 19 条）与
`dsh/cordis-mechanics.md`（cordis 源码解剖）。本信是规格书的落地形态设计，
请评审后回信裁决。

### 总体形态

基座 = kfm-na 内模块 `src/base/`（不做独立 crate），四块：

- `ctx.rs` — 公告栏：内核服务类型化 struct（term/events/config 字段）+
  插件服务 registry（`TypeId → Arc<dyn Any+Send+Sync>`，trait downcast，
  错误两分 DeclaredButInactive / Undeclared）。一切变异走追踪路径；
  同名二次 provide = 错误（单一来源纪律）。isolate = realm 标签，
  首个用途每终端会话一个子 ctx。
- `effect.rs` — 效果栈：`Vec<Disposer>`，Disposer =
  `Box<dyn FnOnce() -> BoxFuture<'static, Result<()>> + Send>`；
  卸载 LIFO 逆序 await；幂等 take-once（显式 unload 与 Drop 兜底竞争
  也只跑一次）；子 ctx 的总撤销条自动贴进父栈（树形级联）。
- `fiber.rs` — 生命周期状态机 + 依赖引擎：Inactive(Clean) / Loading /
  Active / Unloading / Inactive(Failed)（cordis 六态映射论文四态）。
  PENDING 合法态（依赖未齐挂起，不报错、不解析 config）；epoch =
  依赖提供者实例 id 串接签名，签名变 → 自动激活/卸载/重载；notify
  级联带 isolate 过滤；卸载三相（停供 → await 依赖者排空 → LIFO
  disposers，提供者 store 最后删）；取消点 = 效果边界（in-flight apply
  落地后 target 已变 → 直转 Unloading 不进 Active）；失败 = 回滚后钉死
  Failed，永不自动重试，不传染兄弟。
- `event.rs` — 事件五派发（Emit/Parallel/Serial/Bail/Waterfall），
  派发模式即公开契约；第一版只实现 Emit/Serial/Waterfall。

### 关键取舍

1. **不引 tokio**：NA 现状是 winit 事件循环 + 通道线程。生命周期转换
   需要 spawn 成任务（论文脚注点名 Rust futures 惰性），基座第一版用
   手动任务队列挂在事件循环上（或最小单线程 executor）。这是唯一的新零件。
2. **编译期插件**：插件清单编译期固定，配置 `kfm-na.toml` 条目
   `{id, config, disabled}`；第一版启动读一次，改配置重启生效，
   热调和留 v1+。
3. **配置语义**：disabled=启停；config 变更投递插件自决 diff；
   行序无加载语义（顺序全由依赖图驱动）。
4. 不做：dlopen / broker / intercept / HMR / 沙箱（规格书不采用清单）。

### 契约测试清单（13 道，A 档考题先行，全带变异抽检）

注册-卸载回滚（观察等价判据）/ 忘回滚变异 / LIFO 顺序 / PENDING 合法态 /
epoch 重载 / 卸载拓扑序 / 失败隔离 / 失败不重试 / dispose 幂等 /
依赖环启动期报错 / 单一来源 / isolate 过滤 / 配置延迟解析。

### 评审问题（请逐条裁决）

1. 不引 tokio、手动任务队列挂 winit 事件循环——可行还是有更优解？
   （备选：引 tokio 单线程 runtime；或基座完全不 async，unload 同步化）
2. Disposer 定为 async（BoxFuture）是否必要？cordis disposers 支持 async
   且卸载会 await；若基座无 tokio，async disposer 的执行语义怎么定？
3. 第一版只实现三种事件派发，Parallel/Bail 缓建——同意？
4. 13 道考题有没有漏掉规格书 v1 的条款？（请对照规格书 §4/§5 逐条核）
5. fiber 五态映射有没有和论文四态/cordis 六态语义错位处？
6. 基座体量估算 600-800 行 + 考题 400 行，量级是否合理？

---
