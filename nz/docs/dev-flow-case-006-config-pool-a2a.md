# 开发流程案例 006 · 配置池 A2a（AI 的配置面）——插件档案

> 2026-09-05 归档。定位：配置池插件（nz/src/client/plugins/config-pool/ +
> nz/src/server/pool/）与 ai-chat 三接点（picker 写账/标题栏入口/brain 读账）。
> AI 专题（TASK.md §0.7）A2a 阶段——「AI 的配置面」一次立起：统一池数据层
> + 池框架 + 首批四池 + 激活总账 + orb 置顶/关闭切换器。行为规格在
> docs/config-pool-a2a-design.md（2026-09-04 用户签收，§八十条仲裁全裁决），
> 通报在 docs/ledger/agent-inbox/kfmv4-config-pool-a2a-accept-report.md。
> 提交 aaac5bb5（阶段一）/ 1f360a46（阶段二）/ 阶段三本笔。
>
> **活文档纪律（沿用 case-001 用户拍板）：本文档随 config-pool 插件持续
> 生长——未来对池数据层/池框架/四池/激活账/层级咬合的任何修改、事故、
> 调参，都追加到「闭环后迭代」一节**，写清：为什么改（谁拍板）、改了什么、
> 验收数字、产出的纪律。不许只改代码不记账。

## 起点：9.0 契约的池概念，nz 手机形态落地

A2a 的设计输入是 9.0 契约 №3「池卡」（list()/edit(entry)/readonly 双框
模式）+ №12「pool-system/active.json 葬礼」（激活态归消费者实例、各卡
直读直写是死刑）+ nine-point-zero.md 池结构原则（箭头只向下、基础四池）。
v8 的病根=「每池一套管道」（providers/routes/role-card/session-client 各
读各的 active.json）——A2a 的回答是**一套池数据层管所有池**（池描述表
新池=表内加一条）+ **激活总账唯一门**（/pool/active，nz 侧唯一写者）。

## 流程段（每段：产物 / 坑 / 纪律产出）

### ① 设计清单签收制（八十条仲裁全裁决）

- 产物：docs/config-pool-a2a-design.md——§〇边界表（workspaces 组合池/
  范式池/滑切池/主题化不做）+ §二数据层 + §三四池 + §四状态机 C1-C13
  + §五考卷映射 + §六 DoD。
- 仲裁记录①-⑩逐条落档：session 池 v0=壳管理（messages 恒空禁写）、
  active.json 沿用（双端边界诚实登记）、providers.json 单文件例外、
  PageSwipe:500 新层带、滑切不做、手填路径、空池诚实形态、**⑩层级
  用户修正稿**（终端/tmux<AI 页42<池页44<输入栏+光球恒顶；AI 面板内可
  召唤池页；光球升级「AI 面板置顶/关闭切换器」）。
- 纪律产出：**「清单用户签收→考题先行→实现→变异抽检」全期不破例**；
  两处实现与清单措辞的偏差（fuse 落盘时机/目录型 per-entry 写防毁
  kfmv4 双端字段）头注诚实登记，不静默改规格。

### ② 三阶段推进（数据层→池框架→接点，每段红先+变异）

- 阶段一 aaac5bb5：/pool/* 路由族 + 池描述表 + 激活总账（mtime 缓存
  直读/原子写四字段）+ relied 守卫唯一执行点（激活中视同 relied）+
  fuse-on-save 写侧（明文落 .env chmod600、池文件只留 ${VAR}、撞名
  _2 后缀）。A 档 22 钉红先全绿（npm test 175），变异三咬。
- 阶段二 1f360a46：config-pool React 插件——左滑三重判定（condition 门
  +targetFilter+方向裁决后置 judgePoolSwipe，全程不 stopPropagation=P1
  裁判不抢球）+ 一池一页 z44 + 顶栏标签行 + PoolPageRegistry（client ⊆
  server /pool/list 互证）+ 四池页 + 激活双态 UI + pool/changed 推送
  （/ws/term 多路复用，先落盘后广播）+ C12 路由事件先行。B 档 38 钉
  全绿（隔离实例 NZ_AI_CONFIG_DIR 夹具+私有端口，零接触真机 ~/.kfmv4），
  变异四咬；ai-chat 卷红先改卷接 picker 写账（58/58）。
- 阶段三（本笔）：三个遗留接点一次收口——orb 三态、标题栏入口接真、
  brain 默认读总账；C 档真机 8026；文书闭环。
- 纪律产出：**阶段切分按「依赖闭合」不按「文件就近」**——阶段二宁可
  把 C12 拆成事件先行+按钮接线两半，也不让池框架依赖 AI 页内部实现。

### ③ orb 三态（仲裁⑩核心实施，本案例最重的交互裁决）

- 语义：光球从「开关」升级「AI 面板置顶/关闭切换器」，按**当前顶层**
  裁定——顶层=AI 页→点球=关（滑出动画，底下池页复现）；顶层≠AI 页
  （终端态或池页盖着 AI）→点球=AI 页提到最上层（池页不关）。
- z 咬合实施：AI 页 42 与池页 44 都压不过球——「AI 页盖在池页上」不能
  靠升 AI（会倒挂压球），只能**降池页**：提顶档 `data-kfm-aichat-raised`
  令池页 z44→41（层级仍严格 41<42<45 恒顶）。池页状态机零改动
  （POOL_OPEN 原状保持）——提顶是呈现层概念，不进 P6 词汇表。
- 提顶账所有权：ai-chat 独写（ref+attr 每渲染收敛）；清账三条确定性
  路径=①AI 收起 ②池页真开（observer 见 pool-open 翻转）③C12 入口
  事件（事件=入口意图，池页召回 AI 之上）。config-pool 的层级闸 effect
  加 deps 守卫——每渲染 cleanup 的 remove+add 抖动会误触 observer
  把 AI 拉下顶（B12 探针实锤后修确定性，B12d 稳定钉入账）。
- 手势咬合：提顶档下右滑不关盖着的池页（condition 门 +1，B12b）——
  盖着的页面不吃返回手势，防「看不见的池页被误关」。
- 纪律产出：**「谁在顶上」必须有一份单主账本**——两层各持 z 数字的
  交叉引用必然漂移；呈现层状态（置顶关系）不进状态机词汇表，用
  DOM 属性做跨插件通道（与 tokens.css/手势门同源）。

### ④ 标题栏入口接真（拍板⑯占位退役）

- 点「角色」→kfm-nz-pool-open{pool:'prompt'}；点「会话」→session；
  池页已开则转对应池（C3 形状）；AI 页不收起，池页盖其上；占位骨架
  元素（「角色配置·待接入」行）随接真退役。
- 纪律产出：**占位也是契约**——A1 立占位时写下「接真=阶段三」，B 档
  「占位仍在」钉在接真日红先改卷（B8c/B17c 换向），钉跟契约走不跟
  实现走。

### ⑤ brain 默认读总账（仲裁⑥收尾）

- DEFAULT_PROVIDER/MODEL 硬编码 → defaultFromLedger()：读 active.json
  （mtime 缓存），缺项逐字段回落出厂初值（FACTORY 智谱/glm-5.3-flash=
  拍板⑮语义等价迁移）。消费点两处=DirectApiBrain.start 兜底+
  /ai/providers default 投影；picker 选中仍走 run 请求显式带（请求级
  覆盖不动总账）。A 档四腿钉：空账回落/随账/直连脑点名总账条目/
  逐字段回落。
- 纪律产出：**「默认值」是投影不是常量**——总账成为唯一事实源后，
  任何硬编码默认都是第二真源（P7 同哲学伸到 server 默认）。

### ⑥ B 档考卷纪律（隔离实例+变异抽检）

- config-pool 卷自起隔离实例（NZ_AI_CONFIG_DIR=临时夹具+私有端口+
  夹具日志），零接触真机 ~/.kfmv4；ai-chat 卷 KFM_NZ_URL 指隔离实例，
  裸跑 8023 直接退出码 2（防写真账）。
- 阶段三变异双咬：orb 提顶拆（回退旧开关语义）→B8d/B12a 即红；
  brain 读账拆（默认回出厂常量）→A 档直连脑腿红（error 点名出厂智谱
  而非总账条目）。全中逐字节复原（bundle 哈希前后一致）。
- 纪律产出：变异要拆**新语义的最小决定性单元**，不是随便注释一行——
  拆 orb 提顶只红 orb 钉、不殃及手势/激活钉，说明钉位归族正确。

### ⑦ C 档真机（8026 CDP attach）

- 驱动腿=tests/browser/config-pool-c-device.mjs：真触点
  （Input.dispatchTouchEvent）左滑进池/四池 CRUD/激活闭环/orb 三态/
  入口定位；表单文本经原生 setter 注入（输入机制程序化，写路径仍全走
  真机 UI 保存钮）；截图存证 tests/assets/config-pool-c-*.png。
- 真账纪律：考前 active.json/.env 逐字节存档 md5，考后复原复验 md5
  相等；scratch 条目全数删除对账；fuse 抽查用假 key（真 key 不碰）。
- 实录与逐钉数字见通报信 §C 档。

## 观测手段库（本插件沉淀的基建）

| 手段 | 路径 | 用途 |
|---|---|---|
| A 档考卷 | tests/pool-server/pool-swipe/pool-reducer.test.ts + ai-server.test.ts（读账四腿） | 池数据层/手势裁决/状态机/brain 读账钉 |
| B 档考卷 | tests/browser/config-pool.test.mjs（45 钉） | C1-C13 全链+P 族禁令+orb 三态+层级 |
| 〃 | tests/browser/ai-chat.test.mjs（59 钉） | picker 写账/入口接真/占位退役/B17c2 提顶 |
| C 档驱动 | tests/browser/config-pool-c-device.mjs | 8026 真触点全链+截图+md5 复原铁证 |
| server 落盘 | /tmp/nz-pool.log（NZ_POOL_LOG 可覆盖） | CRUD/守卫拦截/fuse/激活逐拍（L2 腿，不落明文不落全文） |
| 观测钩 | __kfmNzPool() / __kfmNzPoolDiag | page/pool/pageState/editing/active/ring+wsState/closeWs/resync |
| 提顶档 | documentElement[data-kfm-aichat-raised] | AI 页提顶层级的跨插件 DOM 通道（tokens.css/手势门/ai-chat 三方同源） |
| 激活总账 | ~/.kfmv4/active.json（/pool/active 唯一门） | 激活态唯一事实源；mtime 缓存直读，双端边界诚实登记 |

## 纪律产出汇总（通用，不限本组件）

1. 「谁在顶上」要单主账本；两层互持 z 引用必漂移。呈现层置顶关系用
   DOM 属性做通道，状态机词汇表不被污染。
2. 跨插件 DOM 信号的 effect 带 cleanup 时必须 deps 守卫——每渲染
   remove+add 抖动会误触所有 MutationObserver 消费者（探针实锤才修，
   修后立稳定钉）。
3. 「默认值」是投影不是常量：唯一事实源确立后，硬编码默认=第二真源。
4. 占位也是契约：立占位时写下接真时点，接真日红先改卷。
5. C 档真账操作三件套：考前字节存档 md5→走唯一门写→考后逐字节复原
   复验；scratch 条目全数删除对账。
6. 阶段切分按依赖闭合不按文件就近；半成品接点（事件先行/按钮后接）
   要在清单和考卷里双向登记。
