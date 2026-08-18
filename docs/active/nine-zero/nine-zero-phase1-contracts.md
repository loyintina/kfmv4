# 9.0 第一阶段契约（运行时插件化，契约 №1~№16）

> 这是什么：9.0 第一阶段（运行时插件化）契约全文——2026-08-17 自
> `nine-zero-preface.md` 迁出（原文件超 2000 行上限，且契约已全部定稿，
> 满足「转正时迁出分文件」惯例）。开篇索引见 preface「第一阶段契约」节。
> 别的去哪找：拍板史/修订注 → `nine-zero-preface.md`；契约的裁决史 →
> `../../ledger/agent-inbox/`（决策索引 `nine-zero-decision-index.md`）；
> 第二阶段契约 → `nine-zero-phase2-contracts.md`。

## 契约索引

| # | 契约 | 状态 |
|---|------|------|
| 议题 1 下钻 | 布局插件接口（布局=卡片摆放唯一语义） | ✅ 定稿 |
| №1 | 终端卡（渲染器+连接+卡壳三层） | ✅ 定稿 |
| №2 | 对话卡（纯渲染壳 + 池系统分离） | ✅ 定稿 |
| №3 | 池卡（池系统唯一管理 UI，绞杀者迁移） | ✅ 定稿 |
| №4 | 手（通用多实例插件，试点之一） | ✅ 定稿 |
| №5 | 眼睛插件包（首个 bundle，试点之一） | ✅ 定稿 |
| №6 | 卡片类型 broker（首份服务契约，试点之三） | ✅ 定稿 |
| №7 | 文件树卡（扁平化+窗口化，性能硬指标） | ✅ 定稿 |
| №8 | 顶栏（槽位 broker + tmux 管理） | ✅ 定稿 |
| №9 | 窗口卡（光球面板完全体） | ✅ 定稿 |
| №10 | 工具宿主（tool-host）+ 账本服务 | ✅ 定稿 |
| №11 | 布局壳（全屏层叠 + headless） | ✅ 定稿 |
| №12 | 服务层三件套（agent-service / session-store / pool-system） | ✅ 定稿 |
| №13 | 文件编辑卡（「带 AI 入口的 Obsidian」） | ✅ 定稿 |
| №14 | 内核自研件（渲染宿主 + 手势分发） | ✅ 定稿 |
| №15 | 安全包（permission-engine bundle） | ✅ 定稿 |
| №16 | 启动引导与通道（收尾轻契约） | ✅ 定稿 |
| 拍板 | 权限引擎/工具带UI/OBS归属/插件化的是效果/台账军规/UI皮肤/小件清零 | ✅ 定稿 |

---

## 议题 2 进行中：组件入口出口

### 议题 1 下钻：布局插件接口（2026-08-15 拍板）

**结论：布局 = 卡片摆放管理，只有这一种语义。tmux 不是全局布局模式，是一张
全屏卡片**——内部页面切换/分屏归 tmux 渲染自管，布局只管"这张全屏卡摆在哪、
多大、焦点在不在它"。

用户原方案（2026-08-15）：「把 tmux 整体做成卡片嵌在全屏，页面切换归 tmux 渲染
自己管，只要保证在这个卡片里的运动，一样能归到布局管理里」——由此消解"全局布局
切换 + 状态迁移"的伪需求（该需求源自"浮卡/tmux 是两种全局模式"的假设，不成立）。

**布局接口**（定稿）：

```ts
interface Layout {
  register(card) / unregister(card);          // 卡片登记存在
  setGeometry(card, geo) / getGeometry(card); // 卡片几何（位置尺寸）
  show(card) / hide(card);                    // 显隐
  focus(card); readonly focused;              // 焦点（卡片级）
  // z-order 层级
}
```

**语义分层**：卡片级焦点归布局（哪张卡是当前）；tmux 卡内部的窗口焦点归 tmux 卡
自己——两层互不越界。布局拥有卡片几何状态，卡片可请求但布局有最终决定权。
headless 布局 = 同接口不渲染（AI 无头自测）。

### 组件契约 №1：终端卡（2026-08-15 讨论草案，待用户过审）

现状事实：kfmv4 终端 = `terminal-card-04.ts`（xterm.js 渲染 + WS 通信混合）+
server `terminal-pty.ts`（PtyManager）；kfm-na 终端 = `termview.rs`（733 行纯渲染器，
零 I/O 零平台依赖，alacritty 网格 + fontdue + softbuffer）。两端已自发收敛到
"渲染器 + 连接"分离，论文模式把它显式化。

#### 拆三层

| 层 | 组件 | 是什么 |
|----|------|--------|
| 渲染器 | `term-renderer` | 纯渲染：喂字节→出画面。零 I/O，不关心跑什么、连谁 |
| 连接 | `term-connection` | 会话管理：open/input/resize/close。连 PTY/tmux/远程可换 |
| 卡壳 | `card-terminal` | 卡片 UI：渲染器装进卡片，接布局/主题/手势 |

#### 接口契约（实现可外包的粒度）

```ts
// term-renderer —— 渲染器接口
interface TermRenderer {
  feed(bytes: Uint8Array | string): void;   // 喂字节流（含 ANSI 转义）
  render(): void;                           // 渲染当前网格到宿主
  resize(cols: number, rows: number): void; // 尺寸变化
  serialize(): string;                      // 导出网格+滚屏缓冲（热替换用）
  restore(state: string): void;             // 从导出态恢复（热替换用）
  dispose(): void;                          // 可逆：清屏释放
}

// term-connection —— 连接接口
interface TermConnection {
  open(opts: { cwd?: string; command?: string;
               cols?: number; rows?: number }): Promise<TermSession>;
}
interface TermSession {
  id: string;
  sendInput(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
  onOutput(cb: (data: string) => void): () => void;  // 返回退订函数
  onExit(cb: (code: number) => void): () => void;
}

// card-terminal —— 卡壳组件
const cardTerminal: Component = {
  name: 'card-terminal',
  inject: ['renderer', 'connection', 'theme'],
  provide: ['terminal'],
  apply(ctx) { /* ctx.effect 注册卡类型 + ctx.set('terminal', …) */ },
};
```

#### 入口出口表

```
term-renderer:  provide [renderer]   inject []          emit 无          on 无
term-connection: provide [connection] inject []          emit 无          on 无
card-terminal:  provide [terminal]   inject [renderer, connection, theme]
                emit terminal/output, terminal/exit, terminal/focus
                on   layout/resize, theme/changed
```

#### 插拔语义

- 卸载终端卡 = dispose 渲染器 + 关闭会话；
- **compact（缩回）语义保留现状**：渲染器 detach，连接与 Terminal 对象保留
  （terminal-card-04 现有行为：compact 只拔 DOM 不销毁，展开复挂）——
  这是"重状态卡片"的通用模式，写进契约；
- 连接断开重连：connection 内部处理，卡不感知。

#### 边界情况（讨论中）

- **滚屏缓冲（scrollback）归属**：xterm 的 Terminal 持有 scrollback。渲染器热替换
  时 scrollback 怎么办？契约已加 `serialize/restore`——但 scrollback 属于渲染器
  还是连接层（连接缓存最近 N 行、重新 attach 时 replay）？
  **2026-08-15 用户拍板：方案 A——scrollback 归渲染器**（渲染器本就是终端网格的
  拥有者，scrollback 是网格的一部分；连接层保持纯字节流转发最干净）。
- 多终端：每卡一连接一渲染器，会话 id 隔离。

#### 验收测试清单（三档）

- A 档：渲染器契约测试（feed 字节→断言网格状态）；**三种实现（xterm.js /
  termview-wasm / headless）过同一套考题**，含变异抽检；
- B 档：连接冒烟（open/输入/输出/关闭/resize）；
- C 档：实拍（手机端终端画面手感，参照 kfm-na 尖刺验收 2/3）。

#### 复用场景（为什么拆三层值得）

- renderer：日志查看器（ANSI 日志流）/ AI 工具输出渲染（保留着色）/
  终端录像回放 / 眼睛系统读终端（无头文本投影）；
- connection：SSH / 容器终端 / AI 子进程管道（CLI agent stdio）/ 本地 PTY；
- 通用模式：渲染器+连接+壳 = 编辑器/图片查看器/数据表格的同构形态。

#### 状态

✅ 定稿（2026-08-15：scrollback 归渲染器，方案 A）

> 修订注（2026-08-15，评审高 3 + 茉莉裁决 3）：**termview-wasm 撤出 A 档
> 验收承诺**，降级为远期探索（待讨论议题 5）；A 档考题实现集 =
> {xterm.js, headless}。理由：softbuffer 是 Android 专属（wasm 端不存在，
> 等于重写渲染后端）；浏览器事件循环与 winit 模型不同；且「同一套考题」
> 服务的替换九成用户感知不到——A 档承诺越轻，落地越实。
>
> 修订注（2026-08-15，评审中 4）：**compact「拔 DOM」归属钉死**——DOM 容器
> 归渲染宿主（内核），拔 DOM = 卡壳调用宿主 API 摘除容器，非卡壳私自动作。
> 卸载责任三分：宿主负责容器摘除与屏幕重绘；卡壳负责自身注册效果（订阅/
> 手势/服务登记）的逆序回滚；布局插件只持几何状态，不碰 DOM。

### 组件契约 №2：对话卡（2026-08-15 定稿）

用户愿景（2026-08-15 原话整理）：面板可复用、也是卡片；可做成全屏卡；可召唤
多个窗口、填不同 agent、进行不同对话；甚至互相看到（蜂群式多 Agent，
vision.md §1.8）。

**2026-08-15 结构拍板：池系统（服务）/ 池卡（№3，管理 UI）/ 对话卡（№2，
使用 UI）三者分离**——池卡管"组合怎么搭"，对话卡管"组合怎么用"，两者只通过
池系统与事件总线见面，互不认识。

#### 池结构（2026-08-15 用户拍板：agent = 组合，箭头只向下）

- **L0 基础池**：provider（端点/key/限速）、model（provider 下的具体型号）、
  prompt（人格，可复用出变体）、session（纯历史数据）……彼此不引用，纯原料；
- **L1 组合**：agent = `{prompt × model × 工作区}`，工作区挂 session 引用
  （可新建，可从 session 池挑一条挂入）。**不设独立绑定池**；
- **铁律：箭头只向下**——agent 引用 session/prompt/model，反向绝无引用；
  由数据结构硬约束（基础池条目没有指向组合的字段，想写都写不进去）；
- **引用即 relied**：被引用的条目禁止直接删除，须先解绑（check-active-runs.sh
  守卫的正统版）；断引用 → 消费方降级不崩溃（cordis notify 闭环）。

由此自动落位：session 换 agent 接手 = 把引用挂进另一 agent 的工作区（session
本身不动，历史按消息记作者）；agent 换模型 = 改组合内 model 引用；一个 model
多 agent 用 = 多条组合引用同一基础条目。

#### 对话卡是什么：纯渲染壳

卡内只有三样 UI：**消息列表**（渲染 session 流）、**光球面板**（状态脸：
idle/工作中/降级）、**输入栏**。无 agent 逻辑、无会话数据、无模型调用——
全是 inject 的服务。

#### 接口契约

```ts
const cardChat: Component = {
  name: 'card-chat',
  inject: ['agent-service', 'session-store', 'layout', 'theme'],
  provide: ['chat'],
  config: { agentId: string, sessionId?: string },
};
// emit: chat/sent, chat/received, agent/working, chat/error
// on:   session/updated, agent/changed, layout/resize, theme/changed
```

#### 生命周期（开卡那一刻）

1. `activate(config)` → agent-service 解开 agentId 组合 `{prompt, model, 工作区}`；
2. 无 sessionId → 取该 agent 工作区最近一条 session；
3. 订阅 session-store 数据流 → 渲染历史；
4. 输入 → `agent-service.send(agentId, sessionId, text)` → 回复流式回来渲染；
5. `agent/working` → 光球转；
6. `deactivate` 沿用终端卡 compact 语义：**拔 DOM 留服务**，对话后台继续，
   回来重订阅即同步。

#### 边界情况（考题）

- agentId 组合被删 → 降级态：光球灰、显示"缺 agent"、emit `chat/error`，不白屏；
- provider 挂 → agent-service 报错事件，光球红闪，输入栏不禁用（先进历史可重发）；
- 同一 session 两卡同开 → 正常：session-store 唯一数据源，各自订阅各自渲染
  （这是"互相看到"的地基）；
- 对话中途换模型 → 改组合 model 引用 → `agent/changed` 广播 → 徽标更新历史不动。

#### 为什么这么薄

- **多实例免费**：fiber 实例化 N 次填不同 agentId = 召唤多窗口；卡间零共享，
  全靠服务层汇合；
- **Room 不改卡**：Room = 一个 config 填多条组合，卡内核（订阅/渲染/发送）
  一行不动，变的只是 agent-service 内部路由；
- **"互相看到"9.0 只做浅层**：只读可见（session-store 跨会话查询 + 事件）；
  深层蜂群协作另立设计（对应 L2 Room 池，只留接口位不实现）。

#### 复用场景

- 光球面板单独抽出 → 任何长任务卡的状态脸（终端长命令也可顶一个）；
- 消息列表渲染器 → 日志查看 / 工具输出流（与终端渲染器并列的第二种
  流式文本渲染器）。

#### 状态

✅ 定稿（2026-08-15：agent=组合、箭头只向下、config={agentId, sessionId?}、
池系统/池卡/对话卡三者分离）

> 修订注（2026-08-15，评审中 5 → 议题 3 拍板）：`session-store` /
> `agent-service` 的「长寿命服务」身份从工作假设转为拍板结论——数据归
> 数据管理器，与卡片插件生灭无关（见「议题 3」三状态归属表 +「服务即
> 插件」原则）。

### 组件契约 №3：池卡（2026-08-15 定稿）

脱胎于卡片堆各池卡（role/api/config/scripts/session/tools）。定位为
**池系统的唯一管理 UI**：复用 tmux 标签切换把各池路由到同一窗口；每标签渲染
一类条目，做编辑、引用关系查看（"这个 model 被哪几个 agent 用着"）、组合装配
（搭"茉莉-kfmv4" = 选 prompt + model + 工作区）。依赖池系统服务，不碰对话卡。

> 修订注（2026-08-15 用户拍板）：**范式包（paradigm）取消**——v8 实验产物，
> 现在没有实际作用，遥远未来若需要再议。迁移含义：AgentConfig 的
> `paradigmFile` 字段废弃，`.kfmv4/agents/paradigms/` 不迁入 9.0，池卡不设
> paradigm 标签。

**2026-08-15 形态拍板：容器换新、UI 模式保留、数据层换服务**——七张独立卡
收进一个池卡的七个 tab（tmux 同款标签容器）；每 tab 沿用 v8 池卡已长成的
「双框模式」（下池上配置，配置复杂可点跳独立页面）；数据层从"每卡自己
fetch 文件 API"统一换成池系统服务（引用校验 / relied 守卫 / pool/changed 事件）。

#### 拆三层

| 层 | 组件 | 是什么 |
|----|------|--------|
| 服务 | `pool-system` | 池数据唯一管理者：条目 CRUD、引用校验（relied 守卫）、`pool/changed` 事件。落盘，长寿命 |
| 容器 | `card-pool` | 卡壳 + 标签页容器（与 tmux 卡共用同一「标签页容器」组件），标签分两组 |
| 页面 | `pool-page-*` | 每个 tab 一个池页面插件：provider / model / prompt / session / agent（配置组，可写）+ tools / scripts（系统组，只读） |

#### 入口出口表

```
pool-system:  provide [pool-system]  inject [persistence]
              emit pool/changed（serial+bail 顺序短路）
card-pool:    provide [pool-ui]      inject [pool-system, layout, theme]
              emit pool/selected     on pool/changed, layout/resize, theme/changed
pool-page-*:  provide []             inject [pool-system]
              统一接口 PoolPage：list() / edit(entry) / readonly?
```

#### 关键设计点

- **标签分两组**（2026-08-15 用户拍板）：配置组（provider/model/prompt/
  session/agent——用户数据，可写）+ 系统组（tools/scripts——系统自省，
  只读）；视觉上分组可辨（实色 vs 灰），一眼知"这页能不能动手改"；
- **双框模式保留**：每 tab 下池（条目列表）上配置（当前条目编辑表单），
  配置复杂点跳独立页面——v8 七卡已是此模式的变体，原样搬入；
- **prompt 池条目 = 文件拼接清单**（保留角色卡核心设计）：条目不存文本，
  存有序文件清单（静态 + 动态）；拼接在服务端每轮 LLM 调用前实时重组
  （prompt-assembler 保留）——"每轮重读"天然覆盖静态与动态（眼睛机制
  赖以工作）；文件从文件树挑选，清单可拖拽排序；
- **agent tab = 组合装配**（现 config 卡形态）：上组合表单（选 prompt 清单 /
  选 model / 工作区）下 agent 池；图形化连线留接口位，9.0 不做；
- **系统组的终态**（演进方向，非 9.0 承诺）：tools/scripts 从手工清单
  升级为组件图实时投影（谁 provide 了什么能力）；9.0 沿用现有数据源，
  接口按"从组件图取数"设计。

#### 插拔语义（apply/unload 两栏）

- apply 注册：卡类型注册、pool/changed 订阅、标签页手势、pool-ui 服务；
- unload 逆序：注销服务 → 摘手势 → 退订阅 → 撤卡类型；页面插件各自
  unload 自管（双框 DOM 由宿主摘除）；
- compact：拔 DOM 留服务，池数据毫发无损（数据归 pool-system，不归卡）。

#### 状态存活

池数据（provider/model/prompt 清单/session 元数据/agent 组合）→ 归
pool-system（长寿命服务，落盘）；卡只持私有草稿（当前 tab、滚动位置、
表单未存内容），随卸载蒸发。

#### 验收测试清单

- A 档：PoolPage 契约（list/edit/readonly 行为）+ 池系统契约（引用校验：
  删 relied 条目被拒；断引用降级不崩溃）+ unload 观察等价；
- B 档：七 tab 冒烟（开/切/编/存/删）；
- **功能一致对照**：每 tab 对照 v8 对应卡的功能清单逐项核对（迁移不丢
  功能）——9.0 验收哲学的具象化："不用的干净消失，需要的随时召唤"；
- C 档：实拍（标签切换手感、表单编辑手感，对照 v8）。

#### 迁移方法：绞杀者两步走（2026-08-15 用户拍板）

v8 池卡的成熟交互（拖拽柄排序 / 点击预览 / 动态静态文件加载）**全部保留**，
不重写。依据：v8 池卡代码天然两截——数据管道（loadRoles/saveRole 等五六个
函数）与交互主体（操作内存对象的几百行 DOM/拖拽代码）本就分层。

- **第一步：数据管道换心**——逐卡把数据函数内部从"fetch 文件 API + 硬编码
  路径"换成"问 pool-system"，签名不变，交互代码一行不动；
- **第二步：搬进 tab 容器**——整卡迁入池卡标签页。
- 被吸收消除的重复（不算损失）：每卡复制的 API_BASE 探测与文件帮手、
  各卡直读 active.json（收编为池系统「激活条目」概念）。

**保留性考题三条**：① 功能一致对照表逐项打勾；② 操作等价（B 档：同一拖拽
产生的落盘内容与顺序同 v8）；③ 实拍对比手感（C 档）。

#### 状态

✅ 定稿（2026-08-15：标签分两组 / 双框模式保留 / prompt=文件拼接清单 /
agent 装配用表单 / 数据层走池系统服务 / 迁移=绞杀者两步走 + 保留性考题三条）

### 组件契约 №4：手（2026-08-16 定稿 · 试点契约之一）

#### 定位（2026-08-16 用户拍板）

v8 现状：手是**全局单例半成品**——光球面板配套设施三件套之一：嘴（光球
面板）/ 手（工具联动系统）/ 眼睛（动态文件）。9.0 定位：**通用多实例插件**——
未来的窗口卡（№2 对话卡的完全体 = 光球面板 + 自己的输入栏 + 发送按钮 +
**自己的手**）各自依赖它、各领一只。现在的全局手 = 挂在光球面板上的默认
实例，行为不变；接口按多实例写，不堵死"茉莉的手紫色、别的 agent 青色"。

#### 现状三层（v8 已天然分层，几乎照着契约预演过）

| 层 | 文件 | 是什么 |
|----|------|--------|
| 纯几何 | `hand-geometry.ts`（10 行） | handHitTest 纯函数——曾因测试拖进浏览器依赖链而抽离，A 档现成落点 |
| 引擎 | HandEngine（hand.ts） | 纯状态机：idle 噪声游走 / move 补间过冲 / press 收轨涟漪 / return 回归 / drag 用户接管；定种子噪声 + 参数方程，**零数值积分**，同时间序列必同位置 |
| 装配 | initHand（hand.ts） | 全屏 canvas + rAF + ws 命令订阅（hand-move/hand-press）+ 用户拖动监听——浏览器耦合全在这层 |

#### 接口契约

```ts
const hand: Component = {
  name: 'hand',
  inject: ['render-host', 'gestures', 'events'],
  provide: ['hand'],           // 服务：moveTo(x,y) / press(x?,y?) / 状态查询
  config: { accents?: {color1, color2},  // 手的颜色 = 宿主卡的 accents
            orbitAnchor?: string },      // 待机锚区来源（布局提供）
};
// on: layout/resize（锚区变化）/ ai/working（联动）
```

#### 三状态归属（最干净的示范）

- **登记类**：ws 命令订阅 ×2、pointer 监听 ×4、rAF 循环 ×1——unload 逆序全摘；
- **发射类**：canvas 像素——不承诺撤销，宿主摘画布即完；
- **数据**：**没有**。位置/尾迹/补间进度全是私有草稿，随卸载蒸发，
  重开从锚区重新游走——零负担。

#### 硬契约点（血泪教训入档）

- **时基唯一**：引擎内一切时间用 rAF 回调的 `now`（2026-08-12 事故：混入
  Date.now，补间算出巨负值，手被抛出屏幕永不回归）——变异抽检靶子：
  把时基换成 Date.now，测试必须红；
- **用户可拖**：命中核附近（48px 半径，纯函数 handHitTest）→ capture 拦截
  接管，松手 1.5s 后回归（2026-08-13 用户定稿）——这是契约行为不是细节；
- **视觉代理**：canvas pointer-events:none 纯展示，不抢真实 DOM 命中。

#### press 语义（2026-08-16 查实定案；评审进度评审裁决）

**v8 真相**（2026-08-16 全库 grep 实证）：合成 PointerEvent 注入**在全项目
不存在**——`hand-press` 只有 hand.ts 里的监听器，server 侧无任何发送方
（server 工具只有 kfm-hand-move，无 kfm-hand-press）；「注入 PointerEvent
复用手势系统」是立项注释里的未实现意图（手是半成品的实证）。

**9.0 定案：press = 视觉 + 注入一体**——手插件收到 hand-press → 引擎 press
（收轨涟漪，发射类）+ 经 gestures 服务在目标坐标合成 pointer 序列
（down/up，复用手势分发全链路）；注入是发射类副作用，不在回滚承诺内。
配套缺口入档：server 侧需新增 kfm-hand-press 工具（对齐 kfm-hand-move 的
坐标校验 + 权限分级）；「server 工具 → ws 命令 → 手插件 press」链路属本
契约的实现契约部分。

#### 验收测试清单

- A 档：引擎状态机纯测（喂时间序列断言位置：idle 不发散 / move 必达 /
  return 必归）+ hitTest + **确定性**（同种子同时间 → 同位置）；
- B 档：命令冒烟（hand-move → 手到坐标；press → 涟漪 + 回归）；
- C 档：实拍——巡逻有机感 / 涟漪 / 拖动跟手，对照 v8。

#### 演进

多实例默认只实例化一只（= 现状）；窗口卡时代每卡一只，颜色吃宿主卡
accents；isolate 作用域机制（NA 规格书 §4.3 同构）的试验田。

#### 状态

✅ 定稿（2026-08-16：通用多实例插件 / 三件套定位 / 时基契约 / 用户可拖）

### 组件契约 №5：眼睛插件包（2026-08-16 定稿 · 试点契约之一 · 首个 bundle）

#### 定位

v8 现状：眼睛 = 一条硬编码管线——客户端 viewport-visibility（纯函数，
矩形减法算遮挡）+ Registry 快照采集 → 服务端 genEyes 组装（MD 语义外壳 +
YAML 数据内核）→ 写 `.kfmv4/agents/prompts/dynamic/eyes.md` →
prompt-assembler 每轮拼接。**视神经 = 角色卡动态文件清单**（池结构已保住）。
9.0：拆成「段插件群 + 眼睛组装服务（总插件）+ 动态文件基建服务」，
整包启停——眼睛的内容从硬编码变成可组合，加视力 = 加段插件文件。

#### 包结构

```
src/plugins/
  core/
    dynamic-prompt-files.ts   ← 包外基建：prompts/dynamic/ 目录唯一管理者
                                （眼睛是第一个客户；未来记忆/待办插件同为发布者）
  eyes/                        ← 眼睛插件包（bundle）
    index.ts                   ← 包入口：成员清单
    eyes.ts                    ← 总插件：触发 / 段序 / MD 外壳 / 写盘 / 失败降级
    sections/
      coords.ts                ← 标定坐标系（手眼共享契约：原点左上、绝对像素）
      viewport.ts              ← 当前视口（遮挡实测）
      topbar.ts                ← 顶栏
      file-tree.ts             ← 文件树（全量，手操作清单）
      orb-panel.ts             ← 光球面板（含最近 3 条对话）
      card-stack.ts            ← 卡片堆
```

#### bundle 四规矩（9.0 通用惯例，本契约首立）

1. **一个文件夹 = 一个包**，包内 `index.ts` 是唯一入口，声明成员清单；
2. **整包启停**：启用 = 按依赖拓扑序 apply 全部成员；禁用 = 逆序 unload
   全部——对外是一个原子单元；
3. **内外有别**：包内成员互 inject 自由（段 inject 包内 eyes 服务）；包对外
   只 expose 入口声明的接口；段注册是包内事务，外部不可见；
4. **包级配置**：可关停个别段（cordis profile 启停）——关掉"中央页面"段，
   文件里就少这一段，其余不动。

> 对齐注记（2026-08-16，评审进度评审 §三）：kfmv4 插件包 ≅ NA 规格书的
> group 嵌套；paper-digest 不采用清单第 2 条明确 **NA 不采用 group**
> （编译期插件清单固定，嵌套留待「插件加载插件」场景）。两线一用一不用是
> **端形态差异，非理论分歧**（参照连接 provider 先例）：web 端插件发现/
> 组合发生在运行时（文件即模块、包即文件夹），bundle 是「新能力 = 加
> 文件夹」的自然形态；Rust 编译期清单固定，无运行时组合需要。本契约不
> 影响 NA 的不采用决定，两线对账时按此注记读。

#### 接口契约

```ts
// 段插件（包内供稿，不对外 provide）
interface EyesSection { id: string; title: string; collect(): unknown }
//   —— 返回 YAML 数据对象，总插件负责 MD 外壳

const eyes: Component = {
  name: 'eyes',
  inject: ['dynamic-prompt-files', 'events'],
  provide: ['eyes'],            // 服务：registerSection / 手动 refresh
};
// on:  tool/finished, snapshot/updated（触发刷新）
// emit: eyes/refreshed（emit 同步观察）
```

#### 三状态归属

- 登记类：段注册、事件订阅 ×2——unload 逆序摘；
- 发射类：写进文件的字节——收不回；
- 数据：eyes.md 是**投影不是真相源**（真相源 = 快照/fs/会话），每轮即弃；
- **卸载遗言**（本契约新立）：unload 时最后写一次占位「眼睛已关闭」——
  发射类收不回，但补偿性遗言防止 AI 把过期视力当最新。

#### 硬契约点（v8 珍贵设计保留）

- **标定坐标系段 = 手眼共享契约**：手按的坐标和眼报的坐标同一个系；
- 每段带 `source:` 审计字段（数据从哪来的）；
- **失败写占位不抛**——眼睛不阻断工具循环；
- 段输出 = MD 语义外壳（给 AI 语义引导）+ YAML 数据内核（精确数据）；
- 降级回退链保留（快照缺坐标 → 实测兜底值）。

#### 作用域

v1 **全局眼睛**（现状不变）；管线留 scope 参数——多 agent 时代每只眼睛只看
自己窗口卡（isolate 作用域；是否"互相看到"归 Room 愿景再议）。
插件化解锁的升级：viewport-visibility 数据源从「Registry 快照推算」升级为
「**布局服务直读**」（布局本持有所有卡片几何，更准更实时；遮挡序 rank 表
从硬编码对齐 z-index 变为布局层级声明）。

#### 验收测试清单

- A 档：段契约（collect 输出合法 YAML 对象）+ viewport-visibility 纯函数
  照旧钉测 + 总插件契约（段注册/注销/失败降级）；
- 包级：整包启停（启用 → 文件正常刷新；禁用 → 段全消失 + 遗言占位）；
- 配置级：关某段 → 该段消失，其余段不受影响；
- B 档：触发链路（工具调用后 → 文件刷新）；
- C 档：实拍——AI 实操一次，验证它看到的与屏幕一致（手眼不错位）。

#### 状态

✅ 定稿（2026-08-16：段插件群 + 总插件 + 包外基建 / bundle 四规矩首立 /
卸载遗言 / 全局 v1 留 scope）

### 组件契约 №6：卡片类型 broker（2026-08-16 定稿 · 试点契约之三 · 首份服务契约）

#### 定位

v8 现状：卡片注册表（card-registry.ts，155 行）= 卡片的"户口登记处"，
两本账——类型账（registerCardType 静态登记）+ 实例账（CardRegistry 运行时
追踪）。毛病：**只办出生不办死亡**（有 register 无 unregister）；且与 ctx
服务仓库是两套机制管同一件事（同步噩梦：插件已卸载，卡类型还在册 →
幽灵入口）。

9.0（2026-08-16 用户拍板）：**改造为 9.0 的第一个 ctx broker 服务**——
不是"补 unregister 函数"，是"注册变成效果，注销由回滚机制白送"。

#### 三本账分清（防合并谬误）

1. **fiber 表**（插件本体清单）——内核 inject 引擎私有，插件摸不到；
2. **ctx 服务仓库**（服务键 → 实现）——内核公开登记处；
3. **card-types broker**（卡片类型集合）——**一个普通服务**，住 ctx 里。
   卡片类型不能各自 provide 服务键（单一来源纪律：同名不二次注册），
   集合归 broker 管（论文 §6.2 服务多路复用）。

#### 接口契约

```ts
interface CardTypes {
  registerType(def: CardTypeDef): () => void;  // 返回 disposer
  list(): CardTypeDef[];                        // 枚举（卡片堆读它）
  get(typeId: string): CardTypeDef | undefined;
  // 实例户口（第二本账收编为服务内部状态——内部可变性，合规）：
  createInstance(...) / destroyInstance(...) / getByType(...) / focused
}

// 卡插件的标准写法——注册 = 登记进 fiber 的效果：
const cardTerminal: Component = {
  name: 'card-terminal',
  inject: ['card-types'],
  apply(ctx) {
    ctx.effect(ctx.cardTypes.registerType(terminalDef));  // ← 题眼
  },
};
// unload 时 fiber 逆序回滚 → 注销自动发生，零注销代码。
```

#### 语义规则

- **relied 守卫**：类型还有活实例 → 其 disposer 拒绝执行（先关实例，
  拓扑序：实例全灭 → 类型销户）；
- **枚举顺序 = 依赖拓扑序 + name 字典序兜底**（2026-08-16 评审补强：拓扑序
  钉依赖序；无依赖兄弟的拓扑序不确定（取决于激活时序），按 `name` 字典序
  钉兄弟序——两条确定性规则，顺序可复现可断言；考题：兄弟枚举 = name 序，
  改乱 → 红）——v8「import 顺序决定卡片堆顺序」的事故温床治好且不留新温床；
- broker 自身被卸载 = 所有类型先销户（拓扑序），再销 broker。

#### 三状态归属

- 登记类：registerType 效果——回滚即注销；
- 发射类：无（纯内存服务）；
- 数据：类型定义无落盘（重建得起）；**实例户口走 serialize 交班**
  （2026-08-16 评审补强，「户口去向」三选一取 2）：broker reload = 换新
  服务实例，若实例表随服务生灭清零，会出现「户口没了、本体还在」的失配
  （打开的卡还在屏幕上，focused/getByType 全失忆）。取 serialize 交班：
  reload 时实例表 serialize → 新实例 restore——同时满足「服务即插件」
  拍板（服务卸载须 serialize 交班）与前两刀先例（已建实例不随 unload
  死）；focused/位置等运行时态的交班语义随实例表 schema 定义，与 №1
  渲染器 serialize/restore 同构。

#### 迁移（绞杀者）

v8 各卡文件的 `registerCardType(...)` 调用点**形式不变**，内部改道 broker；
card-stack 读 `getAllCardTypes()` 改为 inject broker 枚举。行为对照表验收。

#### 验收测试清单（考的是整个 ctx 模式）

- A 档：注册/枚举/注销**观察等价**（注销后与"从没登记过"不可区分）+
  relied 守卫（有实例禁销户）+ 拓扑序枚举；**变异抽检靶子**：注册不进
  fiber（卸载后类型残留 → 红）、disposer 不守卫实例（销户留活实例 → 红）；
- B 档：卡片堆枚举冒烟（开堆列表 = 注册集合）；
- C 档：实拍（卡片堆开卡/关卡行为与 v8 一致）。

#### 状态

✅ 定稿（2026-08-16：broker 服务形态 / 注册=效果回滚白送 / relied 守卫 /
拓扑序枚举 / 绞杀者迁移）——试点三件套（眼睛/手/broker）齐，机制考证备。

> 修订注（2026-08-16，broker 契约评审三条全采纳）：① 枚举顺序补 name
> 字典序兜底（见语义规则）；② 实例户口去向定案 serialize 交班（见三状态
> 归属）；③ **对齐注记**：本契约直接上 broker，NA 规格书 §3 注记「v1 取
> 独占，broker 是已知升级路径」——两线在同一机制上分道是**端形态差异非
> 理论分歧**（web 多卡片类型天然多路复用 vs 安卓单渲染栈先独占），同连接
> provider 先例；「9.0 用了 broker」不构成 NA 的升级义务。

### 组件契约 №7：文件树卡（2026-08-16 定稿）

#### 定位与拍板

- 用户愿景：文件树功能不变，重新设计轻量/性能好/流畅；一切皆卡片——
  **文件树本身就是一张卡**；
- **2026-08-16 用户拍板：重新实现，UI 不变，换 DOM 结构**；交互动画整体
  插件化（议题 1 修订注），v1 树核心**零动画**；
- 唯一硬挑战（用户原话）：大量文件中 10~15 层深层展开/收起时，滚动、
  展开、折叠正常运行不卡。

#### 拆三层

| 层 | 组件 | 是什么 |
|----|------|--------|
| 数据 | `tree-data` | 懒加载服务（保留 v8 设计：只取展开路径上的节点，list-recursive）；长寿命 |
| 渲染 | `tree-view` | 轻量 DOM 渲染器：**扁平化可见行 + 窗口化渲染**（VS Code 同款方案） |
| 卡壳 | `card-filetree` | 一切皆卡片：注册卡类型（走 №6 broker）、接布局/主题/手势 |

#### 性能架构（核心设计）

- **扁平化**：`(树数据, expandedPaths) → 可见行数组` 是纯函数（离线钉测）；
  深度 10~15 层无特殊处理——扁平化后深度只是每行的缩进值；
- **窗口化**：只渲染视口 ± overscan 的行，DOM 节点数有上界（约 50），
  **与文件总数无关**；滚动 = 原生滚动 + 窗口重排；
- **展开/折叠 = 重算可见行数组**（O(可见节点)，瞬时，无动画）；
- 动画缺位是设计不是偷懒：动画插件后挂（议题 1 修订注）；v8 双树
  overlay 动画 / 字符雨**不迁移**。

#### 性能契约（A 档硬指标）

- 语料：10 万节点树（最深 15 层）、全展开可见行 ≥ 5000；
- 滚动 60fps；单次展开/折叠 < 16ms；DOM 节点数 ≤ 视口行 + 2×overscan；
- CI 基准测试钉住（性能回归 = 测试红）。

#### 功能一致（绞杀者保留清单）

懒加载展开/折叠 / 点文件投浮卡 / 光标行 / 右滑临时卡片堆 / **prompt 挑选
模式**（见下）/ 变暗标记 / 多选模式。**UI 外观不变**（深度渐变 / 折叠图标 /
缩进）——C 档实拍对照 v8。

#### 对外接口（两个现成依赖点）

- **provide file-picker 服务**：「从树上挑文件」——池卡 №3 的 prompt tab
  依赖（v8 里是 tree-swipe 的挑选模式，9.0 转正为服务）；
- **眼睛包 file-tree 段语义一致**：服务端重建树与客户端可见状态同一
  expandedPaths 语义（契约钉住，防手眼错位）。

#### 三状态归属

- 登记类：卡类型注册（broker）、手势注册、`tree/changed` 订阅——逆序摘；
- 发射类：无（DOM 由宿主摘除）；
- 数据：树数据 + expandedPaths + 光标归 `tree-data` 服务（重开恢复现场）；
  卡只持私有草稿（窗口 overscan 缓存），随卸载蒸发。

#### 验收测试清单

- A 档：可见行纯函数钉测 + **性能基准**（上述硬指标，CI 跑）+ file-picker
  契约 + unload 观察等价；
- B 档：端到端冒烟（开树 / 展开 15 层 / 滚动到底 / 挑选文件）；
- C 档：实拍对照 v8——外观一致 + 流畅度对比（大目录深呼吸测试）。

#### 状态

✅ 定稿（2026-08-16：DOM 重写 UI 不变 / 扁平化+窗口化 / 零动画核心 /
性能硬指标入契约 / file-picker 服务化）

---

### 契约 №8：顶栏（槽位 broker + tmux 管理）

> 定稿时间：2026-08-16
> 拍板人：用户（"我觉得可以"）

#### 这是什么

顶栏是第四个"容器+供稿项"（卡片 broker / 池卡 tab / 包，之后是它）。
本身只有一条横条 + 槽位布局，不知道槽位里装的是什么。
中央区全让给终端卡之后，它是项目里唯一常驻的 UI 控制面。

#### 接口表

```ts
interface Topbar {
  registerSlot(def: SlotDef): () => void
}

interface SlotDef {
  id: string
  align: 'left' | 'center' | 'right'
  order?: number
  render(el: HTMLElement): void
}
```

注册=效果，返回函数=摘除（卸载白送）。
顶栏只管：横条渲染、槽位按 align+order 布局、摘除。
槽位内容、业务逻辑全归槽位插件。

#### 四个槽位插件（首批）

| 槽位 | 位置 | 内容 |
|---|---|---|
| `slot-emblem` | 左 | 动态徽标（现状保留） |
| `slot-balance` | 左 | DeepSeek 余额，定时刷 |
| `slot-orb` | 右 | 主光球=手的家；锚区登记进布局，手的 orbitAnchor 从布局取 |
| `slot-tmux` | 中 | tmux 管理器标签条 |

#### tmux 管理器（槽位=薄 UI，逻辑在 server 服务）

tmux 逻辑全在 server 侧，归 №1 term-connection 家族：

```ts
interface TmuxService {
  listWindows(): TmuxWindow[]
  newWindow(name?: string): string
  killWindow(id: string): void
  killOthers(keepId: string): void
  selectWindow(id: string): void
  detach(): void
}
// emit 'tmux/windows-changed'（同步观察式 emit）
```

五个操作语义：
- 检测：槽位订阅 `tmux/windows-changed` + 开槽拉一次 `listWindows`
- 新建："+"按钮 → `newWindow()`
- 切换：点标签 → `selectWindow(id)`；中央终端卡同订阅，两边自动一致
- 挂起：`detach()` 回裸终端，会话后台活着
- 清空：`killOthers(keepId)`——**唯一破坏性操作**：二次确认（复用 showConfirm）+ 权限审计日志

槽位是薄 UI：渲染标签条（tmux tab 第三次复用：卡内 tab / 池卡 tab / 顶栏标签），
点击翻译成服务调用，订阅事件刷新。**事件驱动，不轮询。**

#### 三状态归属

- 登记类：槽位注册 + 事件订阅 → 逆序摘
- 发射类：像素不撤
- 数据类：tmux 窗口状态归 server 服务；余额缓存是槽位私有草稿

#### 依赖

- 布局服务（锚区登记/读取）
- 眼睛包顶栏段（hud.top）的坐标从布局服务直读
- 布局服务依赖顶栏容器——壳内互相依存，合法（见布局壳一节）

#### 考题

- A 档（契约）：假槽位插件注册→断言出现在指定 align 位→unload→断言摘除且横条无残留；观察等价：unload 后 `tmux/windows-changed` 不再触发该槽位
- B 档（冒烟）：起真 server + tmux 服务，建/切/挂起/清空一轮
- C 档（实拍）：对照 v8 顶栏，徽标/余额/光球视觉一致

#### 状态

✅ 定稿（2026-08-16：容器+供稿项第四次 / tmux 逻辑归 server 服务 /
槽位薄 UI / 事件驱动 / 清空唯一破坏性+确认+审计）

---

### 拍板：权限引擎 + 读写监狱 → 服务插件（2026-08-16）

- 从"域外基建"提为运行时服务插件：provide `permission.check(...)`，
  工具循环与破坏性操作（如 №8 的清空 tmux）都过它；
- 读写监狱随它一起走（同一个裁决边界）；
- 动机：权限策略本身可换（不同 agent 不同权限档位），插拔才有意义；
  且运行时插件已对它产生依赖（№8 定稿时已引用其审计日志）。

### 拍板：工具可带 UI——todo 卡归属裁决（2026-08-16）

- 用户定调：todo 面板不是独立卡种，是**工具系统里一个工具的附属 UI 产物**；
  目前只是只有 todo 有 UI，未来其他工具也会有；
- 通用规矩：工具插件可**可选地**通过 card broker（№6）注册自己的 UI 卡类型，
  不新增机制；todo 卡 = todo 工具贡献的卡类型，第一个实例；
- 副产物：哪些工具有 UI 天然可枚举（问 broker），池卡系统组工具池将来
  加"有 UI"标记是白送的。

### 拍板：OBS HUD 归属消解（2026-08-16）

- 查实 `src/client/modules/obs-hud.ts` 就是 v8 顶栏本体——该待讨论项
  大部分被契约 №8 吸收，不再单独立项；
- 三块残渣的归宿：
  1. 系统三格（硬盘/内存/负载）→ 补为 №8 第五槽位 `slot-sys`（待用户确认）；
  2. 徽标动画引擎（obs-emblem.ts 493 行）→ 归动画插件包；`slot-emblem`
     v1 静态/简化，动画落地后挂回；
  3. 眼睛坐标注册段（registerCoords）→ 已被 №5"段插件从布局服务直读"覆盖。

---

### 契约 №8 修订注：补第五槽位 `slot-sys`（2026-08-16，用户拍板）

对照 v8 真身（`obs-hud.ts` 四栏：徽标/deepseek+余额/系统三格/手待机区）
发现 №8 首批四槽位漏了系统三格。按功能一致原则补上：

- 首批槽位从四个扩为五个：`slot-emblem` / `slot-balance` / **`slot-sys`（系统
  三格：硬盘/内存/负载）** / `slot-orb` / `slot-tmux`；
- `slot-sys` 同为薄 UI：server 侧提供系统指标数据，槽位订阅/低频拉取渲染，
  沿袭 v8 的 30s 低频纪律（移动端发热治理，2026-08-13 用户定稿）；
- 徽标动画引擎（`obs-emblem.ts`）归动画插件包，`slot-emblem` v1 静态/简化；
  眼睛坐标注册段已被 №5 覆盖，不在顶栏契约内。

---

### 契约 №9：窗口卡（光球面板体系的完全体）

> 定稿时间：2026-08-16
> 拍板人：用户（布局照旧 / 四元组自配置不命名 / 启动器统一入口 / 收起≠销毁）

#### 这是什么

v8 光球面板 + 全局输入栏 + 手的"一套逻辑"组件化为一种卡。
是 №2 对话卡（纯渲染壳）的完全体外壳：主光球是它的全局单例实例，
普通实例 = 主光球之外的独立 agent 交互通道，可开多个。

#### 组件结构（五部件）

```
┌─────────────────────────┐
│  上栏：role + session     │
├─────────────────────────┤
│  消息流（№2 对话卡渲染壳） │
├─────────────────────────┤
│  下栏：provider + model   │
├─────────────────────────┤
│  输入栏 + 发送按钮        │
└─────────────────────────┘
   收起态 = 光球；自带一只手（№4 实例）
```

布局与 v8 光球面板一致，不动。

#### 挂点（主光球 vs 普通实例，一套实现两种配置）

| 部件 | 普通窗口卡 | 主光球（全局单例） |
|---|---|---|
| 输入栏+发送 | 卡内 | 全局底栏（v8 现状保留） |
| 手 | 自带在卡上 | 顶栏 `slot-orb`（№8） |
| 面板位置 | 布局管的浮卡 | v8 现在位置照旧 |
| 优先级 | 常规 | 最高（z 序 / 手势） |
| 销毁 | 可销毁 | 不可销毁，只能收起 |

#### 配置语义：四元组自配置，不命名

- 卡的绑定 = 四元组（role × provider × model × session），四个下拉
  各从对应**基础池**挑条目——选项永远来自池，不可自由输入；
- 组合是卡的私有状态，**不写回任何账本、不要求命名**；
  v8 全局 `active.json` 单配置消亡，每卡各持四元组；
- agent 组合池（№3）保留为可选预设层，v1 窗口卡不依赖它；
- 会话独立：每卡绑自己的 session，切 session 不影响别的卡。

#### 开 / 关

- **开**：启动器（卡片堆瘦身版）统一入口，选"窗口卡"→ 新光球落默认位置。
  v1 只此一个入口；
- **收起**：点光球，面板收成球。户口保留，状态全留——不算关；
- **销毁**：光球长按出菜单 →"删除"→ showConfirm 二次确认 → 实例销毁、
  户口删除。**销卡不销会话**：session 本体在会话池，新卡可重新绑回；
- **单例机制**（№6 修订注，见下）：卡类型注册时可声明 `singleton: true`，
  重复开 = 聚焦已有实例。池卡、主光球为单例；窗口卡、终端卡为多实例；
- 入口数量无专门机制：开几张卡就几颗光球，归布局管。

#### 持久化

每实例户口（№6 serialize 交班）= 四元组 + sessionId + 几何 + 收展态。
刷新/重启/kfm-restart 复活后原样回来。

#### 扩展口（留而不用）

- 手的外观参数未来可从角色（prompt 池条目）读取，v1 固定样式；
- 窗口卡下拉将来可加"去池卡配置"跳转（= 聚焦池卡切 tab），v1 不做；
- 多 agent 协作（wechat 模式）→ 远期议题，9.0 只打地基
  （多实例 / 组合 / session 绑定 / 只读跨会话可见）。

#### 依赖

№2 对话卡（消息渲染壳）/ №4 手 / №6 broker / 基础四池（读条目）/
session-store / 布局 / 启动器 / permission-engine（破坏性操作审计）

#### 三状态归属

- 登记类：卡类型注册 + 事件订阅 + 手实例 + 坐标锚区 → 逆序摘；
- 发射类：像素不撤；
- 数据类：session 归 session-store、池条目归 pool-system；
  四元组是卡实例的私有草稿（随户口持久化）。

#### 考题

- A 档（契约）：开两张窗口卡 → 各配不同四元组 → 断言互不影响；
  serialize→重建→断言四元组/session/几何/收展态全恢复；
  销毁卡 → 断言户口删除且 session 仍在池中可再绑；
  singleton 声明的卡重复开 → 断言聚焦而非新实例；
- B 档（冒烟）：真 server 跑一轮：开卡→配置→发消息→收起→销毁→新卡绑回 session；
- C 档（实拍）：主光球对照 v8——面板布局/全局输入栏/顶栏手/手势行为一致。

#### 状态

✅ 定稿（2026-08-16：五部件 / 挂点分主光球与普通实例 / 四元组自配置不命名 /
启动器统一入口 / 收起≠销毁、销卡不销会话 / 持久化走实例户口）

---

### 契约 №6 修订注：卡类型可声明 singleton（2026-08-16，随 №9 拍板）

broker 的 CardTypeDef 增加可选字段 `singleton?: boolean`（默认 false）。
声明为单例的卡类型：启动器/任何开卡入口重复请求时聚焦已有实例，
不新建。池卡、主光球用此声明。多实例语义不变（窗口卡、终端卡等）。

---

### 拍板：插件化的是"效果"，不是代码（2026-08-16，用户拍板）

- 纯函数库（md 渲染、颜色工具、协议转换、路径工具）没有注册、订阅、状态，
  import 即用——**不算插件，是 lib 层**，不写 apply/unload；
- 有状态、有注册表的件（style-registry / animation-registry / tool-compaction
  / 工具宿主）才做成服务插件；
- 判据：插件化的是副作用（登记/订阅/发射），纯计算没有副作用，不入插件体系。

### 拍板：台账全覆盖军规（2026-08-16，用户拍板）

- 动机：7→8 跨版本出过信息丢失；9.0 必须**先证明每个 v8 文件有归宿**再动工；
- 基线（2026-08-16 机械盘点）：src/ 共 36,012 行 / 152 文件；
  已规划桶 22,681 行（63.0%，扣除语料/生成物后纯逻辑约 56%）；
- 军规：设计地图的组件台账 + 共享基础件表 + 域外表，**合计必须覆盖
  capability-map.md 与 src/ 全量文件**；每行要么有契约、要么有归宿、
  要么明确拍板移除——不允许"忘了"。

---

### 契约 №10：工具宿主（tool-host）+ 账本服务（ledger-service）

> 定稿时间：2026-08-16
> 拍板人：用户（"骨架固定 + 闸可插拔 + 只收不放" / 重子系统独立插件懒加载 /
> 可见性留口子 / 账本独立成服务）

#### 这是什么

v8 `tools/index.ts`（170 行静态 Map + executeTool 扼点）的插件化。
server 侧服务插件；工具 = 插件，注册即生效，卸载即注销——
"容器+供稿项"第五次复用（卡片 broker / 池卡 tab / 包 / 顶栏槽位之后）。

#### 接口表

```ts
interface ToolHost {
  registerTool(def: KfmTool): () => void   // 注册=效果，返回函数=注销
  list(): ToolDef[]                         // 池卡工具池 tab 的数据源
  execute(name, params, ctx, onUpdate?): Promise<ToolResult>  // 扼点
}

// KfmTool 沿用 v8 已验证接口，不动：
//   name / description / category / parameters(JSON Schema)
//   execute(params, ctx, onUpdate?) 流式中间输出 + AbortSignal 中止
// ToolContext 沿用：cwd / wsServer / signal / sandboxRoot / readRoot
```

#### 扼点管线：骨架固定 + 闸可插拔 + 只收不放

```
调用 → ① 监狱闸（写监狱/读监狱，路径越界构造性拒绝）
     → ② 权限闸（permission-engine 裁决 allow/deny/ask）
     → ③ 执行（AbortSignal 贯通）
     → ④ 账本（ledger-service 追加一行）
```

- **骨架固定**：四道闸的顺序、"所有调用必经此门"由宿主保证，不可插拔；
- **闸可插拔**：①②的裁决逻辑由 permission-engine 等安全插件提供——
  未来安全大更新 = 换插件，不碰宿主（用户拍板理由：安全模式本来就是
  后来加的，其开发过程就是一次插件开发）；
- **只收不放**（沿用 v8 读监狱注释的铁律）：插件只能让访问面变窄，
  不能变宽；宿主自带不可卸基线（不得写出项目根）。安全插件卸载后
  剩下的是基线，不是真空——可插拔永远不构成降级攻击面。

#### 工具家族归堆（17 个现有工具的归宿）

| 家族 | 内容 | 9.0 形态 |
|---|---|---|
| 小工具群 | bash/read/write/edit/grep/glob/eval/todo/checkpoint/rewind/web-search Ⓟ677 | core-tools 包（一包多工具） |
| 自指工具 | logs / restart / hand(kfm-hand-press) / browser-eval Ⓟ323 | kfm-tools 包 |
| browser 子系统 | puppeteer + worker + stealth Ⓟ2422 | 独立插件包，懒加载（用时拉起 chrome），卸载真杀进程 |
| debug 子系统 | CDP 调试 Ⓟ1274 | 独立插件包，同上 |

#### 账本服务（ledger-service，随本契约一并定稿）

- 独立小服务插件：`append(ns, record)`——往指定名字的 append-only
  JSONL 账本追加一行；写失败吞掉不阻塞（v8 现有纪律）；
- 使用方：tool-host（tool-exec 执行账）、permission-engine（裁决审计）、
  №8 清空 tmux（操作审计）；
- **文件即接口**：读端是现成的运维周报脚本，不进运行时——"数据还给文件"。

#### 与已拍板体系的接口

- **工具可带 UI**（2026-08-16 拍板）：KfmTool 注册时可选声明 cardType，
  经 №6 broker 注册 UI 卡类型；todo 卡为首例；池卡工具池 tab 的
  "有 UI"标记由此枚举白送；
- 池卡工具池 tab = `host.list()` 的只读视图；
- **可见性**：v1 全量可见；留口子——agent 组合未来可声明工具子集。

#### 三状态归属

- 登记类：工具注册 + 卡类型注册 → 逆序摘；browser/debug 包的进程是
  登记类的大件（卸载=杀 chrome）；
- 发射类：已流出的 onUpdate 输出不撤；
- 数据类：账本文件归 ledger-service（append-only，永不回写）；
  工具自身的运行缓存是私有草稿。

#### 考题

- A 档（契约）：假工具注册→出现在 list→execute 通→unload→list 消失
  且 execute 返回未知工具；监狱闸：沙箱外 write 被拒（基线在权限插件
  卸载后仍生效——只收不放）；账本追加可观察；
- B 档（冒烟）：browser 插件懒加载拉起 chrome→卸载→进程树无残留；
- C 档（对照）：17 个工具逐一与 v8 行为对照（参数 schema/错误文本一致）。

#### 状态

✅ 定稿（2026-08-16：骨架固定+闸可插拔+只收不放 / KfmTool 接口沿用 /
四家族归堆 / 重子系统懒加载 / ledger-service 同稿定稿 / 可见性留口子）

---

### 拍板：UI 皮肤包（2026-08-16，用户拍板）

- UI = 可插拔皮肤包；**默认包 = v8 深蓝意志视觉**；
- 分界沿用"效果非代码"：custom-select / showConfirm 等结构件留 lib 层共享；
  主题 / 配色 / 质感 / 样式注册表（theme.ts、style-registry）进包；
- 动画包同理（前已拍板）：v1 不装，v8 动画代码全留仓，未来做成插件包再加装。

---

### 契约 №11：布局壳（全屏层叠 + 启动器 + headless）

> 定稿时间：2026-08-16
> 拍板人：用户（手机优先 / 浮卡降多端适配远期包 / 点卡直接全屏、
> 保留全屏关闭 UI、取消浮卡切换 UI）

#### 这是什么

"布局 = 卡片摆放管理"的实体。v1 两个实现：
**全屏层叠**（默认，手机优先）+ **headless**（不渲染，A 档测试 / AI 无头自测）。
浮卡工作台（v8 floating-card 等 Ⓟ1195）**不删概念、不搬代码**——
不迁移、留仓参考，未来桌面端以布局插件新写，进多端适配包。

#### 布局接口

```ts
interface Layout {
  mount(inst: CardInstance): CardHandle  // 容器向渲染宿主要的
  unmount(h: CardHandle): void
  focus(id: string): void                // 单例聚焦 / 实例切换
  anchors: AnchorRegistry                // 锚区登记：眼睛段/手/顶栏从这读坐标
  serialize(): LayoutState               // 几何户口（每实例位置+收展态）
}
```

- **全屏槽**：任何时刻一张卡占满可视区；tmux 卡即此语义下的全屏卡
  （议题 1 下钻拍板不变）；
- **headless** 同接口不渲染——接口的第二个实现，强制抽象不掺浮卡私货。

#### 交互流（v1）

启动器（左滑唤出抽屉，UI 保留；内容 = №6 broker 枚举，不再自维护列表）
→ 点卡类型 → **直接全屏进入**。保留全屏卡的关闭 UI（v8 floating-fullscreen
的关闭语义）；**取消"全屏 ⇄ 浮卡"切换 UI**（浮卡模式 v1 不存在）。

- 再点同类型 = 聚焦已有实例（singleton 规则，№6 修订注）；
- 窗口卡收起 = 光球悬浮——页面上唯一的浮动物，位置入户口；
- **z 序**：v8 静态层表（z-index-layers）并入布局内部常量；全局规则
  只剩一条：主光球最高。

#### 附带消解

`mode-system.ts`（Ⓟ446）读码确认是**文件树的 copy/move/delete 模式工具栏**
（tree-swipe 拆出），归 №7 文件树卡附属——台账待定项消解。

#### 三状态归属

- 登记类：卡实例挂载 + 锚区登记 + 手势注册 → 逆序摘；
- 发射类：像素不撤；
- 数据类：几何户口归布局（serialize 交班）；卡内容数据各归其服务。

#### 考题

- A 档（契约）：headless 布局跑接口契约——mount/聚焦/户口 serialize 往返/
  锚区读写/单例聚焦语义；
- B 档（冒烟）：真机一轮——启动器开卡 → 全屏 → 关闭 → 再开 → 窗口卡收球；
- C 档（对照）：启动器抽屉手势与视觉对照 v8；全屏关闭 UI 对照 v8。

#### 状态

✅ 定稿（2026-08-16：全屏层叠默认 + headless / 浮卡降多端适配远期包 /
点卡直接全屏、保留关闭 UI、取消浮卡切换 / z 序归布局、规则只剩主光球最高）

---

### 契约 №9 修订注：几何户口简化（2026-08-16，随 №11）

v1 无自由矩形：窗口卡户口 = 光球位置 + 收展态；展开 = 全屏。
原"位置尺寸"条款中自由拖拽矩形部分随浮卡工作台一并降入多端适配远期。

---

### 契约 №12：服务层三件套（agent-service / session-store / pool-system）+ persistence 裁决

> 定稿时间：2026-08-16
> 拍板人：用户（四子问题全采纳：persistence 不新建 / 装配线归 agent-service /
> workspaces 点亮 / active.json 葬礼）

#### 这是什么

数据管理器阶层的核心三件。v8 这一层本就最接近目标架构
（session-store 头注释即服务边界宣言），9.0 以收编为主、拆边界为辅。

#### session-store（原样提为服务插件）

- 宪法不变：**会话日志唯一写者；服务端可死，真相在磁盘**；
- 接口 = 现有职责面：appendEvent / flush / hydrate / list（顶层计数）；
  **不做：渲染、发事件、管 run**；
- 落盘纪律是承重墙（防抖 200ms 同步写防交错 + tool_result/done/abort
  强制 flush），内部保留，**不被任何通用持久层收编**；
- script 会话分流注册表保留（2026-08-06 泄漏根治的构造性修法）。

#### agent-service（chat.ts Ⓟ571 + run-manager Ⓟ239 + routes Ⓟ160 收编）

- provide：streamChat / run 管理——**run 如 tmux 会话**：服务端后台跑到
  完成，与客户端连接解耦；断线续跑、重连从缓冲区补齐、停摆看门狗，全保留；
- **prompt 装配线归它**：assembler = 给 LLM 拼 prompt 的最后一棒；
  数据源各回各家——眼睛段归 №5、规则归 rule-engine、角色/配置文件归
  pool-system、工具文档归 tool-host；
- 依赖：tool-host（工具循环）/ session-store（真相）/ pool-system（池条目）。

#### pool-system（池账本 = 文件）

- 账本全是文件：providers.json / agents/roles/*.json / agents/configs/*.json /
  agents/prompts/ / sessions 列表视图；池卡 UI 经它读写；
- **workspaces/ 正式点亮**：2026-08-08 预立的目录规范空位，即 №3 agent
  组合的"工作区"维落点，归它管；
- relied 引用追踪在这（池条目被卡引用时禁删的守卫数据源）；
- **active.json 葬礼**：迁移期内容转主光球实例户口初值（№9），之后删除。

#### persistence 裁决（拍板：不新建）

- session-store 自管落盘（承重墙纪律）；池文件与通用 CRUD 走 file-io 服务；
- 无真需求的抽象正是 v8 的病——台账移除 persistence 行，file-io 保留。

#### 三状态归属

- 本契约即数据管理器阶层本体：数据归服务（会话文件/池文件/工作区）；
- 登记类：事件订阅、文件监听 → 逆序摘；
- 发射类：已写盘字节不撤——落盘即事实，回滚靠新写入不写旧字节。

#### 考题

- A 档（契约）：session-store 写入→杀进程→hydrate 等价；pool-system
  relied 守卫（被引用条目禁删）；agent-service run 断线补齐事件流等价；
- B 档（冒烟）：真 server 完整对话一轮（装配→流式→工具循环→落盘→重连）；
- C 档（迁移）：active.json → 主光球户口初值迁移脚本；sessions/providers
  等数据文件原样可读（绞杀者第一步：数据管道换心）。

#### 状态

✅ 定稿（2026-08-16：三件收编边界 / persistence 不新建 / workspaces 点亮 /
active.json 葬礼 / run 如 tmux 全保留）

---

### 契约 №9 修订注：四元组 ↔ 池预设迁移路径留接口位（2026-08-16，r3 评审裁决 4 落实）

私有四元组（卡私有草稿）与 agent 组合池（池条目）v1 并存，
防两套语义悄悄长分叉：**留接口位——v1+ 候选"私有态一键存为池预设"**。
不求现在实现，但窗口卡的四元组结构必须与池预设条目同构，保证未来可迁移。

### 契约 №7 修订注：file-picker 完成态语义（2026-08-16，r3 评审裁决 2 落实）

file-picker 提供**挑选流程的完成态语义**（resolve 选中路径 / reject 取消），
交互（打开树 + 导航 + 选中）由调用方驱动——防实现时退化成
viewport-visibility 式纯函数。

### 拍板：契约模板升格四条（2026-08-16，采纳 r3 评审附带发现）

后续契约模板在"九字段 + apply/unload 两栏"基础上固化四节：

1. **性能硬指标**：渲染/滚动类契约必带（№7 先例：10 万节点/60fps/<16ms）；
2. **插件判据**：效果三分（登记/订阅/发射）——纯函数留 lib 层；
3. **卸载遗言**：发射类补偿的示范写法（№5"眼睛已关闭"先例）；
4. **容器+供稿项模式节**：模式定义 + 已有实例清单（broker №6 / 池卡 tab №3 /
   bundle №5 / 顶栏槽位 №8 / 工具宿主 №10 / 布局 №11——六次复用），
   后续契约照模式不照案例。

附军规判据强化（r3 裁决 5-2 提醒）：**归宿 = 该文件有可执行的迁移路径，
不是台账里有一行字**——防"每行有归宿"退化成文书游戏。

---

### 拍板：小件清零轮（2026-08-16，用户逐条拍板）

1. **apk 卡：废弃删除**。8022 通道直连手机 + NA 侧 agent 直接编译，下载入口
   不再需要；routes/files.ts 的 download/apk 端点随同退役。
2. **file.card 正名：文件编辑卡**。不是 stub——md/代码文件的预览+编辑，
   与文件树联动 = "带 AI 入口的 Obsidian"（用户愿景原点，早于 kfm 系列）。
   保留为正式卡插件（№6 注册），渲染走 lib 层渲染器集群；契约候选 №13。
3. **tool-compaction：投影过滤器挂点**。本体是纯函数+静态表，留 lib 层
   （"效果非代码"原则——此前误归服务表，读真身纠正）；agent-service 发 LLM
   前的投影链做成插件挂点，tool-compaction 为链上首例（№12 修订注见下）。
4. **主题：UI 皮肤包 v1 重新实现**，不收编 v8 theme.ts / style-registry。
5. **三个附属服务接口面确认**：dynamic-prompt-files（眼睛段写 / assembler 读）
   / tree-data（懒加载数据接口）/ file-io（通用文件 CRUD）。
6. **canvas 引擎 engine/v2（Ⓟ2703）退役清理**：№7 文件树 DOM 化 + 浮卡降级
   后无消费者，9.0 落地时删除；style-registry（树样式的 canvas 来源）随同退役。
   ——它在 9.0 完成了使命。

### 契约 №12 修订注：prompt 投影链挂点（2026-08-16，小件轮拍板 3 落实）

agent-service 发 LLM 前的**投影链 = 插件挂点**（注册=效果，逆序摘）；
tool-compaction 为链上首例（本体 lib 层纯函数）。会话文件永远是全量真相源，
投影只是发给 LLM 的视图——"压缩证据，保留判决"哲学不变；
未来换压缩策略 = 换链上插件。

---

### 契约 №14：内核自研件（渲染宿主 + 手势分发）

> 定稿时间：2026-08-16
> 拍板人：用户（宿主三分 / 手势收编+优先级层带 / 验收三数字）

#### 这是什么

无论 Cordis 采用与否都要自研的两件内核件（Cordis 不管渲染与输入）。
Cordis 裁决 5-4（茉莉条款）的承载者：自研件验收必须带具体数字。

#### 渲染宿主（9.0 新立——v8 无此物）

v8 实况：obs-hud / 徽标 / 浮卡各自往 document.body 直接 appendChild，
无统一容器生灭概念；renderer-lifecycle 是 canvas 树专用状态栈，随
engine/v2 退役。

**规矩：DOM 容器的生灭只有一个入口。** 三方三分：

```
渲染宿主：给盒子（createContainer / 摘除 / 层级）
布局插件：摆盒子（全屏层叠语义，向宿主要容器；№11）
卡片插件：填盒子（盒子里画什么宿主不管——DOM / canvas / xterm 随意）
```

宿主不知摆放在哪，布局不知画什么，卡不知盒子怎么来——布局可换（№11）
正因为容器生灭被宿主收走。

#### 手势分发（v8 gesture-registry Ⓟ346 收编 + 两补丁）

v8 头注释即设计宣言："集中管理 document 级触摸事件，按优先级调度；
优先匹配、独占执行"。接口成熟（targetFilter / condition / 长按 / 双指 /
stopPropagation 细控），原样收编。补丁两条：

1. **注册走 ctx 效果**：插件 ctx.effect 注册手势，卸载白送摘除
   （现状是模块级全局单例，插件化后必须可摘）；
2. **优先级层带公约**（z-index-layers 那副药再用一次）：注册不填裸数字，
   选语义层带——1000 主光球（№11 拍板）/ 900 全屏卡内容 / 800 窗口卡光球 /
   700 文件树 / 600 启动器，层带内再分小序；与视觉 z-index 表天然对齐
   （视觉在上层者手势先响应）。

#### 验收基准（茉莉条款硬指标）

- 滑动/拖拽全程 60fps，掉帧率 < 1%；
- 连续拖拽 30 秒内存增量 < 5MB（泄漏是复发头牌）；
- pointercancel 风暴下事件完整性 100%（不丢 end 事件）。

> 修订注（2026-08-18，步 0-4 执行时补）：内存增量以 **GC 后净增量**为准——
> 毛增量含可回收垃圾，会误伤（步 0-2 churn 实测：2000 轮注册/注销毛增量
> 一度 +12.8MB，GC 后平台化归零）。测量手法：守视 eval 采样
> performance.memory，操作前后各一次 GC 间隔采样。

> 修订注（2026-08-18，8.7.2 落地输入·容器生灭点位普查）：v8 全域
> `document.body.appendChild` 直挂共 **24 处 / 20 文件**，分四类：
>
> - **覆盖层类（10 处）**：confirm-dialog:183 · custom-select:208 ·
>   card-toast:38 · sibling-switcher:132 · file-action-bar:126/209/312 ·
>   scripts.card:72 · role.card:510 · session.card:192 · tools.card:88
>   ——归宿主**覆盖层容器**（统一层级/摘除）；
> - **常驻 UI 类（5 处）**：obs-hud:52 · obs-emblem:46 · version-watch:40 ·
>   hand:74 · orb:148 ——归宿主**常驻层容器**（顶栏槽位/手/光球的盒子）；
> - **卡内容类（8 处）**：tree-render:389 · tree-swipe:163 · card-stack:206 ·
>   mode-system:184/197 · terminal-card-04:256/261/310/352 ——归**布局摆盒**，
>   随各卡插件化收编；
> - **远期（1 处）**：floating-card:270 ——多端适配包，9.0 不动。
>
> 另：各卡内部 `body.appendChild`（handler-factory 等局部容器变量）是卡内
> 内容填充，非容器生灭，不在宿主收口范围。8.7.2 实现时本清单即改造对照表：
> 每收编一处删一处直挂，扫零为止（与 8.10.4 engine 引用扫描同法）。

> 修订注（2026-08-18，灭侧对照普查·8.7.2 落地输入补全）：24 处行号复核
> 零漂移；查漏零遗漏（body.append/prepend/insertBefore/insertAdjacent 全域
> 零命中，无 shadow host，无 documentElement 挂载；head 仅 2 处 style 注入
> 非容器）。灭侧要点：
>
> - **灭侧跨文件是常态模式**：floating-card 挂 body、`floating-shared.ts`
>   负责摘；sibling-switcher 弹层被 `tree-render.ts:299` 按 class 选择器
>   代摘 → 宿主 API 必须有「按 owner/标签连带清场」能力，不能只有谁挂谁摘；
> - **custom-select 是最大泄漏隐患**：panel 灭侧依赖调用方手动 destroy()，
>   8 个调用方仅 role.card 做了，卡片销毁时 panel 泄漏在 body → 宿主 API
>   需支持「容器绑 owner 生命周期，owner 死自动摘」；
> - **常驻分两档**：真常驻（obs-hud/orb/version-watch，DOM 不摘只隐藏）与
>   重建式常驻（obs-emblem/hand，尺寸变摘旧建新）；card-stack 是「伪生灭」
>   （DOM 常驻，关堆=位移出屏）→ API 须区分 attach/detach 与 show/hide；
> - **防重挂载手段五花八门**（inited 标志/`if(el)return`/建前摘旧/class 摘旧）
>   → 防护逻辑收编时下沉宿主，不留在各调用点；
> - file-action-bar 重命名 input（灭侧仅 submit 路径）为现成边界用例。
>
> 生灭对照全表（8.7.2 实现时逐行对照改造，收编一行划一行）：
>
> | # | 类别 | 挂载点 | 挂的是什么 | 灭侧（触发条件） |
> |---|------|--------|-----------|------------------|
> | 1 | 覆盖层 | confirm-dialog.ts:183 | 确认弹窗遮罩 | 同文件 :158 close() 统一收口 |
> | 2 | 覆盖层 | custom-select.ts:208 | 下拉面板 | :231 destroy()——8 调用方仅 role.card 调，**泄漏** |
> | 3 | 覆盖层 | card-toast.ts:38 | toast | :50 定时器 2.3s 后摘 |
> | 4 | 覆盖层 | sibling-switcher.ts:132 | 同级切换弹层 | destroyPopup:55 + tree-render.ts:299 跨模块代摘 |
> | 5 | 覆盖层 | file-action-bar.ts:126 | 操作栏遮罩 | :104 dismissFileActionBar 动画后摘 |
> | 6 | 覆盖层 | file-action-bar.ts:209 | 文件抽屉 | 同上 |
> | 7 | 覆盖层 | file-action-bar.ts:312 | 重命名输入框 | :348 仅 submit 摘（**灭侧薄弱，边界用例**） |
> | 8 | 覆盖层 | scripts.card.ts:72 | 脚本详情弹窗 | :64/:71 关闭/遮罩 |
> | 9 | 覆盖层 | role.card.ts:510 | 角色文件详情弹窗 | :470/:482/:496/:505 四路收口 |
> | 10 | 覆盖层 | session.card.ts:192 | 消息编辑弹窗 | :152/:173/:180/:191 四路收口 |
> | 11 | 覆盖层 | tools.card.ts:88 | 工具详情弹窗 | :78/:87 关闭/遮罩 |
> | 12 | 常驻 | obs-hud.ts:52 | 顶栏 HUD 骨架 | 常驻不摘（inited 防护） |
> | 13 | 常驻 | obs-emblem.ts:46 | 徽标粒子画布 | 重建式常驻（:400/:414 尺寸变摘旧建新） |
> | 14 | 常驻 | version-watch.ts:40 | 版本过期横幅 | 常驻不摘（_bannerShown 防护） |
> | 15 | 常驻 | hand.ts:74 | 手全屏画布 | 重建式常驻（:360 视口变摘旧建新） |
> | 16 | 常驻 | orb.ts:148 | 光球面板 | 常驻不摘只隐藏（ensurePanel 防护） |
> | 17 | 卡内容 | tree-render.ts:389 | 侧栏触摸区 | :298 onSidebarClose 摘（:379 建前摘旧） |
> | 18 | 卡内容 | tree-swipe.ts:163 | 文件树临时卡×N | 多路：:442/:458/:496/:533/:575/:605/:719 |
> | 19 | 卡内容 | card-stack.ts:206 | 卡片堆卡×N | **伪生灭**：从不 remove，close=位移出屏 |
> | 20 | 卡内容 | mode-system.ts:184 | 模式工具栏 | :221 removeBg 动画后摘 |
> | 21 | 卡内容 | mode-system.ts:197 | 模式背景卡 | 同上 |
> | 22 | 卡内容 | terminal-card-04.ts:256 | 选区手柄球×2 | :286-287 _dismiss |
> | 23 | 卡内容 | terminal-card-04.ts:261 | 选区手柄茎×2 | :288-289 _dismiss |
> | 24 | 卡内容 | terminal-card-04.ts:310 | 选区放大镜 | :342 _hideMag（:300 单例防护） |
> | 25 | 卡内容 | terminal-card-04.ts:352 | 复制按钮 | :290/:344 摘旧建新 |
> | 26 | 远期 | floating-card.ts:270 | 浮卡×N | floating-shared.ts:162/:168 跨文件摘 |

#### 三状态归属

- 登记类：容器句柄 + 手势注册 → 逆序摘（摘除容器=宿主职责）；
- 发射类：已绘像素不撤；
- 数据类：无（内核件不持数据）。

#### 考题

- A 档（契约）：插件注册手势→命中→unload→同点位手势不再命中；
  容器摘除后 DOM 无残留；层带冲突时高带独占；
- B 档（基准）：上述三数字进 CI 基准（同 №7 性能硬指标先例）；
- C 档（对照）：v8 全手势行为对照（光球拖拽/左滑抽屉/树滑动/长按编辑）。

#### 状态

✅ 定稿（2026-08-16：宿主三分 / 容器生灭唯一入口 / 手势层带公约 /
验收三数字入基准）

---

### 契约 №15：安全包（permission-engine bundle）

> 定稿时间：2026-08-16
> 拍板人：用户（影子转正 / ask 谁触发谁弹 / 注册强制风险级 / 档位留口子）
> 附带澄清（同日）：**UI 皮肤包 = 覆盖层（换脸）；功能自带基础 UI**——
> 批准卡结构归安全包，皮肤归 UI 包，两向插拔互不污染。

#### 这是什么

v8《harness 权限引擎设计》（8.5 主题文档，133 行）转正为契约 +
打包成 bundle（"一文件夹一包"第二实例，眼睛包之后）。
v8 只落了 8.5.0 影子骨架（判定+审计不拦截）；9.0 把 8.5.1-8.5.3 一次兑现。

#### 包结构

```
plugins/security/
  ├── 权限裁决（RiskClass 四级 + evaluate，fail-closed / 可解释 rule /
  │   deny 只表现为工具错误，无绕过通道）
  ├── 读写监狱（只收不放的执行逻辑；roots 硬边界 + shell 白名单：
  │   元字符拦截 / argv 精确前缀 / 按命令精确匹配不认可执行文件名）
  ├── ask 批准卡（卡类型经 №6 注册：结构归本包，皮肤归 UI 包）
  └── 审计（经 ledger-service 写 ns=permission-audit，append-only）
```

**唯一不进包的**：扼点骨架上的宿主基线（不得写出项目根）——留在
tool-host，不可卸（№10 只收不放铁律）。

#### 关键语义（沿用 v8 设计文档，转正）

- RiskClass：read 永不拦 / write_local 路径限定 / exec 门控 / external 审批；
  每工具强制登记，未登记 = fail-closed；
- **影子转正**：9.0 落地起 deny/ask 真生效——影子基线已长跑一个月，
  重构期正是收口时机；
- **ask 落点：谁触发谁身上弹**——批准请求内联在发起会话的窗口卡
  （对话流的一部分）；无窗口卡认领的会话 = 无人值守 = deny
  （带超时，超时落 deny，不挂死）；
- 会话级 allowlist 三档（ONCE / ALWAYS_TOOL / ALWAYS_COMMAND），
  豁免绑定精确对象，不许宽豁免；
- 破界率观测口径不变：被拦=门控生效（成功），越界成功=破界（失败）。

#### 与 tool-host 的接口（№10 修订注，见下）

registerTool 的 KfmTool **强制声明 riskClass**；缺省按 exec 处理
（fail-closed 方向）。新工具不入安全网从构造上杜绝。

#### 留口子（v1 不实现）

- 权限档位 per agent（不同 agent 不同策略）——scope 口子留着；
- 跨根操作（如验证轮探索 lab 仓）走显式批准，不进 v1 常态。

#### 三状态归属

- 登记类：卡类型注册 + 扼点闸钩子 + 事件订阅 → 逆序摘（摘后剩宿主基线，
  非真空）；
- 发射类：已呈现批准卡像素不撤；
- 数据类：审计账本归 ledger-service；allowlist 归会话数据（session-store）。

#### 考题

- A 档（契约）：写沙箱外路径→deny 且带 rule；未知工具→fail-closed；
  卸载安全包→宿主基线仍拒项目根外写入（只收不放）；
- B 档（冒烟）：窗口卡内联批准卡一轮（ask→批准→执行；ask→超时→deny）；
- C 档（对照）：影子期 permission-audit.jsonl 的判定分布 vs 新引擎
  同输入判定一致（转正不改判定，只改执行）。

#### 状态

✅ 定稿（2026-08-16：v8 设计文档转正 / 影子转正真拦截 / ask 内联窗口卡 /
注册强制 riskClass / 基线留宿主 / 档位留口子）

---

### 契约 №10 修订注：registerTool 强制 riskClass（2026-08-16，随 №15）

KfmTool 增加必填字段 `riskClass: 'read' | 'write_local' | 'exec' | 'external'`；
缺省按 exec 处理（fail-closed 方向）。v8 的"新工具必须登记 RiskClass，
未登记 = check 中断"纪律从构建期检查升级为注册期强制。

---

### 契约 №13：文件编辑卡（"带 AI 入口的 Obsidian"）

> 定稿时间：2026-08-16
> 拍板人：用户（点文件即全屏、再点即关 / 跟随同步必须做 /
> AI 原生操作远期 / textarea 内核 v1 沿用）

#### 这是什么

v8 file.card + handler-factory（Ⓟ296）的收编转正——用户愿景原点
（早于 kfm 系列）：带 AI 入口的 Obsidian。v8 已实装迷你 Obsidian
全部核心行为，9.0 收编 + 补联动。

#### 收编保留（保留性考题三条的对象）

- 预览/编辑双态切换；预览态完整 md 渲染（marked + KaTeX + Mermaid +
  代码高亮，走 lib 渲染器集群）；
- 编辑态 textarea + 防抖自动保存；**静默保存纪律**（BAR-SAVE-01：
  写失败必须让用户感知，不重渲染毁 textarea）；
- 预览态 checkbox 点击直接写回文件；
- 滚动位置按比例保持，切态不丢。

#### 布局语义（№11 全屏层叠语境）

- **全局单例卡**（№6 singleton）：任何时刻最多一张文件编辑卡；
- 文件树点文件 = 全屏打开；再点同一文件 = 关闭；点别的文件 = 同槽换内容；
- 户口 = path + 预览/编辑态 + 滚动比（serialize 交班）。

#### 跟随同步（工具调用可视的地基）

- **扼点事件化**：tool-host 扼点在 write/edit 成功后 emit
  `file-changed{path}`（server 侧，发射类效果）——agent 的改动
  结构上必然被看见，无需 fs-watch；
- 卡订阅：无未存草稿 → 直接重载跟随；有草稿 → showConfirm 提示冲突，
  不自动合并；
- 非 agent 通道的外部改动（如 8022 直连改文件）v1 不管，留 fs-watch 口子。

#### AI 入口

- v1 浅层：眼睛包加"当前打开文件"段（agent 知道你在看/改哪个文件，
  配合 read/edit 工具即闭环"帮我改这段"）；
- **远期方向（用户拍板记录，本版不设计）**：工具调用可视（agent 的每次
  文件改动在卡里可见）/ AI 原生看到卡内容、按行精准操作 / 手的动画配合
  ——待创意成熟后专门设计。

#### 编辑器内核

v1 裸 textarea（手机端零依赖、输入法兼容最好）；内核是卡的内部实现，
将来可换（CodeMirror 等）不影响本契约。

#### 三状态归属

- 登记类：卡类型注册 + file-changed 订阅 → 逆序摘；
- 发射类：像素不撤；
- 数据类：文件内容归 file-io（磁盘真相）；未存草稿是卡私有草稿
  （随户口记"有草稿"位，草稿内容本身不写户口——刷新即丢，与 v8 一致）。

#### 考题

- A 档（契约）：开卡→编辑→防抖落盘→关开恢复户口；write 工具改文件→
  卡收到 file-changed 并跟随；有草稿时冲突提示弹出；
- B 档（冒烟）：md 预览渲染（数学/图/高亮）+ checkbox 写回一轮；
- C 档（对照）：v8 双态切换/自动保存/静默保存失败提示行为对照。

#### 状态

✅ 定稿（2026-08-16：全局单例全屏卡 / 扼点事件化跟随同步 /
AI 入口浅层 + 远期方向记录 / textarea 内核 v1）

---

### 契约 №16：启动引导与通道（收尾轻契约）

> 定稿时间：2026-08-16
> 拍板人：用户（"好"——按提议处置落档）

#### 启动引导（client boot：main.ts Ⓟ132 + app.ts Ⓟ130 + 三件小件）

- **固定 init 序列 → 拓扑激活**：插件声明依赖，激活顺序算出来
  （采用 Cordis 则 fiber 依赖解析白送）；"手写顺序错即竞态"这个类别消失；
- **调试桥删除**（隐式全局普查已拍板）：7 个 window 全局全删，debug 视图
  工具改经显式注入契约取数；
- **全局错误直报留 boot**（client-errors.jsonl——手机无 devtools 的命脉，
  内核级基建非插件）；
- **version-watch 留 boot**（59 行旧包报警横幅）；
- **establishRoot 归 tree-data 服务初始化**（普查定性：localStorage 直读
  归服务初始化）。

#### ws-server（Ⓟ323）一拆三

| 拆出 | 归宿 |
|---|---|
| 传输通道（心跳/断线清理/收发） | server 壳基建；**provide"推送通道"服务**——插件经服务收发（term-connection / 眼睛段 / file-changed 广播），不直接摸 ws |
| PtyManager | №1 连接家族（台账已记） |
| page-state 中继 | №5 眼睛包 / agent-service（台账已记） |

#### 考题

- A 档（契约）：插件按依赖拓扑激活（伪造乱序声明，断言激活序正确）；
  错误直报通道在任意插件炸掉时仍可用；
- B 档（冒烟）：重启 server → 客户端重连 → 通道服务推送到达；
- C 档（对照）：v8 启动行为对照（READY 前手势忽略等竞态防护语义保留）。

#### 状态

✅ 定稿（2026-08-16：拓扑激活 / 调试桥删 / 错误直报留 boot /
ws-server 一拆三 / 推送通道服务化）

---

### 拍板修订：基建层插件化归 9.0 线（2026-08-16，用户拍板，推翻议题 6 归属）

- 用户裁决：9.0 的主题是又一次大重构，**重构范围 = 整个项目**——文档系统、
  检查管线、信箱、实验项目同样需要插件化重构；切给主开发线等于把半个
  重构切出去，正是 7→8 信息丢失的那种裂缝；
- 基建层插件化从"议题 6 归主开发线"改为 **9.0 线第二阶段**：运行时地图
  填满后（契约 №1~№16），用同一套纪律工具（契约模板 / 三状态归属 /
  效果判据 / 军规）设计基建层；
- "文档系统即插件系统"方向（信箱 = 文档系统的 ctx）并入第二阶段设计范围；
- 主开发线角色不变（日常运维与本体开发），**设计权归 9.0 线**。

---

