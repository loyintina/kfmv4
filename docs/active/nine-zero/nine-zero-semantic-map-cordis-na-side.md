# 三方语义映射表 · cordis-na 侧(kfm-na 线)

> 这是什么:「文档世界 ↔ cordis-na ↔ Cordis 本体」三方语义映射表的
> **cordis-na 侧**材料(双终审所立任务:9.0 与 NA 各维护一半,降生协议
> 契约定稿时附表)。行号对齐卡萝的 Cordis 侧初稿
> (`nine-zero-semantic-map-cordis-side.md`)16 行。
> 每行标注 cordis-na 的**精确 API + 源码位置**
> (`/root/kfm-na/crates/cordis-na/src/`,文件:行,2026-08-17 阶段 1 后)。
> 状态:cordis-na 侧初稿(待与 9.0 侧、Cordis 侧拼接;用户过目后定投递)。

## 映射主表(cordis-na 列)

| # | 文档世界概念(9.0 侧) | cordis-na 精确 API | 源码验证 | 备注 / 与 Cordis 侧的差异 |
|---|---|---|---|---|
| 1 | 发现(路由表/机制注册表/信箱归属行扫描) | `Ctx::get` + `ServiceKey::of::<dyn T>()`;`GetError` 错误两分(`DeclaredButInactive`/`Undeclared`) | ctx.rs:192, 60;ServiceKey ctx.rs:28 | 发现=按 trait 寻址的 registry 查找。**错误两分是 NA 反哺降生协议的条目**(沙漏讨论区 NA 表态一):「声明未激活」与「从未声明」必须报不同错 |
| 2 | 注入(constraints/降生静态·动态层) | `Ctx::config::<C>()`;解析时机=依赖就绪后、apply 前,fiber 内 take 一次 | ctx.rs:227;fiber.rs:316-324 | **时机纪律**(NA 表态二):求值在「降生完成时」非「首次用到时」;Cordis 侧 lazy config(fiber.ts:642)同构 |
| 3 | 事件(信箱四流型) | `Dispatch::{Emit, Serial, Waterfall}`;`Events::{on_emit, on_serial, on_waterfall}` + 派发三法 | event.rs:16, 107-191 | 流型映射:链条 1:1≈`Serial`(顺序短路);征集 1:N≈`Emit`(同步广播);汇总 N:1≈`Waterfall`(委托链聚合);线程 N:N=缓建(与 Cordis 侧同判,撞墙再补)。Parallel 缓建(v1.1 裁决:同步基座下不可达) |
| 4 | 生命周期(机制四态) | `FiberState::{Inactive(Clean/Failed), Loading, Active, Unloading}` 五态;**无 DISPOSED**(编译期固定插件集,刻意差异) | fiber.rs:35 | 嵌套表述与 9.0 一致:机制四态=外层状态机(何时死),退役内部=卸载三相(怎么死,`unload_fiber` fiber.rs:379-425)。无 DISPOSED 已入不采用清单 |
| 5 | 累积器(git:回滚/撤销) | `EffectStack` + `Disposer = Box<dyn FnOnce() + Send>`;LIFO 逆序 + take-once 幂等 | effect.rs:14, 18-49 | 逆元累积=效果栈;`Ctx::effect` 注册(ctx.rs:209)。git revert 无运行时内对应(运行时的「累积器」就是栈本身) |
| 6 | 同名二次登记=报错(broker 纪律) | `ProvideError::AlreadyProvided`(同 realm 同名 provide 直接错误,绝不覆盖) | ctx.rs:67, 160 | NA 自 G1 映射提出,双终审定稿;与 Cordis「provisions 不相交」(论文 Def 45)同语义 |
| 7 | 代际戳(防过期回执覆盖新状态) | 服务条目 `instance` id + provide 逆元**实例比对**(绑定已更换则旧逆元不许误删);依赖侧 `epoch` 签名 | ctx.rs:83-88, 184;fiber.rs:441 | 旧 epoch 覆盖新状态→判红。对应 Cordis `epoch = ':' + fiber.uid`(fiber.ts:104) |
| 8 | 死后访问判红(退役后仍被引用) | **G2 活性闸:阶段 2 待落地**(裁决已定:panic + Ctx 活性标记;考题=卸载后 provide/get/effect 三断言)。现状:effect.rs:30 静默丢弃 | 审计文档 G2;评审裁决 2 | 对应 Cordis `INACTIVE_ACCESS`(论文 Algorithm 6)。机制退役后仍被引用=死后访问→痛觉器官判红。**此行是三表中唯一的「已知缺口」行** |
| 9 | 两种红(退役判据) | 观察等价判据 helper:`Base::service_count` / `Events::listener_count`;base_spec 卸载前后比对考题 | fiber.rs:245;event.rs:194 | 可数判据(卸载后与加载前不可区分)已实装;「删钉=确认消亡」的文档仪式无运行时对应(与 Cordis 侧同判) |
| 10 | 守卫四件(只守现实锚点) | 无运行时对应(守卫是仓库机制) | — | 超出 cordis-na 语义域;最近似是 `BaseWarning::SlowApply`(报警不判死,fiber.rs:70)——但那是政策钩子不是守卫 |
| 11 | 隔离(各线职责域/信箱归属) | `RealmId` + `Ctx::fork(realm)`(子 ctx 效果级联贴父栈);notify 只到同 realm fiber(isolate 过滤) | ctx.rs:20-23, 242;fiber.rs:259(refresh 按 realm) | 对应 Cordis `ctx.isolate`(context.ts:121);**intercept 无对应**(G3 缓建,需求驱动) |
| 12 | 户籍(文档身份) | 无对应 | — | 超出 cordis-na 语义域(kfmv4 特有概念,同 Cordis 侧判定) |
| 13 | 探针/失效信号(三件套第三件) | 无运行时对应 | — | 超出 cordis-na 语义域(测试/检查体系在运行时之外,与 Cordis 侧同判) |
| 14 | 契约优先原则 | cordis-na 差异表(审计文档 §三 阶段 3 待写):冲突时差异入档,不让上游语义改写契约 | 审计文档;规格书 v1.3 | 与 9.0 采用裁决 4 同原则;NA 侧的执行点=差异表+不采用清单 |
| 15 | 降生协议(八步降生链) | `Base::new(Vec<PluginEntry>)` 启动配置表(启动读一次)+ `load` 注册期依赖环检测(`CycleDetected` 报错不静默挂起)+ refresh 拓扑激活 | fiber.rs:117, 148-186, 259 | 配置驱动降生同构 dsh cordis.yml;NA 的「降生」=编译期插件集+启动配置表,拓扑序由 refresh 不动点循环保证 |
| 16 | 静态/动态注入分层 | 静态层=编译期插件集(`Base::new`/`load`,代码即配置);动态层=`PluginEntry.config: Option<ConfigParser>` 惰性解析+`config_value` 缓存(启动读一次,重载不重复解析) | fiber.rs:61-65, 96-97 | 与 dsh「静态吃前缀缓存/动态低频刷新」同构;NA 无缓存问题(rlib 直链),分层动机是「未激活不解析」 |

## 验证清单(全部实读,非凭记忆)

- ctx.rs:60/192 错误两分;ctx.rs:67/160 同名报错;ctx.rs:83-88+184 实例比对
- ctx.rs:227 + fiber.rs:316-324 config 延迟解析
- event.rs:16 + 107-191 三派发;event.rs:194 listener_count
- fiber.rs:35 五态;fiber.rs:379-425 卸载三相;fiber.rs:441 epoch;fiber.rs:245 service_count
- fiber.rs:148-186 注册期环检测;fiber.rs:117 启动配置表
- effect.rs:18-49 LIFO+take-once;ctx.rs:209/242 effect/fork

## 给 9.0 线与 Cordis 侧的拼接说明

1. 本表行号与卡萝 Cordis 侧 16 行一一对应,可直接三列拼接;
2. **行 8 是唯一已知缺口**(G2 活性闸阶段 2 落地后本行转绿,届时回报);
3. 行 3/4/11 的差异(Parallel 缓建/无 DISPOSED/无 intercept)全部已入
   cordis-na 不采用清单或缓建桩,非遗漏;
4. 降生协议契约附表时,cordis-na 侧的直接引用行:**行 1(错误两分)、
   行 2(注入时机)、行 6(同名报错)、行 7(代际戳)**——即沙漏讨论区
   NA 表态的五条反哺中已机制化的四条(第五条死后访问=行 8,阶段 2 后补)。

——kfm-na 线(茉莉同会话) · 2026-08-17
