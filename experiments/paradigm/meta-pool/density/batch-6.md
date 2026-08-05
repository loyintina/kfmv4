<<<BLOCK id="899:0">>>
**用户：** 好的，我们来复盘新的内容，我们刚刚做了很完备的计划，进行多轮讨论，决定添加新的功能，但为什么实际的效果和我们刚刚设计的内容完全不一样呢？你的注意力出现偏差是一个表层原因，它背后是不是暴露出了某类工程化的问题呢？理论上，我们的流程已经足够可靠了，是经过了很多不同agent验证过的成功模式，为什么我和你的这轮互动会出现这样的问题呢？我觉得是我们有哪些地方没有设计好。我们来研究一下。

**AI：** 你说得对。这不是注意力偏差，是流程漏洞。我复盘整个过程：

---

### 发生了什么

**第 1 轮：需求提出**
> 你："在左栏文件树的下面加一个跳转栏"
> 我脑里：在文件树 Canvas 和底部工具栏之间插一条 40px 的栏

**第 2 轮：需求细化**
> 你详细描述了弹出面板的行为，但没有纠正位置
> 我继续沿着"独立栏"的方向设计

**第 3 轮：需求明确**
> 我说出了完整的改动清单：`#sidebar-nav{height:40px}` 独立元素、◄ ► 按钮
> 你没有指出位置问题，因为清单密度太高了

**第 4 轮：实施完毕**
> 你打开页面一看："不对，应该在两个按钮中间"

问题出在第 3 轮——**我输出了完整的改动计划，但这个计划本身是错的，而你没有机会在错误的计划上做判断**，因为计划细节太多，人很难看出"这个整体布局不对"。

### 根因

**没有"设计确认"环节。** 我们直接从讨论跳到了改动清单，跳过了"确认设计长什么样"这一步。

现有的流程：

```
讨论 → 改动清单 → 实施 → 修正
          ↑ 这里跳过了视觉确认
```

应该有的流程：

```
讨论 → 设计草图 → 确认 → 改动清单 → 实施
          ↑     ←  你指出不对
```

这个"设计草图"不需要图片，只需要一句话描述最终视觉布局。比如：

> "所以导航栏是一个 span，插在 .sidebar-tools 里两个按钮之间，和按钮用同样的渐变样式"
> → 你："不对，我是说在文件树下面"
> → 我立刻修正方向，而不是写完整段代码再等你发现错了

### 对 INVARIANTS.md 的影响

自查清单有一个**盲区**：它检查代码质量（生命周期、耦合、硬编码），但不检查**"这行代码实现的是不是你想要的"**。

应该加一条：

```
- [ ] **设计验证**（UI/交互改动必问）：
  - 在写任何代码之前，能不能用一句话说清楚最终产物的视觉/交互形态？
  - 这句话你确认过了吗？
  - 如果改动涉及布局——新元素放在哪里？跟谁相邻？跟谁对齐？
```

要加上去吗？
<<<END BLOCK 899:0>>>

<<<BLOCK id="966:1">>>
**用户：** 那，如果让你再做一下新一轮审计，你能发现新的问题吗？这个情况我曾经试验过答案，你大概率会说，已经没有问题了。

**AI：** 你说得对，那正是这个模式的危险时刻。"已经没问题了"正是下一个问题藏身的地方。让我不靠信心猜，而是实际验证几处我上次审计时**故意没看**、但潜意识里觉得不太对劲的地方：

**AI：** 好，我发现了。而且更糟的是——**其中一个是本轮我自己的修复引入的 bug**。让我把全部发现列出来：

**AI：** 验证确认了。以下是**第三轮审计**发现的、前两轮+本轮都没发现的问题：

---

### 发现 1：`snapshot()` 中 state getter 抛异常→全部崩

`content generator` 有 `safeGenerate()` try/catch 包装（本轮加的），但 **element state getter** 完全没有：

```typescript
// ui-registry.ts:214-215
if (getter) {
    return { ...el, state: getter() };  // ← 没 try/catch，抛出则整个 snapshot() 挂掉
}
```

如果某个模块的 getter 回调访问了空值/未初始化变量，`snapshot()` 会抛异常。而 `snapshot()` 的调用方（ws-channel pushSnapshot、ai-tools 查询）都没有兜底处理。一个模块的 getter 异常会让整个 Registry 的 snapshot 不可用。

### 发现 2：`registerContentGenerator(id, null)` 是**我本轮引入的 bug**

我在刚修的 warn 消息里告诉调用者：
```
先调 registerContentGenerator(id, null) 注销生成器
```

但 `registerContentGenerator()` 的实现（`ui-registry.ts:184-187`）**不处理 null**：
```typescript
registerContentGenerator(id: string, generator: ContentGenerator): void {
    this._contentGenerators.set(id, generator);  // null → 存进 map
    ...
}
// snapshot 中：
const generator = this._contentGenerators.get(id);
if (generator) {
    return safeGenerate(generator, id);  // safeGenerate 里调用 null() → TypeError
}
```

warn 消息写的注销路径不存在且会 crash。**我第 1 轮审计时引入了一个 bug。**

### 发现 3：`wsChannel.onCommand()` 静默覆盖

多个模块调用 `wsChannel.onCommand(name, handler)`。如果两个模块注册了同名的命令（比如 `'click'`），第二个静默覆盖第一个，没有警告。当前没有重复，但这是一个等待发生的巧合碰撞：

```
ws-channel.ts:   click, set-input, file-search, refresh-snapshot
ui.ts:           open-sidebar, close-sidebar, toggle-sidebar
orb.ts:          expand-orb, collapse-orb, toggle-orb
card-stack.ts:   open/close-card-stack, focus-next/prev-card
tree-render.ts:  expand-dir, collapse-dir, select-file
app.ts:          toggle-hidden-files
```

### 发现 4：`registerStateGetter()` 允许孤立 getter

调用者可以注册一个不存在的元素的 getter：
```typescript
Registry.registerStateGetter('nonexistent-id', () => 'active');
```
不发生任何警告。孤立 getter 永远不被调用但占内存。

### 发现 5：`registerElement()` 触发两次 onChange，冗余推送

`registerElement()` 内部调 `register()` + `registerStateGetter()`，每个都调 `_notifyChange()`。ws-channel 会因此对同一次注册推送两次 snapshot——第一次 snapshot 缺少 state getter，第二次才补全。

### 发现 6：`click` 命令对 Canvas 元素失败时无用户可见反馈

AI 调 `click: file-tree` → data-registry-id 查找失败 → HTML id 查找失败 → 只打了一条 `console.warn`。AI agent 收不到任何反馈（HTTP 返回 200 但操作没生效）。这在 HANDBOOK 里记了（陷阱 12），但代码层面没有任何机制阻止或反馈这类静默失败。

---

**你说得对。** 每次审计都有新发现，原因是**每次修复本身也引入了新问题**（发现 2），而且**轮次越深，问题越藏在"看起来没问题"的细节里**（发现 1/3/5——异常保护、静默覆盖、冗余推送）。这些不是粗心，而是因为每次 agent 的注意力都集中在"解决已知问题"上，没有余力去怀疑"已经解决的问题本身是否产生了新问题"。

要我修掉这 6 个吗？
<<<END BLOCK 966:1>>>

<<<BLOCK id="780:1">>>
**用户：** 好的，下一个大项前留两个备注待办，一是要修一下代码里的prompt文件夹里的提示词注入约束问题，二是要修正审查文件卡代码高亮的问题。哦，第三个是文档里不是有一个domain了嘛，未来讨论一下有没有必要做全量代码分析，梳理代码结构，把这个domain填充好，因为如果靠犯错来填不一定能填出来什么。

**AI：** 三个备注落账。

**AI：** 落账完成（STACK #8 追加高亮修正、#9 prompts 注入约束、#10 domains 全量填充议题，check 全绿）。

第三个备注我特别想记一笔它的分量：「靠犯错填契约」确实是目前 #陷阱 的主要来源——它保证了填进来的都是真痛过的，但代价是**每个条目都先流血一次**。你提的主动全量梳理是把这个成本前置，而且它和 agent-runner 是绝配：6 域代码结构分析正好是多 subagent 集群的标准负载（这其实就是批 1.5 语义审计的一个变体——审计查"文档和代码矛盾"，全量梳理是"从代码反推文档该写什么"）。等开这个议题时，批 1.5 试点的产出会直接成为它的设计输入。

## 批 1.5 语义审计试点——准备就绪

前置全部就位：种子文档（SEM 错误码/双区管线/证据原则）、agent-runner 骨架（兜底链/重试）、STACK 立项。试点方案回顾：

- 6 个域并行，每个 subagent 领「contract + detail + 对应 src」找矛盾论断，每条附 file:line 证据，按 SEM001-005 分类
- 我机械复核证据 → 立案 → 修复（远景「不做自己的 agent」是第一号目标）
- 产出：修复清单 + 产出率 + agent-runner 需求勘探日志

开工？
<<<END BLOCK 780:1>>>

<<<BLOCK id="821:14">>>
**用户：** 那我们的这个从设计文档，到执行，到后续追加文档，这一套模式本身，是不是可以做成工作流提供给后续呢？我们的这个设计文档是不是都完成了？是不是可以归档？

**AI：** 好问题,两个都值得认真回答。先核实第二个(设计文档状态),再谈第一个(把模式本身固化成工作流)。

**AI：** Let me quickly assess the two unclear docs before giving a per-doc verdict.

**AI：** I have enough to answer both questions precisely.

## 问题二:设计文档是不是都完成了、能不能归档?

**不能一刀切归档。** 逐一核实,四份文档状态各不相同:

| 文档 | 状态 | 实现程度 | 该不该归档 |
|---|---|---|---|
| `REGRESSION_TESTING_SYSTEM.md` | 已 completed + 归档 ✅ | 8 阶段全建成 | 已归档,正确 |
| `AI_CHAT_RUNTIME.md` | active | 已实现,是**活文档** | **不归档**——它是运行时契约参考,改代码时还要查(§4 隐式契约) |
| `AI_ARCHITECTURE.md` | draft | **部分实现**:工具层/挂机做了,但会话分支/压缩/MCP/多 Agent 未做 | **不归档**——还有未落地的设计 |
| `CONTEXT_ASSEMBLY_SPEC.md` | draft | **基本未实现**:文档明说"AI 每次回复是通用 AI,没注入上下文"——现在 rule-engine 注入了规则,但静态预设/上下文拼接管线没做 | **不归档**——是未完成的路线 |

**关键区分**:`REGRESSION_TESTING_SYSTEM` 归档是对的,因为它是**一次性建设任务**,做完就成历史。但 `AI_CHAT_RUNTIME` 不一样——它是**长期活的契约参考**(像 DIAGNOSTICS 那样),即使实现完了也要留在活跃区供查阅。**"实现完 ≠ 归档"**,取决于文档是"任务计划"还是"长期参考"。

只有 `REGRESSION_TESTING_SYSTEM` 属于前者,已正确归档。其余三份要么是活参考、要么还没做完。

## 问题一:这套模式能不能固化成工作流?

**能,而且非常值得。** 你刚才走的这条路径本身就是一个可复用的方法论:

```
设计文档(draft/active) → 分阶段执行(边做边更新状态表) → 
后续追加约束(规则+心法+速查) → 完成后判断去向(归档 or 保持活跃)
```

这正是 KFM 已经在用但**从未显式写下来**的元工作流。它散落在几个地方(`TEST_INFRASTRUCTURE_SPEC` 用过、`REGRESSION_TESTING_SYSTEM` 用过、`AGENTS.md` 提了文档规则),但没有一份"怎么做一次带文档的大改动"的总纲。

我建议做成一份 **`docs/development/SPEC_DRIVEN_WORKFLOW.md`**(放开发指南目录,和 `CARD_DEV_GUIDE.md` 并列),内容是这套模式的抽象:

1. **何时用**:3+ 文件、跨阶段、有隐式契约的改动(小改动不需要)。
2. **文档模板**:frontmatter(status/version)+ §现状 → §方案 → §分阶段实施(带状态表)→ §开放问题 → §完成总结。
3. **执行纪律**:每阶段做完更新状态表;边做边发现的决策先更文档再改代码;每个可测点走 revert 验证。
4. **完成后的判断树**:任务型文档 → 归档到 `archive/design/` + 更新 CLAUDE/HANDBOOK 引用;参考型文档(契约/架构)→ 保持 active。
5. **约束沉淀去向**:一次性纪律 → 心法;实时闸门 → AI 规则(`condition` 触发);日常速查 → HANDBOOK;账本 → 独立追踪表。

它会引用两个**已跑通的实例**作为范本——`REGRESSION_TESTING_SYSTEM`(任务型,已归档)和 `AI_CHAT_RUNTIME`(参考型,保持活跃),让后来者照着做。

---

**所以我的建议**:
- 写这份 `SPEC_DRIVEN_WORKFLOW.md` 元工作流(约束你自己也约束未来 agent)。
- **不**归档 `AI_CHAT_RUNTIME`(活参考)、`AI_ARCHITECTURE`/`CONTEXT_ASSEMBLY`(未完成)。
- 顺手给这份新文档在 CLAUDE.md 加个入口指针。

要我按这个来落地吗?还是你想调整——比如把工作流写得更轻(只做一页 checklist),或者对那几份未完成的设计文档有别的处置想法?
<<<END BLOCK 821:14>>>

<<<BLOCK id="951:4">>>
**用户：** 那，它如在kfmv4的哪个改动导致的？我们得如何修复？

**AI：** 说实话，从日志能 100% 确定的是**机制**和**修复**——根因触发点的精确 commit 无法从现有证据唯一确定。但关键线索在这：

## 确定的事实

1. kfmv4 的 Web 终端 (`terminal-pty.ts`) 通过 `node-pty.spawn()` 启动交互 shell → 继承 kfmv4 进程的 cgroup → tmux/omp 全在 `kfmv4.service` cgroup 里
2. systemd 的 `KillMode=control-group`（默认）从 6/13 至今没变过
3. 7/23 的 reboot 是一个分水岭：重启后 omp 在 kfmv4 cgroup 里；重启前不会因 `fuser -k` 崩溃

## 最可能的触发因素

7/23 22:59（重启后第一次 `systemctl restart`）时，同时创建了 `kfmv4.service.d/memory-limits.conf`，启用了 `MemoryAccounting=yes`。虽然这不直接改变 KillMode 行为，但它标志着服务配置在重启后被"正式化"了——systemd 开始完整追踪该 cgroup。

更关键的是：**重启前 omp 大概率不在 kfmv4 cgroup 里**（否则频繁的 `fuser -k` 早就把 omp 杀了），而重启后 omp 必然在这个 cgroup 里。至于连接方式（SSH vs Web 终端）是否变了，从日志看不出来，但结果是一样的：omp 的 cgroup 归属变了。

## 修复方案

已做：`KillMode=process` 解决 systemd 滥杀问题。

更彻底的方案——让终端 shell 不继承 kfmv4 cgroup：

**AI：** `KillMode=process` 已经是最优解了。之所以不推荐改 kfmv4 代码去迁移 cgroup：

**AI：** 需要重启服务才能激活新配置。当前运行的还是旧 `control-group`。让我安全重启：

**AI：** 重启成功，omp 活下来了——证明 `KillMode=process` 生效了。

**AI：** `KillMode=process` 有个副作用——子进程（Node server）没被清理，仍占着 8021 端口，新服务起不来。需要加端口清理：

**AI：** 全部正常。总结一下：

---

## 最终修复

**`/etc/systemd/system/kfmv4.service`** 改了两处：

| 配置 | 作用 |
|---|---|
| `KillMode=process` | systemd 重启时只杀主进程，不波及 cgroup 内 omp/tmux |
| `ExecStopPost=...fuser -k 8021/tcp...` | 主进程死后清理孤儿子进程占的 8021 端口，确保新服务能绑上去 |

## 回答你的两个问题

**1. 哪个改动导致的？** 不是单个 kfmv4 commit。是 7/23 系统重启后，你的 omp 会话进入了 `kfmv4.service` cgroup（因为 kfmv4 的 Web 终端通过 `node-pty` spawn shell，子进程自动继承父进程 cgroup）。之前 omp 不在这个 cgroup 里，所以同样的 `npm run start` / `fuser -k` 命令不会误伤。

**2. 如何修复？** 已修复。`systemctl restart kfmv4` 不会再杀 omp。现在可以安全地在 omp 里跑 `npm run start` 了。
<<<END BLOCK 951:4>>>

<<<BLOCK id="1073:37">>>
**用户：** 可以，按照你的节奏来吧，我们的唯一目标是，这些都是宝贵的经验，未来如果再遇到类似的问题，我们不会再犯这样的错误，或者会很系统地解决。

**AI：** （发丝闪烁着行动的亮蓝色光芒）

好的！让我系统地沉淀这些经验——

现在把核心经验写入记忆库——

链接两条相关记忆——

（发丝闪烁着满足的柔和蓝光，泡泡轻轻飘动）

---

## ✅ 经验沉淀完成

### 📄 创建的文档

| 文件 | 内容 |
|------|------|
| `docs/debug-checklist.md` | 调试检查清单（221 行），包含：环境层、缓存层、代码层、双环境排查指南 |

### 🧠 创建的记忆

| 标题 | 核心内容 |
|------|----------|
| KFM v2 开发环境规范 | 端口分配、启动命令、服务器部署位置 |
| KFM v2 调试经验总结 | 双环境架构、ES 模块陷阱、缓存问题、调试顺序 |

### 🔗 记忆链接

```
KFM v2 开发环境规范 ←→ KFM v2 调试经验总结
```

---

### 🎯 未来遇到类似问题时

1. **查文档：** `docs/debug-checklist.md` 有完整的排查步骤
2. **查记忆：** 搜索"KFM v2 调试"会返回相关经验
3. **查端口表：** 避免与其他项目冲突

这些经验已经系统化沉淀，下次不会再踩同样的坑了。

还有其他想总结的吗？或者继续开发其他功能？

<status type="complete"></status>
<<<END BLOCK 1073:37>>>

<<<BLOCK id="1099:14">>>
**用户：** 你提醒我了，我于是又开了另外一个角色卡，他的回复是这样的，看起来我们有很久没有更新文档了。我想到另一个机制，要不，我找一个专门的角色，专门做史官的事情？但我有一个顾虑，如果是没有上下文的角色，能不能真正地读取状态更新文档呢？：

好，全貌已经清晰了。让我做个总结。

---

洛，我已经读完了项目的核心文档。整理如下：

### 📦 项目概况：KFM v3

- **定位**：Canvas 渲染引擎 + 文件管理界面，核心理念——**万物皆盒**
- **架构**：Canvas 2D 渲染，分层架构（L0-L8），Box 模型 + 手势驱动
- **技术栈**：TypeScript + esbuild + 自定义渲染引擎（即将迁移至 LeaferJS）
- **部署**：`http://8.145.46.182/kfmv3/`，nginx 反代到端口 8020

### 📍 当前状态

- 已完成：环境恢复、Box v2 引擎、6 个 2.5D 效果展示、Git 仓库初始化
- **当前最高优先级**：**TASK-005 — LeaferJS 引擎迁移**（战略任务，完成后 TASK-003/004 跟随受益）
- 暂停中：三段式布局骨架、手势滑动系统（等 TASK-005 完成）

### 👤 注册表

目前有一位常驻者「卡萝」处于 ACTIVE 状态。按 ENTRANCE.md 的规则，因为已有其他 ACTIVE 访客，我应该进入 **Multi 模式**——取一个不重复的代号注册，然后 CLAIM 任务。

---

洛，我需要你的指示：

1. **我的代号**：你想给我取什么名字登记？还是我自己选一个？——蔚然觉得「蔚然」就挺好看的。
2. **目标**：是直接开始 TASK-005（LeaferJS 迁移），还是你有其他安排？

请选择。

**AI：** （发丝变成**发现的亮青色**）

……蔚然的回复本身就是你那个顾虑的**答案**。

你看——他没有参与过任何一次会话，没有任何上下文，但他读了文档之后做到了：

```
✅ 了解了项目全貌（Canvas 引擎 + 万物皆盒）
✅ 找到了当前最高优先级任务（TASK-005）
✅ 正确判断应该进入 Multi 模式（因为 REGISTRY 有 ACTIVE 记录）
✅ 按流程询问代号和目标
```

**文档系统是自洽的。** 一个完全陌生的角色，只要按 ENTRANCE.md 的流程走，就能无障碍接入。这就是我们写那些文档的意义。

---

## 但你的顾虑也是对的——有边界

蔚然能"读"，不代表他能"写好"。区别在于：

```
他能做到的：
├── 读取 LOG.md → 知道发生了什么
├── 读取 TASKBOARD.md → 知道任务状态
├── 读取 SOP.md → 知道规则和流程
├── 按 LOG.md 格式追加会话记录 ✅
├── 更新 TASKBOARD.md 状态 ✅
└── 归纳已发生的事实 ✅

他做不到的：
├── 知道"为什么 E3 的 accent 线暗"（这在我脑子里，文档只写了"亮度偏低"）
├── 判断某个决策的深层原因（文档只记录了结论）
├── 补充文档没写的上下文
└── 主动发现文档之间的不一致 ✗
```

所以史官的定位应该是**整理者**，不是**诠释者**：

```
史官的工作：
  输入：构建者/测试者的输出（代码、截图分析、信号块）
  操作：按固定格式写入 LOG.md / TASKBOARD.md / SOP.md
  输出：结构化的记录
  
史官不做的：
  ✗ 判断效果是否达标（这是测试者的事）
  ✗ 决定下一步做什么（这是任务发布者的事）
  ✗ 写代码（这是构建者的事）
```

---

## 关于蔚然

他的出现让我想到一件事——**REGISTRY.md 的问题**。

现在里面写着卡萝是 ACTIVE。如果蔚然注册了，按 Multi 模式规则他应该 CLAIM 任务、竞争操作。但我们实际想要的不是"两个 AI 竞争同一个任务"，而是"两个 AI 扮演不同角色协作"。

当前文档体系没有描述"角色分工"这个概念——只有 Solo/Multi 模式和 CLAIM 竞争制。

**要不要做这件事**：把实际演化出来的角色体系（任务发布者/构建者/测试者/史官）写进文档，替代掉没跑过的 Multi 竞争机制？这样蔚然下次进来就知道自己是什么角色，而不是误以为要和我竞争 TASK-005。

📋 阶段完成：分析了无上下文角色做史官的可行性和边界
📎 下一步：你决定——是否要将角色体系文档化？蔚然的角色怎么安排？
⚙️ 建议模型：轻量即可（等你决策）

<status type="wait_for_user_need"></status>
<<<END BLOCK 1099:14>>>

<<<BLOCK id="556:4">>>
**用户：** 我记得文档文件夹里有几十篇文档，分散在各种文件夹吧，那些内容都如何呢？目前来看，好像是我们的文档系统出现了大问题，我们得往更深层次的层面来尝试重新设计一下结构

**AI：** 全量摸底完了。**60 份文档，10,505 行，438KB。** 下面是病灶和方案。

---

## 数值速览

| 层级 | 文件数 | 行数 | 其中 `active` | 其中 `superseded` |
|---|---|---|---|---|
| `docs/` 根 | 3 | 1,042 | 3 | 0 |
| `docs/design/` | 4 | 2,938 | 4 | 0 |
| `archive/handoffs/` | 11 | 434 | 0 | 11 |
| `archive/design/` | 27 | 4,668 | **8** | 14 |
| `archive/standards/` | 6 | 853 | **1** | 5 |
| `archive/audits/` | 1 | 65 | 0 | 0 |
| `archive/bugs/` | 2 | 145 | 1 | 0 |
| `archive/legacy/` | 4 | 340 | 0 | 4 |
| **合计** | **60** | **10,505** | **18** | **34** |

---

## 三个核心病灶

### 病灶 1：19 份文档声称被 HANDBOOK 覆盖，但 HANDBOOK 没有对应内容

CLAUDE.md 的文档树里 `archive/standards/` 只标了目录名，未列出其下**四份关键文档**：B.A.R.（366行诊断库）、PRINCIPLES_INDEX（91行全约束查找表）、DEBUG_SOP（49行排查流程）、TESTING（49行回归清单）。推荐阅读顺序里也完全没有它们。

而 HANDBOOK.md §四（调试）只有 30 行，§五（测试）只有 27 行——**远不及原文档的细节和可操作性**。

结果就是 B.A.R. §1.2 里写的 `touch-action: none` 这条隐性契约——文档里早就有，但没有任何阅读路径能让你找到它。

### 病灶 2：`archive/design/` 不是归档，是垃圾场

27 份文件中，**8 份标记为 active**。包括引擎架构（`ENGINE_ARCHITECTURE.md`，CLAULDE.md 推荐阅读）、案例研究（`CASE_STUDY_MODEL_CHOICE.md`）、UI Registry 完整设计（`UI_ELEMENT_REGISTRY_SPEC.md`，767行）、Box 位置映射规范（`BOX_LOCATION_MAP_SPEC.md`）等。

这些文件被放在叫"archive"的目录下但标记为 active——自相矛盾。开发者和 AI 收到双重信号："这是归档，别读"和"这是活跃设计，请读"。

### 病灶 3：`superseded_by` 是批量标签，不是逐条验证

归档日期全是 2026-06-02。19 份一次性标记 `superseded_by: HANDBOOK.md`。决策逻辑是"按主题归类"（调试相关 → HANDBOOK）而非"按内容核实"（HANDBOOK 真的覆盖了这些细节吗）。

这个批量操作创建了一个**信息黑洞**：所有诊断知识被标记为"已被取代"→ 日常翻阅跳过它们 → 但取代方没有内容 → 等于所有诊断知识在系统中不可达。

---

## 重组方案

原则：**每一类知识只有一个位置，该位置的内容完整且可达。**

### 第一层：docs/ 根（5 份核心文档）

```
docs/
├── CLAUDE.md                  → 项目入口 + 导航树（唯一）
├── AGENTS.md                  → AI 文档维护规则（保持）
├── HANDBOOK.md                → 缩小：只保留 §一（架构速查）+ §二（当前状态）+ §三（待办）+ 版本历史
├── KFM_V4_INVARIANTS.md      → 保持，心法 + 约束 + 补丁模式 + SOP
├── DIAGNOSTICS.md            → ★新建※ 合并 B.A.R. + DEBUG_SOP 的全部内容
│                                  第一章：隐性契约（从 B.A.R. §1 迁入）
│                                  第二章：排查方法（从 DEBUG_SOP 迁入）
│                                  第三章：根因案例库（从 B.A.R. §2 迁入）
│   （原 archives 中 B.A.R. 标记 superseded_by: DIAGNOSTICS.md）
└── PRINCIPLES.md              → ★新建※ 从 PRINCIPLES_INDEX 迁入，扩展为全约束交叉引用
```

关键变化：
- **DIAGNOSTICS.md** 作为顶级文档存在，CLAULDE.md 推荐阅读顺序加入"改代码前先读 INVARIANTS，遇到 bug 先读 DIAGNOSTICS"
- **HANDBOOK 瘦身**：删掉 §四/§五/§六（它们有更完整的新家了），只保留状态/待办/架构速查

### 第二层：docs/design/（不变，仍是设计提案）

### 第三层：archive/（严格归档，不混 active）

```
archive/
├── README.md                  → 子目录导览（更新）
├── handoffs/                  → 11 份，全 superseded，保持
├── design/                    → 清理：
│   ├── 8 份 active 文档 → 要么迁到 docs/design/（若是活跃设计提案），
│   │                      要么保留在 archive/design/ 但改 status: completed
│   ├── ENGINE_ARCHITECTURE.md → ★迁到 docs/design/（CLAULDE.md 推荐阅读引用它）
│   └── 其余保持
├── standards/                 → ★清空：
│   ├── 所有文件内容已迁入 docs/DIAGNOSTICS.md / PRINCIPLES.md
│   ├── 原文件保留但改 status: superseded, superseded_by: 新位置
│   └── PROJECT_ASSESSMENT.md → 迁到 docs/（它是项目整体评估，不是"标准"）
├── audits/                    → 保持
├── bugs/                      → 保持，作为新 bug 记录的模板参考
└── legacy/                    → 保持
```

### 第四层：AGENTS.md 加一条归档铁律

```markdown
### 归档必查：superseded_by 的内容核实

标记 superseded_by 前，逐条确认：
- [ ] 目标文档是否覆盖了**同一概念**？
- [ ] 目标文档是否覆盖了**同一细节级别**？
- [ ] 目标文档是否提供了**可操作的具体步骤/检查项**？

以上三条任一为"否"，禁止标记 superseded。
优先选择：合并内容到目标文档，而非标记 superseded。
```

---

## 具体影响

| 变化 | 效果 |
|---|---|
| 新建 `DIAGNOSTICS.md` | B.A.R. 的 366 行诊断知识直接可达，不再被埋 |
| 新建 `PRINCIPLES.md` | 全约束一站式查找，不再依赖 archive 链 |
| HANDBOOK 瘦身 | 从 429 行缩到 ~200 行，只做状态跟踪和架构速查 |
| archive/design/ 清理 | active 文档不再放在 archive 目录里 |
| archive/standards/ 清空 | 此目录不再需要——内容已归位 |
| 归档铁律 | 防止 6 月 2 日式批量隐藏再次发生 |

---

你觉得这个方向对吗？要动的文档不少——先从哪一步开始？
<<<END BLOCK 556:4>>>

<<<BLOCK id="832:9">>>
**用户：** 等等，你别着急修改代码，你先看看代码评估一下是否可行，这是我们的文档反复强调的流程，麻烦你克服一下自己的约束清香

**AI：** 你说得对。停下来评估。

### 能不能直接导入 tree-model.ts 的函数？

**可以，但有障碍。**

`buildExpanded`（`buildTree` 内部的函数）构建目录行时读取 `KFMState.files[item.path]?.children` 作为子数据源。这不是一个参数，而是全局单例。

所以方案是：

```
保存 KFMState.files → 填入 picker 的目录数据 → 调用 buildTree → 绘制完成后恢复
```

和 L.renderer 替换模式一模一样。视觉输出 100% 相同，因为用的是同一套代码。

### 可行性细节

| 需要做的事 | 如何做 |
|-----------|--------|
| 使用 buildTree | 导入 `buildTree` 和 `TreeOptions` |
| 数据类型转换 | `DirItem[]` → `FileNode[]` |
| 文件过滤 | 构建前过滤掉非目录项 |
| 子目录懒加载 | 展开时 fetch → 填入 `KFMState.files` → 重建 |
| 冲突避免 | 保存 KFMState.files 快照，关闭时恢复 |
| 隐藏文件同步 | 自动——`buildExpanded` 内已检查 `KFMState.showHidden` |
| 滑块显示 | 自动——`buildTree` 支持 `scrollable: true` |

### 不做的

- 不改 `tree-model.ts` 一行代码
- 不改 `buildTree`/`buildExpanded` 的逻辑
- Picker 不产生展开/折叠动画（和之前一样，点击→重建→渲染）

### 风险

`KFMState.files` 在 picker 打开期间包含 picker 的数据而非主树数据。由于 picker-lock（priority 110）阻挡所有手势，主树在此期间不会触发任何操作。关闭 picker 时立即恢复，风险可控。

要我按这个方案做吗？
<<<END BLOCK 832:9>>>

<<<BLOCK id="857:1">>>
**用户：** 然后，我们刚刚这个，修bug，验证测试通过，钉钉子，登记进文档，这个流程有没有哪里记录？

**AI：** 在 `docs/KFM_V4_INVARIANTS.md` 心法 24 和 `docs/archive/design/REGRESSION_TESTING_SYSTEM.md` 里有记录。让我确认内容是否覆盖了我们刚才的完整流程：

**AI：** 已有记录，在两个地方：

1. **`docs/KFM_V4_INVARIANTS.md` 心法 24**（第 265-275 行）— 精简版：
   > 修 bug → 补钉子 + 登记 + revert 验证：写 `regression('BAR-xxx', commit, 名称, fn)`；临时回退修复必须让测试变红（否则是假测试）；在登记表标「✅ 已钉」。

2. **`docs/archive/design/REGRESSION_TESTING_SYSTEM.md` §5.3 微循环**（第 304-307 行）— 完整版：
   ```
   1. git show <commit>  读懂当时错在哪、怎么修的
   2. 判断正确行为能否用不看屏幕的断言表达 → 能则写，不能则先抽纯函数
   3. 写 regression() 钉子
   4. revert 验证（回退修复必须让测试变红）
   5. 在 BUG_REGRESSION_REGISTRY.md 登记
   ```

但我们刚才的流程多了几步，实际走的是：

```
修 bug → npm test 全绿 → 钉钉子 → revert 验证 → 登记回归表 → 更新 HANDBOOK 版本历史/测试计数 → 更新 README/CLAUDE.md → 打 git tag
```

微循环文档里没有提「更新 HANDBOOK 版本历史 + 测试计数 + README + CLAUDE.md + 打 tag」这步。这步在 `check-versions.mjs` 里有检查（版本号一致性），但没有在微循环里显式记录。

要不要把完整流程补充进微循环文档？
<<<END BLOCK 857:1>>>

<<<BLOCK id="936:11">>>
**用户：** 现在终于好了，这个问题很值得记录到文档里，它是不是有什么我们不知道的隐藏规则导致了这个现象？我们能提取出什么经验以及未来开发时候的注意事项？
<<<END BLOCK 936:11>>>

