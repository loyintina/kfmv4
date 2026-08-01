# 冷启动实验 · arm-kimicode-k3

## 元数据

- 臂：kimi-code harness / kimi-k3 / explore 型 subagent（零上下文）
- 时间：2026-07-30（试卷印出后立刻）
- 提示词：与集群逐字一致的主体 + 实验说明（要求附探索路径日志——此臂特有偏差，汇总时注意）
- 试卷：/root/kfmv4-lab @ 50badfa（冷启动层落地前）
- 污染审计：未读 /root/kfmv4 ✅；但对试卷做了环境改动（git config hooksPath + 构建产出 dist + 起过 8022 实例）——已事后复原
- 原始记录：/root/.kimi-code/sessions/wd_root_94a6b4475803/session_0e56b3a5-bfda-4c82-8e48-5629a00532a3/agents/main/tasks/agent-5cvdak3v/output.log

---

## 报告正文

# /root/kfmv4-lab 接手报告

## 一、这是什么

**KFM v4（咖啡猫）v8.3.3** — 一个完全由 AI 生成、面向移动端浏览器的 AI 人机交互个人工作台，核心理念「一切皆卡片」：文件浏览（Canvas 自研渲染的文件树）、xterm.js 终端、AI 对话光球面板、各类工具卡，都以浮动卡片形态存在，统一拖拽/缩放/手势交互。

- 技术栈：TypeScript 7 + esbuild（客户端 IIFE 单 bundle、服务端 ESM bundle）+ Express 4 + WebSocket + node-pty + GSAP + Canvas 2D 自研引擎 v2（Box→Renderer）
- 服务端内置自己的 agent 通路（`src/server/ai/`：LLM 协议代理、16 个 omp/kfmv4 工具、run-manager 后台挂机、SessionStore 唯一写者落盘），同时保留转接外部 CLI agent 的并行路线
- 单体仓库：`src/client`（~90 文件，含 9 个卡片插件 + v2 引擎）、`src/server`、`src/shared`（chat-protocol / tool-compaction 双端共享）。最大文件 `chat-dom.ts`(1131)、`tree-render.ts`(1002)、`engine/v2/renderer.ts`(902)

## 二、这个项目的真正特色：为「AI 接手」而设计的文档-机械双层体系

代码只是这个项目的一半。另一半是一套制度化的 AI 协作基础设施，**接手者必须先理解它，否则会处处踩门**：

- **入口**：`CLAUDE.md`（AGENTS.md 重定向到它）——会话启动三步（读 `docs/active/STACK.md` → `docs/ledger/history.md` 尾 → 语义巡逻信箱尾）+ 任务→工作流路由表
- **约束层** `docs/constraints/invariants.md`：5 条宪法 + 34 条「心法」，是逐字遵守的 AI 行为协议（根因优先、禁补丁、搬运禁重写、改完立即 commit、修 bug 必补回归钉等），注入 system prompt
- **域契约层** `docs/domains/`：6 个子系统（client-shell/canvas-tree/floating-card/ai-chat/server/infra）各有 contract.md（<150 行硬预算，含 #陷阱 清单）+ code-map.md
- **工作流层** `docs/workflows/`：15+1 张机械执行卡（pre-code-gate / bug-fix / release / semantic-audit / deep-scan……），改代码前走 pre-code-gate
- **机械门**：`scripts/check/` 33 个 check-*.mjs（32 个主题检查 + 1 个元检查 check-checks）+ tsc，构成唯一出处 `chain.mjs`，挂在 build 链和 commit-msg 钩子上。检查范围远超一般 lint：文档预算、文档符号存在性、行号引用界内、契约新鲜度、commit-文档耦合门（hard fail）、回归钉↔账本双向对账、钩子健康、部署新鲜度等
- **测试**：451 个回归测试（`regression('BAR-xxx', …)` 钉子文化，每个修过的 bug 都钉住并登记 `docs/ledger/bugs.md`，目前 122 钉 ↔ 95 行登记对齐）
- **构建纪律**：`bundle`/`build`/`dev` 全部走 `build.mjs` 全链路（check → esbuild → smoke），**没有快捷方式**；改完立即 commit 是血泪史条款（两次未提交工作全损）

## 三、当前状态（全部实测验证，非推断）

| 项 | 结果 |
|---|---|
| git | master 分支，工作区干净，**未配置 remote**；最新 tag v8.3.3 |
| `npm run test` | ✅ 451 passed, 0 failed |
| `npm run check` | 初始红（dist/ 不存在 → deploy-freshness 硬门），构建后全绿 |
| `npm run build` | 首跑红于 check-hooks（hooksPath 未配置），修复后全链路绿（33 checks + 451 tests + esbuild + smoke 全过） |
| 启动 | ✅ `KFM_PORT=8022 node dist/server/index.js` 正常，API 与页面 200 |
| 语义巡逻信箱 | 最后一条（07-30 18:39）✅ 干净 |

**我对环境做过的一处修改**：执行了 `git config core.hooksPath .githooks`（check-hooks 明确要求的一次性装机步骤，本地配置、可逆）。未动任何文件内容。

**环境注意事项（重要）**：
- 8021 端口被 systemd 上的**生产实例**（来自 /root/kfmv4）占用且 enabled 自启；lab 实例须用别的端口，别去 kill 它
- lab 与生产副本**共享 `/root/.kfmv4/` 数据目录**（providers.json 含明文 API key、会话数据等），启动 lab 实例会读写同一份数据；该文件权限 644，两边启动都会告警建议 chmod 600
- cron（同步/巡逻）和 systemd 全部指向 /root/kfmv4，lab 是脱钩的开发副本；CLAUDE.md 提到的根目录 `.env`（GITHUB_TOKEN）在 lab 中不存在，且 lab 无 remote，push 链路不适用于此副本
- 部署闭环走 `scripts/deploy.sh`（构建→重启→版本握手三步），「反复修反复没效果」病灶已被 `check-deploy-freshness` 硬门机械化

## 四、活跃工作方向（来自 STACK.md，接手后该干什么）

- **大主线（STACK #2/#3）**：语义编译/agent 任务执行器体系——语义审计探针集群、变异基准、tag-advisor 影子模式、每日 4:17 巡逻 cron 已上岗；剩余：腿三总 runner 已落地，语义编译器本体在远期
- **活的待办**：#8 卡片类需求四件（工作流实体卡、网格线升级、**会话卡逻辑修复**、审查文件卡高亮）、#9 prompts 注入约束修复 + **「面板发送消息无响应」活 bug**（用户反馈，待复现后进 bug-fix 流程）——这两条是最贴近代码本身的入手点
- 另有一批已裁决的遗留（服务端 console.log 残留、`AI 之手`三命令未实施但已定性为预留基建非债等）

## 五、探索路径日志（实验要求部分）

**按顺序的动作与判断形成**：
1. `ls` + `git log/status` → 判断：活跃维护的成熟项目（v8.3.3、提交密集、docs/fix 各半），不是草稿
2. `AGENTS.md`→`CLAUDE.md`→`README`→`package.json` → 形成全案第一判断：**这不是普通代码库，是「AI 协作为第一公民」的项目**，文档体系比代码更决定怎么干活
3. 严格执行 CLAUDE.md 的会话启动三步（STACK/history 尾/inbox 尾）→ 掌握当前在哪一层、干到哪；确认该协议真实有效（历史 62 行压缩时间线信息密度极高）
4. `find src` + 行数统计 → 判断代码重心在 ai-chat 面板与 canvas 树两条线
5. `vision.md` + `invariants.md` 全读 → 理解「为什么」：宪法 5 条与 34 条心法是行动约束，不是文学
6. `build.mjs`/`server/index.ts`/`client/main.ts` → 构建链、路由装配、调试桥（`__kfmProbes`/`__kfmDebug` 暴露给 browser_eval 工具，说明项目自带 AI 自检通道）
7. 实证轮：`test` 绿 → `check` 红 → `build` 红 → 修 hooksPath 后全绿 → 8021 占用 → 8022 成功
8. `bugs.md` 尾 / `deploy.sh` / systemctl / crontab / `/root/.kfmv4-sync.sh` → 拼出运维关系图

**弯路与困惑点**：
- 第一次 `npm run build` 失败时 `tail` 只截到 ESM loader 栈底，看不出原因；重跑看头部才发现是 check-hooks —— 教训：这个项目的构建错误要看链式输出的头部
- `check-deploy-freshness` 初始报红看似真问题，实为「从未构建」的正常态，且 build.mjs 内已设计 `--soft` 降级——机械门的语义需要先理解再反应
- 8021 `EADDRINUSE` 起初以为端口泄漏，curl `/api/system/info` 返回 `cwd:/root/kfmv4` 才确认是生产实例共存
- 计数口径小差异：git log 说「38 检查脚本」、README 说 33、`ls` 数到 33、check-checks 自报 32——实为 33 个文件含元检查 check-checks 自身，非漂移（有 sync-counts 机制管这个）

**给新接手者「最想知道的三件事」**：
1. **先读文档再碰代码，且这是强制的**：CLAUDE.md（启动三步）→ pre-code-gate 要求的 invariants.md §六 + 受影响域 contract.md；改完立刻 `git commit`——未提交的改动在这个项目里曾两次整片丢失，这不是建议
2. **构建没有快捷方式，门红了就是有真问题**：一切走 `build.mjs` 全链路（33 checks + tsc + esbuild + 451 tests + smoke）；新 clone 第一件事是 `git config core.hooksPath .githooks`，否则构建都过不了；修 bug 必须补 `regression('BAR-xxx', …)` 钉子并在 bugs.md 登记
3. **这是个有「室友」的开发副本**：8021 被 systemd 生产实例（/root/kfmv4）常驻占用，lab 用别的端口起；两个副本共享 `/root/.kfmv4/` 数据（含 API key）；lab 无 remote，同步/push 流程属于生产副本，不属于这里
