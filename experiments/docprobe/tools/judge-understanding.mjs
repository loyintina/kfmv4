#!/usr/bin/env node
// judge-understanding.mjs — docprobe 盲判轨：理解准确度（要点覆盖 0-5 + 幻觉计数）
//
// 用法：
//   node experiments/docprobe/tools/judge-understanding.mjs \
//     --session /root/.kfmv4/sessions/script/<id>.json \
//     --truth   /root/.kfmv4/experiments/docprobe/truth/<topic>.md \
//     --judge-model deepseek-v4-flash --judge-provider deepseek \
//     [--out /tmp/docprobe-judge.jsonl] （追加写，断点续判按臂 id 跳过）
//
// 盲判纪律：判卷输入只含「题目 + 最终回复 + 地面真相要点」，不含臂条件/轨迹。
// 判官无工具（显式空数组 = 空白名单，e19 语料退化事故根治方案），
// 防判官自己去仓库翻证据（那是开卷判卷）。
// --judge-model/--judge-provider 为显式必填（e18b 判官污染事故纪律：防静默回落默认判官）。

import { readFileSync, appendFileSync, existsSync } from 'fs';
import { runSession } from '/root/kfmv4/experiments/paradigm/tools/session-runner.mjs';

const argv = process.argv.slice(2);
const KNOWN = new Set(['session', 'truth', 'judge-model', 'judge-provider', 'out']);
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.has(a.slice(2)));
if (unknown.length) {
  console.error(`[judge-understanding] 未知旗标：${unknown.join(' ')}（合法：${[...KNOWN].map((k) => '--' + k).join(' ')}）`);
  process.exit(2);
}
const get = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const sessionPath = get('session');
const truthPath = get('truth');
const judgeModel = get('judge-model');
const judgeProvider = get('judge-provider');
const OUT = get('out') || '/tmp/docprobe-judge.jsonl';
if (!sessionPath || !truthPath || !judgeModel || !judgeProvider) {
  console.error('need --session <归档> --truth <真相> --judge-model <名> --judge-provider <名>（判官显式必填）');
  process.exit(2);
}

// ---------- 地面真相：题目 / 理解要点 / 幻觉陷阱 ----------
const truth = readFileSync(truthPath, 'utf8');
const qm = truth.match(/## 冻结题目\s*```\s*([\s\S]*?)\s*```/);
if (!qm) { console.error('truth 缺「## 冻结题目」代码块'); process.exit(2); }
const question = qm[1].trim();
const secText = (name) => (truth.match(new RegExp(`## ${name}[\\s\\S]*?(?=\\n## |$)`)) || [''])[0];
const points = secText('理解要点').split('\n').filter((l) => /^\d+\./.test(l.trim())).map((l) => l.trim());
const traps = secText('幻觉陷阱').split('\n').filter((l) => /^- /.test(l.trim())).map((l) => l.trim());
if (!points.length) { console.error('truth 理解要点为空'); process.exit(2); }

// ---------- 臂：最终回复（盲判唯一输入） ----------
const archive = JSON.parse(readFileSync(sessionPath, 'utf8'));
const armId = archive.id;
if (!armId) { console.error('归档缺 id'); process.exit(2); }
if (existsSync(OUT) && readFileSync(OUT, 'utf8').includes(`"arm":"${armId}"`)) {
  console.log(`[judge-understanding] ${armId} 已判，跳过`);
  process.exit(0);
}
const lastAi = [...archive.messages].reverse().find((m) => m.role === 'ai');
const reply = (lastAi?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
if (!reply.trim()) { console.error(`${armId} 最终回复为空`); process.exit(2); }

// ---------- 盲判 ----------
const prompt = `你是盲判卷员。下面给你一个问题、一份 AI 对该问题的回复、以及该问题的标准理解要点与幻觉陷阱清单。只根据回复文本本身评分，不要猜测回复的产生条件，不要去查阅任何资料。

【问题】
${question}

【AI 回复】
${reply.slice(0, 16000)}

【标准理解要点（共 ${points.length} 条）】
${points.join('\n')}

【幻觉陷阱（回复若踩中须计数）】
${traps.join('\n') || '（无）'}

评分口径：
- coverage 要点覆盖：回复正确命中的要点条数（0-${points.length} 整数）。命中 = 回复包含该要点的核心事实，措辞不限；张冠李戴或仅有词无实不算命中。
- hallucinations 幻觉数：回复踩中幻觉陷阱的条数 + 回复中无出处编造的硬事实数（命令名/参数/路径/日期等）。
- note：一句话依据。

只输出 JSON：{"coverage":N,"hallucinations":N,"note":"..."}`;

const judgeSession = `docprobe-judge-${armId}-${Date.now().toString(36)}`;
const res = await runSession({
  sessionId: judgeSession,
  messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  userText: prompt,
  model: judgeModel,
  provider: judgeProvider,
  tools: [], // 判官无工具：防开卷判卷
});
const judgeArchive = JSON.parse(readFileSync(res.sessionPath, 'utf8'));
const judgeAi = [...judgeArchive.messages].reverse().find((m) => m.role === 'ai');
const raw = (judgeAi?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
const jm = raw.match(/\{[\s\S]*\}/);
if (!jm) { console.error(`${armId} 判官未输出 JSON：${raw.slice(0, 200)}`); process.exit(2); }
const verdict = JSON.parse(jm[0]);
const row = { arm: armId, judge: `${judgeModel}@${judgeProvider}`, ...verdict };
appendFileSync(OUT, JSON.stringify(row, null, 0) + '\n');
console.log(`[judge-understanding] ${armId} → coverage=${verdict.coverage}/${points.length} hallucinations=${verdict.hallucinations} | ${verdict.note}`);
