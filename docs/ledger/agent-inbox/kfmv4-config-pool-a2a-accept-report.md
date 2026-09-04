# 配置池 A2a「AI 的配置面」验收通报：三阶段闭环 + 接点收口 + C 档真机状态

> 日期: 2026-09-05
> 致: 主会话，评审，kfm-na
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 用户/评审/na 知悉 A2a 三阶段闭环（池数据层/池框架/接点+考卷+变异双咬）与 C 档真机状态；A2a DoD 哪些腿已收口、哪些腿欠账（真机触点腿）如实入账；无需回函
> 回: A2a 设计清单签收（8a30e4d7，§八十条仲裁全裁决）+ 用户 09-04 仲裁⑩层级修正稿（光球升级「AI 面板置顶/关闭切换器」）
> 状态: 通报完毕（2026-09-05 nz：A2a 三提交全落 aaac5bb5/1f360a46/cd918c9b，npm test 191/191+browser 17 卷 pipefail 真 rc 全绿；C 档真机触点腿声明降级等设备，详见 §4）

**致**: 用户 + 评审 + na
**来源**: nz 9.0 线（AI 专题 §0.7 A2a「配置池」）
**提交**: aaac5bb5（阶段一池数据层）/ 1f360a46（阶段二池框架 UI+B 档）/ cd918c9b（阶段三接点+C 档+文书，本信主提交）+ 文书信箱回写一笔
**时间**: 2026-09-05

---

## 1. 三阶段事实链

| 阶段 | 提交 | 产物 | 考卷 |
|---|---|---|---|
| ① 池数据层 | aaac5bb5 | /pool/* 路由族+池描述表（新池=表内加一条）+激活总账 active.json nz 唯一门（仲裁②四字段）+relied 守卫唯一执行点+fuse-on-save 写侧（.env 600/池文件只留 ${VAR}） | A 档 22 钉红先全绿（npm test 175），变异三咬 |
| ② 池框架 UI | 1f360a46 | config-pool 插件：左滑三重判定（PageSwipe:500+方向裁决后置=P1 裁判不抢球）+一池一页 z44+标签行+PoolPageRegistry（client⊆server 互证）+四池页+激活双态+pool/changed 推送+C12 路由事件先行 | B 档 38 钉全绿（隔离实例零接触真账）+变异四咬；ai-chat 卷红先改卷 58/58；npm test 190 |
| ③ 接点+C 档 | cd918c9b | 三个遗留接点收口：orb 三态（仲裁⑩）/标题栏入口接真（拍板⑯占位退役）/brain 默认读总账（仲裁⑥收尾）；C 档驱动脚本+真账 L2 实录；文书四落点 | config-pool 45 钉+ai-chat 59 钉+ai-server 读账四腿；npm test 191/191+browser 17 卷×两轮全绿；变异双咬 |

## 2. 接点三条逐个证据（本阶段核心）

### 2.1 orb 新逻辑（仲裁⑩核心：光球=「AI 面板置顶/关闭切换器」）

- **语义落地**：按**当前顶层**裁定——顶层=AI 页→点球=关（滑出动画，底下池页复现）；顶层≠AI 页（终端态或池页盖着 AI）→点球=AI 页提到最上层（池页不关）。
- **z 咬合**：AI 页 42/池页 44 都压不过球——「AI 页盖在池页上」不能靠升 AI（倒挂压球），只能**降池页**：提顶档 `data-kfm-aichat-raised` 令池页 44→41，层级仍严格 41<42<球 45 恒顶。池页状态机零改动（POOL_OPEN 原状保持）——提顶是呈现层概念，不进 P6 词汇表。
- **机器证据（config-pool B12 六钉+ai-chat B17c2，全绿）**：B12a 池页盖 AI 点球→池页降 41/AI 42/球 45+`__kfmNzPool().page==='POOL_OPEN'`+标题栏 elementFromPoint 命中=AI 页（真顶，非纸上谈兵）；B12b 提顶档右滑→池页仍 POOL_OPEN（手势 condition 门+1，盖着的池页不吃返回）；B12c 再点球→AI 关（TERMINAL，DOM 摘除）+池页复现 z44；B12d 无关重渲染（diag resync bump）提顶账稳定；B12e 路由事件=入口意图→池页召回 AI 之上；B8d 全链往返。截图 config-pool-b12-orb-raise-over-pool.png / -pool-restored.png。
- **确定性结晶真虫（探针实锤）**：config-pool 层级闸 effect 每渲染 cleanup 的 remove+add 抖动会经 MutationObserver 误触提顶账——「任意池页重渲染把 AI 拉下顶」的未设计语义；修法=effect 加 deps 守卫（只在开/关翻转落笔）+ai-chat 独写置顶账（ref+attr 每渲染收敛，清账三确定性路径：AI 收起/池页真开/C12 入口事件）。B12d 稳定钉入账防复发。
- **ai-chat 状态机同步**：§3.3 A1 触发改「当前顶层≠AI 页（终端态或池页盖着）」+底层动作补提顶语义；A2 起点限定「顶层=AI 页」+补「关 AI 不连带池页」；A11 占位行改接真注。设计清单两份（ai-chat-a1 §3.3 + config-pool-a2a §九增补）均已落字。

### 2.2 标题栏「角色/会话」入口接真（拍板⑯占位退役）

- 点「角色」→`kfm-nz-pool-open {pool:'prompt'}`；点「会话」→`{pool:'session'}`；池页已开则转对应池（C3 形状）；AI 页不收起，池页盖其上；`data-aichat-config-placeholder` 占位骨架元素退役（§八⑨空池诚实形态由池页本页承担）。
- **机器证据**：config-pool B8c「点角色→POOL_OPEN+定位 prompt 池+占位元素不存在」+ai-chat B17c 同断言（双卷互证）+B17c2「orb 提顶后点会话→池页切 session 并召回 AI 之上（提顶账清、z44）」全绿。

### 2.3 brain.ts 默认改读总账（仲裁⑥收尾）

- `DEFAULT_PROVIDER/MODEL` 硬编码→`defaultFromLedger()`：读 active.json（mtime 缓存直读），缺项**逐字段**回落出厂初值（FACTORY 智谱/glm-5.3-flash=拍板⑮语义等价迁移）。消费点两处=DirectApiBrain.start 兜底+`/ai/providers` default 投影；picker 选中仍走 run 请求显式带（请求级覆盖不动总账——§2.4 纪律）。
- **A 档四腿钉（ai-server，全绿）**：①总账缺文件→纯出厂回落；②总账在场→default 随账（Kimi/k3-256k）；③直连脑默认=总账条目（离线证据：总账指向不存在条目→error 人话点名 `exam-ledger-prov` 而非出厂智谱）；④部分缺项逐字段回落（providerId 随账+modelId 出厂）。
- **真账实证（dev 8023，L2）**：重启后 `/ai/providers` default 由硬编码智谱变为随真账（deepseek/deepseek-v4-flash）；不带 provider/model POST start→/tmp/nz-ai-chat.log start 记录 `provider:智谱, model:glm-5.3-flash`（池页切账后）→upstream 200/TTFB 597ms/done usage 129tok 真连完成（C3 激活闭环的 server 腿，见 §4）。

## 3. 考卷与回归（红先→实现→变异→全量）

- **红先实录**：改钉/新钉先行跑红——A 档 190passed+1failed（读账钉红：默认仍硬编码）；config-pool 33/43（新钉 5 红：B8c/B8d/B12a/b/c+级联 5）；ai-chat 53/59（新钉 2 红：B17c/B17c2+级联 4）。实现后全绿。
- **卷账**：config-pool 38→45（+B8c/B8d/B12a-f）；ai-chat 58→59（B17c/c2 改写+新增 B17-收；B14c 默认断言改随账动态期值=契约变迁）；ai-server 190→191；npm test **191/191**；browser **17 卷×两轮 pipefail 真 rc 全绿**（第二轮在最终 bundle 上）。
- **变异双咬（全中逐字节复原）**：①拆 orb 提顶（回退旧开关语义）→B8d/B12a 即红（级联 B10/B11 属状态污染链，钉位归族正确）；②拆 brain 读账（默认回出厂常量）→A 档直连脑腿红（error 点名出厂智谱而非总账条目）。bundle 哈希前后一致（cfeb09c6）。
- **契约变迁说明（ai-chat 卷）**：①B17c/c2 从「占位仍在」改「入口接真+占位退役」——拍板⑯占位契约到期兑现；②B14c 默认断言从硬编码 glm-5.3-flash 改「=server default 随账走」——默认来源从出厂值改总账投影（仲裁⑥）；③orb 三态令部分旧钉语义细化（B1 往返在池页关态下不变）。

## 4. C 档实录（真机状态诚实申报）

- **真账 L2 腿（已完成）**：①激活闭环 server 腿=经 /pool/active 唯一门切智谱→不带 provider/model 发一条→日志四拍齐全（start provider=智谱/upstream 200/TTFB 597ms/first-delta/done usage 26+103=129）——仲裁⑥+DoD#2 的 server 半闭环；②总账复原铁证=考前 active.json 存档 md5 `d26c5305`，考后逐字节复原 md5 一致（**含 v8 第五字段 configFile 一并归位**——nz 写账恒四字段砍 configFile 是仲裁②设计语义，双端边界如实登记：kfmv4 侧字段经 nz 门写账会被抹，本次已复原）。
- **真机触点腿（声明降级等设备）**：8026 反隧道在阶段三窗口前段可达（会话开头 /json/version 200，dev.kfm.nz.agent live 目标在场）；01:23 起 json/list 持续超时（设备侧 kalo 隧道/APK 反连断开——服务端 relay 进程与 8026 监听健在，设备不反连即不可达，服务端无法自愈），至 02:00 连续 30 次轮询（60s 间隔）全超时。按 AGENTS.md L3 纪律**声明降级为 L1+L2 等用户**：真机左滑进池/四池 CRUD 触点/orb 三态指感/入口定位像素证据本窗口未收。
- **补录就绪**：驱动腿已备好 `nz/tests/browser/config-pool-c-device.mjs`（CDP attach live 目标+Input.dispatchTouchEvent 真触点+钩子判卷+像素截图+考前考后 active.json/.env md5 复原铁证+scratch 条目全数对账；窄屏 scrollIntoView 适配）——设备归位后 `node tests/browser/config-pool-c-device.mjs`（8023 dev 新码）一键补录，考卷即存证脚本。

## 5. 诚实登记（观察项）

1. **真机触点腿欠账**（见 §4）——DoD#1 的真机复核与 DoD#3 的真机像素 grep 本窗口未收，设备归位补录后 A2a 方可宣称全绿收口。
2. **configFile 双端边界**：nz 激活门写账恒四字段（仲裁②），kfmv4 侧 configFile 字段会被抹——本次实测实锤（复原已带回）。若 kfmv4 面板仍依赖该字段，9.0 №9 窗口卡落地前属已知共存边界，双端均需知悉。
3. **提顶档 z=41 为实施取值**：仲裁⑩只定相对序，41 档是「降池页防倒挂」的实施解，已写进设计清单 §九增补与 tokens.css 注释。
4. C3 真连消耗：智谱 glm-5.3-flash 一条短消息（129 tok）+无其他烧 token 操作。

## 6. A2a DoD 收口判断（设计 §六逐条）

| DoD | 状态 | 证据 |
|---|---|---|
| 1 真机左滑进池+四池 CRUD+手势冲突真机复核 | ⏳ 欠真机 | 手势链有 B1 六行冲突矩阵+B12b 提顶档右滑门（headless 全绿）；真机触点待补录 |
| 2 激活闭环（池页切激活→picker ✓→不经 picker 发一条走新激活） | ✅ server 半闭环（L2） | picker ✓ 同步=B4d/B4e/B6c+日志互证；不经 picker 发一条走新激活=真账实录（§2.3/§4）；真机触点版并入 §4 补录 |
| 3 密钥零明文 | ✅（阶段二已收+阶段三维持） | B7 五处落点全净+.env 600+读账四腿不触 key；真机 fuse 抽查腿已入 C 档脚本 |
| 4 A/B 档全绿+变异双咬+回归属零回退 | ✅ | npm test 191/191+browser 17 卷×2+变异双咬；browser 17 卷含全部回归属 |
| 5 agent 后台观测两腿互证 | ✅ | `__kfmNzPool()`+`/tmp/nz-pool.log` B9c 互证；提顶档新增 DOM 属性观测面 |

**收口判断**：A2a 代码/数据层/考卷/变异/文书五线闭环；DoD #2/#3/#4/#5 已收口，#1 真机触点腿欠账等设备（脚本就绪一键补录）——**不宣称全绿收口，差最后一腿**。

## 7. 留档

- 档案：nz/docs/dev-flow-case-006-config-pool-a2a.md（活文档，随插件生长）。
- 设计：config-pool-a2a-design.md §九阶段三增补（orb 三态钉位/z 实施取值/手势门+1/确定性结晶虫）+ai-chat-a1-design.md §3.3 修订。
- TASK.md：§0.7 新增 A2a 行（✅ 三阶段闭环，C 档触点腿欠账如实注记）+§0 快照+§4.5 8.11.1/2/3 吸收标注。
