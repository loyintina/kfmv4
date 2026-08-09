> 这是什么：agent 脚本执行器（agent 原件形态 A）的设计与用法。
> 别的去哪找：语义层母体 → ../active/semantic-compiler-seed.md；检查管线 → ../domains/infra/contract.md；立项 → ../active/stack.yaml #3。

# 指南：agent-runner（agent 脚本执行器）

**一句话**：把「固定提示词 + 机械组装输入 + 可验证输出」的独立任务做成可 `node` 调用的脚本——
agent 原件，不是 agent 应用。三明治：**机械组装输入 → agent 判断 → 机械验证输出 → 调用方（agent）消费**。

## 两种形态的分工

- **形态 A（本体系，scripts/agent/）**：独立脚本，洁净室上下文，可进 cron/管线，输出 exit code 语义。
  输入一律机械预装，原件不带工具（可控性来源）。运行库 = `agent-runner.mjs`
  （`runAgent`/`runAgentTooled` 单臂 deepseek 官方链，重试两次后显式透传报错）。
- **形态 B（存量）**：提示词文件由 agent 执行（workflows/ 卡 + subagent）——交互式、需要工具的任务。

## 形态 A 工具流扩展（runAgentTooled，2026-08-04）

探针的「不带工具」不是铁律，而是**工具须受白名单约束**。`runAgentTooled` 给形态 A
加了工具流通道：探针通过 kfm 服务端 `/ai/chat/start`（带 `tools` 白名单 +
`extraSystem` 约束注入）跑多轮工具流会话，复用服务端工具循环/权限引擎/白名单三层过滤，
**不本地执行任何工具**——可控性来源从「探针没有工具」迁移到「探针只被允许用白名单内
工具，且执行在服务端统一护栏内」。

- 输出契约与 `runAgent` 一致（`{ok, data, raw, provider, attempts, errors}`），另附
  `tooled:true`、`fallback:true`（服务端不可达 → 自动降级纯文本，巡逻不空窗）。
- 任务级声明：semantic-audit 任务清单 `tools?: string[]` 字段，给了走工具流，不给走纯文本。
- 边界 = 检测：探针白名单只给读类（read/grep/glob），**禁止 write/edit/bash**——修复留给会话 agent。
- 依赖：kfm 服务在线（fallback 保底）；流式多轮比单轮贵，超时给足（默认 600s）；
  `maxTokens` 默认 32000——思考链计入 max_tokens，默认 16384 会被长思考吃光、
  text 为 0 导致校验失败（2026-08-04 试点事故），任务级 `maxTokens` 可覆盖。
- 思考控制（2026-08-04 官方实测）：opencode 中转只认 `thinking:{type:'disabled'}` 硬开关
  （effort 档位失真 1.5 倍）；deepseek 官方 `reasoning_effort` 真控制（flash 映射 low→low，
  难任务实测 1788 vs max 6272 字符），且带 tools 必须回传 `reasoning_content`（服务端已支持）。
  推荐组合：`provider:'deepseek'` + `params:{thinking:{type:'enabled'}, reasoning_effort:'low'}`
  + max_tokens 兜底——思考保留在 reasoning 通道（不外溢、AI 保持 JSON 输出纪律）且长度受控
  （试点 1 次尝试通过校验，产出真实发现）。
  ⚠️ 不用 effort=max（实测必吃光预算 → text 空）；不用 thinking disabled（试点实测失败：
  思考过程外溢进 text、拒不输出 findings JSON）。

## 输出协议（调用方 = agent，不存在「人工兜底」，兜底是会话间接力 agent）

- **exit 0**：输出精确（schema 校验通过），机械流程直接走
- **exit 2**：全 provider 失败或校验重试耗尽——errors/原始结果抛 stdout，调用方读了自己判断
  （原设计的 exit 1「模糊输出交调用方」未实现，重试耗尽现归 exit 2——语义审计 B2 修订；实现侧见 scripts/agent/tag-advisor.mjs）
- 未来自主触发（cron 无 agent 在场）才需要邮箱位（STACK 拾取），当前调用方永远在场，不设

## provider 兜底链

`providers.config.json` 单臂链：deepseek/deepseek-v4-flash（2026-08-05 两次重排收敛：
opencode 网关两臂额度耗尽撤下、阶跃星辰顺位也撤——全链只留自有额度官方臂；
失败原地重试 2 次（runAgent `retries` 默认 2），仍失败显式报错透传 errors，
不再顺位兜底——错误可见性优先于成功率）。
key 从 `~/.kfmv4/providers.json` 按 id 读；调用失败自动落下一个；
可选 `params` 覆盖请求参数（现配 `response_format: json_object`——「只输出 JSON」从 prompt 约束升级为端点约束，与 validate 重试双保险）。

**中转池体质（2026-07-30 实测）**：`opencode.ai/zen/go` 是 Cloudflare 挡前的
**共享额度中转池**，非官方 API——池拥挤时会把上游失败吞成「200 空响应」
（间歇性，同一参数组稍后即恢复）；Cloudflare error 1010 按客户端签名封禁
非浏览器 UA（python urllib 403，node fetch 放行）。与官方 deepseek 的本质
区别：共享额度便宜但不稳定 vs 自有额度按量付费稳定。**空响应/429 不是协议
不兼容，是池体质**——兜底链（空响应原地重试 → 落下一个 provider）就是为
吸收它设计的，看到链上前两臂失败、官方臂成功 = 系统正常工作，不是 bug。

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
→ deepseek 官方 → 阶跃星辰。
2026-08-05 再重排：opencode 网关两臂（Go Google / Go GitHub）额度耗尽撤下；同日
阶跃星辰顺位亦撤（用户拍板：自有额度官方臂失败即显式报错，不静默顺位）——链收敛为
deepseek 官方单臂，见上文「provider 兜底链」。）
未来前端设置卡负责该链的可视化编排 + key 健康状态（STACK #3 配套）。

## 输出可控性

不靠参数压制，靠**校验+重试**：`validate(text)` 返回 data 或 null，null 则带错误反馈重问
（同 provider，默认 2 次）。多余文字会被 schema 校验当场打回——编译器报错的同一反射回路。

## 触发三层（一号负载实例）

1. **机械雷达**：`check-release-radar`（check 链第 28 个，warning）——commits≥30 或 feat≥10 提醒，
   阈值经 14 历史版本对论证；职责是「不忘」
2. **agent 判定**：`node scripts/agent/tag-advisor.mjs`——语义判级别 + 起草 release note
3. **人拍板**：tag 是 git mutation，永远人工

## 测试协议（agent 脚本投产前后必过）

1. **回放测试**：历史版本对 = 黄金集，`node scripts/agent/test-tag-advisor.mjs [近N对]`，
   一致率 ≥70% 进影子模式（分歧样本是 prompt 调优输入，不必然是错——历史发版本就不规范）
2. **否定测试**：周期中段切片须「忍住」（测不发版的判断力）
3. **影子模式**：建议归建议，决定归人，分歧记 `ledger/tag-advisor-shadow.md`
4. **投产仍只产建议**：mutation 类动作永远人拍板
5. **首班岗演练**（2026-07-30 用户拍板）：投产后第一班必须有人盯着实战跑一轮，
   交「首班报告」（逮到了什么 + 机制自身出了什么丑），凭报告才算正式投产。
   模糊层版的 check-probes 探针条款——新探测器第一次真跑，既是它检查世界、
   也是世界检查它。判例：semantic-chain 首班逮 8 条发现 + 暴露自身 2 机制缺口
   （keptFindings 不落盘 / 增量跳过吞未裁决），不首班验收这两个洞永久潜伏

> tag-advisor 回放实录（2026-07-29，三轮）：47% → 57% → 61%（原始）；
> 调整后 83%（豁免类：major 提交清单无信号 5 例 + v6 小窗历史标级松 3 例）。
> 剩余 6 例「细化归 patch」顽固分歧中部分实为历史错标——继续调 prompt = 拟合噪音，转影子模式由真实世界裁决。

## 新负载如何加

1. 在 scripts/agent/ 下写新脚本（参照 tag-advisor.mjs）：`runAgent({ system, prompt, validate })`，输入机械组装
2. 需要新触发位 → 对应 check/钩子挂提醒（雷达模式）
3. 走测试协议四段再投产（投产后还有第五段：首班岗演练）

## 二号负载：semantic-audit.mjs（探针集群，2026-07-30）

语义审计的脚本化（母体 → ../active/semantic-compiler-seed.md；任务清单 → scripts/agent/semantic-audit.tasks.mjs）：

- **编排器 + 任务清单分离**：一个探针只问一个问题（组内/组间条数单源 = semantic-audit.tasks.mjs，
  2026-08-03 实况 18 + 6），组间探针种子来自
  ledger/semantic-provenance.md 实测冲突对——不打 N² 笛卡尔积
- **并发 10 洁净室**：任务间零共享上下文，单任务失败不拖垮全局（进 errors 不阻塞）。
  定档依据（2026-07-30 变异基准三曲线）：conc3/10/20 成绩在噪声带内不动、conc20
  全 Google 端 22/22 绿——并发只影响速度不影响质量，10 留一倍余量
- **增量对账**：任务输入（定义+文档内容）哈希没变即跳过（make 式）；哈希含
  AUDIT_VERSION 版本盐（脚本/prompt 变更 +1 令旧哈希失效）。`--full` 强制全量、
  `--dry-run` 只出计划、`--task=<id>` 单跑
- **拜占庭对策代码化**：发现的 claim/against 证据行必须真实存在，否则计入 dropped（幻觉拦截）
- **记账**：reported/kept/dropped/provider/attempts 全量进 `docs/ledger/semantic-audit-state.json`，
  per-任务精确率是 prompt 迭代的数据源；keptFindings 明细同样落盘（重跑刷新、跳过保留）——
  cron 无人值守时裁决轮的唯一入口（2026-07-30 首跑教训：只打印 stdout = 发现蒸发，
  且增量跳过一次就把未裁决发现吞掉）
- **采样闪烁（诚实边界，2026-07-30 首跑实测）**：keptFindings 重跑即刷新——LLM 采样方差
  会让上一轮的真发现在新一轮静默消失（工作流卡 2 条 exit_condition 张力即因此从账上
  掉落，凭 stdout 证据人工追回修复）。趋势看多轮，单轮消失 ≠ 已裁决
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

## 三号负载：semantic-chain.mjs（语义巡逻总 runner，腿三，2026-07-30 用户拍板）

定时巡逻编排：跑腿一（增量）→ 聚合成单结论 → 投信箱 → 走人。裁决不归它管。

- **三态 verdict**：✅ 干净 / ⚠️ N 条待裁决（指向裁决流 workflows/semantic-audit.yaml）/
  💀 退化（腿一 exit 2，provider 链异常）；永远 exit 0——注意力信号不是构建失败。
  ⚠️ 的 N = 全量未裁决数（各任务 keptFindings 之和，跨任务去重），非本轮新增——
  修复或豁免登记才让数字下降，增量跳过不会吞掉旧发现
- **信箱**：`docs/ledger/semantic-chain-inbox.md`（append-only 一行一轮）；新会话 agent
  读尾部见 ⚠️ → 进裁决流。未裁决发现下轮重复出现是特性（注意力门控靠反复提醒兑现）
- **--with-bench**：顺带跑变异基准做尺校准（invariants #32），成绩单摘要行进信箱；
  基准有 API 成本，cron 每周一次即可
- **cron 安装**（2026-07-30 装机）：每日 `17 4 * * *` 巡逻 + 每周一 `23 4 * * 1` 带基准，
  日志 `/var/log/semantic-chain.log`


## 四号负载：browser-relay.mjs（守视——视觉自测基建，2026-08-06 用户拍板）

常驻服务型工具（与一次性负载不同：daemon + CLI，任何 agent 可调用，含未来 kfmv4
面板 agent）。用途：UI 开发的「改 → 自己看 → 再改」闭环——headless Chrome 截图
落盘，agent 读图验证排版/遮挡/交互，替代「用户描述 → 猜」。

- **用法**：`node scripts/agent/browser-relay.mjs <cmd>`（open/shot/click/type/eval/
  wait/state/tabs/close/viewport/stop），stdout 单行 JSON；shot 返回 png 路径供读图。
  daemon 未启动时 CLI 自动拉起，端口 8033（控制面只认 127.0.0.1）
- **视口校准**：真机开 `http://<服务器>/kfmv4/test`（8021 常驻校准页，POST 存
  ~/.kfmv4/browser-relay/viewport.json），新开标签按真机视口渲染；未校准默认 400×812@2x
- **长跑自洁**：闲置 10min 自退（/health 不算活动）/ 标签上限 8 LRU / 截图留最新 50 /
  每次启动全新 profile 禁磁盘缓存 / 6h 强制退休兜底
- **陷阱**：bundle/css 是 immutable 缓存——验证前端改动前必须 `stop` 重启 daemon，
  否则新标签也吃旧包（2026-08-06 实测踩中）
- 视觉断言回归化（几何断言固化为测试钉）为候选方向，尚未立项


## 五号负载：obs-aggregate.mjs（观测台聚合器，史官制度 8.5）

周报生成（cron 每周聚合）：读三本 append-only 账本——`~/.kfmv4/ledger/agent-calls.jsonl`
（LLM 调用：provider/耗时/成败）、`~/.kfmv4/ledger/permission-audit.jsonl`（工具调用审计：
RiskClass/判定）、`docs/ledger/semantic-chain-inbox.md`（文档健康趋势）→ 周报文本
stdout，`--mailbox` 投信箱。用法：`node scripts/agent/obs-aggregate.mjs [--days=7] [--mailbox]`。

## 六号负载：session-retention.mjs（巡逻会话生命周期，2026-08-06 用户拍板）

sessions/script/ 只进不出必淤积——治药是生命周期不是换数据库（用户判断：
访问模式=写一次/整篇读/按时间列，文件系统天然适配；全文检索需求出现时再议入库）。
规则：`patrol-*.json` 超龄 90 天 → tar.gz 进 `sessions/script/archive/`（按运行日命名），
原件删除。只碰 patrol- 前缀——bi-/px-/sandbox-/_quarantine 归 paradigm 进程自治，
面板区人工会话永不进视野。用法：`node scripts/agent/session-retention.mjs [--days=90] [--dry-run]`，
测试注入 KFM_DATA_DIR。cron 每日 04:53（巡逻 04:17 之后）。
