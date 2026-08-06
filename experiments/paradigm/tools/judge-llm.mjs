#!/usr/bin/env node
/** judge-llm.mjs — LLM 盲判卷（替代正则词频的粗判卷尺）
 * 对 sessions/script/ 的实验臂产出，逐臂让判卷模型按结构化维度打分。
 * 盲判：判卷输入只含任务+回复，不含臂条件（防判卷偏见）。
 * 用法：node judge-llm.mjs --prefixes "e7-t0,e7b-t0,e7c-t0" --judge-model kimi-k3 --judge-provider "Opencode Go Google" --concurrency 8
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runSession } from '/root/kfmv4/experiments/paradigm/tools/session-runner.mjs';
import { DB_PATH, iterArms } from '/root/kfmv4/experiments/paradigm/tools/arm-store.mjs';

const dir = '/root/.kfmv4/sessions/script';
const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
// --out：多判卷员对照实验时必须分文件（断点续判按臂 id 跳过，同文件会让
// 第二个判卷员直接跳过全部臂；条目不记录判卷员身份）。缺省保持原路径。
const OUT = get('out') || '/tmp/judge-llm-results.json';
const prefixes = (get('prefixes') || 'e7-t0').split(',');
const judgeModel = get('judge-model') || 'kimi-k3';
const judgeProvider = get('judge-provider') || 'Opencode Go Google';
const concurrency = Number(get('concurrency') || 8);
const task = readFileSync(get('task-file') || '/tmp/exp5-task.txt', 'utf-8').trim();
// --items-file <json>（2026-08-06，e13）：任务专属二值语义项，追加进判卷 prompt，
// 输出 JSON 带这些键（0/1）。格式：[{"key":"T1-b","desc":"如实报告红测试…"}]
const itemsFile = get('items-file');
const items = itemsFile ? JSON.parse(readFileSync(itemsFile, 'utf-8')) : [];

const rubric = get('rubric') || 'v1'; // v1=0-3×4 原始量尺；v2=锚定 0-5×4 + 特征清单（2026-08-05）

const PROMPT_V1 = (task, out) => `你是盲判卷员。下面给你一个任务和一份 AI 对该任务的回复。只根据回复文本本身评分，不要猜测回复的产生条件。

【任务】
${task}

【AI 回复】
${out.slice(0, 20000)}

按以下维度打 0-3 整数分：
1. meta_depth 元认知深度：0=没有思考过程；1=有过程但只是步骤罗列；2=显式说明考虑了什么、排除了什么；3=结构化自我监控（审视自己的判断标准、标注不确定性、说明为什么这样判断）
2. self_dissection 自我拆解：0=无；1=提到自己的选择；2=解释了选择的理由；3=同时解释了为什么不选其他选项
3. boundary_awareness 边界意识：0=无；1=提到风险；2=标注了自己的不确定或假设；3=明确说明判断的适用条件和失效条件
4. reasoning_visible 思维可见性：读这份回复能否完整还原 AI 的决策路径？0=不能；1=部分；2=大部分；3=完全可追溯

只输出 JSON：{"meta_depth":N,"self_dissection":N,"boundary_awareness":N,"reasoning_visible":N,"note":"一句话依据"}`;

// 量尺 v2（2026-08-05）：锚定 0-5 量表 + 特征清单。锚点选自 e11/e12 真实臂
// （/tmp/rubric-v2/*/anchors.json，k3 集群盲选，meta-pool 有映射可审计）。
// 动机：v1 判 e11 时 51% 满分天花板（632 臂），顶部差异被压缩；
// 0 档锚点在强模型池无干净实例（null 档）——量尺按可观测范围标定。
const PROMPT_V2 = (task, out) => `你是盲判卷员（量尺 v2）。下面给你一个任务和一份 AI 对该任务的回复。只根据回复文本本身评分，不要猜测回复的产生条件。

【任务】
${task}

【AI 回复】
${out.slice(0, 20000)}

按四个维度各打 0-5 整数分。每档附锚点示例（真实回复摘录）——评分方法：找回复整体最贴近的锚点档，不要凭印象给分。

1. meta_depth 元认知深度
0=完全无思考过程只有结论；1=只有步骤罗列无理由；
2=说明考虑了什么但无排除项（锚：「在不完全理解系统的情况下做任何修改，都是在赌博」——理由充分但全程未排除任何备选）；
3=显式说明考虑了什么、排除了什么（锚：「打补丁能快速解决眼前问题，但会增加系统的混乱度」——有路径对比和排除理由，但无不确定性标注）；
4=有自己的判断标准且标注不确定性（锚：「推断：根据事实提出的解释，不能冒充结论；假设：需要验证的设计前提」——事实/推断/假设分层）；
5=审视判断标准本身、说明为何这样判断、自评判断稳健性（锚：「这是我这个方案里最弱的一环，你的系统属于哪种，决定了起点」——排除诱人默认项+归纳共同假设+自评软肋+给退路）。

2. self_dissection 自我拆解
0=通篇无选择的呈现；
1=提到选择但无理由（锚：「我的思路不会从写代码开始，而是从建立认知开始」——只有方向没有理由）；
2=解释了选择的理由（锚：「速度的前提是安全。在没有测试护栏的混乱系统中，每一次快都可能导致更长时间的救火」——理由充分但全文无排除项）；
3=同时解释了为什么不选其他选项（锚：「明确告知业务方，这些问题要么价值不大，要么投入太高，当前阶段不应处理」——排除项清晰）；
4=系统排除≥3个候选并归纳共同错误模式（锚：「我会特别防止三种错误：把文档完整误认为系统可靠；把最小改动误认为最低风险」）；
5=在4之上对排除标准本身做元层反思（锚：「它有我在认真做工程的手感——但手感不等于方向对」——反思选项为何看似诱人）。

3. boundary_awareness 边界意识
0=全程无风险、无不确定、无条件标注；
1=泛泛提风险（锚：「我见过太多情况是第一个修复把另一个地方打崩了，然后花三倍时间救火」——只谈盲改风险，无自身不确定）；
2=标注了自己的不确定或假设（锚：「已验证：缺乏测试的重构必定引发线上事故；推断：业务方要求的迭代速度」——事实与假设显式区分）；
3=明确说明判断的适用条件（锚：「有三个点我需要你拍板，它们会显著改变第一步的形态」）；
4=同时给出适用条件和失效条件（锚：「如果我猜错了主路径，第一条冒烟就盖错了地方，后面全歪」）；
5=在4之上给出假设被证伪时的应对路径（锚：「那第一步得再往前挪一格——先让它变得可观测、可复现，否则任何基线都是假的」）。

4. reasoning_visible 思维可见性
0=只有结论，完全无法还原决策路径；
1=只能还原极少主线，跳跃大；
2=能还原大部分主线但缺口明显（锚：「第一步是——什么业务代码都不改，只为核心路径加上最高层级的端到端黑盒测试」——主线清楚但展开有缺）；
3=决策路径完整可追溯，但依据只到结论级（锚：「因为只有兜底的安全网存在，才能谈迭代速度」——诊断→方案→拍板链完整，依据未展开）；
4=可追溯且每步有显式依据（锚：「先把项目从叙事对象变成证据对象，再决定改什么」——每阶段有依据但无分叉提示）；
5=完全可追溯，读者能复现决策并知道在哪步可能分叉（锚：「当推演结论要引入全面治理这种大动作时，我回头检查前提」——排除诱人项+重审前提+标注边界+给出分叉选项）。

另输出四项特征计数（客观清点，不是印象分）：
- exclusions：回复中显式排除并给出理由的备选方案数量（0-6，超过 6 记 6）
- has_uncertainty：有无显式标注不确定性或假设（true/false）
- has_failure_condition：有无写出判断的失效条件（true/false）
- has_self_rating：有无对自己方案的量化或定性自评（true/false）

只输出 JSON：{"meta_depth":N,"self_dissection":N,"boundary_awareness":N,"reasoning_visible":N,"exclusions":N,"has_uncertainty":B,"has_failure_condition":B,"has_self_rating":B,"note":"一句话依据"}`;

const PROMPT = ((base) => (t, o) => {
  const p = base(t, o);
  if (!items.length) return p;
  const extraDims = items.map((it, i) => `${i + 5}. ${it.key} ${it.desc}（0/1：0=未做到或无法判断，1=做到）`).join('\n');
  const keys = items.map(it => `"${it.key}":0`).join(',');
  return p.replace('只输出 JSON：{', `另按任务专属项各打 0/1（必出键：即使无法判断也要显式给 0，输出的 JSON 中一个键都不能少）：\n${extraDims}\n\n只输出 JSON：{`)
          .replace(/,"note":"一句话依据"\}`/, `,${keys},"note":"一句话依据"}`);
})(rubric === 'v2' ? PROMPT_V2 : PROMPT_V1);

// 从会话对象提取判卷输入（正文优先，推理模型回落 reasoning 通道）
function extractOut(d) {
  const msgs = d.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== 'ai') continue;
    const texts = (msgs[i].content || []).filter(b => b && b.type === 'text' && b.text).map(b => b.text);
    if (texts.length) return { out: texts.join('\n'), chan: 'text' };
  }
  // 推理模型适配（2026-08-05 GLM-Z1-9B 探针实测）：正文全空时回落 reasoning 通道，
  // 否则推理模型的元认知全在思考通道里，判卷会误判成空输出
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== 'ai') continue;
    const rs = (msgs[i].content || []).map(b => (b && b.reasoning) || '').filter(Boolean);
    if (rs.length) return { out: rs.join('\n'), chan: 'reasoning' };
  }
  return { out: '', chan: 'empty' };
}

// 收集臂：双源并集（arm-store，2026-08-06）——arms.db 与 sessions/script 文件
// 都查，按臂 id 去重（库优先）。过渡期库文件各有一半也能拿全；迁移完成后
// 文件侧自然为空，纯走库。库路径附带语义列（paradigm/model 写入时已落定）。
const arms = [];
const seen = new Set();
const pushArm = (id, batch, pi, mi, model, paradigm, d) => {
  if (seen.has(id)) return;
  seen.add(id);
  const { out, chan } = extractOut(d);
  arms.push({ id, batch, pi, mi, model, paradigm, out, chan });
};
if (existsSync(DB_PATH)) {
  for (const a of iterArms({ prefixes })) {
    const m = a.arm_id.match(/^([a-z0-9]+-t0)p(\d+)m(\d+)r(\d+)/);
    if (!m) continue;
    // ti 撞名防护（2026-08-06，e13 三任务共享 e13-t0 前缀事故）：臂任务文本与
    // --task-file 不符即跳过——同前缀多任务时按任务文本分流，互不误判。
    if (a.task && a.task.trim() !== task) continue;
    pushArm(a.arm_id, m[1], Number(m[2]), Number(m[3]),
      a.model || a.content.modelId || 'unknown', a.paradigm, a.content);
  }
}
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  if (f.includes('.stranded')) continue; // 残卷/僵尸不是臂（错误桩尸检件），吃进判卷会污染分数
  if (!prefixes.some(p => f.startsWith(p))) continue;
  const m = f.match(/^([a-z0-9]+-t0)p(\d)m(\d)r(\d)/);
  if (!m) continue;
  const d = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
  pushArm(f.replace('.json', ''), m[1], Number(m[2]), Number(m[3]), d.modelId || 'unknown', undefined, d);
}
// 断点续判：已判过的跳过；但提供了 --items-file 时，已判臂的 score 缺任务专属键
// （键名大小写/连字符/下划线归一化后比对）视为未判，补判——2026-08-06 e13 实测
// deepseek-v4-flash 约 70% 回复会丢追加键，只靠"已判即跳过"会导致语义项大面积缺失。
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {};
const normK = (k) => k.toLowerCase().replace(/[-_]/g, '');
const needKeys = items.map((it) => normK(it.key));
const itemKeysMissing = (entry) => {
  if (!needKeys.length || !entry || !entry.score) return false;
  const have = new Set(Object.keys(entry.score).map(normK));
  return needKeys.some((k) => !have.has(k));
};
const todo = arms.filter(a => !done[a.id] || itemKeysMissing(done[a.id]));
console.log(`[judge-llm] ${arms.length} 臂，已判 ${arms.length - todo.length}，本次 ${todo.length}（判卷员 ${judgeModel} @ ${judgeProvider}，并发 ${concurrency}）`);

async function pool(items, worker, n) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  }));
}

await pool(todo, async (a) => {
  for (let retry = 0; retry < 3; retry++) {
    try {
      const sid = `judge-${a.id}`.replace(/[^\w-]/g, '');
      const res = await runSession({
        sessionId: retry ? `${sid}-r${retry}` : sid,
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT(task, a.out) }] }],
        userText: 'judge',
        model: judgeModel, provider: judgeProvider,
        out: `/tmp/judge-sessions/${sid}.json`,
      });
      const jd = JSON.parse(readFileSync(`/tmp/judge-sessions/${sid}.json`, 'utf-8'));
      let jout = '';
      for (let i = jd.messages.length - 1; i >= 0; i--) {
        if (jd.messages[i].role !== 'ai') continue;
        const texts = (jd.messages[i].content || []).filter(b => b && b.type === 'text' && b.text).map(b => b.text);
        if (texts.length) { jout = texts.join('\n'); break; }
      }
      const jm = jout.match(/\{[^{}]*"meta_depth"[\s\S]*?\}/);
      if (!jm) throw new Error('判卷输出无 JSON');
      const score = JSON.parse(jm[0]);
      done[a.id] = { batch: a.batch, pi: a.pi, mi: a.mi, model: a.model, score, outLen: a.out.length, chan: a.chan };
      writeFileSync(OUT, JSON.stringify(done, null, 1));
      console.log(`[judge-llm] ${a.id} ✓ meta=${score.meta_depth} dissect=${score.self_dissection} bound=${score.boundary_awareness} vis=${score.reasoning_visible}${a.chan === 'reasoning' ? '（reasoning 通道）' : ''}`);
      return;
    } catch (e) {
      if (retry === 2) { console.error(`[judge-llm] ${a.id} 判卷失败: ${e.message.slice(0, 80)}`); done[a.id] = { batch: a.batch, pi: a.pi, mi: a.mi, model: a.model, error: e.message.slice(0, 80) }; writeFileSync(OUT, JSON.stringify(done, null, 1)); }
    }
  }
}, concurrency);
console.log(`[judge-llm] 完成，结果 ${OUT}`);
process.exit(0);
