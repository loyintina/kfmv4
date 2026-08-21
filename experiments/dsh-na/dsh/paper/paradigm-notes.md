# 《A Programming Paradigm for Spatiotemporal Composability》精读笔记

> 2026-08-15。论文：Yifan Shi, Wei Zhang, Tianyi Cui（北京大学 · DeepSeek-AI）。
> Preprint（2026-08-13 草案，88 页），上游：https://github.com/cordiverse/paper。
> （仓库内 `paper/paper.pdf` / `paper.md` 原文副本已移出；需要时在 git 历史考古或取上游）
> 本笔记是论文级研究的核心产物：概念体系 + 数学结构 + 三层对照
> （论文 → cordis 源码 → dsh 工业强化），全部论断可回论文章节/定义号。

## 0. 论文身份与一句话贡献

**一句话**：把编程语言的经典概念 **effect（效果）** 与 **coeffect（共效果）**
从"编译期静态注解"提升为"运行时机制"，为**动态组合**（插件系统、自进化 agent
harness）提供形式基础，并实现为元框架 **Cordis**（§1.3, §5）。

论文识别的两个正交维度（§1.1）：

| 维度 | 问题 | 静态对应物 | 论文解法 |
|------|------|-----------|---------|
| **时间可组合性** | 移除组件时副作用完全、安全地逆转 | 词法作用域 / RAII | **revertible effects**：每次上下文变换携带运行时追踪的逆（§3.1） |
| **空间可组合性** | 声明、发现、解析组件间依赖 | 模块导入解析 | **reactive coeffects**：按规格声明依赖，上下文每次变化按规格通知（§3.2） |

**动机例证**（§1.2）：VSCode 扩展宿主无法在运行中卸载单个扩展（前 100 扩展 87 个
带代码、都要重启），且扩展间几乎不互相依赖（仅 7/100 声明 dependency）——插件
系统普遍缺时间/空间可组合性。粗粒度替代（OS 进程级时间可组合 + 容器编排级空间
可组合）代价是：每次重启丢弃全部进程内状态、粒度不匹配（§1.2.3）。

**自进化 harness 是终极动机**（§1.2.2, §8）：未来 harness 由模型生成并替换自身
组件、连续服务不重启。没有时间可组合性，每次自我修改 = 全量重启，故障的自我
修改甚至能废掉用来恢复的进程。

## 1. 概念地图（全文骨架）

```
effect（§2.1：类型注解）         coeffect（§2.2：上下文注解）
        │ 提升为运行时                   │ 提升为运行时
        ▼                              ▼
revertible effects（§3.1）        reactive coeffects（§3.2）
  effect context ∂Γ = Γ×(Γ→Γ)      coeffect context Σ = (k:K)⇀V_k
  track / recover / ⋄ 组合           get/set（set 本身是效果！）
  witnessed effect 𝔈*Γ              satisfaction σ⊨d + notify 分类
  独立性（变换幺半群交换）             isolation（realm）/ interception（metadata）
        └──────────┬─────────────────┘
                   ▼
        context type Γ∞ = μΓ. Γ×(Γ→Γ)×Σ（§3.3.1）
        观察等价 ≃ 对 coefect 商 → 买来 effect 独立性（§3.3.2）
                   ▼
        组件 ℭΓ = (d, p, e*) + fiber + registry（§4.1）
        十规则演算（§4.2-4.3）→ 元理论（§4.4）
        Preservation / Recovery exactness / Ordering /
        Resolution coherence / Progress / Confluence
                   ▼
        Cordis 实现（§5）：核心库 + loader + HMR
        dsh = Cordis 的工业级验证（vendor + 18 条本地强化）
```

## 2. 时间可组合性：revertible effects（§3.1）

### 2.1 核心构造：effect context

**Definition 2**：效果上下文 `∂Γ ≔ Γ × (Γ→Γ)` —— 一对 `(𝛾, 𝜑)`：
- `𝛾`：当前上下文状态；
- `𝜑`：**累积器（accumulator）**，到目前为止所有效果之逆的复合，把上下文恢复到初始态的函数。

**Definition 1（twisted composition 扭转复合）**：`(𝑓₁,𝑔₁) ∘ (𝑓₂,𝑔₂) ≔ (𝑓₁∘𝑓₂, 𝑔₂∘𝑔₁)`
——正变换按应用序复合，**逆按相反顺序累积**。它构成幺半群（单位 `(id,id)`）。
这就是 LIFO 回滚的代数：后安装的逆先执行。

**Definition 3（track）**：`trackΓ(𝑓,𝑔) = (𝛾,𝜑) ↦ (𝑓(𝛾), 𝜑∘𝑔)` —— 应用效果 `𝑓`、
把它的逆 `𝑔` 压入累积器。
**Definition 6（recover）**：`recoverΓ = (𝛾,𝜑) ↦ (𝜑(𝛾), id)` —— 跑完累积器、重置。

**Theorem 7（soundness invariant）**：`recover(track(𝑓,𝑔)(𝛾,𝜑)) = recover(𝛾,𝜑)` 当
`𝑔(𝑓(𝛾)) = 𝛾`。直觉：**不管中间怎么变换，recover 的结果只取决于"能否用逆回
到起点"**——`𝜑(𝛾) = 𝛾₀` 是状态的不变式。

### 2.2 从"逆先验给定"到"应用时见证"（Definition 8-15）

track 模型的问题：逆 `𝑔` 必须先验给定（一个逆要服务于所有状态），且 recover
是全有或全无。修正：

- **效果函数** `𝔈Γ ≔ Γ → Γ × (Γ→Γ)`：应用时**返回**新状态 + 该次效果的逆。
- **带证效果函数** `𝔈*Γ`：约束 `(𝛿,𝑔) = 𝑒(𝛾) ⇒ 𝑔(𝛿) = 𝛾` —— 逆在其应用的状态上确实回滚。**证人是插件作者的义务，不是运行时验证的**（§5.1.1 明言，§6.1 界定义务边界）。
- **效果复合 `⋄`**（Definition 9）：`(𝑓⋄𝑔)(𝛾) = let (𝛿,𝑠)=𝑔(𝛾) in let (𝜀,𝑡)=𝑓(𝛿) in (𝜀, 𝑠∘𝑡)`——逆仍旧逆序累积。`(𝔈Γ, ⋄)` 是幺半群（Theorem 10），带证性在复合下保持（Theorem 11）。
- **effect 提升**（Definition 12）：`effectΓ : 𝔈Γ → ∂Γ → ∂²Γ`——效果的逆**本身也是效果**（undo 的 undo 是再做一次），逆的逆同上层效果组合。`effect` 保持 `⋄`（Theorem 13）。

**Theorem 16**：`𝔈*Γ` 中的效果按应用序安装、**逆序回滚**，每次回滚都作用于自己应用产生的状态、每步保持 soundness invariant。这就是 LIFO 回滚成立的原因。

### 2.3 独立性：效果可以在任意顺序回滚（§3.1.3）

单累积器只能 LIFO 整体回滚。但组件交错运行时，某组件的逆要在**别人已移动的状态**上跑。什么时候还能精确撤回自己？

**Definition 17/19（变换幺半群 / 独立）**：效果的变换幺半群 `𝔐(𝑒)` = 前向映射 + 所有产出的逆生成的子幺半群。两效果**独立**当：① 彼此的每个变换交换（`𝑓∘𝑔 = 𝑔∘𝑓`）；② 一方的变换不扰动另一方产出的逆。

**Corollary 21**：两两独立的效果族，**任意排列**顺序回滚都能回到起点。LIFO 只是其中一种（无需假设），独立性买来的是**其他所有顺序**——包括多组件交错的那一种。

**关键分野**（§3.3.2 末尾）：
- **可交换部分由 effects 承载**：组件按任务需要的顺序做效果，系统按方便的顺序回滚，组件间互不约束；
- **有序部分由 coeffects 承载**：不交换的 key，顺序必须在效果之外强加——组件内靠累积器（LIFO），组件间靠声明式 coeffect（提供先于依赖满足）。

## 3. 空间可组合性：reactive coeffects（§3.2）

### 3.1 coeffect context 与 get/set（Definition 22-23）

`Σ ≔ (𝑘:𝐾) ⇀ 𝒱𝑘` —— 依赖 key 到类型化值的**有限部分函数**（类型族保证静态类型安全）。
操作：
- `get(𝑘)`：读（前置：`𝑘 ∈ dom(𝜎)`）；
- `set(𝑘,𝑣)`：写（前置：`𝑘 ∉ dom(𝜎)`）。

**关键协同**：`set(𝑘,𝑣)` 的类型正是 `𝔈*Σ`——**coeffect 操作本身是效果函数**，直接继承 §3.1 的效果机制（`effectΣ` 自动追踪与恢复依赖注册）。"coeffect 操作是效果，效果可逆"——这就是两者的协同点（§3.2.1 末尾）。

### 3.2 规格与通知：反应性的核心（Definition 25-26）

**规格** `𝔇Σ ≔ Set(𝐾)`：组件声明的依赖集合。
**满足谓词** `𝜎 ⊧ 𝑑 ≔ ∀𝑘∈𝑑. 𝑘 ∈ dom(𝜎)`——可判定（dom 有限）。
**notify 分类** `notify𝑑(𝜎,𝜎′) ∈ {activating, deactivating, neutral}`：按满足状态是否翻转分类。

反应性不变量：**activating 转变触发组件效果执行（带完整效果追踪）；deactivating 转变触发累积器恢复**。因为所有状态变更都经效果函数（其逆恢复原 dom），"每次 coeffect 变更都被观察到"是代数的结论而非实现细节（§3.2.2）。

### 3.3 isolation 与 interception（§3.2.3）

对基本模型的两次扩展，都用 **derived realization（派生实现）**（Definition 27）：
不动共享表、派生新上下文、逆为 id——恢复即丢弃派生上下文，无逆可追踪。

- **Isolation（隔离）**：`Σ_iso = (K⇀R) × ((r:R)⇀V_r)`——双层映射：key 先解析 realm 再取值。**运行时 ad-hoc 多态**：同一 key 在不同上下文解析到不同值（多租户/测试/sandbox）。
- **Interception（拦截）**：`Σ_inter = ((k:K)→M_k) × ((k:K)⇀(M_k→V_k))`——上下文携带 metadata + 提供者函数；组件声明的 metadata 与上下文 metadata 按 key 的幺半群合并（**right-biased**：上下文优先，可覆盖组件声明——外层约束内层，不改组件本身）。

## 4. 统一：context type 与观察等价（§3.3）

### 4.1 Γ∞（Definition 32）

`Γ∞ ≔ μΓ. Γ × (Γ→Γ) × Σ` —— 递归上下文类型：状态 + 累积器 + coeffect 表。
- 自我相似结构统一了 ∂-塔（effect 映射 𝔈Γ∞ 把 Γ∞ 映到自身）；
- `𝒱` 不受约束 ⇒ **任何需跨组件共享的状态都可以编码为一个 key 的依赖**——Σ 涵盖所有共享可变状态，不只是组件间依赖；
- 层级组合：加载组件 = 执行其效果（插上）；卸载 = 恢复其效果（拔出，不影响其他运行中的组件）；父上下文聚合子效果，**任意嵌套组合**。

### 4.2 观察等价 ≃ 买来独立性（§3.3.2）

Theorem 7 声称状态"相等"，但物理状态无法精确恢复（free 不还原堆布局、生成名不可还原）。因此等式要**模一个等价 ≃ 读**，而 ≃ 由 coeffect 定义：

**Definition 33**：两个上下文状态相关当 coeffect 投影绑定相同的 key 到相关值。**没有 key 绑定的部分被遗忘**——这正是恢复可以"几乎相等"的数学依据（堆布局/生成名若没被任何 key 绑定，就在关系之外）。

**Definition 34（测试/不可区分）**：key 的操作是观察手段；两个值在所有测试下结果相同则不可区分。**Lemma 35**：不可区分性是操作尊重的最粗关系。
**Definition 37**：`𝔈*Γ` 的带证条件按 ≃ 读（`𝑔(𝛿) ≃ 𝛾`）。
**Theorem 42**：如果每个 key 的操作（在其上发生的）都交换（key 可交换），则两个 coeffect 中介的效果函数独立（Definition 19）——**把 §3.1.3 留下的独立性假设变成了结构保证**。

直觉：**"绑定所有共享位置到 key"是范式的纪律**（§3.3.2 末尾明言两个局限：不能 reify 为 coeffect 的位置在定理之外；key 可交换性是对提供者的义务）。

### 4.3 范式定位（§3.3.3）

两极端之间：函数式显式状态线程（State 单子：可追踪但 ergonomics 差）vs 命令式隐式突变（React useEffect / Spring getBean：ergonomics 好但不可追踪）。**Context paradigm 兼得**：效果与共效果都经显式上下文参数中介，每个操作可归属到其上下文（进而其组件）；**开发者为每个原子效果提供逆，复合逆由组合推出**（teardown 从 loading 派生而非另行编写）；**组件只声明依赖，运行时自动解析与重连**。正确性从"开发者纪律"变成"范式的结构性质"。

## 5. 动态组合演算（§4）

### 5.1 组件 / fiber / registry（§4.1）

- **组件** `ℭΓ ≔ 𝔇Γ × 𝔓Γ × 𝔈*Γ`（Definition 43）：`(𝑑, 𝑝, 𝑒)`——依赖规格 × 提供集合 × 带证效果函数。一个接口的两个方向：从环境读什么、向环境写什么。**单源纪律**：registry 内无两 fiber 提供交集（provisions 不相交）。
- **fiber**（Definition 44）：组件的一次实例化，`⟨𝑑,𝑝,𝑒,𝜋,𝜎,𝜏,𝜃⟩`——父指针、自己的 coeffect 表、退役标志、生命周期状态。**名字是原子**（动态局部名纪律）。
- **registry**（Definition 45）：状态携带的 fiber 集合。coeffect 上下文是**导出的**：`𝜎𝛾 = ⋃{𝜎ₘ | m 是 ACTIVE 的}`（式 40）——每个 key 的 provider 唯一（由 provisions 决定，不随状态变）。

### 5.2 十规则（§4.2-4.3）

**编排规则（orchestrator 动作，带前置条件）**：
- `O-Insert`：注册 fiber（前置：名字新鲜、父存在、provisions 不相交）；
- `O-Retire`：退役 fiber（无条件——退役是请求，生命周期规则负责执行；先退役再移除，否则丢弃累积器泄漏）；
- `O-Remove`：移除（前置：已退役 + 非激活 + 无子）。

**生命周期规则（前提成立即触发）**——六态：`Inactive(ζ) | Reloading(i,g,ω) | Active(g,ω) | Unloading(g,ω,ζ)`：
- `L-Begin`：Inactive → Reloading（目标视图 ω 非 ⊥）；
- `L-Iter`：迭代一步，逆压入累积器（`g∘h`）；
- `L-Finish`：Reloading → Active（目标视图仍 = ω）；
- `L-Divert`：目标视图变了 → 半途改道 Unloading（迭代边界粒度，可中止或落地）；
- `L-Raise`：迭代抛错 → Unloading（携带错误 outcome，**先恢复后记录**）；
- `L-Leave`：Active → Unloading（**先停止提供，再排逆**）；
- `L-Unload`：跑累积器、丢已提交视图 → Inactive（唯一应用累积器的规则）。

**四层扩展**（§4.3，对应真实运行时的四个现实）：
1. **Withdrawal**（§4.3.1）：把 L-Unload 拆成 L-Leave（记录决定、停止提供）+ L-Unload（等依赖者）；**relied 守卫**——依赖者把 key 解析到 n 时 n 的卸载被推迟，直到所有消费方撤出。L-Leave 让 n 的表离开 σ_γ，新目标视图不再指向 n，依赖者自己开始离开——**守卫总能释放**（Theorem 66）。
2. **Iteration**（§4.3.2）：激活是**效果迭代器** `𝔈^iter`（每次产出 (δ, g, Maybe(续)），**reified delimited continuation**——等价于 yield/generator。
3. **Asynchrony**（§4.3.3）：迭代在 Flight 期间目标视图可能变——**inertia（惯性）**：已启动的迭代必须落地，落地后再卸载（不能中途丢弃）。
4. **Failure**（§4.3.4）：迭代可 raise（`Either(Ξ, …)`）；错误记录在**该 fiber** 上而非传播给父——兄弟组件继续跑；失败 fiber 不阻碍任何事、不重入生命周期（`Inactive(ξ)` 不能 L-Begin）。

### 5.3 元理论五定理（§4.4）

| 定理 | 直觉 |
|------|------|
| **Preservation**（T59） | registry 良构性保持：fiber 树、provisions 不相交、已提交视图完整且在 registry 内、视图指向的提供者必须已安装。relied 守卫承载第 3/4 条 |
| **Recovery exactness**（T61, Cor 62） | **单累积器不变量在交错中存活**：跑 n 的累积器 = 撤回 n 自己的贡献，得到"n 从未存在"的状态（模 ≈，控制字段除外）。独立性是前提 |
| **Ordering**（T63） | 提供者撤出绑定**只在其所有依赖者已停用之后**（守卫），依赖者在自己的 teardown 全程仍可读 key；一次激活安装的效果全程对着同一个已提交视图 |
| **Resolution coherence**（T64） | 一次转换（Reloading 区间）的所有迭代对着同一个分辨率 ω 跑；目标视图变 → 走 L-Divert 离开转换 |
| **Progress**（T66） | ≺（n≺m 当 n 提供 m 声明的 key）无环 + 迭代有限 → 无死锁 + 终止：任何最大序列到达 quiescent 状态 |
| **Confluence**（T73） | **动态历史不留痕迹**：quiesce 到的状态 = 从一开始静态组装（按依赖序每个组件加载一次）会到的状态。可等价于增量计算的"从头求值一致"（论文引用 [45]）。失败是唯一真正分歧源 |

Confluence 的意义（§4.4.5 末尾）：「一个 orchestrator 加组件、移除、替换 provider、回滚替换，保证到达从一开始写下最终组合就得到的状态」——**推理 Cordis 应用可以当作它是静态组装的**。限制：说的是状态，不是系统沿途的排放。

## 6. 理论 → Cordis 实现映射（§5.1，Table 2 提炼）

| 理论构造 | Cordis 实现 |
|---------|------------|
| Γ∞ | `ctx`（一级上下文） |
| 效果迭代器 𝔈^iter | 返回/产出逆的 effect callback |
| `effectΓ(e)` | `ctx.effect(callback)`（唯一上下文变更入口） |
| Σ_iso / Σ_inter | `ctx[@@store]` / `ctx[@@isolate]` / `ctx[@@intercept]`（符号键槽） |
| `get`/`set` | `ctx.get` / `ctx.set`（set 是 ctx.effect 调用） |
| `isolate`/`intercept` | `ctx.isolate` / `ctx.intercept`（派生上下文，无逆） |
| fiber 元组 | `fiber`（uid=名字，inject=d，provide=p，apply=e，parent=π） |
| 已提交视图 ω | `fiber.committed`（实现里是 provider uid 的元组） |
| target(γ,n) | `fiber.target`（refresh 重算；⊥=INACTIVE） |
| 惯性 𝖥𝗎𝗍𝗎𝗋𝖾 | `fiber.inertia`（in-flight 转换句柄） |
| O-Insert / O-Retire | `ctx.use` 及其 callback 的逆 |
| L-Begin/L-Iter/L-Finish | `execute` 的迭代循环（Algorithm 1） |
| L-Leave | `refresh` 把 fiber 标记 UNLOADING（Algorithm 5 第 10 行） |
| L-Unload + 守卫 | `unload` 先 `await` 被通知的依赖者排空（Algorithm 5 第 25 行） |
| L-Raise | 错误记录在 fiber、target 置 ⊥ |

**实现要点**（§5.1.1-5.1.4）：

- **ctx.effect 是唯一变更入口**（Algorithm 1）：`execute` 把 callback 当迭代器驱动，每步产出的逆复合进 `inverse`；`dispose` 一次性翻转 armed（**恢复至多触发一次**）并**前插到父上下文的累积器**（`ctx.dispose = dispose ∘ ctx.dispose`——子效果的逆是父上的效果，∂-塔的递归结构）。带证条件不检查——**证人是插件作者的义务**。
- **notify**（Algorithm 3）：遍历所有 fiber，key ∈ fiber.inject 且 realm 解析相同 → `refresh`；返回受影响集合让调用者可 await。**绑定只对提供者 ACTIVE 的依赖者可见**——provider 进入 UNLOADING 即停止提供，依赖者提前一步开始 teardown（绑定仍在）。
- **生命周期**（Algorithm 4/5）：`refresh` 重算 target，变了且无 in-flight 转换 → reload 或 unload。`reload` **先提交视图**（`fiber.committed ← resolve(inject)`），跑完再验 target：还是它 → ACTIVE；变了（无论 ⊥ 还是换 provider）→ 链入 unload。`unload`：**先 drain 依赖者**（等 notified 的 fiber 到 INACTIVE）→ `fiber.dispose()` → 提交视图置 ⊥ → target 是 ⊥ 则 INACTIVE 否则链入 reload。**两级检查**：转换级（完成时验 target，跨转换惯性链）+ 迭代级（每步边界验 target，转换内部分回滚）。
- **proxy 上下文访问**（Algorithm 6）：`ctx[key]` 沿 fiber 链上溯，在第一个 committed 视图绑定该 key 处授权；声明而未提交 → INACTIVE_ACCESS；到 root 无声明 → UNDECLARED_ACCESS。**与 ctx.get 不同**：proxy 按访问者自己的视图解析并强制规格 d，get 是无条件查表——Theorem 63 依赖这个（依赖者 teardown 中仍可读被撤的 key）。

## 7. Loader 与 HMR（§5.2）

- **entry**（Definition 74）：`id / url / isolate / intercept / config / disabled`——**支持集恰好是 entry 记录的**：disabled=τ，树位置=π，url 选组件声明 d、p。配置树 = 系统加载什么的权威记录。group/include 是普通组件（基于注册原语），嵌套树仍在演算内。
- **reconciliation**（增量而非整体重建），sound 的四个元理论理由：Confluence（最终状态只取决于最终配置）/ Progress（一定 quiesce）/ Cor 62（离开的 fiber 贡献为零）/ Ordering（可并发加载，依赖只约束激活时机不约束模块加载）。字段级最小破坏派发：id/url 重建、isolate 重指派 realm、intercept 原地改、config 交给组件 diff、disabled 卸载/重载。**managed realms**：local realm（随 entry 移动，按 id 标记）/ global realm（按字符串共享）；delimiter 符号判定"绑定是否 entry 自己的"。
- **HMR**（模块级 revertible effects，**无需开发者标注接受边界**——Webpack/Vite 需要）：分类（import 依赖子图，固定点：有 import 被接受则接受、全 import 被拒绝则拒绝、环默认拒绝）→ 陈旧 entry 检测 → **事务式重载**（备份缓存 → 逐 entry dispose + use 新模块 → 失败则恢复缓存 + 回滚 swap）。

## 8. 三层对照：论文 ↔ cordis 源码 ↔ dsh 强化

本线已有源码证据（`cordis-mechanics.md`），现在补齐论文坐标。每行 = 论文定义 ↔ cordis 源码 ↔ dsh 的 18 条本地强化（`/opt/dsh-src/vendor/README.md`）之相关者。

| 论文 | cordis 源码 | dsh 强化（vendor README 条目） |
|------|------------|------------------------------|
| `set(k,v)` 是效果（Def 23） | `ctx.provide` 经 `fiber.effect` 注册（reflect.ts:277-304） | — |
| notify 分类（Def 26） | `reflect.notify` 遍历 fiber 重算（reflect.ts:314-336） | — |
| 视图按 provider 而非值比较（§5.1.3） | `fiber.store` 存 `Impl`（带 fiber），epoch = `':'+impl.fiber.uid`（fiber.ts:611-623） | — |
| 惯性转换（§4.3.3） | `fiber.inertia` + `_setEpoch` 排 in-flight（fiber.ts:625-639） | 第 6 条：reentrant disposal 加固、UNLOADING 拒绝新 effect、child fiber 先注册后发布 |
| reload 先提交视图再执行（Alg 5 L14） | `_reload` 先 `_resolveConfig`（internal/config waterfall）再 `_execute`（fiber.ts:646-673） | 第 15 条：lazy config 解析移植（cordiverse/cordis#41）——raw config 只在依赖激活后求值 |
| L-Raise 先恢复后记录（§4.3.4） | `_reload` 的 catch 置 epoch=INACTIVE 并记录错误（fiber.ts:659-664） | — |
| 守卫：unload 等依赖者排空（Alg 5 L25） | provide disposer：delete → notify → await 依赖者 → 再删自己（reflect.ts:297-303） | — |
| 事务式加载（Alg 10） | — | 第 8 条：loader/include 事务式配置协调（失败回滚、恢复旧插件） |
| patch 按 id 整行替换 + last-write-wins | `applyEntryPatches`（vendor/include/src/index.ts:58-128） | 第 11 条：导出纯函数 + insert 立即索引（dsh 加了"后层可寻址刚插入行"） |
| entry.disabled=τ（Def 74） | Loader 的 `disabled` 字段 | 第 18 条：disabled `!!js` 表达式每次挂载求值 |
| Σ 沿 ctx 递归（derived realization，Def 27） | `parent.extend({fiber})` 子上下文 | — |

**注**：`cordis-mechanics.md` §7 记录的 fiber 六态（PENDING/LOADING/ACTIVE/FAILED/UNLOADING/DISPOSED）与论文六态（Inactive(⊥)/Reloading/Active/Unloading/Inactive(ξ)/退役移除）一一对应（Table 2 明示：LOADING=Reloading、FAILED=Inactive(ξ)）。

## 9. 讨论中的边界与开放问题（§6）

- **系统边界**（§6.1）：位置 inside（系统可独占修改并可恢复 → 追踪进 Γ）vs outside（操作 = idΓ 不追踪）。**coeffect 移动边界**：把外部位置 reify 为 key 的依赖，用带逆的操作集约束访问。**acquisition（获取，inside：open/close、malloc/free）vs emission（排放，outside：write/send 推数据）**。恢复排放只有两条路：**withhold（扣住直到状态确定持久——输出提交问题）** 或 **compensation（补偿：删掉创建的文件、退还收费；按相同 LIFO 组合，但元理论需对更粗等价重证）**。
- **服务多路复用**（§6.2）：独占绑定（一接口一实现，切换扰动所有消费者）vs **service broker**（中间服务作入口，多 provider 共存，broker 吸收扰动——负载均衡/滚动更新（§1.2.3 粗粒度编排下放为应用级模式）/跨进程调用（异步契约））。
- **访问控制**（§6.3）：inject 声明 = capability 请求，ctx proxy = capability 中介（**静态可审查**）；interception 承载细粒度策略（fs 依赖声明可读写路径，orchestrator 不改组件即可约束）；不可信代码需真 sandbox（外部机制，host 侧是普通 fiber，能力可被上述访问控制衰减）。
- **语言独立性**（§6.4）：时间维度需要 **closures**（逆 + 状态捕获成值）+ 运行时模块引入/撤回机制（managed registry / dlopen / WASM）；空间维度需要依赖**类型化**（typeclass/trait/declaration merging——Rust 的 trait 正点名）与访问**中介**（Proxy / descriptor / 反射 / 编译期元编程）。
- **互依赖与粒度**（§6.5）：依赖环 = 相关组件永久不激活（**可从声明预测，不是运行时死锁**）；双向交互可分解为四组件消除环（核心不互依赖，集成组件依赖两者），一般情形集成组件数可随 n 平方增长。
- **依赖类型化与版本**（§6.6）：仅 key 身份链接的两个问题——**interface drift**（接口演进 vs 消费者旧编译）与 **key collision**（同名异义）。三方案：key 命名空间（K×P）/ **peer dependencies**（cordis 现采用；npm 可强制版本兼容；局限：靠语义化版本自觉 + 单版本解析）/ 结构兼容（宽子类型，行为契约复杂、多态下不可判定）。
- **协同设计**（§6.7）：语言可让上下文**隐式**（操作修改其运行所在的上下文或派生新上下文——补隐式安全：闭包/全局变量无法越权触达他人上下文）+ 让效果/共效果**进编译器**（迭代器→单状态机帧、规格进类型系统→编译期报依赖环、行类型→结构兼容）。OS 可把 coeffect 规格当"组件可触达的全部"（sandbox 天然）、资源作 coeffect 提供（内存/文件描述符，归属记录只存一份）、使 emission 可逆（事务写/COW 快照）。

## 10. 与 dsh 的关联（本线研究的意义）

dsh 的 AGENTS.md 第一行：「DeepSeek Harness is a plugin-based agent harness on
vendored Cordis: **everything is a plugin**」。论文 §8 把 **self-evolving agent
harness** 列为 Cordis 的终极验证场景：模型生成并替换自身组件、连续服务——需要
时间维度（快速替换下的完整恢复）与空间维度（拓扑频繁变化下的依赖协调）。dsh
正是把 Koishi 案例（4000 插件的聊天机器人框架）升级到 agent harness 的工业验证：
- 五机制（plugin/ctx/inject/事件五派发/可逆效果）的"为什么"由论文给出；
- dsh 的 18 条本地强化（vendor/README.md）是"论文理论 → 生产现实"的增量工程；
- 「一切皆插件」= 论文的「一切组件经上下文效果/共效果中介」的产品表述；
- 连接 provider 可换、agent loop 本身是插件——正是 §6.2 服务多路复用 + §4.3 动态替换的实例。

## 11. 待办/可深挖方向

1. 论文 Theorem 41-42（coeffect-mediated effect 独立性）与 dsh 工具注册表/事件监听
   的实际"可交换性"对照——哪些 dsh 注册实际不交换、顺序靠什么承载
2. §6.4 语言独立性对 kfm-na（Rust）的启示：trait 类型化依赖 + proc macro 中介
   （此点对 kfm-na 落地线有价值，留给 NA 线）
3. 版本化依赖（§6.6）在 dsh 的 peerDependency 实践对照（`packages/README.md`）
4. dsh 的 `scope`（per-agent 注册，glossary.md）对应论文哪个机制——isolate realm
   的一个应用实例（agent 作为 realm）
