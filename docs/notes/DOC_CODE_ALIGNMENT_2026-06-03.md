---
status: active
created_at: 2026-06-03
context: UI Element Registry 文档-代码对齐 + 便捷方法 + CI 增强
---

# 文档-代码对齐审计与修复

> 本文档记录 2026-06-03 对齐工作的产出、发现的和未解决的问题，以及给后续 agent 的建议。
> 关联文档：`docs/UI_ELEMENT_REGISTRY_SPEC.md`、`src/client/modules/ui-registry.ts`、`check-registry.mjs`

---

## 本轮做了什么

### 🩺 审计发现

对 `docs/UI_ELEMENT_REGISTRY_SPEC.md`（759 行）与 `ui-registry.ts`（265 行）逐行对照，发现 **6 处偏差**，其中 4 处来自**不同 AI agent 的偏差倾向积累**：

| 偏差 | 根因 |
|------|------|
| §2.1 说"模块不知道 Registry 存在"→ 代码里模块显式调 register() | v0.2 agent（理想主义者）写了目标，v1.0 agent（实干家）走了务实路线，没人回头改 §2.1 |
| §2.3 validate() 签名过时 | 同上 |
| §S.6 行数估计 +2 行 vs 实际 ~11 行 | 设计阶段低估了实现成本 |
| check-registry 只查 id 不查参数完整性 | 验证 agent 优先保证了"有注册"，没有检查"注册得对不对" |

### 🔧 修复内容

**文档（3 处）：**
- §2.1：从"零耦合"改为"轻耦合"，解释为什么模块需要显式注册是经过 §5.1 讨论的有意选择
- §2.3：删掉过时的 validate() 签名，指向 §S.3
- §S.6：行数估计从 +2 更新为典型 ~15 行

**代码（2 处）：**
- `ui-registry.ts`：新增 `registerElement(el, getter?)` 便捷方法，一次调用完成 register + stateGetter，避免遗漏配对
- `check-registry.mjs`：新增参数完整性校验，检查每个 register() 是否包含 `type`/`label`/`description`/`effect`/`enabled`

**手册（1 处）：**
- `HANDBOOK.md` 陷阱 5b/6：推荐 registerElement() 模式，注明参数完整性检查已加入 CI

### ✅ 验证状态

- `npm run check`：零错误
- `npm run test`：74/74 通过
- 构建管线：sass → check-anim → check-as-any → **check-registry（含参数完整性）** → check-docs → tsc，全部通过

---

## 本轮留下的缺口

### 已知未解决的问题

| # | 问题 | 类型 | 建议优先级 |
|---|------|------|-----------|
| 1 | `notifyStateChange()` 散布——已在 KFMState 层加自动订阅 | 自动化缺口 | ✅ 已解决 |
| 2 | 内容层 snapshot 的 ordering 没有契约定义 | 设计缺口 | P3 |
| 3 | archive/design/ 下残留了旧版 UI_ELEMENT_REGISTRY_SPEC.md | 文档维护 | ✅ 已加醒目 warning |
| 4 | 全部 11 个元素已迁移至 registerElement() | 代码一致性 | ✅ |

### 缺口 1 的解决方案

`notifyStateChange()` 散布在 6 个文件的 41 处调用中。根解不是继续散布更多手动调用，而是**让 Registry 自动感知 KFMState 的变化**。

**已实施**：在 `ui-registry.ts` 末尾加了一行 `KFMState.subscribe(() => Registry.notifyStateChange())`，覆盖 KFMState.toggleHidden()、setExpanded() 等路径。GSAP 回调中的状态切换和直接 DOM classList 操作仍需手动通知——但核心数据层的变更现在自动可见了。

仍然手动通知的路径（有合理理由保留）：
- `card-stack.ts` 的 9 处——GSAP 动画生命周期回调
- `orb.ts` 的 8 处——orbState 模块内部变量 + GSAP 回调
- `tree-render.ts` 的 10 处——Canvas 渲染引擎事件 + 动画锁守卫
- `app.ts` 的 operation-toast——setTimeout 超时回调
---

## 给后续 agent 的建议

### 1. 关于"文档 vs 代码"对不上的情况

这个项目现在有 **5 个活跃文档 + ~29 个归档文档**，横跨多个 agent 接力。如果你发现某处矛盾，很可能是：

1. **不同 agent 写了不同的章节，没有同步**（最常见）
2. 归档文档里的内容已经 superseded 但没有醒目标注（检查 frontmatter 的 `status` 和 `superseded_by`）
3. 代码演化后文档没有更新（优先相信 §S "已定稿"部分，然后相信代码行为）

**处理原则**：按文档自身的权威层级决定：
- §1（核心意图）> §S（产出定义）> §2-§9（讨论/提案）> §10（演进史）
- 如果 §S 和代码矛盾 → 优先检查代码是否实现了 §S 的语义意图
- 如果 §2 和 §S 矛盾 → §S 优先（它是已定稿的产出定义）

### 2. 关于心法在实践中的运用

在本次对齐工作中，最有用的三条心法是：

- **心法 5（代码越改越少）**——阻止了我去做"零耦合大重构"那个看起来很帅但会让代码净增 200+ 行的方向
- **心法 8（选能自然满足所有约束的方案）**——帮我识别出"修文档 + 加 registerElement() + 增强 CI"是比"构建时自动扫描 + 运行时状态 Proxy"更自然的方案
- **心法 12（发现补丁立即根除）**——但这里要注意分辨真正的补丁和 documented trade-off。`register()` 是后者，`notifyStateChange` 的手动散布是前者（但根解不是大重构，而是 KFMState 层统一广播）

### 3. 下一步最值得做的工作

**P2（中等收益）：消除 openSidebar/closeSidebar 的双重状态源。**
当前 `ui.ts` 的 `openSidebar()`/`closeSidebar()` 直接操作 DOM classList，而 `KFMState.sidebarOpen` 字段存在但不被这两个函数使用。这意味着 KFMState 订阅无法自动感知侧栏切换。根解是让 `openSidebar()`/`closeSidebar()` 也走 `KFMState.setSidebarOpen()`，或者直接移除 KFMState 上的这个字段让状态源唯一。这个改动涉及 ui.ts + state.ts，约 30 分钟。

**不做的：**
- 不要碰 §2.1 的架构方向了，它现在是"轻耦合"，和 §S 一致。翻来覆去改文档方向会让后续 agent 更困惑。
- notifyStateChange 的 GSAP 路径手动调用保留不动——它们有合理的存在理由（动画生命周期是模块内部状态，不应通过 KFMState 广播）。

---

## 本次 session 的元观察

这个项目有一个很有趣的特征：**文档的可维护性已经超过了代码的可维护性。** 文档有 `check-docs.mjs` 检查链接完整性、有 `status` frontmatter 标记生命周期、有 `superseded_by` 指引迁移路径——但代码层面的约束自动化（参数完整性、注册配对、notify 覆盖）反而落后于文档。

如果你接手这个项目，**优先加强代码层面的自动化约束**，而不是继续加文档。`check-registry.mjs` 的参数完整性校验是一个起点，但还可以走得更远——比如在 `snapshot()` 入口处加一个开发时断言（`debug-assert.ts`），检查所有已注册的元素都有关联的 getter。

---

---

## 附：一条新原则的由来

在本次 session 即将结束时，项目 owner 提出了一条原则：

> **能自己做完的事，就该自己做完，防止给后续 agent 增加理解成本。**

这条原则的触发点是：我留了一个 `registerElement()` 迁移示范（只改了 1 个元素，剩下 10 个没动），理由是"示范一下就行，剩下的等下次"。owner 指出——**这不就是心法 12 说的'留给以后'吗？** 留一个未完成的状态，下一个 agent 要先花时间理解"为什么有两种写法"，再决定要不要改，远比我直接改完的成本高。

于是我改了剩下 10 个。5 分钟的事，但避免了下一个 agent 花 20 分钟去理解、决策、再花 5 分钟改。

这条原则和心法 12（发现补丁立即根除）的区别：
- **心法 12** 针对的是**补丁**——绕过 bug 的临时方案
- **这条原则**针对的是**半截工作**——功能没错但没做完，留给别人收尾

两者在"不给以后叠债"这一点上相通。建议后续 agent 也遵守。

---

*写于完成文档-代码对齐、registerElement() 迁移、check-registry 增强之后。*
*2026-06-03*
