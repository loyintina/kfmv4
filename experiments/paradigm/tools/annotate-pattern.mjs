#!/usr/bin/env node
/**
 * annotate-pattern.mjs — 补 episodes 缺省的 pattern 标注（2026-08-04 接手审计）
 * 审计发现：101/264 段 pattern 为空（38%）。用便宜链 LLM 按 patterns.md 的
 * 32 个引导模式逐段判断范式归属。⚠️ uid 跨会话不唯一——更新必须按 id。
 * 用法：--dry-run（建议不写库）/ --apply（写库）/ --uid <段id>（单段调试）
 */
import { runAgent, extractJson } from '/root/kfmv4/scripts/agent/agent-runner.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const APPLY = argv.includes('--apply');
const ONLY = argv.includes('--uid') ? argv[argv.indexOf('--uid') + 1] : null;

const PATTERNS = [
  '验证优先','心法前置','补丁vs根因','两机制打架','读码优先','复用既有','实现边界控制',
  '删繁','设计主权','可回退铁律','复盘沉淀','施压式验收','验收清单模式','深挖根因+对标成熟',
  '全链路验证','数量覆盖质疑','架构性质校验','彻底重构决策','落盘兜底机制','版本哲学',
  '主产物vs副产物','全量原则','prompt单一原则','总runner自动化','溯源审计','重构优于补丁',
  '筛选vs压缩','修尺量物','冰山理论','数据实验优先','庙算','检查发现率信号',
];

const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync('/root/.kfmv4/materials/materials.db');
const missing = ONLY
  ? db.prepare("SELECT id,uid,kind,topic,note FROM episodes WHERE uid=?").all(ONLY)
  : db.prepare("SELECT id,uid,kind,topic,note FROM episodes WHERE pattern IS NULL OR pattern=''").all();
console.error(`[annotate] 待标注段: ${missing.length}`);

const BATCH = 10;
let total = 0, applied = 0;
for (let i = 0; i < missing.length; i += BATCH) {
  const batch = missing.slice(i, i + BATCH);
  const segLines = batch.map(e => `${e.id}|${e.uid}|${e.kind}|${(e.topic || '').slice(0, 80)}${e.note ? '|' + e.note.slice(0, 80) : ''}`).join('\n');
  const prompt = `你是素材库段标注员。下面每行是一个会话段落：「id|段id|类型|主题|备注」。
为每段从以下 32 个引导模式中选 0-2 个最贴切的范式标签（0 个=杂项/无范式，用空数组）：
${PATTERNS.map((p, i) => `${i + 1}.${p}`).join('\n')}
只输出 JSON：{"annotations":[{"id":<数字>,"pattern":["模式名"]}]}
id 用输入里的数字 id，一一对应不要遗漏。不确定给空数组。`;
  const r = await runAgent({
    system: '你是素材库段标注员。只输出要求的 JSON，不要任何多余文字。',
    prompt,
    validate: (t) => { const j = extractJson(t); return j && Array.isArray(j.annotations) ? j : null; },
    maxTokens: 3000,
    params: { response_format: undefined },
    timeoutMs: 120000,
  });
  if (!r.ok) { console.error(`[annotate] 批 ${i / BATCH + 1} 失败: ${r.errors.join('；')}`); continue; }
  for (const a of r.data.annotations) {
    const pats = Array.isArray(a.pattern) ? a.pattern.filter(p => PATTERNS.includes(p)).join(',') : '';
    total++;
    if (APPLY) { db.prepare('UPDATE episodes SET pattern=? WHERE id=?').run(pats, a.id); applied++; }
    else console.log(`${a.id} ${(batch.find(b => b.id === a.id) || {}).uid || '?'} → ${pats || '(无)'}`);
  }
}
if (DRY) console.log(`[annotate] dry-run 建议 ${total} 段（未写库）`);
if (APPLY) console.log(`[annotate] 已写库 ${applied} 段`);
