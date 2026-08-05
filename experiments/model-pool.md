# 标准模型池（2026-08-05 v2 用户定稿）

> 实验测试统一用这份池，不分通道（用户原话：「以后做测试，这两系统一做，不要有区分」）。
> 通道只是路由，模型才是样本。选模型的原则：覆盖能力梯度（小/中/大）× 跨家族 × 成本可控。

## 变更记录

- 2026-08-05 v3：聚光系从 20 精简到 12（用户要求去重：同模型多通道只留一个，按次/特价优先，e7c 锚点除外；thinking 变体每系列留一个测推理通道适配）。
- 2026-08-05 v2：删除 Opencode Go 系（额度耗尽，小 plan 顶不住批量实验）；聚光系从 6 扩到 20（用户给清单，探针 20/22 通过）；硅基流动 12 不变。
- 2026-08-05 v1：初版（opencode 7 + 聚光 6 + 硅基流动 12）。

## 聚光系（12 模型，2026-08-05 探针全通过）

聚光成本极低：1 刀 ≈ 0.16 元人民币。**按次计费的模型成本与 token 长度无关**，跑长梯度包（96k+）时优势巨大。

| 模型 ID | 家族 | 档位 | 计费 | 单次成本 | 备注 |
|---|---|---|---|---|---|
| gpt-5-mini | GPT | 小 | 按量 | | e7c 锚点（288 臂） |
| [codex]gpt-5.4-mini | GPT | 小 | 待确认 | | codex 通道对照 |
| [codex]gpt-5.6-luna | GPT | 中 | 待确认 | | GPT 中档独苗 |
| [0.4刀/次]gemini-3.5-flash | Gemini | 小 | 按次 | ≈0.064 元 | 最新 flash |
| [酒馆专用0.9刀/次]gemini-2.5-pro | Gemini | 中 | 按次 | ≈0.144 元 | 对应 e7c 的 2.5-pro-t3 |
| [1刀/次]gemini-3-pro-preview-think | Gemini | 大 | 按次 | ≈0.16 元 | 推理型 |
| claude-haiku-4-5-20251001 | Claude | 小 | 按量 | | e7c 锚点（288 臂） |
| [kiro]claude-sonnet-4-6 | Claude | 中 | 按次 | 一毛级 | |
| kiro-claude-sonnet-5-thinking | Claude | 中 | 按次 | 一毛级 | 推理型 |
| [kiro]claude-opus-4-8 | Claude | 大 | 按次 | 一毛级 | **e7c 对照锚点（288 臂）** |
| [kiro]claude-opus-4-8-thinking | Claude | 大 | 按次 | 一毛级 | 推理型 |
| kiro-claude-opus-5 | Claude | 超大 | 按次 | 一毛级 | 最新旗舰 |

去重砍掉的 8 个（同模型重复通道/被相邻档位夹挤）：[0.4刀/次]gemini-3-flash、[ant]gemini-3.5-flash、
[特价]claude-haiku-4-5-20251001、gemini-2.5-pro（按量）、gpt-5.6-luna（按量）、[kiro]claude-opus-4-5、
[kiro]claude-sonnet-4-6-thinking、kiro-claude-sonnet-5。
探针失败（503 No available channel，硬不可用）：`gpt-5-nano`、`kimi-k2.5`——不入池。

聚光系窗口未逐测（多为转发通道，官方页无直接规格）：按系族常规值估算（GPT 系 400K /
Gemini 系 1M / Claude 系 200K），89.8k 包占用率 ≤45%，e10/e11 无顶穿风险；
e11 的 D 档（2×L，最长 ~180k）仅 Gemini/GPT 系可跑，Claude 200K 跑 D 档上限 2×64k。

历史数据注意：e7c 用过的 `gemini-2.5-flash-t3`、`gemini-2.5-pro-t3`、`gpt-5` 不在新池名单内，
跨批对照锚点：`gpt-5-mini`、`claude-haiku-4-5-20251001`、`[kiro]claude-opus-4-8`。

## 硅基流动系（12 模型，便宜小模型为主）

上下文窗口为 2026-08-05 普查结果（siliconflow.com 官方模型页，**平台实际值**，可能与模型原生值不同）。

| 模型 ID | 家族 | 类型 | 上下文窗口 | 89.8k 包占用率 |
|---|---|---|---|---|
| Pro/deepseek-ai/DeepSeek-R1 | DeepSeek | 推理 | 164K（另有 96K 旧口径，未统一） | 55%（96K 口径 94%） |
| Pro/deepseek-ai/DeepSeek-V3 | DeepSeek | 非推理 | 164K | 55% |
| Qwen/Qwen3.6-35B-A3B | Qwen | 推理 | 262K | 34% |
| Qwen/Qwen3.5-4B | Qwen | 推理 | 262K（推测，同系列口径） | 34% |
| Qwen/Qwen3.5-9B | Qwen | 推理 | 262K | 34% |
| Qwen/Qwen3.5-27B | Qwen | 推理 | 262K | 34% |
| THUDM/GLM-4-32B-0414 | GLM | 非推理 | **33K** | **274% ✗ 顶穿** |
| THUDM/GLM-Z1-9B-0414 | GLM | 推理 | 131K（平台扩展，原生 32K） | 69% |
| zai-org/GLM-4.5-Air | GLM | 非推理 | 131K | 69% |
| inclusionAI/Ling-mini-2.0 | 蚂蚁 | 非推理 | 131K | 69% |
| stepfun-ai/Step-3.5-Flash | 阶跃 | 推理 | 262K | 34% |
| Pro/MiniMaxAI/MiniMax-M2.5 | MiniMax | 推理样 | 197K（平台截断，原生 256K） | 46% |

**e9 适应性调整（占用率普查直接后果）**：
- `GLM-4-32B-0414`（33K 窗口）：只能跑 0/8.1k(25%)/30.1k(92%) 三档，47.4k 及以上物理顶穿——
  不跑满档，按 3 档 × 8 臂 = 24 会话计。它反而成了 H8 占用率假设的天然近满样本。
- 89.8k 档在 GLM-Z1-9B/GLM-4.5-Air/Ling-mini（131K）上占用率 69%，在 R1（96K 旧口径）上 94%——
  e9 数据天然覆盖 25%-94% 的占用率谱，分析时**按占用率分桶**，不只按档分桶。
- 账户状态：API 显示欠费 -67.05 但调用正常（后付费模式）；用户后台显示余额约 49 元（以用户后台为准，差异未查明）。

## 判卷适配备注

- **推理模型**（reasoning_content 通道）：思考过程可能不进正文 text 块——
  判卷尺（正则/LLM）读的是正文，推理模型的「元认知显式化」可能在 reasoning 通道测不到，
  判卷时需先检查会话文件结构再定尺。新池中 `-thinking` / `-think` 后缀模型同属此类。
- **成功率**：聚光部分通道成功率约 80%+（用户说明），批量跑臂时重试 2 次基本可覆盖；
  batch-run 需确认有失败重试机制，失败臂记入结果而非静默丢弃。
- 已有梯度数据：mm3/flash（e7/e8）、聚光旧 6 模型（e7c）——跨批对照锚点 `[kiro]claude-opus-4-8`。
