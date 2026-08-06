#!/usr/bin/env node
/**
 * e16-cut.mjs — e16 候选段切块（S5/S6 集群打分前置，零 API）
 *
 * 输入：meta-pool/e16-candidates.json（e16-mine.mjs 产出，163 段带粗打分）
 * 切块：按用户消息切（批次 3 同法）——一块 = 一条 user 消息 + 其后到下一 user
 *   之前的所有 ai/reasoning/text 内容。S5/S6 的判断单位正是「用户指出 → AI 应对」
 *   这一来一回。
 * 过滤：块 <300 字符（无实质内容）丢弃；单块 >12k 字符截断（集群 prompt 预算，
 *   截断处标注）；reasoning 只取前 1500 字符（思考链供参考但不主导）。
 * 产出：meta-pool/e16-blocks/<episodeId>-b<idx>.json（含原文+元数据）
 *   + meta-pool/e16-blocks-index.json（块清单，按 episode 粗打分降序，
 *     供 AgentSwarm 分批）
 *
 * 用法：node experiments/paradigm/tools/e16-cut.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const META = join(HERE, '..', 'meta-pool');
const BLOCKS_DIR = join(META, 'e16-blocks');
mkdirSync(BLOCKS_DIR, { recursive: true });

const MIN_CHARS = 300, MAX_CHARS = 12000, REASONING_CAP = 1500;

const { candidates } = JSON.parse(readFileSync(join(META, 'e16-candidates.json'), 'utf-8'));
const db = new DatabaseSync(process.env.HOME + '/.kfmv4/materials/materials.db', { readOnly: true });
const epStmt = db.prepare('SELECT seq_start, seq_end FROM episodes WHERE id = ?');
const msgStmt = db.prepare('SELECT seq, role, text FROM messages WHERE session_id = ? AND seq BETWEEN ? AND ? ORDER BY seq');
const rsStmt = db.prepare('SELECT seq, text FROM reasoning WHERE session_id = ? AND seq BETWEEN ? AND ? ORDER BY seq');

const index = [];
let dropped = 0;
for (const ep of candidates) {
  const range = epStmt.get(ep.episode_id);
  if (!range) { console.error(`跳过 ep${ep.episode_id}：episodes 表查不到`); continue; }
  const msgs = msgStmt.all(ep.session_id, range.seq_start, range.seq_end);
  const reasons = rsStmt.all(ep.session_id, range.seq_start, range.seq_end);
  const rsBySeq = new Map(reasons.map(r => [r.seq, r.text]));

  // 切块：user 消息开新块
  const blocks = [];
  let cur = null;
  for (const m of msgs) {
    if (m.role === 'user') {
      if (cur) blocks.push(cur);
      cur = { user: m.text || '', ai: [], reasoning: [] };
    } else if (cur && (m.role === 'ai' || m.role === 'assistant')) {
      cur.ai.push(m.text || '');
      const rs = rsBySeq.get(m.seq);
      if (rs) cur.reasoning.push(rs.slice(0, REASONING_CAP));
    }
  }
  if (cur) blocks.push(cur);

  blocks.forEach((b, i) => {
    const text = `**用户：**\n${b.user}\n\n**AI：**\n${b.ai.join('\n')}`
      + (b.reasoning.length ? `\n\n**（AI 思考节选）：**\n${b.reasoning.join('\n---\n')}` : '');
    let final = text, truncated = false;
    if (text.length > MAX_CHARS) { final = text.slice(0, MAX_CHARS) + '\n\n[…块过长已截断…]'; truncated = true; }
    if (final.length < MIN_CHARS) { dropped++; return; }
    const id = `ep${ep.episode_id}-b${i}`;
    writeFileSync(join(BLOCKS_DIR, `${id}.json`), JSON.stringify({
      id, episode_id: ep.episode_id, session_id: ep.session_id, source: ep.source,
      topic: ep.topic, pattern: ep.pattern, ep_score: ep.score,
      chars: final.length, truncated, text: final,
    }, null, 1));
    index.push({ id, episode_id: ep.episode_id, source: ep.source, topic: ep.topic, pattern: ep.pattern, ep_score: ep.score, chars: final.length, truncated });
  });
}

index.sort((a, b) => b.ep_score - a.ep_score);
writeFileSync(join(META, 'e16-blocks-index.json'), JSON.stringify({ generated: new Date().toISOString(), blocks: index }, null, 1));
console.log(`切块完成：${index.length} 块（丢弃过短 ${dropped}）→ ${BLOCKS_DIR}`);
console.log(`字符总量 ${(index.reduce((a, b) => a + b.chars, 0) / 1000).toFixed(0)}k，截断块 ${index.filter(b => b.truncated).length}`);
console.log(`建议分批：${Math.ceil(index.length / 32)} 批 × 32 块`);
db.close();
