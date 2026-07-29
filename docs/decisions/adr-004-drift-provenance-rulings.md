> 这是什么：ADR-004——漂移溯源审计三分歧的裁决（accepted）。
> 证据来源 → ../ledger/drift-provenance.md 深潜案五/六/八；卡片统一化前史 → adr-002。

**日期**: 2026-07-29
**状态**: accepted
**决策者**: 用户拍板（深潜与普查证据呈堂后）

## 裁决一：orb.ts 宿主化——拆（不登记双域特例）

**决策**：把 orb.ts 中约 350 行 ai-chat 编排（chatMessages/abortCtrl/loadSessionInto/
tryAutoResume/handleSend）拆出为独立模块，orb.ts 回归纯骨架。列为专项，需设计方案。

**理由（用户原话的要点）**：

1. **为消息窗口卡铺路**：后续要做「消息窗口卡」（与卡片堆同形态），需要面板的业务逻辑
   可被卡片体系复用——业务不分离，窗口卡无从谈起。
2. **一切皆卡片的初心**：最初的设想是一个参数化大卡片类型显化出一切 UI 要素，
   被具体功能催熟才偏离；面板与浮卡若一开始统一，就不会有此问题。
3. **历史失败不改变方向**：adr-002 记录的两次统一化失败，归因于当时架构不清与经验不足，
   是试错成本而非方向错误。本次测绘+溯源恰好补上了当年缺的系统级理解。

**与 adr-002 的关系**：不冲突——adr-002 自己留了活口「统一引擎应从零设计，不在现有
模块上修补」。本裁决是**业务分离**（前置偿债），统一引擎仍以新设计为前提，不在
orb.ts/floating-card.ts 上修补。

**后果**：拆分专项进 STACK；拆分边界以深潜案五为准（会话状态与 run 生命周期）。

## 裁决二：anim scope——废弃泛化声称（采纳深潜）

**决策**：不改任何调用点。保留 scope 给 tree-render 单租户；animation-registry 头注释
与 scope() docstring 改为「按需的模块级 timeline 隔离」；client-shell contract 同步。
killTweensOf 直透维持官方用法。

**理由**：机制出生即未接线（声称与第一处绕过同 commit）；直透自始是官方用法；
两年零故障——漂移只在注释声称与接线之间。强化 = 改 7 调用点 + 加 check 去落实一个
从未防住 bug 的机制，是在成因分布 E 类（机制没人走，21.9%）占比最高的项目上再造一个 E。

## 裁决三：ai-tools 9 端点 + capability-executor——整删（不留实证期）

**决策**：ai-tools.ts 9 端点整批删除，capability-executor 收编或同删（按依赖实况），
server contract 同步摘除。不留访问日志实证期。

**理由（用户定调）**：这是 v6.1.0 不成熟的尝试——预设的「仓外 agent HTTP 操作面」
受众从未存在（HTTP push 后备通道出生即未接线；v8.3.0 agent-runner 也不用）。
**「如果出现问题，用我们现在的系统级理解重新构建，比留下要好。ai 时代，
重构比补丁效率更高。」** 附带收益：server#7 的 drive-by 敞口随删除消除大半。

## 宪法级沉淀

- 「**ai 时代，重构比补丁效率更高**」——删除不明遗产的默认立场：能重建的不保留。
  （候选宪法条款，待心法文档下一轮归纳时正式收录）
- 随修溯源：修每条漂移必带成因标签 + 引入 commit（制度化，进 bug-fix 流程）。

## 追加裁决（2026-07-29，裁决三连带两问）

- **command 通道 → 保留为「AI 之手」预留基础设施，不算技术债**。用户定调：
  未来肯定做 AI 操作页面的工具，19 个客户端 command handler + WS 协议面是
  「提前做好的接口」。服务端触发端（原 POST /ui/command）随整删消失属预期空转，
  AI 之手落地时重建触发 + 补 action 静态校验即可。
- **幽灵能力注册 → 删除**。main.ts 的 file-search/file-read/file-write 注册
  无执行面、仅喂 page-state 提示词，会让 AI 看到永不可调用的能力（提示词噪声，
  可能误导调用尝试）。已删；能力管道（ui-registry → WS → page-state）留空，
  与 command 通道同属 AI 之手重建面。check-registry 的 CAPABILITY_MANIFEST
  同步摘除，AI 之手落地时重建。
