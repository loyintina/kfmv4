> 这是什么：agent 脚本执行器（agent 原件形态 A）的设计与用法。
> 别的去哪找：语义层母体 → ../active/semantic-compiler-seed.md；检查管线 → ../domains/infra/contract.md；立项 → ../active/STACK.md #3。

# 指南：agent-runner（agent 脚本执行器）

**一句话**：把「固定提示词 + 机械组装输入 + 可验证输出」的独立任务做成可 `node` 调用的脚本——
agent 原件，不是 agent 应用。三明治：**机械组装输入 → agent 判断 → 机械验证输出 → 调用方（agent）消费**。

## 两种形态的分工

- **形态 A（本体系，scripts/agent/）**：独立脚本，洁净室上下文，可进 cron/管线，输出 exit code 语义。
  输入一律机械预装，原件不带工具（可控性来源）。
- **形态 B（存量）**：提示词文件由 agent 执行（workflows/ 卡 + subagent）——交互式、需要工具的任务。

## 输出协议（调用方 = agent，不存在「人工兜底」，兜底是会话间接力 agent）

- **exit 0**：输出精确（schema 校验通过），机械流程直接走
- **exit 2**：全 provider 失败或校验重试耗尽——errors/原始结果抛 stdout，调用方读了自己判断
  （原设计的 exit 1「模糊输出交调用方」未实现，重试耗尽现归 exit 2——语义审计 B2 修订；实现侧见 scripts/agent/tag-advisor.mjs）
- 未来自主触发（cron 无 agent 在场）才需要邮箱位（STACK 拾取），当前调用方永远在场，不设

## provider 兜底链

`providers.config.json` 有序列表：deepseek/deepseek-v4-flash → 阶跃星辰/step-3.7-flash。
key 从 `~/.kfmv4/providers.json` 按 id 读；调用失败自动落下一个；
可选 `params` 覆盖请求参数（现配 `response_format: json_object`——「只输出 JSON」从 prompt 约束升级为端点约束，与 validate 重试双保险）。

**禁思考字段（deepseek 实测 2026-07-30）**：`thinking: {"type": "disabled"}` 是真开关
（572ms/5 completion tokens vs 裸 6083ms/445 tokens；`reasoning_effort:none` 非法、
`low` 只降不关、`enable_thinking:false` 静默忽略）。负载级选择：`runAgent({ params })`
透传覆盖——抽取型负载（JSON 提取/判定）关思考换速度，推理型负载（语义审计）勿关。
注意思考链吃 max_tokens：推理型负载上限要给足（审计用 16000，首轮 2000 全灭教训）。
**对照实验（2026-07-30 exp-thinking.mjs，4 审计任务 × 2 臂，顺序交替）**：关思考提速
51-71×（1.3-1.7s vs 72-97s）但 4 任务产出**全部为零**——1.4s 对 16-51KB 审计 prompt
返回空 = 根本没分析；开思考臂报 7 条（该样本下全假——文档已收敛，真发现信号枯竭，
召回差异待变异基准测）。结论：推理型负载关思考 = 没审，勿关铁律有硬数据了。
单次请求超时 `runAgent({ timeoutMs })`，默认 120s（2026-07-30 由 60s 上调——
inter-workflows 大 prompt 探针双端 60s 超时失败教训）。
（2026-07-30 用户拍板撤下 Kimi/kimi-for-coding-highspeed 链首位：端点过严——审计大 prompt
连续空响应，且该系只允许 temperature=1 与「只输出 JSON」任务相克，原 infra code-map 漂移 12 结案。
同日链路重排：Opencode Go Google/deepseek-v4-flash → OpenCode Go GitHub（429 月限额，8 天复位）
→ deepseek 官方 → 阶跃星辰。）
未来前端设置卡负责该链的可视化编排 + key 健康状态（STACK #3 配套）。

## 输出可控性

不靠参数压制，靠**校验+重试**：`validate(text)` 返回 data 或 null，null 则带错误反馈重问
（同 provider，默认 2 次）。多余文字会被 schema 校验当场打回——编译器报错的同一反射回路。

## 触发三层（一号负载实例）

1. **机械雷达**：`check-release-radar`（check 链第 28 个，warning）——commits≥30 或 feat≥10 提醒，
   阈值经 14 历史版本对论证；职责是「不忘」
2. **agent 判定**：`node scripts/agent/tag-advisor.mjs`——语义判级别 + 起草 release note
3. **人拍板**：tag 是 git mutation，永远人工

## 测试协议（agent 脚本投产前必过）

1. **回放测试**：历史版本对 = 黄金集，`node scripts/agent/test-tag-advisor.mjs [近N对]`，
   一致率 ≥70% 进影子模式（分歧样本是 prompt 调优输入，不必然是错——历史发版本就不规范）
2. **否定测试**：周期中段切片须「忍住」（测不发版的判断力）
3. **影子模式**：建议归建议，决定归人，分歧记 `ledger/tag-advisor-shadow.md`
4. **投产仍只产建议**：mutation 类动作永远人拍板

> tag-advisor 回放实录（2026-07-29，三轮）：47% → 57% → 61%（原始）；
> 调整后 83%（豁免类：major 提交清单无信号 5 例 + v6 小窗历史标级松 3 例）。
> 剩余 6 例「细化归 patch」顽固分歧中部分实为历史错标——继续调 prompt = 拟合噪音，转影子模式由真实世界裁决。

## 新负载如何加

1. 在 scripts/agent/ 下写新脚本（参照 tag-advisor.mjs）：`runAgent({ system, prompt, validate })`，输入机械组装
2. 需要新触发位 → 对应 check/钩子挂提醒（雷达模式）
3. 走测试协议四段再投产

## 二号负载：semantic-audit.mjs（探针集群，2026-07-30）

语义审计的脚本化（母体 → ../active/semantic-compiler-seed.md；任务清单 → scripts/agent/semantic-audit.tasks.mjs）：

- **编排器 + 任务清单分离**：一个探针只问一个问题（组内 17 + 组间 6），组间探针种子来自
  ledger/semantic-provenance.md 实测冲突对——不打 N² 笛卡尔积
- **并发 10 洁净室**：任务间零共享上下文，单任务失败不拖垮全局（进 errors 不阻塞）。
  定档依据（2026-07-30 变异基准三曲线）：conc3/10/20 成绩在噪声带内不动、conc20
  全 Google 端 22/22 绿——并发只影响速度不影响质量，10 留一倍余量
- **增量对账**：任务输入（定义+文档内容）哈希没变即跳过（make 式）；哈希含
  AUDIT_VERSION 版本盐（脚本/prompt 变更 +1 令旧哈希失效）。`--full` 强制全量、
  `--dry-run` 只出计划、`--task=<id>` 单跑
- **拜占庭对策代码化**：发现的 claim/against 证据行必须真实存在，否则计入 dropped（幻觉拦截）
- **记账**：reported/kept/dropped/provider/attempts 全量进 `docs/ledger/semantic-audit-state.json`，
  per-任务精确率是 prompt 迭代的数据源
- **exit 协议**：0 = 流程跑完（发现是产出不是失败）；2 = 全部任务失败/环境缺 provider；
  非阻断，不挂 check 链（概率区纪律）

### 变异基准：semantic-mutate.mjs + semantic-bench.mjs（2026-07-30 用户拍板）

真实漂移收敛后准确度信号枯竭——mutation testing：往沙盒副本注入已知缺陷测召回/误报。
- `semantic-mutate.mjs`：变异目录（首卷 10 条 = L1 历史复刻 5 + L2 SEM×元素矩阵 3 +
  L3 near-miss 负例 2）+ 沙盒物化（tmp/semantic-bench/，gitignored）+ ground-truth.json。
  find 串失效即物料过期，目录随文档演进维护；逃逸病例裁决后复刻进目录，卷子只长不缩
- `semantic-bench.mjs [--remutate] [--conc=N] [--dup=N]`：对沙盒跑受影响探针，
  claim 文件+行 ±5 对分。审计模块经 SEMANTIC_AUDIT_ROOT 环境变量指沙盒，活树无感
- 首卷三曲线（conc 3/10/20）：召回稳定 2-3/8（直接矛盾全逮，推理型/缺席型全漏——
  M02 归属推理/M05 同文件拼写/M06 证据缺席/M07 长链推理是稳定盲区），NC 0-2/2 波动
- **分数纪律：单轮 ±1 是 LLM 采样噪声不是信号，比分数看连续多轮趋势**
- 副产物：额外发现已逮 4 条真漂移（prompts/ 无测绘、ai/ 归属三方分叉、code-map 60s
  旧超时、yaml dangling 术语）——基准卷兼作探矿器
