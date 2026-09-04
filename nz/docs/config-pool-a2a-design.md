# 配置池 A2a · 设计清单（行为层规格 + 实现清单）

> 这是什么：AI 专题（TASK.md §0.7）A2a 阶段「配置池」的设计清单——
> 池框架（左滑进入/一池一页/顶栏标签行）+ server 侧统一池数据层 + 首批四池
> （基本/provider-model/agent-prompt/session）。照此可实现。
> 语义来源：9.0 契约 №3 池卡（docs/active/nine-zero/nine-zero-phase1-contracts.md:257-350）
> 与 №12 pool-system/active.json 葬礼（同文件:1151-1158）+ nine-point-zero.md
> 池结构原则（:41 箭头只向下、:70 pool-system 台账行、:153 基础四池）
> + ai-chat A1 清单（拍板⑫ picker 二级路由 / 拍板⑯ 标题栏配置下拉占位 / §1.3
> providers+代字 fuse）+ 插件契约（nz/docs/plugin-contract.md）与 tmux 标签件
> 先例（nz/docs/tmux-tabs-v2-state-machine.md）+ kfmv4 数据 schema 源码
> （role.card.ts:20-27 / api.card.ts:15-21 / session-client.ts:33-55 /
> routes/providers.ts:44-76 / env-store.ts）。
> 被吸收关系：TASK.md §4.5 的 8.11.1（pool-system 数据层）/ 8.11.2（池卡容器）
> / 8.11.3（七 tab 路由同一窗口）三行被本清单吸收为 AI 专题手机形态——
> 「七 tab」按 A2a 拍板改为「首批四池 + 池类可追加」，双框模式/绞杀者精神沿用。
> 纪律：**清单用户签收 → 考题先行（红先）→ 实现 → 变异抽检**；
> 全程 agent 保有测试与 API 调试可见能力（§五）。
> 状态：**已签收**（2026-09-04 用户拍板）。
> 考卷蓝本：A 档 `tests/pool-*.test.ts` + B 档 `tests/browser/config-pool.test.mjs`
> + C 档真机。
> 仲裁记录（2026-09-04 用户拍板）：
> ① session 池 v0=壳管理（列表/新建/改名/删除/激活，messages 恒空禁写，
>    落盘留 A3/session-store lineage）——按推荐执行 ✅；
> ② 激活总账沿用 ~/.kfmv4/active.json（nz 侧 /pool/active 唯一门，
>    kfmv4 双端边界诚实登记）——按推荐执行 ✅；
> ③ providers.json 保持单文件数组（物理例外、CRUD 语义统一）——按推荐执行 ✅；
> ④ 手势层带新增 PageSwipe:500 ✅；
> ⑤ 激活账落选方案留档防复活 ✅；
> ⑥ A1 默认改读总账（brain.ts 两行+picker 选中写总账）顺手做 ✅；
> ⑦ 池页内左右滑切池不做（v0 只点标签，接口就位）——按推荐执行 ✅；
> ⑧ prompt 池文件清单 v0 手填路径行（树挑选留接口位）——按推荐执行 ✅；
> ⑨ 空池=v0 诚实形态——按推荐执行 ✅；
> ⑩ **层级（用户修正稿）**：池页全屏但**盖不住 AI 光球与输入栏**——
>    层级定死：终端/tmux < AI 页 < 池页 < 输入栏+光球（恒顶）；
>    **AI 面板内可召唤池页**（标题栏角色/会话入口开在 AI 页之上）；
>    **光球新逻辑**：当前顶层=AI 面板→点球=关闭面板回终端；当前顶层
>    不是 AI 面板→点球=把 AI 面板提到最上层出现（底下开着池页也不冲突）。
>    orb 从「开关」升级为「AI 面板的置顶/关闭切换器」✅
>    （2026-09-05 阶段三实施注：提顶档=data-kfm-aichat-raised，池页降
>    41 档让 AI 页 42 盖回池页上——防 z 倒挂且球/输入栏 45 恒顶不变；
>    池页不关，orb 再点=关 AI 页池页复现；提顶档右滑不关盖着的池页）。

## 〇、范围与边界（什么做、什么不做）

**A2a = 配置池复合概念一次立起**：池框架（左滑进入的全屏页 + 顶栏标签行 +
PoolPage 接口 + 池注册表）+ server 侧统一池数据层（一套 CRUD 管所有池）
+ 首批四池 + 激活总账（active.json 葬礼后的家）+ 与 ai-chat A1 的两个接点
（picker 同源 / 标题栏入口路由）。

| 做 | 不做（A2a 边界，越界=返工源） |
|---|---|
| 池框架：左滑进入、一池一页、顶栏标签行（复用 tmux 标签件词汇/样式）、PoolPage 接口、池注册表（新池按接口注册即追加） | workspaces 组合池（9.0 №12 点亮的是数据层概念，A2a 数据层+UI 都不做） |
| server 统一池数据层：`/pool/*` 路由族 + 激活总账 + relied 守卫 + pool/changed 推送 | 范式池（paradigm——9.0 契约 №3 修订注已拍板取消，不复活） |
| 四池：基本池（激活总账 UI 化）/ provider-model / agent-prompt / session | 工具/脚本只读池（9.0 系统组 tools/scripts——nz 无对应数据源，池注册表留 readonly 接口位） |
| 密钥代字 fuse-on-save（明文落 .env、池文件只留 ${VAR}、chmod 600） | 池 UI 的主题化（tokens 专用段照 keybar/ai-chat 先例加一套，皮肤系统不做） |
| 标题栏「角色/会话」占位入口接真（拍板⑯路由到对应池页） | 池页内左右滑切池（留接口位不实现，防与页内列表手势混淆——见 §八⑦） |
| picker 与池页同源互证（/ai/providers 数据语义不变） | session 消息落盘（A1 无持久化拍板不动，session 池 v0=壳——见 §八①设计空白点） |

## 一、池框架设计

### 1.1 形态拍板落实（不许推翻，只许落实）

配置池 = **一个全屏手机页面**（不是散落卡）：左滑进入，一池一页，顶栏
标签行点击切换池，池类可追加。页内布局沿用 9.0 契约 №3「上配置下池」
双框模式：上半=当前条目编辑表单（配置区），下半=条目列表（池区）；
基本池为只读聚合变体（§3.1）。

### 1.2 左滑手势与冲突判定（本清单最重的交互设计点）

**现状核查**（决定方案的事实基座）：

- nz 手势分发器（`src/client/gesture.ts`）已在内核接线（main.ts:31-33），
  但**目前在册消费者为零**——term 滚动/tap、keybar、tmux 标签排全部走
  各自 DOM 监听，没有一家用 registerGesture。配置池手势是它的第一个真实客户。
- 分发模型是 **pointerdown 时独占锁定**（gesture.ts:255-288：按优先级匹配
  第一个 handler 即 break），方向在 pointerdown 时刻未知——所以「左滑」
  不能靠匹配期裁决，必须**方向裁决后置**（onEnd 才判 dx/dy）。
- 全部监听 passive（gesture.ts:157-161），handler 默认不 stopPropagation——
  「裁判不抢球」是既有构造，左滑 handler 只要守这条，终端垂直滚动链路
  （term 自己的监听）与它互不吞事件。
- 水平滑动的现存占用面：**只有 tmux 标签排**（`overflowX:'auto'`，
  tmux-tabs/index.tsx:196）和未来的池页内列表。终端只有垂直 scrollback，
  水平 drag 无绑定；keybar 14 键一行排无横向滚动（KeybarApp.tsx）；
  AI 页消息列表只垂直滚；picker/配置下拉是菜单不是滑区。

**方案（裁定建议，签收时拍板）**：

1. **注册**：`registerGesture(ctx, handler)`，ctx.effect 白送摘除（plugtest
   残留计数现成判卷）。层带：GestureLayer 现五带（MainOrb 1000 /
   FullscreenCard 900 / WindowOrb 800 / FileTree 700 / Launcher 600）无
   语义贴合者——**建议新增 `PageSwipe: 500`**（低于全部功能控件带，页面
   导航手势天然让位；新增内核常量=内核件改动，登记 §八④请拍板）。
2. **condition 门（匹配期排除）**：AI_PAGE 打开时不响应（配置池与 AI 页
   是平级全屏页，AI 页内入口=标题栏下拉，不走手势）；配置池已开时不响应；
   终端 TUI/ALT 全屏应用态（vim/htop 里左右滑是应用语义）**不响应**——
   复用 term 既有的 ALT 态判定（bottom-anchor/ime-pan 考卷同款地形）。
3. **targetFilter 排除（落点期排除）**：`[data-tmux-strip]`（标签排横滑）、
   keybar、composer、orb、picker/配置下拉菜单 DOM、毛玻璃罩层——这些
   目标上落下的 pointerdown 不匹配。
4. **方向裁决后置（松手期判定）**：`dx < -64px 且 |dx| > 2|dy|` 才成立
   （阈值进脑为具名常量，皮内禁魔法数）；不满足=零动作零副作用，
   垂直滚动自然落选。**全程不 stopPropagation、不 preventDefault**（P1）。
5. **返回对称**：池页内右滑（同阈值反向）= 返回，另加顶栏右端 × 钮双通道
   （移动端可发现性，手势不是唯一路径）。

冲突矩阵（考卷 B1 逐行钉）：

| 落点/语境 | 垂直滑 | 左滑 | 裁定 |
|---|---|---|---|
| 终端正文（SHELL 态） | scrollback（term 自有链路，不受影响） | **进配置池** | 方向裁决后置，互不吞事件 |
| 终端 ALT/TUI 态 | 应用内滚动 | 不响应（condition 门） | vim/htop 左右滑归应用 |
| tmux 标签排 | — | 标签排横滑 | targetFilter 排除 |
| keybar / composer / orb | — | 不响应 | targetFilter 排除 |
| AI 页打开 | 消息列表滚动 | 不响应（condition 门） | AI 页入口=标题栏下拉（拍板⑯） |
| 池页内 | 池区列表滚动 | 右滑返回；左滑不绑（§八⑦） | 页内滑切池不做 |

### 1.3 顶栏标签行（复用 tmux 标签件词汇/样式）

标签行 = tmux-tabs 标签排的同族件：**借词汇与视觉 token，新写数据驱动
组件**（与 ai-chat 借 BeautifulUI 同款定性——是重写不是搬源码）：

- 借：胶囊行形态（`--kfm-bar-bg`/`--kfm-line`/`--kfm-radius-pill`）、
  标签 chip（激活=`--kfm-accent` 底/非激活=`--kfm-chip-bg`，
  tmux-tabs/index.tsx:205-211 同款）、横溢出 `overflowX:auto`、
  聚焦指示语义（当前池标签高亮=本页「附着」的池，组件不发明聚焦）；
- 裁：orb/把手、＋/×、毛玻璃二级页、会话 WS 数据源——标签行只做
  「池注册表枚举 → 一排标签 → 点击路由」；
- 标签集 = 池注册表枚举（§1.5），新池注册即多一个标签——「池类可追加」
  在 UI 层的兑现点；配置组/系统组分组样式（9.0 契约：实色 vs 灰）留
  class 钩子，v0 四池全配置组。

### 1.4 PoolPage 接口（TS 签名，9.0 契约 list()/edit(entry)/readonly? 的 nz 版）

```ts
// nz/src/client/plugins/config-pool/pool-page.ts
type PoolId = string;   // v0 在册：'basic' | 'provider' | 'prompt' | 'session'

interface PoolPage<T = unknown> {
  readonly pool: PoolId;
  readonly title: string;          // 标签行显示名
  readonly readonly?: boolean;     // 系统组只读标记（v0 四池可写；基本池=true 为首用例）
  list(): Promise<T[]>;            // 经统一池数据层（/pool/:pool），禁自fetch文件
  edit(entry: T | null): void;     // 上配置区载入编辑目标；null=新建草稿
  // —— nz 追加（激活双态拍板的接口兑现；可读池定义，只读池不实现）——
  activeId?(): Promise<string | null>;   // 当前激活条目（读激活总账投影）
  activate?(id: string): Promise<void>;  // 切换激活（POST /pool/active）
}
```

- **激活双态**：`edit()` 载入的编辑目标 ≠ `activeId()` 报的激活项——编辑
  任何条目不动激活标，激活只有 `activate()` 一条路径（P2）。
- 基本池不实现 list/edit 的 CRUD 语义（readonly 聚合视图，§3.1）。

### 1.5 池注册表（client + server 双侧同源）

- **client 侧**：`PoolPageRegistry`（Map<PoolId, PoolPage>），插件装配期
  四池注册；标签行/路由只问注册表——新池=写一个 PoolPage 实现+注册一行。
- **server 侧**：池数据层的池描述表（§2.3）——每池声明存储适配、schema
  校验器、reliers 引用声明；`/pool/list` 把它投影给 client 做存在性互证
  （client 注册表 ⊆ server 注册表，B 档钉）。

### 1.6 pool/changed 事件

9.0 契约：serial+bail 顺序短路、池数据唯一管理者发出。nz 落地形态：

- **通道**：复用既有 `/ws/term` WS 桥（tmux-sessions 推送同款多路：
  `{t:'pool-changed', pool, id, op}`，op ∈ `created|updated|deleted|activated`）——
  不新开端口不开 SSE，重连腿/断线补测白送；
- **语义**：server 侧 CRUD/激活写盘成功后广播（先落盘后广播，落盘即事实）；
  client 各池页收到→refetch 校准（服务器唯一真源，tmux P5 同款哲学，
  P7）；
- **v0 不承诺**：跨进程文件监听（kfmv4 侧改池文件 nz 不感知——同机双端
  共存的已知边界，§八②登记）；serial+bail 的「bail」消费语义 v0 无
  消费者，接口留位不实现。

## 二、统一池数据层（server 侧，8.x「每池一套管道」的病根切除点）

### 2.1 路由族形状（nz 无 express，raw node:http，照 A1 route.ts 先例
挂进 src/server/index.ts 静态服务分支之前）

```
GET  /pool/list                 → 池描述表投影：[{pool,title,readonly,count}]
GET  /pool/:pool                → 条目数组（provider 池出代字形态，永不出明文——P4）
POST /pool/:pool/create         body{entry} → {entry}（schema 校验坏即 400 人话）
POST /pool/:pool/:id/update     body{entry} → {entry}（provider 池内部走 fuse-on-save）
POST /pool/:pool/:id/delete     → 200{ok} | 409{error, reliedBy:[...]}（relied 守卫，P3）
GET  /pool/:pool/:id/reliers    → 引用关系查看（"这个 provider 被哪几个会话用着"）
GET  /pool/active               → 激活总账：{providerId,modelId,roleFile,sessionId}
POST /pool/active               body 部分更新（如{providerId,modelId}）→ 广播 activated
```

错误语义沿用 A1 表精神：配置错误→人话 JSON 不 500 不裸栈；写失败
（权限/坏 JSON）→ 500{error} + /tmp 日志完整体。

### 2.2 存储目录结构（沿用 ~/.kfmv4/ 数据区，A1 拍板④不变）

```
~/.kfmv4/                       NZ_AI_CONFIG_DIR 可覆盖（A1 既有机制，池层共用）
├── providers.json              provider-model 池（单文件数组——例外，见 §八③）
├── .env                        密钥明文唯一落点（chmod 600，fuse-on-save）
├── active.json                 激活总账（nz 侧 pool-system 唯一写者，§2.4）
├── agents/roles/<id>.json      agent-prompt 池（一文件一条目，既有目录）
└── sessions/<id>.json          session 池（一文件一条目，既有目录；v0 壳）
```

「目录=池、一文件=一条目、JSON 可 grep 可 diff」拍板在 roles/sessions
两池天然成立；providers.json 是既有单文件数组且 A1/kfmv4 双端直读，
**物理形态例外、CRUD 语义统一**（池数据层按池适配存储，路由族/校验/
守卫/广播一套不少）——登记 §八③请拍板。

### 2.3 池描述表（server 侧统一 CRUD 的枢纽，约一屏代码/池）

```ts
interface PoolDescriptor {
  pool: PoolId;
  title: string;
  readonly?: boolean;
  load(): Promise<unknown[]>;                    // 存储适配（目录型/单文件数组型）
  save(entries: unknown[]): Promise<void>;       // 原子写（临时文件+rename，防半截 JSON）
  validate(entry: unknown): string | null;       // schema 校验，null=过，string=人话
  reliers: Array<{ pool: PoolId; field: string }>; // relied 引用声明（§2.5）
  afterSave?(entry: unknown): Promise<void>;     // provider 池挂 fuse-on-save
}
```

### 2.4 激活账归属（active.json 葬礼的 nz 落地——定论）

**契约原文**：№12「active.json 葬礼：迁移期内容转主光球实例户口初值
（№9），之后删除」（phase1-contracts.md:1158）——9.0 终局里激活态归
**消费者实例**（每个窗口卡自己户口），全局激活文件整体消失。

**nz A2a 现实**：没有窗口卡/多实例，AI 消费者只有一个（ai-chat 插件），
且基本池拍板就是「全局激活态总账的 UI 化」。**定论**：

1. 激活账 = pool-system 统一管理的**单文件总账**，落 `~/.kfmv4/active.json`
   （沿用既有路径——kfmv4 还在跑、双端同机共读，换路径=双账分裂）；
2. 「葬礼」在 nz 的死因不是文件，是**模式**：v8 各卡直读直写 active.json
   （api.card.ts:23/role.card.ts:30/session-client 各读一份）= 死刑。
   nz 侧纪律：激活态读写只有 `/pool/active` 一个门，任何插件禁自读文件（P5）；
3. schema = v8 实录子集（真机 ~/.kfmv4/active.json 现状）：
   `{providerId, modelId, roleFile, sessionId}`——v8 的 `configFile`
   （组合配置卡字段）砍掉不迁（nz 无组合池，范式池已死，登记在案）；
4. 演进方向写明：9.0 №9 窗口卡落地时，总账字段降级为「主光球实例户口
   初值」，多实例各持户口——A2a 的总账结构与之同构，保证可迁移；
5. 落选备选「各池文件内 active 字段」：散、N 个写点、grep 激活态要翻
   全部池文件，直接违背「总账 UI 化」拍板——不取（§八⑤）。

**与 A1 硬编码默认的接点**：`nz/src/server/ai/brain.ts:40-41` 现在
`DEFAULT_PROVIDER='智谱'`/`DEFAULT_MODEL='glm-5.3-flash'` 写死（拍板⑮）。
激活总账上线后，A1 的默认来源应改为「读总账，总账缺项回落出厂值
（智谱·glm-5.3-flash 写入总账初值）」——建议 A2a 顺手改这两行+考卷，
拍板⑮语义等价迁移；picker 选中仍随 run 请求显式带 provider/model
（请求级覆盖，不动总账——激活总账只被池页/picker 显式动作改写）。
登记 §八⑥请拍板。

### 2.5 relied 守卫实现层（被引用条目禁删）

- **唯一执行点 = server 池数据层**（client 确认页只是 UX，守卫不在 UI——P3）；
- v0 引用图（箭头只向下，nine-point-zero.md:41）：
  - `session.providerId/modelId` → provider 池条目；
  - 激活总账四字段 → 对应池条目（**激活中条目视同 relied，禁删，
    先切走再删**——裁定）；
  - role 池 v0 无池内引用者（组合池未来是消费者，接口已就位）；
- 实现：删除前按池描述表的 `reliers` 声明扫描——被引 → 409
  `{error:人话, reliedBy:[{pool,id,field}]}`，确认页展示「被谁用着」；
- **断引用降级不崩溃**（9.0 契约 №3 验收项）：读到引用指向不存在条目
  → 列表照出、该字段标注「已失效」，不抛错不拦列表（B 档钉）。

### 2.6 密钥代字 fuse-on-save（复刻语义，统一走池层）

照 kfmv4 routes/providers.ts:44-76 + env-store.ts 语义在池数据层重落
（A1 的 nz/src/server/ai/providers.ts 只有只读 fuse，**写侧 fuse 是 A2a
新增**，一套代码两个消费者）：

- 保存 provider 条目：`apiKey` 为明文 → `KFM_PROVIDER_<ID 大写规范化>`
  （撞名 `_2/_3` 后缀）写入 `.env`（chmod 600，upsertEnvVar 保注释行），
  池文件只落 `${VAR}` 代字；已是代字/空值原样透传；
- **A1 事故纪律沿用**：变量名显式写死进条目，禁止自动派生覆盖手工命名
  （na 智谱 401 事故，A1 清单 §1.3 已冻结）；
- 读取/编辑回填只出代字形态；响应/日志/观测钩任何一处出明文=钉红（P4）。

## 三、四池逐个

### 3.1 基本池（`basic`，readonly 聚合视图——激活总账的 UI 化）

- **定位**：active.json 葬礼后的家。**不是新配置源**，是各池激活项的
  聚合视图+切换入口（PoolPage.readonly 首用例，无 list/edit CRUD 语义）。
- **页内布局**（上配置下池的只读变体）：上区=三个激活槽位行
  （① 默认 provider·model ② 激活角色 ③ 激活会话——每行显示当前值+
  失效标注位），下区=每行「前往更换」钮 → 路由到对应池页并预置激活标
  （跨页路由是池框架内部能力，不进状态机词汇）；
- 数据 = `GET /pool/active` + 各池 list 的存在性投影（激活项已失效→
  该行标「已失效」不崩，§2.5 降级语义的首个 UI 兑现）；
- **不做**：总账的历史轨迹/最近切换记录（v0 无此数据源，不发明）。

### 3.2 provider-model 池（`provider`）

- **schema**（照 api.card.ts:15-21 + A1 §1.3 实录）：
  `{id, name, baseUrl, apiKey(代字形态), models[]}`；单文件数组存
  providers.json（§八③例外）。
- **CRUD 语义**：create/update 走 fuse-on-save（§2.6）；delete 过
  relied 守卫（session 引用 + 激活中禁删）；数组顺序即文件顺序
  （round-trip 保序，A6 钉）。
- **激活语义**：激活单位 = provider+model **二元组**（总账 providerId+
  modelId 同写，`activate(id, model?)` 扩展签名）；无激活 provider
  → A1 出厂默认回落（§2.4）。
- **页内布局**：上配置=provider 表单（id/name/baseUrl/apiKey 代字回填
  占位提示/models 清单行编辑）；下池=provider 条目列表（✓激活标 +
  编辑/删除/设为激活）；**provider→model 下钻**：点条目行展开该
  provider 的 models 管理（增删行 + 行级「设为激活」）——与 picker
  二级路由（拍板⑫）同构同数据源，形状互证（B4 钉）。
- **接点**：`/ai/providers`（A1 picker 数据源）一字不改——它读同一
  providers.json，池页写、picker 读，同源互证是考卷不是新机制。

### 3.3 agent-prompt 池（`prompt`）

- **schema**（照 role.card.ts:20-27 原样）：
  `{id, name, promptFiles[], dynamicPromptFiles[], createdAt, updatedAt}`；
  **不存文本存有序文件引用**（9.0 契约：拼接在服务端每轮重组，A2a 无
  装配线，拼接留 A2b/A3）；条目 id=文件名裸名（`agents/roles/<id>.json`，
  可中文——v8 实录 `茉莉-kfmv4.json`）。
- **CRUD 语义**：纯壳 CRUD；delete 过守卫（激活中禁删；v0 无池内引用者）。
- **激活语义**：总账 `roleFile` 字段；A1 对话 v0 **不消费** role
  （A1 无 prompt 装配——激活角色的效果是「被记住」，生效留 A2b 装配线，
  UI 诚实标注「A2b 起生效」）。
- **眼睛挂载点 = dynamicPromptFiles**：nz 已有 dynFiles 内存骨架
  （plugins/core/dynamic-prompt-files.ts，fs 后端留位）——A2a 只在
  schema/表单里保住这个字段的读写，投影联动是 A2b 的活。
- **页内布局**：上配置=role 表单（name + promptFiles 有序清单 +
  dynamicPromptFiles 有序清单）；下池=role 列表+激活标。
  **诚实缺口**：v8 角色卡的文件树挑选（tree-swipe）nz 没有（文件树卡=
  8.10.x 未做）——v0 文件清单=手填路径行（增删/上下移排序），文件树
  挑选留接口位等 8.10（§八⑧登记）。

### 3.4 session 池（`session`，v0 壳——设计空白点在此，诚实标出）

- **schema（核心壳，8.x 压缩耦合字段全砍）**：
  `{id, title, manuallyNamed?, createdAt, updatedAt, providerId?, modelId?, messages[]}`；
  砍掉 `messageCount/tokenCount/windowTokenCount/compactCutIndex/
  fullTokenCount/measuredPromptTokens`（session-client.ts:42-54 整族
  压缩投影字段——8.x 压缩耦合，nz 无压缩线）；条目 id=文件名裸名
  （`sessions/<id>.json`，v8 实录 `茉莉的测试.json`）。
- **v0 范围裁定（建议，签收拍板）**：**只读列表 + 新建空会话 + 改名 +
  删除 + 设为激活**；`messages` 字段在 schema 里但**恒空数组**——
  A1 无持久化拍板不动，ai-chat run 不接 session 池（仍在内存，刷新
  即清）；
- **空白点诚实说**：于是「当前激活会话」v0 是个不积累消息的户口壳，
  基本池会话槽位显示的是壳。run→session 落盘的正确家是 session-store
  （9.0 №12「会话日志唯一写者」承重墙，TASK 8.12.1），建议 A3 会话
  持久化立项时补齐，PoolPage<SessionEntry> 接口届时一字不改（§八①）；
- **唯一写者纪律**：v0 写者=池数据层（壳 CRUD）；messages 字段任何件
  禁写（P5）——未来的写者只能是 session-store  lineage，池页永不直接
  写消息；
- **页内布局**：上配置=壳表单（title 改名）；下池=会话列表
  （title/updatedAt/激活标）+新建+删除+设为激活；
- **接点**：拍板⑯标题栏「会话」入口路由到此页——用户看到的是空池+
  新建钮（诚实形态，不是故障，§八⑨）。

### 3.5 与 ai-chat A1 的接点总表

| 接点 | 现状 | A2a 动作 |
|---|---|---|
| picker 二级路由（拍板⑫） | `/ai/providers` 只读投影 | 数据语义不动；池页=全量管理、picker=快捷切换，同源互证进考卷（B4） |
| picker 选中态 | client 内存（chat-link.ts:112-114），刷新即失 | 选中即写总账（POST /pool/active {providerId,modelId}），刷新后读总账复原——picker 第一次有了持久化（§八⑥联动）✅ 阶段二已接 |
| 标题栏「角色/会话」占位（拍板⑯） | 空态占位一行文案 | 接真：点「角色」→ POOL_OPEN+prompt 池；点「会话」→ POOL_OPEN+session 池；占位文案退役 ✅ 阶段三已接（kfm-nz-pool-open 事件真发，B8c/B17c 钉） |
| server 默认 provider/model（拍板⑮） | brain.ts:40-41 写死 | 改读总账+出厂值回落（§2.4，§八⑥请拍板）✅ 阶段三已接（defaultFromLedger，ai-server 新钉） |
| A1 providers.ts 只读 fuse | loadProviders+resolveKey | 一行不动；写侧 fuse 在池层新增（§2.6） |

## 四、交互状态机（清单体例；词汇表唯一真源，宪法 §7 五要素）

**状态枚举**：

| 状态机 | 状态 | 含义 |
|---|---|---|
| 页面机 | `POOL_CLOSED` | 配置池未开（终端页/AI 页各归其主） |
| 〃 | `POOL_OPEN` | 配置池全屏页在场（含当前池 id 语境） |
| 池页机 | `BROWSE` | 下池列表态（上配置区空/预览） |
| 〃 | `EDITING` | 上配置载入编辑目标（含新建草稿） |
| 〃 | `OVERLAY_DELETE` | 删除确认毛玻璃页（tmux OVERLAY_CLOSE 同款模式） |

**转换表**（手势与环境事件同列）：

| # | 起点 | 触发 | 终点 | 底层动作 |
|---|---|---|---|---|
| C1 | `POOL_CLOSED` | 左滑成立（§1.2 三重判定：condition 门+targetFilter+方向裁决） | `POOL_OPEN`+`BROWSE` | 纯 UI；默认进基本池；从 AI 页标题栏入口进=直达对应池（C12） |
| C2 | `POOL_OPEN` | 右滑成立 / 点 × 钮 | `POOL_CLOSED` | 纯 UI；未存草稿蒸发（EDITING 中右滑先回 BROWSE 还是直接关——裁定：直接关，草稿蒸发与 C6 同语义） |
| C3 | `BROWSE`/`EDITING` | 点标签行另一池标签 | `BROWSE`（新池） | 池注册表路由，换 PoolPage 挂载；旧池草稿蒸发 |
| C4 | `BROWSE` | 点条目行 | `EDITING` | `edit(entry)` 上配置载入（provider 池=apiKey 代字回填） |
| C5 | `EDITING` | 点保存 | `BROWSE` | POST create/update → 成功广播 pool/changed → 列表 refetch；校验败=表单内人话不转换 |
| C6 | `EDITING` | 点取消/返回 | `BROWSE` | 草稿蒸发，零副作用 |
| C7 | `BROWSE`/`EDITING` | 点删除 | `OVERLAY_DELETE` | 确认拦截（无确认不删，P3 的 UI 半） |
| C8 | `OVERLAY_DELETE` | 确认 | `BROWSE` | POST delete → 200 广播删；**409 relied → 确认页内展「被谁用着」人话，不删不转换** |
| C9 | `OVERLAY_DELETE` | 取消/点罩层空白 | 原状 | 零副作用 |
| C10 | `BROWSE` | 点「设为激活」（含 model 行级） | `BROWSE`（激活标移动） | POST /pool/active → 广播 activated → 各池页/picker/基本池同步 |
| C11 | 任意 | pool/changed 推送到达 | 原状保持 | refetch 校准（服务器唯一真源，P7） |
| C12 | `POOL_CLOSED` | AI 页标题栏「角色/会话」入口（拍板⑯接真） | `POOL_OPEN`+`BROWSE`（对应池） | AI 页不收起，池页盖其上（层级见 P10） |
| C13 | 任意 | WS 断/页面回前台 | 原状保持 | 重连后 refetch 校准（tmux E1 同款环境事件） |

**禁止条款**：

- **P1 手势冲突**：左滑 handler 禁止 stopPropagation/preventDefault；
  禁止在 AI_PAGE 态/ALT-TUI 态/标签排/keybar/composer/orb/菜单罩层
  落点上成立；方向裁决不满足阈值（§1.2-4）禁止任何页面动作——
  终端垂直滚动被抢一次=钉红。
- **P2 激活双态**：edit 载入编辑目标禁止改激活标；activate 禁止隐式
  改编辑目标；picker 选中=写总账但禁止动池页编辑态；激活中条目
  禁删（视同 relied）。
- **P3 relied 禁删**：守卫唯一执行点=server 池数据层，client 确认页
  不构成守卫；断引用（指向不存在条目）禁止抛错/拦列表——降级标注。
- **P4 密钥代字**：池文件/API 响应/观测钩/server 日志任何一处出
  明文 key=钉红；保存必走 fuse-on-save；编辑回填只回代字；.env
  恒 chmod 600。
- **P5 唯一写者**：池数据写路径只有 `/pool/*` 路由族——插件/client
  禁直写 ~/.kfmv4 任何池文件与 active.json；session 池 messages
  字段 v0 恒空，任何件禁写。
- **P6 词汇表强制统一**：`POOL_CLOSED`/`POOL_OPEN`/`BROWSE`/`EDITING`/
  `OVERLAY_DELETE`，清单外状态名=规格外状态≈bug 候选。
- **P7 服务器唯一真源**：列表/总账以 server 响应与 pool/changed
  推送为准，client 禁止发明第二份缓存真源（tmux P5 同款）。
- **P8 皮内禁硬编码样式字面量**：颜色/阴影/圆角/时长全走 `--kfm-*`
  tokens 专用段（keybar P5/ai-chat P7 同款），结构尺寸留 inline。
- **P9 动画 token 化**：池页滑入/收起只许 `--kfm-dur-normal`/
  `--kfm-ease-out`（ai-chat P11 同款）。
- **P10 层级规则**（建议裁定，§八⑩请拍板）：池页=全屏最高层
  （z44 > composer/orb z43 > AI 页 z42）——配置是沉浸任务，打开时
  composer/orb/tmux 控件隐藏（display:none 档，与 AI 页开时 tmux
  隐藏同款）；关闭复原；AI 页在其下不收起（C12 回来还在）。

**可观测性约束**：单源 reducer 唯一 transition 入口（from/to/trigger
记账）；同步查询钩 `__kfmNzPool()` 报 `{page, pool, pageState, editing,
active, lastEvents}`；转换环形缓冲 ≥50 拍；server 侧 `/tmp/nz-pool.log`
JSONL 逐拍落 CRUD/守卫拦截/fuse 事件（不落明文 key 不落条目全文，
摘要+计数）。

## 五、考卷映射

### A 档 · 池数据层纯逻辑钉（红先；临时 dir 注入，NZ_AI_CONFIG_DIR 同款机制）

| 钉 | 验证 | 手段 |
|---|---|---|
| A1 | 四池 CRUD round-trip（create→list→update→delete），roles/sessions 目录型一文件一条目 | 临时 ~/.kfmv4 夹具直接驱动路由族 |
| A2 | 代字 fuse-on-save：明文 key POST → 池文件只留 ${VAR}、.env 落明文 chmod 600、响应无明文、撞名 _2 后缀 | 构造 provider 条目断言三处落点 |
| A3 | relied 守卫：删被 session 引用的 provider → 409+reliedBy；删激活条目 → 拒；断引用列表降级不崩 | 构造引用图+断引用 |
| A4 | 激活双态：update 条目不动总账；POST /pool/active 部分更新只改指定字段 | 断言总账 diff |
| A5 | schema 校验：坏 role/session/provider 条目 → 400 人话，不写盘 | 构造坏载荷 |
| A6 | providers.json 单文件数组兼容：池层写后 A1 loadProviders 照读、数组保序、代字 fuse 照通（A1 A6 不回退） | A1 既有钉联动复跑 |
| A7 | 手势方向裁决纯函数：dx/dy 样本矩阵（垂直/水平/斜/不足阈值） | 脑函数直喂（gesture 分发核心公开，A 档可驱动先例=gesture.ts:14） |

变异抽检：fuse 缺失裸发明文必咬 A2；守卫删除必咬 A3；edit 偷写总账
必咬 A4。

### B 档 · Playwright headless 全链

| 钉 | 验证转换 | 手段 |
|---|---|---|
| B1 | C1 左滑进入+P1 冲突矩阵 | 合成手势：终端 SHELL 态左滑→POOL_OPEN；垂直滑不触发；ALT 态不触发；标签排上横滑不触发且标签排照滚；AI_PAGE 态不触发；逐条截图 |
| B2 | C2 返回双通道 | 右滑→POOL_CLOSED；× 钮→POOL_CLOSED；EDITING 中右滑草稿蒸发断言 |
| B3 | C3 标签行四池切换 | 标签集=池注册表枚举；切四池各截；server /pool/list 与 client 标签互证 |
| B4 | picker 同源互证（拍板⑫联动） | 池页改 providers（加 model/改 name）→ /ai/providers 投影即变 → picker 二级页同形；picker 选中 → 总账变 → 池页 ✓ 同步 |
| B5 | C7/C8 relied 禁删 UI | 删被引用 provider → 确认页展 reliedBy 人话+条目仍在；断引用条目照列带「已失效」 |
| B6 | P2 激活双态 UI | 编辑非激活 provider 保存 → 激活标不动；「设为激活」→ ✓ 移动+picker ✓ 同步+基本池槽位同步 |
| B7 | P4 密钥不明文 | 保存明文 key → 全链路载荷+DOM+钩子 grep 无 key 形态（ai-chat B7 同款）；回填=代字 |
| B8 | C12 标题栏入口接真（拍板⑯） | AI 页点「角色」→ POOL_OPEN+prompt 池；点「会话」→ session 池；占位文案不存在断言 |
| B9 | P6/P9 词汇表+观测钩 | `__kfmNzPool()` ring 状态名⊆枚举；/tmp/nz-pool.log 逐拍互证（L2 腿） |
| B10 | C11/C13 推送校准 | 第二页（同 server 第二 tab）CRUD → 本页 pool/changed 到达 refetch |
| B11 | P10 层级 | 池页开 → composer/orb/tmux display:none；z 序数值断言；C12 路径 AI 页不收起 |

### C 档 · 真机

| 钉 | 验证 | 手段 |
|---|---|---|
| C1 | 左滑手感+四池各操作一轮（开/切/编/存/删/激活） | 真机操作+截图+CDP 读钩 |
| C2 | 真 key fuse 验证：池页存真 key → providers.json 无明文、.env 600、A1 发一条照通 | 真机+文件系统互证（L2） |
| C3 | 激活闭环：池页切激活 provider/model → A1 发一条走新激活（不经 picker） | 真机+/tmp/nz-ai-chat.log 互证 provider 字段 |
| C4 | 标题栏入口真机路由+池页内阅读/滚动手感 | 真机截图 |

### 回归属（不许弄红的现有卷）

- `npm test` 全量 + browser 卷：ai-chat（21 钉——B4/B14 picker 行为被
  本清单扩展处须红先改卷）、keybar-click、tmux-tabs、ime-pan、
  scrollback、term-hooks、kernel、bottom-anchor、cjk-*；
- A1 的 /ai/providers 响应形状一字不改（picker 考卷不回退）；
- main.ts 改动面=一行插件挂载+gesture 层带常量，碰红任何卷=红先立钉。

## 六、验收判据（A2a DoD）

1. **真机左滑进池、四池各完成一轮 CRUD+激活切换**（截图/CDP 证据），
   手势冲突矩阵真机复核（终端滚动零被抢）；
2. **激活总账闭环**：池页切激活 → picker ✓ 同步 → A1 不经 picker 发
   一条走新激活 provider/model（/tmp 双日志互证）；
3. **密钥零明文**：真 key 保存后池文件/载荷/日志 grep 全净，.env 600；
4. A/B 档考卷全绿 + 变异抽检双咬 + 回归属零回退；
5. agent 可后台观测全过程：`__kfmNzPool()` + `/tmp/nz-pool.log`
   两腿互证一致。

## 七、工作量预估

| 块 | 估 |
|---|---|
| server 池数据层（描述表+路由族+激活总账+relied 守卫+fuse 写侧）+ A 档钉 | 2 天 |
| 池框架 client（手势件+页面壳+标签行+池注册表+pool/changed 消费） | 1.5 天 |
| 四池页（基本/provider/prompt/session 各一，上配置下池） | 2 天 |
| ai-chat 接点（picker 写总账/标题栏接真/brain 默认改读总账）+ B 档考卷 | 1 天 |
| C 档真机 + 观测闭环 + 通报 | 0.5 天 |
| **合计** | **约 7 天** |

## 八、异议与备选（读契约/源码后的诚实登记，签收时逐条拍板）

1. **session 池 v0 空白点（最大一条）**：A1 无持久化拍板 vs session 池
   messages 字段——本清单取「v0=壳管理（列表/新建/改名/删除/激活），
   messages 恒空，落盘留 A3/session-store lineage」。备选=池层临时代理
   最小落盘（**反对**：抢 9.0 №12 session-store「会话日志唯一写者」
   承重墙的活，且违背 A1 拍板精神）。请拍板。
2. **激活总账沿用 ~/.kfmv4/active.json 的双端边界**：kfmv4 各卡仍按
   8.x 模式直读直写该文件（它没参加葬礼）——nz「唯一写者」纪律只对
   nz 侧成立；kfmv4 侧改激活 nz v0 不监听（读时 mtime 缓存直读，
   刷新/重连时校准）。备选=nz 另立 nz-active.json（**反对**：双账
   分裂，picker 与 kfmv4 面板各说各话）。请拍板。
3. **providers.json 单文件数组 vs 「目录=池一文件=一条目」拍板**：
   既有格式+A1/kfmv4 双端直读，provider 池物理形态例外、CRUD 语义
   统一（池描述表存储适配吸收差异）。备选=拆目录+迁移双端（**反对**：
   A1 直读链路与 kfmv4 面板都要动，收益只有形式统一）。请拍板。
4. **GestureLayer 新增 PageSwipe:500 层带**=内核件 gesture.ts 常量
   改动（层带公约「选带不填裸数字」的正当扩展）。备选=复用
   Launcher:600（语义不符，启动器与页面导航不是一族）。请拍板。
5. **激活账落选方案备案**：各池文件内 active 字段（散、N 写点、
   grep 难）——已被「总账 UI 化」拍板否决，留档防复活。
6. **A1 硬编码默认改读总账的范围**：建议 A2a 顺手改 brain.ts:40-41
   两行+picker 选中写总账（拍板⑮语义=出厂初值，等价迁移）；备选=
   留 A2b（picker 刷新即失忆的病多活一个阶段）。请拍板。
7. **池页内左右滑切池不做**：页内列表未来可能有水平操作，滑切会埋
   冲突；v0 只点标签，接口（池注册表枚举顺序）已就位。如用户要
   滑切，单独立项评估冲突面。请拍板。
8. **prompt 池文件清单=手填路径行**：v8 的文件树挑选（tree-swipe）
   依赖文件树卡（TASK 8.10.x 未做）——v0 手填+排序，树挑选留接口位。
   若不接受手填，prompt 池编辑区降级只读等 8.10（**反对**，壳 CRUD
   是本池 v0 的主要价值）。请拍板。
9. **session 池空池体验**：标题栏「会话」入口接真后用户看到空池+
   新建——这是 v0 诚实形态不是故障；占位文案「会话配置·待接入」
   随接真退役。若用户认为空池不如继续占位，session 池页可挂
   「消息持久化 A3 到位」说明行。请拍板。
10. **池页层级 z44 全屏独占**（composer/orb 隐藏）：拍板⑯只拍了入口
    路由没拍层级；本清单取「配置=沉浸任务」裁定。备选=池页与 AI 页
    同层互斥开关（关 AI 页才能开池页——多一次转换，反对）。请拍板。

## 九、阶段三接点实施增补（2026-09-05 实施，清单正文不变只补账）

阶段二遗留三接点一次收口，实施语义与钉位登记（考卷蓝本=§五，此处为
增补针脚）：

1. **orb 三态（仲裁⑩核心实施）**：光球=AI 面板「置顶/关闭」切换器，按
   **当前顶层**裁定——顶层=AI 页→点球=关（滑出动画，底下池页复现）；
   顶层≠AI 页（终端态或池页盖着 AI）→点球=AI 页提到最上层（池页不关）。
   z 咬合实施：提顶档=ai-chat 挂 `data-kfm-aichat-raised`（监听 config-pool
   的 `data-kfm-pool-open` 属性翻转清账），tokens.css 据此把池页降 **41**
   档（层级仍严格 池页41<AI 页42<球45 恒顶，防倒挂）——仲裁⑩原文只定
   相对序，41 档是实施取值；提顶档右滑不关盖着的池页（手势 condition
   门 +1 条件，P1 族）。钉：config-pool B12a/b/c + B8d；ai-chat B17c2。
   ai-chat 状态机 §3.3 A1/A2 语义按此修订（ai-chat-a1-design.md）。
2. **标题栏入口接真（拍板⑯占位退役）**：点「角色」→`kfm-nz-pool-open`
   {pool:'prompt'}；点「会话」→{pool:'session'}——池页已开转对应池
   （C3 形状），AI 页不收起；`data-aichat-config-placeholder` 元素退役。
   钉：config-pool B8c（池侧）+ ai-chat B17c/c2（按钮侧）。
3. **brain.ts 默认改读总账（仲裁⑥收尾）**：DEFAULT_PROVIDER/MODEL 硬编码
   → `defaultFromLedger()`：读 active.json（mtime 缓存直读），缺项逐字段
   回落出厂初值（FACTORY 智谱/glm-5.3-flash=拍板⑮）；消费点两处=
   DirectApiBrain.start 兜底 + `/ai/providers` default 投影。钉：ai-server
   「默认改读激活总账」四腿（空账回落/随账/直连脑点名总账条目/逐字段回落）。
4. **B 档增补**：config-pool 卷 38→43（B8c/B8d/B12a/b/c 五钉，B8 旧「占位
   仍在」钉随接真退役）；ai-chat 卷 58→59（B17c/c2 改写+新增 B17-收，
   B14c 默认断言改「随账走」动态期值——契约变迁=默认来源从出厂值改总账
   投影，§3.5 表已同步）。
