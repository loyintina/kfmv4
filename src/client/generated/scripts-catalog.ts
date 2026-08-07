/**
 * scripts-catalog.ts — 脚本目录（脚本卡数据源）
 *
 * ⚠️ 本文件由 scripts/check/gen-scripts-catalog.mjs 生成，禁止手改。
 * 改脚本/加脚本后跑：node scripts/check/gen-scripts-catalog.mjs
 * 登记字段在 scripts/scripts-catalog.manifest.json。
 */

export interface ScriptCatalogEntry {
  name: string;
  file: string;
  category: string;
  description: string;
  permission: string;
  prompt: string;
  effect: string;
}

export const SCRIPTS_CATALOG: ScriptCatalogEntry[] = [
  {
    "name": "gen-hallucination-inputs.mjs",
    "file": "experiments/coldstart/tools/gen-hallucination-inputs.mjs",
    "category": "冷启动工具",
    "description": "为 subagent 判卷生成输入文件",
    "permission": "读 derived/arms.json 与判卷规程文件，写 derived/hallucination-inputs/<armId>.md；本身不联网不调 LLM",
    "prompt": "判卷规程在外部文件 experiments/coldstart/prompts/judge-hallucination.md（本脚本只把它固化进输入文件）",
    "effect": "为 subagent 判卷生成输入 md（规程 + 机械候选清单 + 证据包）"
  },
  {
    "name": "hallucinate-batch.mjs",
    "file": "experiments/coldstart/tools/hallucinate-batch.mjs",
    "category": "冷启动工具",
    "description": "第二把尺批量驱动（出处反查，幻觉率测量）",
    "permission": "联网调 LLM（经 agent-runner provider 兜底链，并发 4）；写 derived/hallucination-scores/<armId>.json；断点续跑",
    "prompt": "判卷提示词在外部文件 experiments/coldstart/prompts/judge-hallucination.md",
    "effect": "第二把尺批量驱动：出处反查幻觉率测量，逐臂出评分 JSON"
  },
  {
    "name": "judge-batch.mjs",
    "file": "experiments/coldstart/tools/judge-batch.mjs",
    "category": "冷启动工具",
    "description": "coldstart 判卷批量驱动（走 agent-runner 的 provider 兜底链，",
    "permission": "联网调 LLM（经 agent-runner，判官 deepseek-v4-flash @ opencode go，并发 4）；写 derived/scores/ 与 _errors.log；断点续跑",
    "prompt": "判卷规程/量尺/真相全在外部文件：prompts/judge-v1.md + rubric.md + ground-truth.md",
    "effect": "coldstart 判卷批量驱动：逐臂出评分卡，失败臂记日志不中断整批"
  },
  {
    "name": "normalize-arms.mjs",
    "file": "experiments/coldstart/tools/normalize-arms.mjs",
    "category": "冷启动工具",
    "description": "冷启动多臂实验数据归一化器",
    "permission": "读 ~/.kfmv4/experiments/coldstart/sessions/ 原始答卷，写 derived/（arms.json + transcripts/）；幂等覆盖；不联网",
    "prompt": "无（机械归一化）",
    "effect": "冷启动多臂数据归一化：四类格式统一成元数据数组 + 时间线成绩单"
  },
  {
    "name": "routine-entry-validation.mjs",
    "file": "experiments/coldstart/tools/routine-entry-validation.mjs",
    "category": "冷启动工具",
    "description": "入口文档常态化验证（文档 CI）",
    "permission": "联网（localhost:8021 面板 SSE 驱动验证臂）+ execSync 调 judge-batch 判卷（间接 LLM）；写会话归档、derived 与信箱 verdict 行",
    "prompt": "无内置提示词——试卷为入口文档原文，判卷规程在 coldstart/prompts 外部文件（经 judge-batch）",
    "effect": "入口文档常态化验证：跑验证臂 → 判卷 → 对照基线阈值判 PASS/FAIL"
  },
  {
    "name": "theme-code.mjs",
    "file": "experiments/coldstart/tools/theme-code.mjs",
    "category": "冷启动工具",
    "description": "coldstart 阶段2：五域定性主题编码（开放编码层）。",
    "permission": "联网调 LLM（经 agent-runner）；读 derived/coding-digest.md，写 derived/themes/<domain>.json",
    "prompt": "内置五域编码提示词常量（DOMAINS，每域一个开放编码任务）",
    "effect": "coldstart 阶段2：五域定性主题编码 → 主题分类学 JSON"
  },
  {
    "name": "aggregate-e13.mjs",
    "file": "experiments/paradigm/tools/aggregate-e13.mjs",
    "category": "范式实验工具",
    "description": "一次性汇总：合并 e13 脚本判卷 + LLM 盲判，出格均值表",
    "permission": "只读 meta-pool 判卷归档，写 meta-pool/aggregate-e13.json；不联网",
    "prompt": "无（机械汇总）",
    "effect": "一次性汇总：合并 e13 脚本判卷 + LLM 盲判，出格均值表"
  },
  {
    "name": "aggregate-e14.mjs",
    "file": "experiments/paradigm/tools/aggregate-e14.mjs",
    "category": "范式实验工具",
    "description": "e14 组合挂载（H3）汇总分析（2026-08-07 凌晨，夜间链配套）",
    "permission": "只读 meta-pool 判卷归档，写 meta-pool/aggregate-e14.json；不联网；幂等可重跑",
    "prompt": "无（机械汇总，含 fisher 精确检验）",
    "effect": "e14 组合挂载（H3）汇总分析：叠加/协同/稀释对照读数"
  },
  {
    "name": "aggregate-e15-e16.mjs",
    "file": "experiments/paradigm/tools/aggregate-e15-e16.mjs",
    "category": "范式实验工具",
    "description": "e15（注入位置）+ e16（结构 S5/S6）汇总分析（2026-08-07 晨）",
    "permission": "只读 meta-pool 归档，写 meta-pool/aggregate-e15-e16.json；不联网；幂等",
    "prompt": "无（机械汇总，含 MWU 检验）",
    "effect": "e15（注入位置）+ e16（结构 S5/S6）汇总分析"
  },
  {
    "name": "aggregate-e17.mjs",
    "file": "experiments/paradigm/tools/aggregate-e17.mjs",
    "category": "范式实验工具",
    "description": "e17 复盘质量线专项汇总（2026-08-07，确认性实验）",
    "permission": "只读 meta-pool 归档，写 meta-pool/aggregate-e17.json；不联网；幂等",
    "prompt": "无（机械汇总）",
    "effect": "e17 复盘质量线专项汇总（预注册主终点 self_dissection，S6 vs 无包）"
  },
  {
    "name": "aggregate-e18.mjs",
    "file": "experiments/paradigm/tools/aggregate-e18.mjs",
    "category": "范式实验工具",
    "description": "e18 v4-flash 专项汇总（2026-08-07）",
    "permission": "只读 meta-pool 归档，写 meta-pool/aggregate-e18.json；不联网；幂等",
    "prompt": "无（机械汇总）",
    "effect": "e18 v4-flash 专项汇总（单模型三预注册读数）"
  },
  {
    "name": "aggregate-e19.mjs",
    "file": "experiments/paradigm/tools/aggregate-e19.mjs",
    "category": "范式实验工具",
    "description": "e19 拥挤区占用率专项汇总（2026-08-07）",
    "permission": "只读 meta-pool 归档，写 meta-pool/aggregate-e19.json；不联网；幂等",
    "prompt": "无（机械汇总）",
    "effect": "e19 拥挤区占用率专项汇总（meta_depth × 占用率曲线形态）"
  },
  {
    "name": "arm-store.mjs",
    "file": "experiments/paradigm/tools/arm-store.mjs",
    "category": "范式实验工具",
    "description": "实验臂数据库访问层（paradigm 研究线基建，2026-08-06）",
    "permission": "库模块：读写 ~/.kfmv4/experiments/arms.db（node:sqlite，WAL 模式）；不联网",
    "prompt": "无（机械存储层）",
    "effect": "实验臂数据库访问层：batches 注册表 + arms 语义列表，统一 DB 入口"
  },
  {
    "name": "audit-arms.py",
    "file": "experiments/paradigm/tools/audit-arms.py",
    "category": "范式实验工具",
    "description": "e11/e12 臂位全量审计：列出缺失/重复/残臂/无法归组。",
    "permission": "只读 ~/.kfmv4/sessions/script/ 臂文件与任务文本；stdout 输出；不写、不联网",
    "prompt": "无（机械审计）",
    "effect": "e11/e12 臂位全量审计：按模型窗口分档期望列出缺失/重复/残臂"
  },
  {
    "name": "batch-run.mjs",
    "file": "experiments/paradigm/tools/batch-run.mjs",
    "category": "范式实验工具",
    "description": "范式包实验批量驱动（并发烧 token 的关键基建）",
    "permission": "联网（经 session-runner 走 localhost:8021 面板 API 烧 token）；写 sessions/script 归档、arms.db 与臂沙箱（--sandbox-template 时 rm -rf 重建 sandbox-<armId>/）",
    "prompt": "无内置提示词——任务文本（--tasks/任务文件）与范式包（.kfmv4/paradigms/<名>.md）均外部传入",
    "effect": "范式包实验批量驱动：变体矩阵 × 重复臂并发跑会话，断点续跑"
  },
  {
    "name": "bench-score.mjs",
    "file": "experiments/paradigm/tools/bench-score.mjs",
    "category": "范式实验工具",
    "description": "面板通道标定对分器（paradigm 实验基建，2026-08-04）",
    "permission": "只读 sessions/script/bi-*.json 与变异基准 ground-truth；stdout 输出；不写、不联网",
    "prompt": "无（机械对分）",
    "effect": "面板通道标定对分器：召回 / NC 违规 / extras 三读数"
  },
  {
    "name": "blind-anonymize.py",
    "file": "experiments/paradigm/tools/blind-anonymize.py",
    "category": "范式实验工具",
    "description": "盲判匿名化：提取实验臂 AI 最终输出 → 匿名文件（随机编号），条件映射单独保存",
    "permission": "读 sessions/script 臂会话；写 /tmp/blind-judge/ 匿名文件与 meta-pool/blind-map.json 条件映射；不联网",
    "prompt": "无（机械匿名化）",
    "effect": "盲判匿名化：臂最终输出抽成随机编号匿名件，映射单独保存"
  },
  {
    "name": "bug-scan.py",
    "file": "experiments/paradigm/tools/bug-scan.py",
    "category": "范式实验工具",
    "description": "素材会话 bug 片段粗扫描（paradigm 研究线，2026-08-04）",
    "permission": "只读 opencode.db（sqlite）与素材会话；stdout 输出；不写、不联网",
    "prompt": "无（启发式信号词表内置，非 LLM 提示词）",
    "effect": "素材会话 bug 片段粗扫描：信号词启发式切段，供人工精审"
  },
  {
    "name": "build-e14-combo.mjs",
    "file": "experiments/paradigm/tools/build-e14-combo.mjs",
    "category": "范式实验工具",
    "description": "e14 组合挂载实验的组合包构建器（2026-08-06）",
    "permission": "读 ~/.kfmv4/paradigms/ 源包，写同目录 e14-bd-meta.md；幂等（逐字节一致）；不联网",
    "prompt": "无（机械拼接）",
    "effect": "e14 组合包构建：behavior-discipline + metacognition 全文拼接 + token 估算"
  },
  {
    "name": "build-e16-packs.mjs",
    "file": "experiments/paradigm/tools/build-e16-packs.mjs",
    "category": "范式实验工具",
    "description": "e16 结构实验（S5 对比对 / S6 复盘叙事）制包器（2026-08-06）",
    "permission": "读 materials.db 与 meta-pool 打分文件，写 ~/.kfmv4/paradigms/ 的 S5/S6 包；不联网",
    "prompt": "无（机械选材拼接）",
    "effect": "e16 结构实验制包：按纯度过滤选材，W2 轻标记格式组装 S5/S6 包"
  },
  {
    "name": "build-e19-packs.mjs",
    "file": "experiments/paradigm/tools/build-e19-packs.mjs",
    "category": "范式实验工具",
    "description": "e19 语料组装 + 同源嵌套切包（2026-08-07）",
    "permission": "读 sessions/script 的 e19 语料 exam-state，写 ~/.kfmv4/paradigms/ 嵌套包；--dry 只预览；不联网",
    "prompt": "无（机械拼接切档）",
    "effect": "e19 语料组装 + 同源嵌套切包（32k⊂128k⊂256k⊂512k，长度唯一变量）"
  },
  {
    "name": "build-episodes.py",
    "file": "experiments/paradigm/tools/build-episodes.py",
    "category": "范式实验工具",
    "description": "段/回合结构落库（2026-08-04）",
    "permission": "读人工 classification 文件，写 materials.db（episodes + turns 两表）；不联网",
    "prompt": "无（机械落库）",
    "effect": "段/回合结构落库：人工精切 + 机器预切写入 materials.db"
  },
  {
    "name": "build-length-paradigms.py",
    "file": "experiments/paradigm/tools/build-length-paradigms.py",
    "category": "范式实验工具",
    "description": "拼嵌套长度梯度范式包 v3：按「用户消息」块切分（细粒度），质量序逐块追加，严格嵌套",
    "permission": "读 meta-pool episodes/index 与现有范式包，写 ~/.kfmv4/paradigms/ 长度梯度包；不联网",
    "prompt": "无（机械拼接）",
    "effect": "嵌套长度梯度范式包 v3：按用户消息块切分，质量序逐块追加 32k⊂64k⊂96k⊂128k"
  },
  {
    "name": "cost-stats.py",
    "file": "experiments/paradigm/tools/cost-stats.py",
    "category": "范式实验工具",
    "description": "实验成本统计：会话归档 × 档包长 × 价格表 → 每模型每档成本",
    "permission": "只读会话归档；stdout 输出；不写、不联网",
    "prompt": "无（机械统计）",
    "effect": "实验成本统计：会话归档 × 档包长 × 价格表 → 每模型每档成本"
  },
  {
    "name": "e16-cut.mjs",
    "file": "experiments/paradigm/tools/e16-cut.mjs",
    "category": "范式实验工具",
    "description": "e16 候选段切块（S5/S6 集群打分前置，零 API）",
    "permission": "读 meta-pool/e16-candidates.json 与 materials.db，写 meta-pool/e16-blocks/ 与块索引；不联网（零 API）",
    "prompt": "无（机械切块）",
    "effect": "e16 候选段切块：按用户消息切成判断单位，供集群打分分批"
  },
  {
    "name": "e16-mine.mjs",
    "file": "experiments/paradigm/tools/e16-mine.mjs",
    "category": "范式实验工具",
    "description": "e16 S5/S6 素材开矿（候选集生成，零 API）",
    "permission": "只读 materials.db，写 meta-pool/e16-candidates.json；不联网（零 API）",
    "prompt": "无（机械挖掘）",
    "effect": "e16 S5/S6 素材开矿：错误指出短语 + 复盘 pattern 候选集，带密度打分"
  },
  {
    "name": "exp-driver.mjs",
    "file": "experiments/paradigm/tools/exp-driver.mjs",
    "category": "范式实验工具",
    "description": "实验编排器：spec 文件驱动的「跑数重试循环 + 判卷」两段式流程",
    "permission": "spawnSync 调 batch-run / judge-llm（间接联网烧 token）；--check 只校验 spec 不点火；本身不直接写实验数据",
    "prompt": "无自身提示词（任务/判卷文件由 spec JSON 指定）",
    "effect": "实验编排器：spec 驱动的跑数重试循环 + 判卷两段式流程"
  },
  {
    "name": "gen-slices-summary.py",
    "file": "experiments/paradigm/tools/gen-slices-summary.py",
    "category": "范式实验工具",
    "description": "切片摘要汇总生成器（2026-08-04）",
    "permission": "只读 materials.db，写 slices-summary.md（默认 ~/.kfmv4/materials/，--out 可改）；不联网",
    "prompt": "无（机械生成）",
    "effect": "切片摘要汇总：按源分组每段一行，素材库可视化导航层"
  },
  {
    "name": "judge-e13-script.mjs",
    "file": "experiments/paradigm/tools/judge-e13-script.mjs",
    "category": "范式实验工具",
    "description": "e13 纪律陷阱实验·脚本判卷通道（零成本行为检出）",
    "permission": "只读臂沙箱（sandbox-<armId>/）与臂会话，写 meta-pool 判卷归档 JSON；不联网（零成本行为检出）",
    "prompt": "无（机械 diff + 工具痕迹检出清单）",
    "effect": "e13 脚本判卷通道：沙箱 diff + 工具痕迹 → 每臂 0/1 检出表"
  },
  {
    "name": "judge-llm.mjs",
    "file": "experiments/paradigm/tools/judge-llm.mjs",
    "category": "范式实验工具",
    "description": "LLM 盲判卷（替代正则词频的粗判卷尺）",
    "permission": "联网（经 session-runner 调判卷模型）；写判卷结果 JSON（--out，默认 /tmp）与 /tmp/judge-sessions/；断点续判",
    "prompt": "内置判卷 prompt 模板；任务文本与语义项经 --task-file/--items-file 外部文件注入",
    "effect": "LLM 盲判卷：逐臂按结构化维度打分（输入只含任务+回复，不含臂条件）"
  },
  {
    "name": "judge-px1-blind.mjs",
    "file": "experiments/paradigm/tools/judge-px1-blind.mjs",
    "category": "范式实验工具",
    "description": "px-1 插件实验盲判复核（2026-08-05 用户拍板）",
    "permission": "读 sessions/script 的 px-* 会话与 exam-meta；联网调判卷 LLM；写 meta-pool/judge-px1-blind.json 与 keymap.json",
    "prompt": "内置量尺常量 RUBRIC（讨论质量 0-15 锚定评分，不含身份/相位信息）",
    "effect": "px-1 插件实验盲判复核：抹去身份洗牌后逐轮打分，产出分数曲线"
  },
  {
    "name": "annotate-operit.py",
    "file": "experiments/paradigm/tools/legacy/annotate-operit.py",
    "category": "范式考古",
    "description": "operit 会话范式候选筛选（2026-08-04）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "operit 会话范式候选筛选（2026-08-04）"
  },
  {
    "name": "annotate-pattern.mjs",
    "file": "experiments/paradigm/tools/legacy/annotate-pattern.mjs",
    "category": "范式考古",
    "description": "补 episodes 缺省的 pattern 标注（2026-08-04 接手审计）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "补 episodes 缺省的 pattern 标注（2026-08-04 接手审计）"
  },
  {
    "name": "annotate-pattern.py",
    "file": "experiments/paradigm/tools/legacy/annotate-pattern.py",
    "category": "范式考古",
    "description": "补 episodes 缺省的 pattern 标注（2026-08-04 接手审计）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "补 episodes 缺省的 pattern 标注（2026-08-04 接手审计）"
  },
  {
    "name": "extract-all.py",
    "file": "experiments/paradigm/tools/legacy/extract-all.py",
    "category": "范式考古",
    "description": "素材全量提取器（opencode → materials.db，2026-08-04）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "素材全量提取器（opencode → materials.db，2026-08-04）"
  },
  {
    "name": "extract-convo.mjs",
    "file": "experiments/paradigm/tools/legacy/extract-convo.mjs",
    "category": "范式考古",
    "description": "从 kimi code wire.jsonl 提取对话流（范式包素材矿）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "从 kimi code wire.jsonl 提取对话流（范式包素材矿）"
  },
  {
    "name": "extract-kimi-full.py",
    "file": "experiments/paradigm/tools/legacy/extract-kimi-full.py",
    "category": "范式考古",
    "description": "kimi 会话完整提取器（2026-08-04 补缺口）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "kimi 会话完整提取器（2026-08-04 补缺口）"
  },
  {
    "name": "extract-omp-db.py",
    "file": "experiments/paradigm/tools/legacy/extract-omp-db.py",
    "category": "范式考古",
    "description": "omp 会话入库 materials.db（2026-08-04 接手 omp 线）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "omp 会话入库 materials.db（2026-08-04 接手 omp 线）"
  },
  {
    "name": "extract-omp-jsonl.py",
    "file": "experiments/paradigm/tools/legacy/extract-omp-jsonl.py",
    "category": "范式考古",
    "description": "omp 会话完整提取器（2026-08-04 修正）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "omp 会话完整提取器（2026-08-04 修正）"
  },
  {
    "name": "extract-omp.py",
    "file": "experiments/paradigm/tools/legacy/extract-omp.py",
    "category": "范式考古",
    "description": "omp 会话提取器（2026-08-04 接手 omp 线）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "omp 会话提取器（2026-08-04 接手 omp 线）"
  },
  {
    "name": "extract-operit.py",
    "file": "experiments/paradigm/tools/legacy/extract-operit.py",
    "category": "范式考古",
    "description": "chat-backups 提取器（operit 时代会话 → materials.db）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "chat-backups 提取器（operit 时代会话 → materials.db）"
  },
  {
    "name": "extract-session.py",
    "file": "experiments/paradigm/tools/legacy/extract-session.py",
    "category": "范式考古",
    "description": "单会话用户消息提取器（paradigm 研究线，2026-08-04）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "单会话用户消息提取器（paradigm 研究线，2026-08-04）"
  },
  {
    "name": "migrate-arms-to-db.mjs",
    "file": "experiments/paradigm/tools/legacy/migrate-arms-to-db.mjs",
    "category": "范式考古",
    "description": "存量臂文件 → arms.db（design-arm-store.md 一期）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "存量臂文件 → arms.db（design-arm-store.md 一期）"
  },
  {
    "name": "migrate-px-to-db.mjs",
    "file": "experiments/paradigm/tools/legacy/migrate-px-to-db.mjs",
    "category": "范式考古",
    "description": "px 插件实验会话 → arms.db（2026-08-06）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "px 插件实验会话 → arms.db（2026-08-06）"
  },
  {
    "name": "restore-annotations.py",
    "file": "experiments/paradigm/tools/legacy/restore-annotations.py",
    "category": "范式考古",
    "description": "精切标注半自动恢复（2026-08-04）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "精切标注半自动恢复（2026-08-04）"
  },
  {
    "name": "restore-from-history.py",
    "file": "experiments/paradigm/tools/legacy/restore-from-history.py",
    "category": "范式考古",
    "description": "从会话历史重放精切标注（2026-08-04）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "从会话历史重放精切标注（2026-08-04）"
  },
  {
    "name": "run-e11-gapfill.sh",
    "file": "experiments/paradigm/tools/legacy/run-e11-gapfill.sh",
    "category": "范式考古",
    "description": "e11 硅基 D 高档补臂循环——部署硬杀后的重试到齐",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "e11 硅基 D 高档补臂循环——部署硬杀后的重试到齐"
  },
  {
    "name": "run-e13.sh",
    "file": "experiments/paradigm/tools/legacy/run-e13.sh",
    "category": "范式考古",
    "description": "e13 点火循环——重试到齐（192 臂矩阵，幂等零浪费）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "e13 点火循环——重试到齐（192 臂矩阵，幂等零浪费）"
  },
  {
    "name": "run-judge-v2.sh",
    "file": "experiments/paradigm/tools/legacy/run-judge-v2.sh",
    "category": "范式考古",
    "description": "e11/e12 v2 判卷（断点续判 + 重试，2026-08-06）",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "e11/e12 v2 判卷（断点续判 + 重试，2026-08-06）"
  },
  {
    "name": "run-px-baseline.sh",
    "file": "experiments/paradigm/tools/legacy/run-px-baseline.sh",
    "category": "范式考古",
    "description": "px 基线分布实验跑批——同场景同教官永不挂载，测无包基线",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "px 基线分布实验跑批——同场景同教官永不挂载，测无包基线"
  },
  {
    "name": "run-px-fatigue.sh",
    "file": "experiments/paradigm/tools/legacy/run-px-fatigue.sh",
    "category": "范式考古",
    "description": "px 疲劳区专项跑批——持续挂载 13 轮测疲劳",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "px 疲劳区专项跑批——持续挂载 13 轮测疲劳"
  },
  {
    "name": "run-px-halflife.sh",
    "file": "experiments/paradigm/tools/legacy/run-px-halflife.sh",
    "category": "范式考古",
    "description": "px 残留半衰期专项跑批——挂载 3 轮摘除后强制观测 10 轮",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "px 残留半衰期专项跑批——挂载 3 轮摘除后强制观测 10 轮"
  },
  {
    "name": "run-px-matrix.sh",
    "file": "experiments/paradigm/tools/legacy/run-px-matrix.sh",
    "category": "范式考古",
    "description": "px 插件矩阵跑批——gemini-2.5-pro/sonnet-4-6 挂载实验",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "px 插件矩阵跑批——gemini-2.5-pro/sonnet-4-6 挂载实验"
  },
  {
    "name": "run-silicon-backfill.round1.sh",
    "file": "experiments/paradigm/tools/legacy/run-silicon-backfill.round1.sh",
    "category": "范式考古",
    "description": "硅基系 e11/e12 补跑第一轮——排除硅基上游挂死的 4B",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "硅基系 e11/e12 补跑第一轮——排除硅基上游挂死的 4B"
  },
  {
    "name": "run-silicon-backfill.sh",
    "file": "experiments/paradigm/tools/legacy/run-silicon-backfill.sh",
    "category": "范式考古",
    "description": "硅基系 e11/e12 补跑（入库版）——按上下文窗口分级，429 降并发",
    "permission": "只读素材库/写实验数据区（一次性脚本，已归档留存）",
    "prompt": "部分内置提取/标注规则（考古级，不再维护）",
    "effect": "硅基系 e11/e12 补跑（入库版）——按上下文窗口分级，429 降并发"
  },
  {
    "name": "material-index.py",
    "file": "experiments/paradigm/tools/material-index.py",
    "category": "范式实验工具",
    "description": "工具会话素材索引器（paradigm 研究线，2026-08-04）",
    "permission": "只读各 AI 工具会话库（opencode/omp/kimi/qoder-cn 元数据）；--write 时写 ~/.kfmv4/materials/index.md；不联网",
    "prompt": "无（机械索引）",
    "effect": "工具会话素材索引：按工作目录/主题聚簇成「包」候选清单"
  },
  {
    "name": "meta-density.py",
    "file": "experiments/paradigm/tools/meta-density.py",
    "category": "范式实验工具",
    "description": "元认知密度判卷尺（paradigm 实验自动判卷，2026-08-05 定稿）",
    "permission": "只读 sessions/script 臂文件与 paradigms 清单；stdout 输出；不写、不联网",
    "prompt": "无（机械词频尺，动词表内置且标定后勿改）",
    "effect": "元认知密度判卷尺：metaRe（我+思考动词）频率/臂，经 e7 标定"
  },
  {
    "name": "occupancy.mjs",
    "file": "experiments/paradigm/tools/occupancy.mjs",
    "category": "范式实验工具",
    "description": "真实占用率口径（2026-08-06）",
    "permission": "纯数据模块：导出两张手工维护登记表，无 IO、不联网",
    "prompt": "无（机械常量表）",
    "effect": "真实占用率口径：occ_ratio = 范式包标称尺寸 ÷ 模型窗口"
  },
  {
    "name": "plugin-exam.mjs",
    "file": "experiments/paradigm/tools/plugin-exam.mjs",
    "category": "范式实验工具",
    "description": "插件生命周期实验驱动器（考生 + 教官双会话）",
    "permission": "联网（考生走 localhost:8021 工具流 + 教官裸 API 调用）；写 sessions/script 归档、<id>.transcript.md、exam-state/exam-meta；断点续跑",
    "prompt": "教官提示词在外部文件（默认 experiments/paradigm/instructors/design-discussion.md，--instructor-file 可换）",
    "effect": "插件生命周期实验驱动器：考生+教官双会话，逐轮挂载/摘除范式包"
  },
  {
    "name": "recompute-cells.py",
    "file": "experiments/paradigm/tools/recompute-cells.py",
    "category": "范式实验工具",
    "description": "用判卷归档重算 e11/e12 格均值（v2 主尺，总分 0-20）。",
    "permission": "只读 arms.db（不存在时回落 sessions/script 文件）与判卷归档；stdout 输出；不写、不联网",
    "prompt": "无（机械重算）",
    "effect": "用判卷归档重算 e11/e12 格均值（v2 主尺，总分 0-20）"
  },
  {
    "name": "review-episodes.py",
    "file": "experiments/paradigm/tools/review-episodes.py",
    "category": "范式实验工具",
    "description": "段精切工作台（2026-08-04）",
    "permission": "读 materials.db 回合链；--mark 时 UPDATE episodes 标注写回 DB；不联网；交互式 CLI",
    "prompt": "无（机械工作台，判断由操作者做）",
    "effect": "段精切工作台：逐段拉回合链 → 写回 status/pattern/note 标注"
  },
  {
    "name": "session-runner.mjs",
    "file": "experiments/paradigm/tools/session-runner.mjs",
    "category": "范式实验工具",
    "description": "会话驱动内核（paradigm 实验基建）",
    "permission": "联网（POST localhost:8021 /ai/chat/start + SSE 消费，KFM_BASE 可改）；写 sessions/script/ 归档（CLI 模式）；可作模块 import",
    "prompt": "无内置提示词——prompt/角色卡/范式包均参数传入",
    "effect": "会话驱动内核：离线跑 kfm 工具流会话并落盘归档"
  },
  {
    "name": "agent-runner.mjs",
    "file": "scripts/agent/agent-runner.mjs",
    "category": "agent 负载",
    "description": "agent 脚本运行时（形态 A：洁净室 agent 原件）",
    "permission": "联网调 LLM API（provider 有序兜底链，key 从 ~/.kfmv4/providers.json 按 id 读）；只追加写 ~/.kfmv4/agent-calls.jsonl 调用账本；不写仓库",
    "prompt": "无内置业务提示词——prompt 模板由调用方传入（{{var}} 注入）",
    "effect": "洁净室 agent 运行时：机械组装输入 → 调 LLM → 机械校验输出，返回 {ok, data, raw, provider, errors}"
  },
  {
    "name": "browser-relay.mjs",
    "file": "scripts/agent/browser-relay.mjs",
    "category": "agent 负载",
    "description": "浏览器守视（2026-08-06 用户拍板，HUD 可视化自测基建）",
    "permission": "常驻 daemon（serve 模式暴露 HTTP 控制面）+ 一次性 CLI 双形态；拉起 headless Chrome（puppeteer-core）；写截图等到 ~/.kfmv4/browser-relay/；不连 LLM API（浏览器可开任意 URL）",
    "prompt": "无（机械）",
    "effect": "浏览器守视：开页/截图/点击/输入/求值等命令，stdout 单行 JSON + 截图路径"
  },
  {
    "name": "exp-iceberg.mjs",
    "file": "scripts/agent/exp-iceberg.mjs",
    "category": "agent 负载",
    "description": "冰山工作量验证实验（一次性）：feat 后 fix 链长度 × 前置讨论有无",
    "permission": "只读（execSync git log/tag，不改动仓库）；不写文件、不联网",
    "prompt": "无（机械统计）",
    "effect": "冰山工作量验证：按口径统计 feat/fix 链与前置设计讨论，stdout 报表"
  },
  {
    "name": "exp-probe-decompose.mjs",
    "file": "scripts/agent/exp-probe-decompose.mjs",
    "category": "agent 负载",
    "description": "探针分解实验：抽取器(no-think) + 判断器(think)",
    "permission": "联网调 LLM（经 agent-runner）；只读 tmp/semantic-bench 沙盒与仓库文档；不写文件",
    "prompt": "内置断言抽取器与判断器提示词常量（本文件 system/prompt 字符串），复用 semantic-audit 评分逻辑",
    "effect": "探针分解实验：no-think 抽取器 + think 判断器两段式，测召回与耗时，stdout 数据"
  },
  {
    "name": "exp-probe-matrix.mjs",
    "file": "scripts/agent/exp-probe-matrix.mjs",
    "category": "agent 负载",
    "description": "探针能力矩阵（19 探针 × 16 变异）",
    "permission": "联网调 LLM（内部并发池，默认 8）；只读 tmp/semantic-bench 沙盒；不写文件",
    "prompt": "复用 semantic-audit.mjs 的 buildPrompt 内置审计探针提示词",
    "effect": "探针能力矩阵：19 探针 × 16 变异全跑，按探针聚合盲区，stdout 报表"
  },
  {
    "name": "exp-thinking.mjs",
    "file": "scripts/agent/exp-thinking.mjs",
    "category": "agent 负载",
    "description": "思考开/关对照实验（2026-07-30 用户拍板：拿数据说话）",
    "permission": "联网调 LLM（经 agent-runner，两臂交替）；不写 state、不写文件（头部自述）",
    "prompt": "内置 system 常量 + 复用 semantic-audit.mjs 的 buildPrompt",
    "effect": "思考开/关两臂对照实验：延迟/尝试次数/报留拦差异，stdout 数据表"
  },
  {
    "name": "exp-vision-internal.mjs",
    "file": "scripts/agent/exp-vision-internal.mjs",
    "category": "agent 负载",
    "description": "vision 探针四臂对照实验（2026-07-30 用户拍板）",
    "permission": "联网调 LLM；先 execSync 跑 semantic-mutate 物化沙盒（写 tmp/semantic-bench，gitignored）；不写仓库",
    "prompt": "内置四臂提示词变体常量（ARMS：基线/去保守/脚手架/叠加）",
    "effect": "vision 探针四臂对照实验（M07+MID-4 定向变异），stdout 数据表"
  },
  {
    "name": "obs-aggregate.mjs",
    "file": "scripts/agent/obs-aggregate.mjs",
    "category": "agent 负载",
    "description": "观测台聚合器（史官制度 8.5）：周报生成",
    "permission": "只读 ~/.kfmv4/*.jsonl 账本、docs/ledger 信箱与 git log；--mailbox 时追加写 semantic-chain-inbox.md；不联网",
    "prompt": "无（机械聚合）",
    "effect": "观测台周报聚合：LLM 调用账本 + 工具审计 + 信箱趋势 → stdout 周报（可投信箱）"
  },
  {
    "name": "semantic-audit.mjs",
    "file": "scripts/agent/semantic-audit.mjs",
    "category": "agent 负载",
    "description": "语义审计探针集群编排器（腿一，agent-runner 二号负载）",
    "permission": "联网调 LLM（并发 3 洁净室）；写 docs/ledger/semantic-audit-state.json 与 patrol-* 会话归档（sessions/script/）；工具流探针仅读类工具白名单（禁 write/edit/bash）",
    "prompt": "内置审计探针提示词常量（buildPrompt/SYSTEM，含已登记病灶豁免清单解析）",
    "effect": "语义审计探针集群编排器：增量对账 + 机械复核幻觉，产出 SEM 清单草案入 state"
  },
  {
    "name": "semantic-audit.tasks.mjs",
    "file": "scripts/agent/semantic-audit.tasks.mjs",
    "category": "agent 负载",
    "description": "语义审计探针任务清单（腿一，v1 手写）",
    "permission": "纯数据模块：无 IO、不联网、不执行进程",
    "prompt": "探针任务定义在本文件（每任务的问题/feeds/baseline/tools 字段），供 semantic-audit 组装提示词",
    "effect": "语义审计探针任务清单（组内 17 + 组间 6），被编排器 import"
  },
  {
    "name": "semantic-bench.mjs",
    "file": "scripts/agent/semantic-bench.mjs",
    "category": "agent 负载",
    "description": "变异基准跑分器（semantic-mutate 的下半件）",
    "permission": "联网调 LLM；读 tmp/semantic-bench 沙盒，沙盒缺失或 --remutate 时 execSync 重建（写 tmp/）；不写 state、不进 check 链",
    "prompt": "复用 semantic-audit.mjs 的 buildPrompt 内置审计提示词",
    "effect": "变异基准跑分器：对沙盒副本跑受影响探针，按 ground-truth 算召回/误报"
  },
  {
    "name": "semantic-chain.mjs",
    "file": "scripts/agent/semantic-chain.mjs",
    "category": "agent 负载",
    "description": "语义巡逻总 runner（腿三，STACK #3，2026-07-30 用户拍板）",
    "permission": "execFileSync 调 semantic-audit（间接联网 LLM）；追加写 docs/ledger/semantic-chain-inbox.md 与指标 jsonl；永远 exit 0",
    "prompt": "无自身提示词（探针提示词在 semantic-audit.mjs）",
    "effect": "语义巡逻总 runner：跑探针集群 → 聚合成 verdict → 投信箱（--with-bench 顺带校准基准）"
  },
  {
    "name": "semantic-mutate.mjs",
    "file": "scripts/agent/semantic-mutate.mjs",
    "category": "agent 负载",
    "description": "变异基准卷（mutation testing for 语义审计管线）",
    "permission": "只读仓库文档与 git 历史；写 tmp/semantic-bench/ 沙盒副本与 ground-truth.json（gitignored）；不联网",
    "prompt": "无（机械变异注入）",
    "effect": "变异基准卷：物化变异沙盒 + ground-truth.json，供 bench 对分"
  },
  {
    "name": "session-retention.mjs",
    "file": "scripts/agent/session-retention.mjs",
    "category": "agent 负载",
    "description": "巡逻会话生命周期（2026-08-06 用户拍板：只进不出必淤积）",
    "permission": "读写 ~/.kfmv4/sessions/script/：tar 归档超龄 patrol-*.json 后删原件（execSync tar）；只碰 patrol- 前缀；不联网；--dry-run 只读",
    "prompt": "无（机械）",
    "effect": "巡逻会话生命周期：超龄（默认 90 天）patrol 会话归档进 archive/"
  },
  {
    "name": "tag-advisor.mjs",
    "file": "scripts/agent/tag-advisor.mjs",
    "category": "agent 负载",
    "description": "发版建议 agent（agent-runner 一号负载）",
    "permission": "只读 git log（ref 严格格式校验）；联网调 LLM（经 agent-runner）；不写文件",
    "prompt": "内置发版顾问提示词常量（system + semver 家规 prompt 模板）",
    "effect": "发版级别建议 {level, reason, notes}：机械算下限 + agent 判级别，exit 码分级"
  },
  {
    "name": "test-tag-advisor.mjs",
    "file": "scripts/agent/test-tag-advisor.mjs",
    "category": "agent 负载",
    "description": "tag 检测器回放测试（黄金集 = 历史版本对）",
    "permission": "只读 git tag；全并发 execFile 调 tag-advisor（间接联网，费 API 调用）；不写文件",
    "prompt": "无自身提示词（提示词在 tag-advisor.mjs）",
    "effect": "tag 检测器回放测试：历史版本对黄金集算推荐级别一致率"
  },
  {
    "name": "auto-push.sh",
    "file": "scripts/auto-push.sh",
    "category": "运维",
    "description": "主仓自动推送（2026-08-02 补缺口：除私有数据同步外，主仓代码无自动推送）",
    "permission": "bash（cron 机制）；跑 freshness 检查/部署脚本/git push（联网推远端，pre-push 钩子跑全链 check）；写 /var/log/kfmv4-autopush.log",
    "prompt": "无（机械）",
    "effect": "主仓自动推送：freshness 红先部署、有未提交改动跳过、全链 check 兜底"
  },
  {
    "name": "chain.mjs",
    "file": "scripts/check/chain.mjs",
    "category": "检查器",
    "description": "check 链唯一出处（v8.3 编译方向升档）",
    "permission": "spawnSync 逐个跑 check 子进程（构建链内只读检查）；失败时追加写 ~/.kfmv4/check-failures.jsonl 账本；不联网",
    "prompt": "无（机械编排）",
    "effect": "check 链唯一出处：STEPS 清单统一执行，--soft 可降级指定步骤为提醒"
  },
  {
    "name": "check-active-stack.mjs",
    "file": "scripts/check/check-active-stack.mjs",
    "category": "检查器",
    "description": "工作栈与 active/ 目录健康检查（v8.2 新增）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "工作栈与 active/ 目录健康检查（v8.2 新增）"
  },
  {
    "name": "check-agent-script-docs.mjs",
    "file": "scripts/check/check-agent-script-docs.mjs",
    "category": "检查器",
    "description": "agent 脚本发现性门（2026-08-06 用户拍板，发现性缺口机械化）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "agent 脚本发现性门（2026-08-06 用户拍板，发现性缺口机械化）"
  },
  {
    "name": "check-anim.mjs",
    "file": "scripts/check/check-anim.mjs",
    "category": "检查器",
    "description": "动画导入检查",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "动画导入检查"
  },
  {
    "name": "check-as-any.mjs",
    "file": "scripts/check/check-as-any.mjs",
    "category": "检查器",
    "description": "类型逃逸检查（as any / as unknown as）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "类型逃逸检查（as any / as unknown as）"
  },
  {
    "name": "check-bar-ledger.mjs",
    "file": "scripts/check/check-bar-ledger.mjs",
    "category": "检查器",
    "description": "BAR 账本 ↔ 回归钉子交叉检查（v8.2 批 1）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "BAR 账本 ↔ 回归钉子交叉检查（v8.2 批 1）"
  },
  {
    "name": "check-card-meta.mjs",
    "file": "scripts/check/check-card-meta.mjs",
    "category": "检查器",
    "description": "card.meta 类型逃逸检查",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "card.meta 类型逃逸检查"
  },
  {
    "name": "check-cards.mjs",
    "file": "scripts/check/check-cards.mjs",
    "category": "检查器",
    "description": "卡片注册表完整性校验",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "卡片注册表完整性校验"
  },
  {
    "name": "check-checks.mjs",
    "file": "scripts/check/check-checks.mjs",
    "category": "检查器",
    "description": "检查脚本集成完整性验证（v8.3 单源化后重写）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "检查脚本集成完整性验证（v8.3 单源化后重写）"
  },
  {
    "name": "check-code-doc-refs.mjs",
    "file": "scripts/check/check-code-doc-refs.mjs",
    "category": "检查器",
    "description": "代码中的文档引用有效性（v8.2 新增）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "代码中的文档引用有效性（v8.2 新增）"
  },
  {
    "name": "check-code-map-coverage.mjs",
    "file": "scripts/check/check-code-map-coverage.mjs",
    "category": "检查器",
    "description": "部件级 code-map 覆盖门（2026-08-06 用户拍板，HUD 裸奔事故机械化）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "部件级 code-map 覆盖门（2026-08-06 用户拍板，HUD 裸奔事故机械化）"
  },
  {
    "name": "check-commit-docs.mjs",
    "file": "scripts/check/check-commit-docs.mjs",
    "category": "检查器",
    "description": "commit-doc 耦合门（v8.2 批 2 立项，",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "commit-doc 耦合门（v8.2 批 2 立项，"
  },
  {
    "name": "check-consistency.mjs",
    "file": "scripts/check/check-consistency.mjs",
    "category": "检查器",
    "description": "入口路由表一致性（v8.2 重写：文档树 → CLAUDE.md 路由表）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "入口路由表一致性（v8.2 重写：文档树 → CLAUDE.md 路由表）"
  },
  {
    "name": "check-console.mjs",
    "file": "scripts/check/check-console.mjs",
    "category": "检查器",
    "description": "console 日志扫描",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "console 日志扫描"
  },
  {
    "name": "check-contract-freshness.mjs",
    "file": "scripts/check/check-contract-freshness.mjs",
    "category": "检查器",
    "description": "域契约新鲜度检查（check-handbook-sync + check-desc-freshness 合并继任者）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "域契约新鲜度检查（check-handbook-sync + check-desc-freshness 合并继任者）"
  },
  {
    "name": "check-css-wiring.mjs",
    "file": "scripts/check/check-css-wiring.mjs",
    "category": "检查器",
    "description": "CSS 接线完整性校验（防「接线丢失」类 bug）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "CSS 接线完整性校验（防「接线丢失」类 bug）"
  },
  {
    "name": "check-deploy-freshness.mjs",
    "file": "scripts/check/check-deploy-freshness.mjs",
    "category": "检查器",
    "description": "部署新鲜度硬门（纪律机械化 SOP：旧包验证病灶收编）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "部署新鲜度硬门（纪律机械化 SOP：旧包验证病灶收编）"
  },
  {
    "name": "check-doc-budget.mjs",
    "file": "scripts/check/check-doc-budget.mjs",
    "category": "检查器",
    "description": "加载类文档预算线机械执行（v8.2 批 1）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "加载类文档预算线机械执行（v8.2 批 1）"
  },
  {
    "name": "check-doc-coverage.mjs",
    "file": "scripts/check/check-doc-coverage.mjs",
    "category": "检查器",
    "description": "文档覆盖强制约束（v8.2 重写：HANDBOOK 审计表 → 域契约/细节文档）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档覆盖强制约束（v8.2 重写：HANDBOOK 审计表 → 域契约/细节文档）"
  },
  {
    "name": "check-doc-linerefs.mjs",
    "file": "scripts/check/check-doc-linerefs.mjs",
    "category": "检查器",
    "description": "文档行号引用有效性检查（v8.3 语义审计机械化 M1）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档行号引用有效性检查（v8.3 语义审计机械化 M1）"
  },
  {
    "name": "check-doc-orphans.mjs",
    "file": "scripts/check/check-doc-orphans.mjs",
    "category": "检查器",
    "description": "文档可达性纪律（每份文档必须被引用，且去对地方）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档可达性纪律（每份文档必须被引用，且去对地方）"
  },
  {
    "name": "check-doc-schema.mjs",
    "file": "scripts/check/check-doc-schema.mjs",
    "category": "检查器",
    "description": "文档结构 schema 校验（v8.2 批 2）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档结构 schema 校验（v8.2 批 2）"
  },
  {
    "name": "check-doc-scripts.mjs",
    "file": "scripts/check/check-doc-scripts.mjs",
    "category": "检查器",
    "description": "文档脚本/源码引用存在性检查（2026-08-04，SEM001 机械化收割）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档脚本/源码引用存在性检查（2026-08-04，SEM001 机械化收割）"
  },
  {
    "name": "check-doc-symbols.mjs",
    "file": "scripts/check/check-doc-symbols.mjs",
    "category": "检查器",
    "description": "文档符号存在性检查（v8.2 批 1）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档符号存在性检查（v8.2 批 1）"
  },
  {
    "name": "check-docs.mjs",
    "file": "scripts/check/check-docs.mjs",
    "category": "检查器",
    "description": "文档质量自动化检查（v8.2 重写：scope 切到 DOCS_ROOT，废弃 frontmatter 规则）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "文档质量自动化检查（v8.2 重写：scope 切到 DOCS_ROOT，废弃 frontmatter 规则）"
  },
  {
    "name": "check-experiment-index.mjs",
    "file": "scripts/check/check-experiment-index.mjs",
    "category": "检查器",
    "description": "实验数据引用完整性检查",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "实验数据引用完整性检查"
  },
  {
    "name": "check-experiment-registry.mjs",
    "file": "scripts/check/check-experiment-registry.mjs",
    "category": "检查器",
    "description": "实验产物发现性门（2026-08-06 用户拍板，DOC-FLOW-11）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "实验产物发现性门（2026-08-06 用户拍板，DOC-FLOW-11）"
  },
  {
    "name": "check-fix-tests.mjs",
    "file": "scripts/check/check-fix-tests.mjs",
    "category": "检查器",
    "description": "fix-tests 耦合门（心法 24「修 bug 补钉纪律」机械化收编）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "fix-tests 耦合门（心法 24「修 bug 补钉纪律」机械化收编）"
  },
  {
    "name": "check-hooks.mjs",
    "file": "scripts/check/check-hooks.mjs",
    "category": "检查器",
    "description": "git 钩子健康检查（v8.2 批 4）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "git 钩子健康检查（v8.2 批 4）"
  },
  {
    "name": "check-inbox-heartbeat.mjs",
    "file": "scripts/check/check-inbox-heartbeat.mjs",
    "category": "检查器",
    "description": "信箱巡逻心跳（F1 机械化主人，2026-08-03，BAR-SEMCHAIN-01 催生）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "信箱巡逻心跳（F1 机械化主人，2026-08-03，BAR-SEMCHAIN-01 催生）"
  },
  {
    "name": "check-ledger-commits.mjs",
    "file": "scripts/check/check-ledger-commits.mjs",
    "category": "检查器",
    "description": "账本 commit 引用对账（v8.3 语义审计机械化 M3）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "账本 commit 引用对账（v8.3 语义审计机械化 M3）"
  },
  {
    "name": "check-mutation-anchors.mjs",
    "file": "scripts/check/check-mutation-anchors.mjs",
    "category": "检查器",
    "description": "变异集物料锚点新鲜度硬标准（2026-08-02 立）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "变异集物料锚点新鲜度硬标准（2026-08-02 立）"
  },
  {
    "name": "check-probes.mjs",
    "file": "scripts/check/check-probes.mjs",
    "category": "检查器",
    "description": "检查探针自检（v8.2 批 5）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "检查探针自检（v8.2 批 5）"
  },
  {
    "name": "check-registry.mjs",
    "file": "scripts/check/check-registry.mjs",
    "category": "检查器",
    "description": "UI Element Registry 完整性验证",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "UI Element Registry 完整性验证"
  },
  {
    "name": "check-release-radar.mjs",
    "file": "scripts/check/check-release-radar.mjs",
    "category": "检查器",
    "description": "发版雷达（v8.3.0，warning 模式）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "发版雷达（v8.3.0，warning 模式）"
  },
  {
    "name": "check-secrets.mjs",
    "file": "scripts/check/check-secrets.mjs",
    "category": "检查器",
    "description": "开源守门：工作树明文 key 泄露扫描",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "开源守门：工作树明文 key 泄露扫描"
  },
  {
    "name": "check-stack-status.mjs",
    "file": "scripts/check/check-stack-status.mjs",
    "category": "检查器",
    "description": "工作栈 schema + 编号纪律 + bug 入口门（yaml 化二代）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "工作栈 schema + 编号纪律 + bug 入口门（yaml 化二代）"
  },
  {
    "name": "check-state-freshness.mjs",
    "file": "scripts/check/check-state-freshness.mjs",
    "category": "检查器",
    "description": "状态类条目新鲜度硬标准（2026-08-02 立）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "状态类条目新鲜度硬标准（2026-08-02 立）"
  },
  {
    "name": "check-test-patterns.mjs",
    "file": "scripts/check/check-test-patterns.mjs",
    "category": "检查器",
    "description": "测试计数模式完整性检查",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "测试计数模式完整性检查"
  },
  {
    "name": "check-tool-compaction.mjs",
    "file": "scripts/check/check-tool-compaction.mjs",
    "category": "检查器",
    "description": "工具 I/O 压缩器登记完整性校验（v8.1.0）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "工具 I/O 压缩器登记完整性校验（v8.1.0）"
  },
  {
    "name": "check-uncommitted.mjs",
    "file": "scripts/check/check-uncommitted.mjs",
    "category": "检查器",
    "description": "未提交改动检查",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "未提交改动检查"
  },
  {
    "name": "check-versions.mjs",
    "file": "scripts/check/check-versions.mjs",
    "category": "检查器",
    "description": "版本号一致性检查（v8.2 适配：HANDBOOK 锚点 → README + ledger/history）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "版本号一致性检查（v8.2 适配：HANDBOOK 锚点 → README + ledger/history）"
  },
  {
    "name": "check-workflow-integrity.mjs",
    "file": "scripts/check/check-workflow-integrity.mjs",
    "category": "检查器",
    "description": "工作流卡引用完整性（v8.2 新增，v8.3 扩展 M2）",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "工作流卡引用完整性（v8.2 新增，v8.3 扩展 M2）"
  },
  {
    "name": "check-zindex.mjs",
    "file": "scripts/check/check-zindex.mjs",
    "category": "检查器",
    "description": "Z-Index 层级注册表完整性校验",
    "permission": "构建链内只读检查（无网络、无写盘副作用）",
    "prompt": "无（机械检查）",
    "effect": "Z-Index 层级注册表完整性校验"
  },
  {
    "name": "docs-root-const.mjs",
    "file": "scripts/check/docs-root-const.mjs",
    "category": "构建链基建",
    "description": "文档根目录共享常量（DOCS_ROOT 单一出处）",
    "permission": "纯常量模块：无 IO、不联网",
    "prompt": "无（机械常量）",
    "effect": "DOCS_ROOT 共享常量：文档根目录单一出处，切换时只改一处"
  },
  {
    "name": "docs-status.mjs",
    "file": "scripts/check/docs-status.mjs",
    "category": "构建链基建",
    "description": "文档系统健康仪表盘（v8.2 批 3，非阻断观测）",
    "permission": "只读遍历 docs/ 统计层分布等；stdout 输出；不写、不联网；非阻断",
    "prompt": "无（机械统计）",
    "effect": "文档系统健康仪表盘：层分布等观测指标，供压缩轮/审计输入"
  },
  {
    "name": "domain-src.mjs",
    "file": "scripts/check/domain-src.mjs",
    "category": "构建链基建",
    "description": "域 → src 路径映射（单一真相源）",
    "permission": "纯常量模块：无 IO、不联网",
    "prompt": "无（机械常量）",
    "effect": "域 → src 路径映射单一真相源，供契约新鲜度检查与清单生成消费"
  },
  {
    "name": "gen-code-inventory.mjs",
    "file": "scripts/check/gen-code-inventory.mjs",
    "category": "生成器",
    "description": "机械层代码清单生成器（代码测绘·机械层）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "机械层代码清单生成器（代码测绘·机械层）"
  },
  {
    "name": "gen-contract-lists.mjs",
    "file": "scripts/check/gen-contract-lists.mjs",
    "category": "生成器",
    "description": "契约文件清单生成器（可生成事实登记表 P0）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "契约文件清单生成器（可生成事实登记表 P0）"
  },
  {
    "name": "gen-experiments-list.mjs",
    "file": "scripts/check/gen-experiments-list.mjs",
    "category": "生成器",
    "description": "实验清单拼接器（活源头 = 文件系统 + 各线 index.md）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "实验清单拼接器（活源头 = 文件系统 + 各线 index.md）"
  },
  {
    "name": "gen-page-state-schema.mjs",
    "file": "scripts/check/gen-page-state-schema.mjs",
    "category": "生成器",
    "description": "眼睛格式说明「代码注册的事实段」拼接器",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "眼睛格式说明「代码注册的事实段」拼接器"
  },
  {
    "name": "gen-permission-map.mjs",
    "file": "scripts/check/gen-permission-map.mjs",
    "category": "生成器",
    "description": "权限风险表拼接器（原代码注册驱动）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "权限风险表拼接器（原代码注册驱动）"
  },
  {
    "name": "gen-route-table.mjs",
    "file": "scripts/check/gen-route-table.mjs",
    "category": "生成器",
    "description": "CLAUDE.md 路由表生成器（可生成事实登记表 P0）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "CLAUDE.md 路由表生成器（可生成事实登记表 P0）"
  },
  {
    "name": "gen-rules-map.mjs",
    "file": "scripts/check/gen-rules-map.mjs",
    "category": "生成器",
    "description": "规则登记表拼接器（原代码注册驱动）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "规则登记表拼接器（原代码注册驱动）"
  },
  {
    "name": "gen-scripts-catalog.mjs",
    "file": "scripts/check/gen-scripts-catalog.mjs",
    "category": "生成器",
    "description": "脚本目录卡生成器（活源头 = 文件系统 + 脚本头部 + 登记 manifest）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "脚本目录卡生成器（活源头 = 文件系统 + 脚本头部 + 登记 manifest）"
  },
  {
    "name": "gen-tool-docs.mjs",
    "file": "scripts/check/gen-tool-docs.mjs",
    "category": "生成器",
    "description": "工具文档「参数节」拼接器（原代码注册驱动）",
    "permission": "回写生成物；--check-only 只读校验",
    "prompt": "无（机械拼接）",
    "effect": "工具文档「参数节」拼接器（原代码注册驱动）"
  },
  {
    "name": "sync-counts.mjs",
    "file": "scripts/check/sync-counts.mjs",
    "category": "构建链基建",
    "description": "文档计数单一来源化（v8.2 批 1）",
    "permission": "回写 README/CLAUDE.md/docs 多处计数锚点与 chain:auto 区块（幂等）；--check-only 只读校验；不联网",
    "prompt": "无（机械同步）",
    "effect": "文档计数单一来源化：check 数/测试数从文件系统派生并回写各文档"
  },
  {
    "name": "clean-npm-temp.cjs",
    "file": "scripts/clean-npm-temp.cjs",
    "category": "运维",
    "description": "npm 残留临时目录清理脚本（preinstall hook 自动运行）",
    "permission": "node（npm preinstall hook）；删除 node_modules/ 下 npm 残留临时目录（rmSync recursive）；不联网",
    "prompt": "无（机械清理）",
    "effect": "清 npm 中断残留临时目录，防 install 时 ENOTEMPTY 死循环"
  },
  {
    "name": "deploy-fast.sh",
    "file": "scripts/deploy-fast.sh",
    "category": "运维",
    "description": "会话中途快部署：esbuild + 重启 + 握手（跳过全链测试，约几秒）",
    "permission": "bash；build.mjs --fast 写 dist/ + 调用 kfm-restart.sh 重启服务 + curl localhost 版本握手；不联外网",
    "prompt": "无（机械）",
    "effect": "会话中途快部署：快构建 + 重启 + 握手（跳过全链测试）"
  },
  {
    "name": "deploy.sh",
    "file": "scripts/deploy.sh",
    "category": "运维",
    "description": "修复部署闭环：构建 → 重启 → 版本握手验证",
    "permission": "bash；npm run build 写 dist/ + 调用 kfm-restart.sh 重启 + curl localhost 版本握手；不联外网",
    "prompt": "无（机械）",
    "effect": "修复部署闭环：构建 → 重启 → 版本握手验证运行进程已加载新包"
  },
  {
    "name": "kfm-restart.sh",
    "file": "scripts/kfm-restart.sh",
    "category": "运维",
    "description": "kfm-restart — 安全重启 kfmv4 服务（含在跑实验闸门）",
    "permission": "bash；curl localhost 重启端点 + 轮询等服务恢复；前置 check-active-runs.sh 闸门（KFM_RESTART_IGNORE_ACTIVE=1 可放行）；不写文件、不联外网",
    "prompt": "无（机械）",
    "effect": "安全重启 kfmv4 服务：HTTP 端点触发（先响应后重启），有在跑实验默认拒绝"
  },
  {
    "name": "regenerate.sh",
    "file": "scripts/regenerate.sh",
    "category": "运维",
    "description": "生成器全回写（一键结束「改代码 → 手动逐级回写」多米诺）",
    "permission": "bash；跑 sync-counts/gen-code-inventory/gen-contract-lists 回写生成物到仓库文档；--commit 时 git 提交生成物；--check 只读校验；不联网",
    "prompt": "无（机械）",
    "effect": "生成器全回写一键化：按依赖顺序回写 + 可选精确提交"
  },
  {
    "name": "sweep-sessions.sh",
    "file": "scripts/sweep-sessions.sh",
    "category": "运维",
    "description": "sessions 目录清扫（script 分流的兜底回收）",
    "permission": "bash；移动/删除 ~/.kfmv4/sessions/ 下超龄 script 会话与 sandbox-* 沙箱（24h 加后缀、14 天删除）；--dry-run 只预览；不联网",
    "prompt": "无（机械清扫）",
    "effect": "sessions 目录清扫：僵尸会话加 .stranded 后缀回收，超期残卷与沙箱删除"
  }
];

export const SCRIPT_CATEGORIES: string[] = ["agent 负载","范式实验工具","范式考古","冷启动工具","检查器","生成器","构建链基建","运维"];
