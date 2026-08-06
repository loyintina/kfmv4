#!/usr/bin/env node
/**
 * build-e16-packs.mjs — e16 结构实验（S5 对比对 / S6 复盘叙事）制包器（2026-08-06）
 *
 * 选材规则（design-roadmap-e14-e16.md「e16 长杆 = 制包」落档）：
 *   素材 = materials.db 1098 块（e16-scores-merged.json 全量密度打分，0-3 尺）
 *   S5 包（对比对：错误 vs 正确）：s5=3 且 s6≤1（纯度过滤——保 S5/S6 可比性）
 *   S6 包（复盘叙事：走错→修正）：s6=3 且 s5≤2（纯度放宽——s6=3 中 s5≤1
 *     仅 5 块可用共 8k 字，不够成包；放宽到 s5≤2 得 15 块 21k 字，记为已知局限）
 *   通用过滤：未截断、800–3000 字符（太短没叙事弧，太长挤占预算）
 *   排序：ep_score（episode 级质量分）降序；同会话限 2 块保底多样性，
 *     预算未满再放开二轮
 *   预算：正文 ≈11000 字符/包（×0.75 ≈ 8.2k tok，对齐 metacognition-8.1k 可比档）
 *
 * 包装格式 = W2 轻标记（e12 结论：轻标记是默认赢面结构）：
 *   头部宣言（范式定位 + 致挂载模型 + 来源）+ `\n\n---\n\n` 分隔 +
 *   `## N、{topic}` 节标题，节内为原始对话块（**用户：** / **AI：** 原样）
 *
 * 幂等：评分/块文件不变时重复运行产出逐字节一致。
 * 用法：node experiments/paradigm/tools/build-e16-packs.mjs
 * 产出：~/.kfmv4/paradigms/e16-s5-contrast.md / e16-s6-retro.md
 *       + meta-pool/e16-packs-manifest.json（选块清单与理由，供复算）
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const POOL = 'experiments/paradigm/meta-pool';
const BLOCKS_DIR = join(POOL, 'e16-blocks');
const OUT_DIR = join(homedir(), '.kfmv4', 'paradigms');
const SEP = '\n\n---\n\n';
const BODY_BUDGET = 11000; // 字符，≈8.2k tok（0.75 口径）
const MIN_CHARS = 800, MAX_CHARS = 3000, PER_SESSION_CAP = 2;

const scores = JSON.parse(readFileSync(join(POOL, 'e16-scores-merged.json'), 'utf-8')).scores;
const blocks = {};
for (const f of readdirSync(BLOCKS_DIR)) {
  if (f.endsWith('.json')) blocks[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(BLOCKS_DIR, f), 'utf-8'));
}

const usable = (s) => {
  const b = blocks[s.id];
  return b && !b.truncated && b.chars >= MIN_CHARS && b.chars <= MAX_CHARS;
};

function select(pred) {
  const pool = scores.filter(pred).filter(usable)
    .sort((a, b) => (blocks[b.id].ep_score - blocks[a.id].ep_score) || a.id.localeCompare(b.id));
  const picked = [], perSession = {};
  let total = 0;
  // 两轮贪心：首轮守同会话限额，预算未满次轮放开
  for (const cap of [PER_SESSION_CAP, Infinity]) {
    for (const s of pool) {
      if (total >= BODY_BUDGET) break;
      if (picked.includes(s)) continue;
      const b = blocks[s.id];
      // 块原子不可切，防末块超冲：已达成 80% 预算后，只收不会把总量推过 110% 的块
      if (total >= BODY_BUDGET * 0.8 && total + b.chars > BODY_BUDGET * 1.1) continue;
      if ((perSession[b.session_id] || 0) >= cap) continue;
      picked.push(s);
      perSession[b.session_id] = (perSession[b.session_id] || 0) + 1;
      total += b.chars;
    }
    if (total >= BODY_BUDGET) break;
  }
  return picked;
}

const HEAD = {
  s5: `# 对比对示范（S5：错误 vs 正确）

> 范式定位：对比对——同一工程情境下「错误做法」与「正确做法」并排呈现，对照出为什么错、为什么对。本包是范式包（示范），不是规则包（约束）：以下对话摘自真实工程会话，展示「对照式纠错」在实战中长什么样。
> **致挂载本包的模型**：请模仿这些对话里 AI 的**行为方式**——把错误路径和正确路径并置、说清两者差在哪——而不是复述对话的内容。对话里的项目、文件名、文档名只是示范语境，不是你的任务，也不是你的约束。
> 来源：materials.db e16 密度打分精选（s5=3 且 s6≤1 纯度过滤），2026-08-06 由 build-e16-packs.mjs 生成。`,
  s6: `# 复盘叙事（S6：走错→修正）

> 范式定位：复盘叙事——完整呈现「走错了路 → 察觉 → 回退/修正 → 沉淀规则」的叙事弧，重点不是不犯错，而是犯错后的回路长什么样。本包是范式包（示范），不是规则包（约束）：以下对话摘自真实工程会话，展示「走错→修正」在实战中长什么样。
> **致挂载本包的模型**：请模仿这些对话里 AI 的**行为方式**——走错了先承认再回退、修正后把教训落成规则——而不是复述对话的内容。对话里的项目、文件名、文档名只是示范语境，不是你的任务，也不是你的约束。
> 来源：materials.db e16 密度打分精选（s6=3 且 s5≤2 纯度过滤——s6=3 中 s5≤1 仅 5 块可用，放宽至 s5≤2，记为已知局限），2026-08-06 由 build-e16-packs.mjs 生成。`,
};

const PLANS = [
  { name: 'e16-s5-contrast.md', kind: 's5', pred: (s) => s.s5 === 3 && s.s6 <= 1 },
  { name: 'e16-s6-retro.md', kind: 's6', pred: (s) => s.s6 === 3 && s.s5 <= 2 },
];

const manifest = { generated: new Date().toISOString(), budget: BODY_BUDGET, packs: {} };
for (const plan of PLANS) {
  const picked = select(plan.pred);
  const sections = picked.map((s, i) => {
    const b = blocks[s.id];
    return `## ${['一','二','三','四','五','六','七','八','九','十','十一','十二'][i] || i + 1}、${b.topic}\n\n> 模式：${b.pattern} · 块 ${s.id}（s5=${s.s5} s6=${s.s6}，episode 质量分 ${b.ep_score}）\n\n${b.text.trim()}`;
  });
  const body = HEAD[plan.kind] + SEP + sections.join(SEP) + '\n';
  writeFileSync(join(OUT_DIR, plan.name), body);
  manifest.packs[plan.name] = picked.map((s) => ({
    id: s.id, s5: s.s5, s6: s.s6, chars: blocks[s.id].chars,
    ep_score: blocks[s.id].ep_score, topic: blocks[s.id].topic, reason: s.reason,
  }));
  const bodyChars = picked.reduce((a, s) => a + blocks[s.id].chars, 0);
  console.log(`[build-e16] ${plan.name}: ${picked.length} 块，正文 ${bodyChars} 字符，全文 ${body.length} 字符 ≈ ${Math.round(body.length * 0.75)} tok`);
}
writeFileSync(join(POOL, 'e16-packs-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[build-e16] manifest → ${POOL}/e16-packs-manifest.json`);
