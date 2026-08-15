> 这是什么：9.0 大重构的**会前酝酿记录**——正式设计开始前的方向讨论与已拍板结论。
> 别的去哪找：9.0 设计地图（后续 P0 建）→ 本文档转正后移入；理论基础 → ../experiments/dsh-na/dsh/paper/paradigm-notes.md；项目远景 → vision.md；**评审往来 → ../ledger/agent-inbox/（跨线评审信箱，评审意见与裁决状态列在此）**

# 9.0 会前酝酿

> 2026-08-15 立。状态：**酝酿中**——逐项讨论、逐项记结论；全部议题收敛后转入
> 正式设计（spec-driven 元工作流）。本文档随讨论增补，禁止删改已记结论
> （要推翻先在原文下追加"修订注"，保留决策史）。

## 背景：为什么酝酿

用户诉求（2026-08-15）：
1. 现有功能很多做了几乎不用，有些常用功能却没有专门入口——以前不知道真正
   需要什么，现在在使用中渐渐清晰；
2. 9.0 要按论文《A Programming Paradigm for Spatiotemporal Composability》的
   模式彻底组件化（一切皆插件）；
3. 设计要细到"每个插件的入口出口、上下文管线、依赖、提供、插拔方法"都写清，
   设计粒度细到实现可以外包；
4. 推进模式：一点一点讨论，写一点、做测试、论证审核复查审计、再推进
   （spec-driven 元工作流，docs/guides/spec-driven.md）。

用户描述的 9.0 愿景（2026-08-15 原话整理）：

```
【中央面板】终端卡 / tmux 窗口管理器（跑命令、开 agent）+ 光球面板/输入栏（组件）
            + 顶栏（开 tmux 窗口用的 UI）
【卡片】    文件树卡（重新设计：轻量/性能好/流畅，一切皆卡片）
            池卡（配置统一：role/api/config/paradigm/scripts/session/tools 等卡
                  用 tmux 标签切换路由到同一窗口）
            卡片堆（工作台）；日志卡几乎没用过（占位，无统一样式）→ 移除/合并
【未完体系】徽标（obs-emblem）+ 手（hand）——趁 9.0 组件化
【底座】    ctx 基座（论文五机制）+ 渲染底座（边界见议题 1）
```

## 已拍板结论

### 议题 1：渲染底座是内核还是插件？（2026-08-15 拍板）

**结论：不整体插件化，分层——「能画东西」在内核，「怎么布局」是插件。**

| 层 | 归属 | 内容 | 理由 |
|----|------|------|------|
| 渲染宿主 | **内核** | DOM 容器、事件总线、最薄生命周期（"有一块画布"） | 性能热路径不被间接化；启动不需等布局插件 |
| 布局引擎 | **插件** | 浮卡工作台、tmux 窗口管理器、标签页、手机单列、headless | 收益最大点：换布局=换插件；headless=AI 无头自测 |
| 动画/手势 | **半插件** | 动画引擎可替换（GSAP 是一种实现）；手势分发在内核 | 手势决定"输入如何进组件"，是基座；动画是策略 |

**依据**（讨论要点存档）：
- 收益：布局可替换（tmux 管理器=布局插件）；无头运行（AI 自更新可自测）；
  动画/手势策略可换；与论文彻底对齐（渲染=效果、渲染依赖=coeffect）。
- 代价：接口稳定性压力陡增（渲染接口是所有组件地基）；热路径性能（kfmv4
  热路径是 UI 渲染，与 dsh 的工具调用不同）；性能契约履约难度（60fps 保证
  要从代码内聚改为接口契约）；启动链路变长。
- 对齐：论文 §6.2 服务多路复用（渲染底座=broker，布局插件=提供者）；
  dsh 结构（基座只留 ctx，渲染形态由 bundle 决定）。

### 议题 3：状态与持久化放哪（2026-08-15 拍板）

**结论：三状态归属表——登记类逆序摘、发射类不撤、数据归数据管理器（服务）。**

| 类型 | 例子 | 归谁 | 卸载时 |
|------|------|------|--------|
| 登记类（=获取类） | 订阅、手势、服务注册 | 插件挂到基座 | **逆序摘干净**（契约考题） |
| 发射类 | 像素、网络请求、终端字节 | 扔出去收不回 | 不承诺撤销，摘容器即完 |
| 数据 | 会话、配置、池条目 | 数据管理器（服务） | 与插件无关，毫发无损 |

- **插件只持私有草稿**（滚动位置、在途动画——别的插件不关心、卸载没人
  心疼的），草稿随卸载蒸发；共享的、活得比插件久的、要落盘的状态全归
  服务层（= NA 规格书 §4.1 状态存活规则的 web 表述）；
- **发射类边界**（用户拍板）：像素 = 发射类，卸载 = 摘 DOM 容器，不承诺
  "恢复屏幕原样"；回滚承诺只覆盖登记/获取类；
- **哲学对应**（茉莉指出）：本表是宪法第四条「真相源/投影分离」在插件层
  的展开——数据是真相源归服务，投影（像素/订阅）随插件生灭。每个插件
  契约须显式标注自己属于哪一类。

### 原则：服务即插件（2026-08-15 拍板）

系统里只有内核 ctx 不可插拔；**服务与卡片同为插件，仅 provide 内容不同**
（卡 provide 界面能力，服务 provide 数据能力）。服务插件卸载须满足：
relied 守卫（有依赖者禁卸）+ serialize 交班（热替换，复用契约 №1 渲染器
serialize/restore 模式）或账本在盘（真卸载）。内存里重建不起来的状态
不许存在。

### 契约模板：对齐 NA 规格书 §8（2026-08-15 拍板；评审高 1/高 2 + 茉莉增补）

每份插件/组件契约九字段：身份 / 提供（标注注册表式 vs 有序链）/ 依赖 /
生命周期语义 / 配置 schema / 事件（**逐事件标注派发模式**）/ 状态存活 /
契约测试清单 / 实拍判卷点。

kfmv4 本地增补与定调：

- **apply/unload 两栏不得缺栏**（茉莉）：apply 注册清单 + unload 逆序
  回滚清单；「无效果注册」是合法答案，缺栏非法——从结构上堵「忘回滚」；
- **卸载三相**（对齐 §4.3）：停供 → 依赖者排空 → LIFO disposers；
  dispose take-once（二次调用报错，契约测试强制）；
- **卸载判据 = 观察等价**（对齐 §5）：卸载后经由 ctx 可观察行为与加载前
  不可区分；断言范围只含登记/获取类；
- **事件派发集 v1**（与 NA v1.1 同步基座同构）：emit（同步观察）/
  serial+bail 合一（同步顺序短路）/ waterfall（委托链）；parallel 缓建。

### 9.0 验收哲学（2026-08-15，茉莉原话，用户确认）

> 验收标准不是"多少东西可插拔"，而是**"不用的东西能不能干净地消失，
> 需要的东西能不能随时召唤"**。

### 组件化试点顺序（2026-08-15，茉莉提名，用户确认）

先拿小而干净的三块把「契约 + 考题 + 卸载三相」机制跑通：**眼睛
（viewport-visibility 只读坐标）/ 手（hand-geometry 纯函数）/ 卡片注册表
（register 已有、unregister 待补）**；机制跑通后再攻重卡（终端/对话/池卡）。

### 使用中清晰的需求（随手记区）

一句话一条，使用中清晰了就记：

- 日志卡几乎没用过（占位，无统一样式）→ 移除；
- 范式包取消（见 №3 修订注）；
- （茉莉补：中央面板九格删除、徽标调小、手加用户拖动——都是"使用中才
  清晰"的需求，当时若随手记会少走弯路。）

## 待讨论议题

2. **组件间怎么联动**（ctx 服务 + 事件总线）——每张卡的入口/出口/依赖/
   提供（进行中，组件契约逐个定稿中）
3. ~~状态与持久化放哪~~ → **已拍板（2026-08-15，见上「议题 3」）**
4. ~~布局插件接口~~ → **已拍板（2026-08-15，见下「议题 1 下钻」）**
5. **termview-wasm 可行性**（远期探索；评审高 3 + 茉莉裁决 3：不进 9.0
   验收承诺。硬障碍：softbuffer Android 专属 / 浏览器事件循环 vs winit）
6. **多 agent 协作基建**（评审送审 5 条，2026-08-15 收进，见
   `../ledger/agent-inbox/kfmv4-inbox-mechanism-response.md` §五）：
   ① 通用化立项（agent-inbox 升通用多 agent 信箱？）② 状态停滞检查
   （`check-agent-inbox-stale.mjs` 草案，阈值 7 天？）③ 契约头四字段
   机读 schema（provides/depends/status/修订规则）④ 回执契约（四类信件
   谁回/回什么/多久回）⑤ 结晶回路（裁决→契约迁移路径）。茉莉主张：
   全部立项但「薄而硬」——先做 ⑤结晶回路（战略）+ ②停滞检查（活性）
   +「已收到」档（缺口），①③④作为定义先行。9.0 上下文里与
   「文档系统即插件系统」直接相关（评审观察 6：重写 kfmv4 前先在自己
   的协作基建上跑通契约+登记+事件+评审 = 9.0 第一份活考题）

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

### 组件契约 №3：池卡（骨架待讨论）

脱胎于卡片堆各池卡（role/api/config/scripts/session/tools）。定位为
**池系统的唯一管理 UI**：复用 tmux 标签切换把各池路由到同一窗口；每标签渲染
一类条目，做编辑、引用关系查看（"这个 model 被哪几个 agent 用着"）、组合装配
（搭"茉莉-kfmv4" = 选 prompt + model + 工作区）。依赖池系统服务，不碰对话卡。

> 修订注（2026-08-15 用户拍板）：**范式包（paradigm）取消**——v8 实验产物，
> 现在没有实际作用，遥远未来若需要再议。迁移含义：AgentConfig 的
> `paradigmFile` 字段废弃，`.kfmv4/agents/paradigms/` 不迁入 9.0，池卡不设
> paradigm 标签。

状态：🔄 骨架（讨论中）
