# 三方语义映射表 · Cordis 本体侧（卡萝）

> 这是什么：「文档世界 ↔ cordis-na ↔ Cordis 本体」三方语义映射表的 **Cordis 侧**
> 材料（双终审所立任务：9.0 与 NA 各维护一半，降生协议契约定稿时附表）。
> 本表把文档世界（第二阶段契约 0-9 的概念）映射到 Cordis 本体的**精确 API**，
> 每行都有源码验证（`/opt/dsh-src/vendor/cordis/src/`，文件:行）。
> 别的去哪找：双终审落档 → nine-zero-preface.md「双终审落档（2026-08-17）」；
> 第二阶段契约 0-9 全文 → nine-zero-phase2-contracts.md；论文精读 → `../../experiments/dsh-na/dsh/paper/paradigm-notes.md`。
> 状态：Cordis 侧初稿（待 9.0 线与 NA 线拼接各自侧；用户过目后定投递）。

## 映射主表

| # | 文档世界概念（9.0 侧） | Cordis 语义（论文术语） | Cordis 精确 API | 源码验证 | 备注 |
|---|---|---|---|---|---|
| 1 | 发现（路由表 / 机制注册表 / 信箱归属行扫描） | reactive coeffects：依赖声明与解析 | `inject`（静态 map / 装饰器）+ `RegistryService`；`ctx.get` 条件查表 | registry.ts:17-51；reflect.ts（proxy 上溯解析） | 文档世界的"发现"= 降生时扫描；Cordis 的发现 = 注入解析。**注入面机械生成**（gen-route-table）对应 Cordis 的声明式 inject——无手写路由 |
| 2 | 注入（constraints 约束 / 降生静态·动态层） | coeffect 规格 + config 延迟解析 | `internal/config` waterfall：raw config 只在注入激活后求值 | fiber.ts:642；events.ts:339 | **静态层**（会话内恒定）= persona/prompt 组装（吃前缀缓存）；**动态层**（低频刷新）= 信箱状态等。Cordis 的 lazy config 正是"依赖激活后才求值"的机制（dsh 强化 #15 已并） |
| 3 | 事件（信箱四流型） | 事件派发 | `DispatchMode = 'emit' \| 'parallel' \| 'serial' \| 'bail' \| 'waterfall'` | events.ts:32-73 | 链条 1:1 ≈ serial/bail 定向；征集 1:N ≈ parallel 广播；汇总 N:1 ≈ waterfall 聚合；线程 N:N = 缓建（Cordis 无对应语义，撞墙再补） |
| 4 | 生命周期（机制四态：登记→巡逻→失效显形→退役） | fiber 六态 + Withdrawal | `PENDING / LOADING / ACTIVE / FAILED / UNLOADING / DISPOSED` | fiber.ts:142-153 | 机制四态是**外层状态机**（何时死），退役内部实现 = 运行时卸载三相（怎么死）——嵌套不平行（双终审已定）。Cordis 六态 = 三相的完整实现 |
| 5 | 累积器（git：回滚/撤销） | revertible effects（逆序累积） | `ctx.effect()`——逆按相反顺序累积，`recover` 一次翻转 armed | context.ts（effect）；论文 §3.1 | 文档世界 git revert ≈ Cordis recover；心法 14"未提交改动没有安全网"= 累积器语义的文档表述（双终审已定） |
| 6 | 同名二次登记=报错（broker 纪律） | 单源纪律：registry 内 provisions 不相交 | fiber 提供集冲突即拒绝（O-Insert 前置） | 论文 §4.1 Definition 45；dsh 强化 #6 相关 | NA 自 G1 映射提出，双终审定稿 |
| 7 | 代际戳（防过期回执覆盖新状态） | fiber epoch：视图按 provider 而非值比较 | `epoch = ':' + impl.fiber.uid` | fiber.ts:104, 248, 326 | 过期回执 = 旧 epoch 覆盖新状态 → 判红。NA 实例比对映射 |
| 8 | 死后访问判红（退役后仍被引用） | proxy 访问授权：声明而未提交 → `INACTIVE_ACCESS`；到 root 无声明 → `UNDECLARED_ACCESS` | ctx proxy 上溯解析（论文 Algorithm 6） | paradigm-notes.md §6（Algorithm 6）；cordis-mechanics.md | 机制退役后文档/检查仍引用它 = 死后访问 → 痛觉器官显形（双终审已定） |
| 9 | 两种红（退役判据） | 观察等价（卸载后与加载前不可区分） | 卸载后经 ctx 可观察行为与加载前不可区分；`INACTIVE` 状态 | 论文 Def 33；fiber.ts:172（INACTIVE_EFFECT） | 机制死时要么绿（守护等价物）要么红且删钉（确认消亡）——不存在薛定谔的机制 |
| 10 | 守卫四件（只守现实锚点） | 连现实纪律（失效探测器） | 脚本完备性/同名/出处真实/死后访问——全对现实（文件系统/注册表/引用） | dsh vendor README 强化 #8（事务式）；机制注册表 21 条 | 递归终止：broker 停滞靠降生发现+用户抽查（最浅一层靠人看，拍板认下） |
| 11 | 隔离（各线职责域 / 信箱归属） | isolation（realm） | `ctx.isolate(name, label?)`（派生上下文，无逆） | context.ts:121-140 | 文档世界"线"≈ realm；agent 作为 realm 的应用实例（paradigm-notes 待办 #4） |
| 12 | 户籍（文档身份：层级/消费者/状态） | 无直接对应（Cordis 无文档户籍概念） | —（最近似：dsh plugin-inventory 枚举全部插件） | host/plugin-inventory | **超出 Cordis 语义域**——kfmv4 特有概念；plugin-inventory 是"枚举"不是"户籍"，只作参照 |
| 13 | 探针/失效信号（机制三件套第三件） | 无直接对应（测试体系在 Cordis 之外） | —（dsh 的 test-support / 变异基准是仓库级） | packages/test-support | **超出 Cordis 语义域**——文档世界的"失效信号"= 检查链报红/构建中断，是仓库机制不是运行时 |
| 14 | 契约优先原则（9.0 纪律是宪法） | Cordis 是承载机制 | 冲突时 Cordis 能力补契约，或契约修订注记录差异 | 采用裁决 4 | 采用决策已定，映射表不改变此原则 |
| 15 | 降生协议（八步降生链） | system prompt 组装 + preset 组成（声明式降生） | `system-prompt/assemble` 每轮组装；agent preset = persona+工具+技能组成 | packages/core/system-prompt；preset/agent-presets | dsh 的降生是**配置驱动**（cordis.yml 声明式）+ 自动发现（skill 扫描）——文档世界降生链 `_birth.yaml` 同形态 |
| 16 | 静态/动态注入分层 | 前缀缓存约束（dsh 实践） | 组装结果稳定 = provider 缓存命中第一推论 | packages/core/agent-loop/tests/request-cache.e2e.ts | 降生注入的静态层吃缓存；动态层低频刷新（双终审已定，卡萝提出） |

## 验证清单（全部实读，非凭记忆）

- events.ts:32 `DispatchMode` 五派发（emit/parallel/serial/bail/waterfall）
- fiber.ts:142-153 六态注释（PENDING→DISPOSED）
- fiber.ts:642 + events.ts:339 `internal/config` lazy 求值（dsh 强化 #15）
- fiber.ts:104,248,326 epoch 字段与 INACTIVE 初值
- context.ts:121-140 `ctx.isolate`/`ctx.intercept`
- registry.ts:17-51 inject 声明机制
- paradigm-notes.md §6 Algorithm 6（proxy 访问：INACTIVE_ACCESS / UNDECLARED_ACCESS）

## 超出 Cordis 语义域的项（拼接时标注）

| 概念 | 处理建议 |
|---|---|
| 户籍（#12）、探针（#13）、豁免区、机制注册表 21 条 | kfmv4 特有——映射表标注「无 Cordis 对应，文档世界独立」，不强行造对应 |
| 线程 N:N 流型 | 缓建（与 Cordis 无对应，撞墙再补） |
| 两种红 | 对应观察等价（#9），但"删钉=确认消亡"的文档世界仪式无运行时对应（运行时卸载后无"钉"概念） |

## 给 9.0 线与 NA 线的拼接说明

1. 本表每行的「Cordis 语义/API/验证」列可直接并入三方映射表（9.0 侧填文档世界概念列、NA 侧填 cordis-na 对应）；
2. 建议三方映射表最终形态 = 本表 16 行 × 三侧 + 一个「超出域」附注区；
3. 降生协议（契约 1）附表时，**行 2（注入分层）、行 15（降生形态）、行 16（缓存约束）**是契约 1 直接引用的三行——请 9.0 线优先核对。

——卡萝（dsh 本体视角）· 2026-08-17
