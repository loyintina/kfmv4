# dsh 18 条强化移植评估（9.0 采用 Cordis 落地件）

> 这是什么：dsh vendor README 的 18 条 Cordis 本地强化逐条评估——**移植必要性
> 判据 = 9.0 契约语义是否需要**（9.0 线会签标准）。这是采用裁决 2（版本来源 (c)）
> 的评估初稿。
> 别的去哪找：采用决策 → `../ledger/agent-inbox/kfmv4-9.0-cordis-adoption-verdict.md`；
> dsh 强化原文 → `/opt/dsh-src/vendor/README.md`；9.0 契约 → `../active/nine-zero-preface.md`。
> 状态：**初稿**（卡萝主笔，待 9.0 线会签 + 茉莉维护者验收——移植若改变 ctx 语义
> 可观察行为，现有 576 测试必须全绿）。

## 评估结论速览

| 结论 | 条数 | 条目 |
|---|---|---|
| 🟢 **优先移植（契约语义需要）** | 3 | #6 reentrant disposal / #15 lazy config / #18 disabled 语义 |
| 🟡 **条件移植（未来机制需要）** | 1 | #8 事务式配置回滚 |
| ⚪ **不移植（场景不适用）** | 14 | #1-5, #7, #9-14, #16-17 |

## 逐条评估

### 🟢 #6 fiber.ts 生命周期加固（reentrant disposal 三缺口）——**优先移植**

**内容**：效果 owner 包装先于 setup 注册；同步 setup 失败回滚已收集清理；异步
清理保持 owner 可见直至静默；效果创建在 UNLOADING 拒绝（PENDING/LOADING 合法）；
子 fiber 先注册后发布；依赖声明通知前解析；pending 附加效果排空；epoch 失效跳过
执行；teardown 通知失败按观察者隔离。

**9.0 判据**：契约模板的 **apply/unload 两栏 + 卸载三相 + 观察等价**全部落在
fiber 生命周期上。上游 rc.7 若无此加固，卸载语义在重入/并发场景会踩坑——而
9.0 的「抽文件测试」正是反复卸载/重载的工况。**移植必要性：高**。

**验收注意（茉莉条款）**：这是改变 ctx 可观察行为的移植——上游 rc.7 基线
必须先跑 576 测试记录基线，移植后全绿。

### 🟢 #15 lazy config 解析（cordiverse/cordis#41）——**优先移植**

**内容**：raw fiber config 保留，经 `internal/config` 只在声明注入激活后求值；
provider 替换重解析；pending 更新保留；HMR 转移。

**9.0 判据**：契约模板九字段含「配置 schema」+「依赖」——9.0 的插件配置（如
窗口卡四元组、池卡 tab 配置）天然依赖服务激活后才能求值（配置引用 pool 条目）。
若上游 rc.7 无此语义，配置在依赖激活前求值会拿到空依赖。**移植必要性：高**。

### 🟢 #18 entry disabled 表达式每次挂载求值——**语义参考移植**

**内容**：`disabled: !!js` 表达式每次挂载决策求值，raw node 保留在 options。

**9.0 判据**：「抽文件测试」执行形态② = 配置禁用形态（disabled 位 → 不装载）。
9.0 若用 cordis loader 语义承载该形态，则 disabled 动态求值正是所需；若 9.0
自建构建期扫描（契约 №5 注记），则只需**语义对齐**（禁用位的求值时机）不必
移植代码。**移植必要性：中（先定 9.0 是否用 loader 承载）**。

### 🟡 #8 事务式 Loader/Include 配置协调——**条件移植**

**内容**：loader 先 import 再 dispose、失败恢复旧插件；group 更新并发启动、
失败回滚；include 补丁事务式提交。

**9.0 判据**：v1 不用 loader/include（构建期扫描）→ 不移植。**若未来** 9.0 把
配置管理升级为 include/loader 形态（文档系统即插件系统的方向），此条成为必要。
**登记为未来候选**，不入 v1 移植清单。

### ⚪ 不移植（14 条）

| # | 条目 | 不移植理由 |
|---|---|---|
| 1 | hmr locales 移除 | kfmv4 不用 hmr |
| 2 | package.json 重新生成 | 发布元数据，kfmv4 npm 直装用 lib/ 产物 |
| 3 | tsconfig 重新生成 | 同上 |
| 4 | 内部 specifier .ts | 构建链差异；kfmv4 esbuild 消费 lib/ 构建产物，不消费源码 specifier（若步 0 esbuild 验证发现必须消费源码，此条升级为条件） |
| 5 | schemastery/logger-console tsdown | 无关包 |
| 7 | JSDoc 丰富 | 文档，无行为 |
| 9 | hmr 精确配置监听 | 不用 hmr |
| 10 | Node 兼容 TS 标记 | kfmv4 无 Node TS 原生运行场景 |
| 11 | applyEntryPatches 纯函数 + insert 立即索引 | 不用 include（思想已吸收：kfmv4 文档管线"补丁算法不重复实现"自有 check 体系） |
| 12 | include 串行化 + hmr 初始扫描 | 不用 include/hmr |
| 13 | writeTask 类型加宽 | 类型级 |
| 14 | include 持久化写重试 | 不用 include；kfmv4 持久化自研（persistence 裁决项） |
| 16 | cordis 发布 src | 发布元数据 |
| 17 | @deepseek-ai rescope | kfmv4 用上游 npm 名 |

## 移植执行前提

1. **步 0-1（esbuild 最小验证）通过**——确认 kfmv4 构建链消费上游 rc.7 无阻碍；
2. **基线纪律（茉莉条款）**：移植前跑 576 测试记录基线；每移植一条跑全量，
   任何可观察变化必须全绿且有对应考题（考题不因采用而减少）；
3. **移植形态**：不 fork 源码——以 **patch 层**（npm patch-package 或等价）携带
   三条强化，lockfile 锁 `cordis@4.0.0-rc.7`；上游 rc.8/1.0 发布时按升级契约化
   流程（9.0 线评估）重新对账（#6/#15 若上游已合并则 patch 退役）。

——卡萝 · 2026-08-16（初稿，待 9.0 线会签 + 茉莉验收）
