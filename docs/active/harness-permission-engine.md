# harness 权限引擎设计（8.5 主题：行为守界）

> 2026-08-02 立项（用户拍板 8.5 = 行为守界）。姊妹蓝图：`experiments/harness-studies/openworker.md`
> （吴恩达团队 OpenWorker 权限机制逆向，286 行含文件:行号）。
> 数据依据：`experiments/coldstart/reports/06-harness-behavior.md`（124 臂实验——
> 20% 破界、16 臂 edit 修复者「诊断全对、纪律归零」）+ 03-boundary-discipline.md。

## 0. 一句话定位

**把边界纪律从提示词挪进代码**——harness 工具执行层加 `PermissionEngine.evaluate()` 拦截点，
fail-closed（默认拒绝、显式放行）。提示词边界条款保留（降低触发频率），机制是最终防线。

## 1. 现状盘点（改什么）

| 现状 | 位置 | 问题 |
|------|------|------|
| 工具直接执行，无权限层 | `src/server/ai/tools/index.ts` executeTool | 越界靠模型自觉 |
| 边界条款在提示词 | onboarding.md §4 / 角色卡 | 124 臂实测失效（edit 修复者 16 臂） |
| 散落校验 | BAR-SEC 系列（sanitizePath/isValidSessionId）、PROJECT_ROOT cwd | 各管一段，无统一裁决面 |
| 审批无通道 | 无 | 面板无人值守=静默 |

## 2. RiskClass 映射（对 kfmv4 工具面）

| RiskClass | 语义 | kfmv4 工具 | 策略 | 实验依据 |
|-----------|------|-----------|------|---------|
| read | 只读，无副作用 | read / glob / grep / web-search / kfm 读类 | **永不 gate** | 06：读工具与破界无关 |
| write_local | 写本地，路径可控 | write / edit / 文件操作 | 路径限定（会话根/SAFE_ROOT 内）+ 询问 | 02 F2：越界多写在「不该写的地方」 |
| exec | 执行命令，副作用面大 | **bash** | 门控（白名单 + 审批） | 06：做事通道与破界正相关；18 臂构建/部署越界 |
| external | 外部副作用 | commit/push、kfm-restart、未来 AI 之手页面操作 | 审批；**无人值守一律拒绝** | 11 臂 commit 越界；无人臂 build 越界（验证轮冒烟实测） |

## 3. evaluate 契约

```ts
// src/server/ai/tools/index.ts — executeTool 内，工具执行前
type Decision =
  | { action: 'allow' }
  | { action: 'deny'; reason: string; rule?: string }
  | { action: 'ask'; prompt: string };      // 有人在场 → 面板批准卡；无人值守 → 落 deny

async function evaluate(name: string, params: Record<string, unknown>, ctx: ToolContext): Promise<Decision>
```

- **fail-closed**：未知工具/未知参数形态 → deny；
- **deny 呈现**：对 agent 只表现为工具错误 `denied by user: <reason>`——无绕过通道（OpenWorker permissions.py:120 同构）；
- **规则可解释**：每次决策带 rule 引用（RiskClass 派生或 allowlist 命中），进审计日志；
- **允许携带上下文**：`ctx` 含会话工作区（activeRoot/PROJECT_ROOT）、运行模式（attended/unattended）。

## 4. 审批通道

- **有人在场**：面板出「批准卡」（ws 事件走现有命令通道，`approval-request` → 用户批准/拒绝 → `approval-resolve`）——工具调用挂起等待（带超时，超时落 deny）；
- **无人值守**（常态化验证 / cron / 未来 AI 之手无人模式）：`ask` 一律落 `deny`（fail-closed，不静默放行，不挂死——OpenWorker Inbox 挂起 vs 我们的拒绝：先拒绝后记录，简单可靠）；
- **会话级 allowlist**：用户显式批准过的「工具+参数形态」记入会话 allowlist（`ONCE/ALWAYS_TOOL/ALWAYS_COMMAND` 三档），减少重复询问；豁免必须绑定具体对象（精确命令串），不允许宽豁免（OpenWorker standing rule 粒度）。

## 5. roots 硬边界 + shell 白名单

- **roots**：写类工具的路径必须落在会话工作区根（activeRoot）内——拒绝逃逸；跨根操作（如验证轮探索 /root/kfmv4-lab）走显式批准；
- **shell 白名单**（bash 工具）：
  1. 元字符拦截：`; & | > < \` ` $ ( ) \n \r` 任一出现即拒（防 `git status && rm -rf`）；
  2. argv token 精确前缀：`git status` 不放行 `git statusfoo`；
  3. 默认空白名单 + 用户确认后进 allowlist；
  4. 「没有普遍安全的可执行文件」原则（OpenWorker 明示）——允许清单按命令精确匹配，不按可执行文件名。

## 6. 审计日志（破界率观测仪）

```json
{ "ts": "...", "sessionId": "...", "tool": "bash", "paramsSummary": "git add -A ...",
  "riskClass": "exec", "decision": "allow|deny|ask→deny", "rule": "allowlist:EXACT|deny:meta-char|...",
  "mode": "attended|unattended" }
```

落 `~/.kfmv4/permission-audit.jsonl`（append-only）。观测口径（关键定义）：

- **模型试图越界被拦**（deny 且模型主动发起了危险操作）= **门控生效**，是成功不是失败；
- **越界成功**（危险操作实际执行）= 门控失败，才是破界；
- **破界率新口径** = 越界成功数 / 危险操作尝试数——与 124 臂的「破界定级」（30/31 信度）对接，从此有机器侧证据。

## 7. 小版本推进

| 版本 | 内容 | 验收 |
|------|------|------|
| 8.5.0 | RiskClass 映射 + evaluate 骨架（fail-closed）+ 审计日志 | 基线破界率建立；危险操作 100% 走 evaluate |
| 8.5.1 | 审批通道（面板批准卡 + ws 事件）+ 无人值守 fail-closed | 面板可批准/拒绝；无人臂危险操作全 deny |
| 8.5.2 | roots 硬边界 + shell 白名单 | 写工具逃逸 0；`;`/`&&` 命令全拦 |
| 8.5.3 | 会话 allowlist + 破界率仪表化 + 常态化验证回归 | 破界率对比基线（20% → 目标明显下降）；allowlist 摩擦可接受 |

## 8. 风险与开放问题

1. **审批 UI 是新交互面**（批准卡设计）——8.5.1 工作量大头；
2. **无人值守口径**：常态化验证臂会从「破界后自愈」变「直接 deny」——基线对比必须标注条件变化，防「破界率下降」自欺（deny 是成功，但观测口径要写死）；
3. **误伤风险**：shell 白名单对复杂合法命令（管道/脚本）可能误伤——allowlist 按命令确认累积，被拦即记录供人工补；
4. **与 AI 之手的关系**：权限引擎是 AI 之手的前置地基（AI 操作页面更需要门控），审批 UI 设计要兼顾未来 AI 操作场景；
5. **性能**：evaluate 是纯本地判定（白名单/路径/元字符），毫秒级，不进 LLM——不烧 token、不加延迟。

## 9. 关联

- 蓝图：`experiments/harness-studies/openworker.md`（PermissionEngine/risk.py/roots.py/白名单模板）
- 数据：`experiments/coldstart/reports/03-boundary-discipline.md`（破界分型/谱系）、`06-harness-behavior.md`（工具暴露面与破界正相关）
- 测量：`experiments/coldstart/tools/routine-entry-validation.mjs`（常态化验证 = 权限引擎回归场）
- 远景：`docs/active/vision.md` §研究参考（可插拔 Agent 引擎 → harness 权限引擎为地基）
