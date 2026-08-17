# 隐式全局普查（9.0 步 0 补充材料）

> 这是什么：9.0 采用 Cordis 前的**隐式全局状态清单**——迁移工作量的真实下限信号
> （茉莉 2026-08-16 于 Cordis 采用讨论区提议，卡萝执行）。
> 别的去哪找：采用决策 → `../../ledger/agent-inbox/kfmv4-9.0-cordis-adoption-verdict.md`；
> 9.0 台账 → nine-point-zero.md；三状态归属表 → `./nine-zero-preface.md` 议题 3。

> 定性标准（茉莉定义）：Cordis 模型里隐式全局**每一个都必须变成显式的 ctx
> 效果/coeffect**，否则 inject 时找不到提供者。逐个定性：该成效果的成效果、
> 该删的删。

## 一、window 暴露面（赋值点 7 处，消费点 5 处）

### A 类：暴露到 window 的顶层引用（main.ts 调试桥）

| 暴露名 | 位置 | 内容 | 消费方 | 定性 |
|---|---|---|---|---|
| `__kfmDebug` | main.ts:42 | {KFMState, L, anim, cardRegistry, gestureRegistry} 调试桥对象 | browser_eval 调试 | **删**（9.0 调试工具另立契约；v1 不需要） |
| `__L` | main.ts:48 | L（logger 顶层引用） | kfmv4-views.ts:35（带 fallback `window.L`） | **删**（调试视图脚本专属；9.0 视图工具经注入契约提供） |
| `__anim` | main.ts:49 | anim（动画引用） | kfmv4-views.ts:72 | **删**（同上；动画 9.0 归动画插件包） |
| `__cardRegistry` | main.ts:50 | cardRegistry | kfmv4-views.ts:179 | **删**（9.0 经 card-types broker 枚举，broker 是服务不是 window 全局） |
| `__gestureRegistry` | main.ts:51 | gestures | kfmv4-views.ts:128 | **删**（9.0 手势分发在内核，经 ctx 服务提供） |
| `KFMState` | main.ts:53 | state.ts 单例（见 §三） | kfmv4-views.ts 调试 + 各模块 import | **成服务**（数据归数据管理器） |
| `__dismissTodoPanel` | orb-chat-hints.ts:204 | dismissTodoPanel 函数 | orb-chat-hints.ts:154 内联 onclick | **删或改**（9.0 todo 卡是工具附属 UI，事件走工具→卡通信，不需要 window 桥） |

### B 类：window 消费点（读取端）

| 位置 | 读取 | 说明 |
|---|---|---|
| src/server/ai/tools/omp/debug/kfmv4-views.ts:35/72/128/179 | `__L`/`__anim`/`__gestureRegistry`/`__cardRegistry`（均带 `window.XXX` fallback） | server 端工具注入到浏览器的调试视图脚本；9.0 若保留该工具，注入契约改为显式传参，不再蹭 window |

**注**：`window.__kfmLastCompact` 是**历史幽灵**（只有读取点没有赋值点，2026-08-16
已修，`routes/files.ts:10` / `orb-chat-run.ts:442` / `session-client.ts:49` 三处
修复注记在档）——普查确认当前已无赋值点、无残留引用。

## 二、模块级可变单例（128 处 let/var，16 文件）

### 分布

| 文件 | 单例数 | 用途 | 9.0 定性（初判） |
|---|---|---|---|
| canvas-scroll.ts | 18 | 滚动状态（位置/惯性/方向锁） | 归 tree-data 或卡私有草稿 |
| tree-swipe.ts | 17 | 滑动手势状态（挑选模式/临时堆） | 归 tree-data + 手势分发 |
| orb.ts | 17 | 光球面板状态（收展/位置/尺寸/选中会话） | 归窗口卡实例户口（№9 已定） |
| terminal-card-04.ts | 13 | 终端卡状态（会话/渲染器引用） | 归终端卡实例（№1 已定） |
| mode-system.ts | 12 | 文件树模式工具栏状态 | 归 №7 文件树卡附属（已定） |
| chat-dom.ts | 10 | 消息列表增量渲染状态 | 归对话卡渲染壳 |
| canvas-cursor.ts | 9 | 光标液体粒子状态 | 归动画插件包 |
| card-stack.ts | 7 | 卡片堆状态（开合/焦点/滚动） | 归启动器插件（№11） |
| file-action-bar.ts | 6 | 操作栏状态 | 归 №7 附属 |
| orb-chat-run.ts | 4 | run-manager 状态 | 归 agent-service（№2 附属） |
| orb-chat-hints.ts | 3 | 等待提示/待办面板状态 | 归窗口卡包数据 |
| sibling-switcher.ts | 2 | 兄弟切换 | 归布局/手势 |
| math-diagram.ts | 2 | 渲染器状态 | lib 层私有 |
| floating-card.ts | 2 | 浮卡状态 | **不迁移**（多端适配远期包） |
| version-watch.ts | 1 | 版本检测 | 归启动引导 |

### 定性三分（对应三状态归属表）

- **数据类**（归服务）：orb 面板位置/尺寸、terminal 会话、tree 展开路径、mode 状态
  ——迁入对应服务的 serialize/restore 户口；
- **私有草稿类**（随卸载蒸发）：滚动位置、惯性、动画补间、临时选中——卡/插件私有
  状态，直接搬入插件实例作用域；
- **待删类**：调试桥、window 注入、未用 fallback。

## 三、跨模块共享单例（真·隐式全局）

| 单例 | 位置 | 共享面 | 9.0 定性 |
|---|---|---|---|
| `KFMState` | state.ts:56（export const 可变对象） | 文件树/文件操作/侧栏/视图，多模块直接 import 读写 | **成服务**：`tree-data` + `file-io` 的数据层（三状态表：数据归数据管理器，落盘） |
| localStorage 直读 | state.ts:58-62（currentRoot/expandedPaths/showHidden） | 初始化即读 | 归对应服务初始化（persistence 裁决项相关） |

## 四、结论（对迁移工作量的意义）

1. **window 暴露面小而干净**：7 处赋值、5 处消费，全部有明确处置（删 6 / 成服务 1）——
   不是迁移负担，是清理清单；
2. **真·隐式全局只有 KFMState 一个**：其余 128 处是**模块内私有可变状态**，在
   Cordis 模型里属于插件私有草稿（合法存在），不需要全部"显式化"——茉莉担心的
   "每一个都必须变成显式 ctx 效果/coeffect"实际收敛为：**只有跨模块共享的那一
   小撮需要成服务**；
3. **工作量下限信号修正**：迁移主体不在"隐式全局显式化"，而在 orb.ts（17）+ 
   chat-dom（10）+ tree-swipe（17）+ canvas-scroll（18）的**模块内状态与交互逻辑
   拆分**——这些模块本来就是重卡（№1/№2/№7）的收编对象，普查结论与契约台账
   一致，无新增隐藏体量。

——卡萝 · 2026-08-16（初稿，待 9.0 线会签）

---

**9.0 线会签 · 2026-08-16**：**通过。** 结论与台账三状态归属表完全一致：
KFMState 是唯一真·隐式全局（→ tree-data/file-io 服务，数据归数据管理器）；
localStorage 直读归服务初始化；128 处模块级单例 = 插件私有草稿，不需全部
显式化——这个收敛防止了迁移工作量的高估。orb.ts 17 处归窗口卡实例户口，
与契约 №9 已定条款一致。§四-3 的修正（迁移主体在重卡模块的状态拆分，不在
隐式全局显式化）与契约台账吻合，无新增隐藏体量确认。
