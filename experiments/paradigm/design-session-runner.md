# 会话驱动内核 + 研究管线设计（paradigm 实验基建）

> 2026-08-03。目标：**离线批量跑 kfm 工具流**——行为范式包研究的测试床，
> 同时是「subagent 工具」的产品内核（AI 之手愿景复用）。
> 核心洞察：研究基础设施与 subagent 工具**共享同一个会话驱动内核**，两面消费。

## 内核：runSession（会话驱动）

**复用基础**：`routine-entry-validation.mjs` 已是离线跑 kfm 会话的驱动
（POST /ai/chat/start → SSE 消费 → 落盘归档），抽成可复用模块。

**参数组 = 配置卡**（config.card.ts 已有产品载体，`.kfmv4/configs/<id>.json`）：

```json
{ "id": "测试配置", "providerId": "opencode-go", "modelId": "deepseek-v4-flash",
  "sessionId": "", "roleFile": "蔚然" }
```

```
runSession({
  configId,      // 配置卡 id → 解析 providerId/modelId/sessionId/roleFile
  messages,      // 完整消息列表（续写 = 读 session 历史 + 追加新消息后全量重发）
  userText,      // 落盘原文（防 ts 前缀污染——routes.ts 语义）
  paradigm,  // 范式包文本：拼进首条 user 消息前（不能走 system——chat.ts
                 //   会过滤 role==='system'；范式包=上下文注入，正是其本质）
  overrides,     // 实验覆盖：{ sessionId?, model?, roleFile? }——实验每臂新会话
  base,          // http://localhost:8021/api
  timeoutMs,
}) → { runId, events, ms, sessionPath }
```

**解析链**：configId → `.kfmv4/configs/<id>.json`（provider/model/session/role）
→ providerId → `.kfmv4/providers.json`（baseUrl/apiKey/models——命名映射实现时确认）
→ `POST /ai/chat/start`（带 roleFile + overrides 覆盖）→ SSE → 归档。

**关键语义**（从代码确认）：
1. `POST /ai/chat/start` body = { sessionId, messages, model, provider, roleFile?, userText }——messages 是发往 AI 的对话列表，userText 是落盘原文（防投影污染）
2. SSE 消费：`GET /ai/chat/:runId/stream` 续读到 done（run-manager 后台生成，连接解耦）
3. **注入机制**：`chat.ts` apiMessages 过滤 `role==='system'` → 范式包必须拼进首条 user 消息（如「〔行为规范注入〕…\n\n任务：…」）——比角色卡（roleFile）更灵活，离线驱动可精确控制
4. **续写**：服务端按 messages 全量做上下文；续写 = 读 `~/.kfmv4/sessions/<id>.json` → 追加新 user 消息 → 全量重发
5. **实验覆盖**：配置卡的 sessionId 是面板绑定（可能空或指定会话）；实验每臂独立会话 → overrides.sessionId = armId 动态生成

## 研究管线：batch-run（变体批量）

```
batch-run --variants 范式包A,范式包B,无 --models m1,m2 --tasks t1,t2 --arms 24
  1. 笛卡尔积变体 → 臂清单（armId 编码变体：arm-<模型>-<注入>-<任务>-<n>）
  2. 并发 pool（复用 hallucinate-batch 模式，并发 4，断点续跑）
  3. 每臂 runSession（带变体 paradigm）→ 归档
     .kfmv4/experiments/paradigm/sessions/<armId>.json
  4. 输出臂清单（供判卷）
```

## 目录结构

```
experiments/paradigm/
  index.md                    # 研究线登记（4 假设）
  design-session-runner.md    # 本文档
  tools/
    session-runner.mjs        # 内核（第一步实现）
    batch-run.mjs             # 研究管线（第二步）
    judge-behavior.mjs        # 行为质量尺（第三步，需设计）
.kfmv4/experiments/behavior-injection/sessions/   # 私有数据层
```

## 实现阶段

1. **内核**（session-runner.mjs）：从 routine 抽 startRun/waitRun/归档 + paradigm + 续写——跑通一个变体会话验证注入生效
2. **研究管线**（batch-run.mjs）：变体批量 + 并发 + 断点续跑 + 归档
3. **判卷**（judge-behavior.mjs）：行为质量尺（讨论/任务质量维度——需设计 rubric）
4. **subagent tool**（产品面，AI 之手愿景）：内核封装成 kfm 工具 + 工具卡 UI——独立立项

## 注意点

- 递归深度控制（subagent 里调 subagent 限深）、并发隔离（每臂独立 session）、超时治理
- 范式包质量须经 check 级检验（弱模型忠实模仿错误——负迁移风险）
- 会话落盘清理：研究臂归档后清生产区副本（routine 已有此模式）

## 抗重启：断点续跑与部署前检查（2026-08-06 定型）

背景：8021 服务器重启会杀掉所有实验进程（2026-08-05/06 三次部署误杀实验，
px-base-g25-1 烧到 R8 归零、px-hl 两跑死第 1 轮）。各链路的续跑能力盘点：

| 工具 | 续跑机制 | 状态 |
|------|---------|------|
| batch-run | 臂级：归档文件 existsSync 跳过 + 重试 | 原生已有 |
| judge-llm | 判卷归档存在则跳过已判 | 原生已有 |
| plugin-exam | **每轮落盘 `<id>.exam-state.json`**（cleanHistory 全量无包历史 +
  mounted/mountIdx/nextUser/instructorNote/mountLog/turn），启动时存在即
  从 turn+1 续跑（`--fresh` 强制重跑）；中止退场写 `aborted:true` 且退出码 1 | 本次补齐 |

plugin-exam 续跑天然兼容的原理：每轮本来就是全量重发（runSession
out=sessionFile），视图（buildView）按需包装——状态文件重建变量后从
turn+1 继续即可，transcript 追加「↻ 断点续跑」节、meta 记 `resumed:true`。

**wrapper 幂等+重试模板**（run-px-baseline.sh / run-px-halflife.sh 为范本，
新 wrapper 照抄）：① exam-meta.json 存在且无 `aborted:true` → 跳过；
② 每个 id 最多 3 次尝试，失败（含被 SIGKILL，退出码非 0）sleep 10 后重跑
——plugin-exam 自动断点续跑。注意旧代码退场写 meta 无 aborted 字段：
零数据跑次要手动删 stale meta 才会重跑。

**部署前检查**：`tools/check-active-runs.sh`——扫描「有 exam-state.json 无
完成 meta」的在跑插件实验 + pgrep 实验进程；有在跑实验时退出码 1。
**任何重启 8021 的操作（含部署、kfm_restart）之前必须先跑它**——这条同时
记入部署纪律文档。
