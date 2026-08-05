#!/usr/bin/env node
/** judge-llm.mjs — LLM 盲判卷（替代正则词频的粗判卷尺）
 * 对 sessions/script/ 的实验臂产出，逐臂让判卷模型按结构化维度打分。
 * 盲判：判卷输入只含任务+回复，不含臂条件（防判卷偏见）。
 * 用法：node judge-llm.mjs --prefixes "e7-t0,e7b-t0,e7c-t0" --judge-model kimi-k3 --judge-provider "Opencode Go Google" --concurrency 8
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runSession } from '/root/kfmv4/experiments/paradigm/tools/session-runner.mjs';

const dir = '/root/.kfmv4/sessions/script';
const OUT = '/tmp/judge-llm-results.json';
const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const prefixes = (get('prefixes') || 'e7-t0').split(',');
const judgeModel = get('judge-model') || 'kimi-k3';
const judgeProvider = get('judge-provider') || 'Opencode Go Google';
const concurrency = Number(get('concurrency') || 8);
const task = readFileSync(get('task-file') || '/tmp/exp5-task.txt', 'utf-8').trim();

const PROMPT = (task, out) => `你是盲判卷员。下面给你一个任务和一份 AI 对该任务的回复。只根据回复文本本身评分，不要猜测回复的产生条件。

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

// 收集臂
const arms = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  if (!prefixes.some(p => f.startsWith(p))) continue;
  const m = f.match(/^([a-z0-9]+-t0)p(\d)m(\d)r(\d)/);
  if (!m) continue;
  const d = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
  const msgs = d.messages || [];
  let out = '';
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== 'ai') continue;
    const texts = (msgs[i].content || []).filter(b => b && b.type === 'text' && b.text).map(b => b.text);
    if (texts.length) { out = texts.join('\n'); break; }
  }
  arms.push({ id: f.replace('.json', ''), batch: m[1], pi: Number(m[2]), mi: Number(m[3]), model: d.modelId || 'unknown', out });
}
// 断点续判：已判过的跳过
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {};
const todo = arms.filter(a => !done[a.id]);
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
      done[a.id] = { batch: a.batch, pi: a.pi, mi: a.mi, model: a.model, score, outLen: a.out.length };
      writeFileSync(OUT, JSON.stringify(done, null, 1));
      console.log(`[judge-llm] ${a.id} ✓ meta=${score.meta_depth} dissect=${score.self_dissection} bound=${score.boundary_awareness} vis=${score.reasoning_visible}`);
      return;
    } catch (e) {
      if (retry === 2) { console.error(`[judge-llm] ${a.id} 判卷失败: ${e.message.slice(0, 80)}`); done[a.id] = { batch: a.batch, pi: a.pi, mi: a.mi, model: a.model, error: e.message.slice(0, 80) }; writeFileSync(OUT, JSON.stringify(done, null, 1)); }
    }
  }
}, concurrency);
console.log(`[judge-llm] 完成，结果 ${OUT}`);
process.exit(0);
