// e16-mine.mjs — e16 S5/S6 素材开矿（候选集生成，零 API）
// S5 对比对候选：用户消息含错误指出短语（两字符词 FTS trigram 查不到，直接 LIKE）
// S6 复盘叙事候选：episodes pattern 含 补丁vs根因/可回退铁律/重构优于补丁/溯源审计/版本回退
// 产出：每个候选 episode 带错误信号密度打分，落盘 meta-pool/e16-candidates.json
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'fs';

const db = new DatabaseSync(process.env.HOME + '/.kfmv4/materials/materials.db', { readOnly: true });
const PHRASES = ['不对', '错了', '修坏', '还原', '回退', '不是根因', '你确定', '又坏', '还是不行', '改坏', '破坏', '幽灵', 'bug', '报错'];
const S6_PATTERNS = ['补丁vs根因', '可回退铁律', '重构优于补丁', '溯源审计', '版本回退', '回归定位', '调试困境'];

const episodes = db.prepare(`
  SELECT id, session_id, uid, kind, status, seq_start, seq_end, topic, pattern, source
  FROM episodes
  WHERE (kind='bug' AND status='solved')
     OR ${S6_PATTERNS.map(p => `pattern LIKE '%${p}%'`).join(' OR ')}
`).all();

const msgStmt = db.prepare(`
  SELECT seq, role, SUBSTR(text, 1, 4000) text FROM messages
  WHERE session_id = ? AND seq BETWEEN ? AND ? ORDER BY seq
`);

const candidates = [];
for (const ep of episodes) {
  const msgs = msgStmt.all(ep.session_id, ep.seq_start, ep.seq_end);
  const userMsgs = msgs.filter(m => m.role === 'user');
  const errorHits = userMsgs.filter(m => PHRASES.some(p => (m.text || '').includes(p)));
  const totalChars = msgs.reduce((a, m) => a + (m.text || '').length, 0);
  // S5 信号 = 有用户明确指出错误（后续 AI 修正即是「正确示范」对）
  // S6 信号 = pattern 命中复盘类标签
  const s6Hit = S6_PATTERNS.filter(p => (ep.pattern || '').includes(p));
  candidates.push({
    episode_id: ep.id, uid: ep.uid, session_id: ep.session_id, source: ep.source,
    kind: ep.kind, status: ep.status, topic: ep.topic, pattern: ep.pattern,
    msgs: msgs.length, user_msgs: userMsgs.length, chars: totalChars,
    est_tokens: Math.round(totalChars * 0.75),
    s5_error_hits: errorHits.length,
    s5_samples: errorHits.slice(0, 2).map(m => (m.text || '').slice(0, 80)),
    s6_patterns: s6Hit,
    // 粗打分：S5 看错误信号密度，S6 看标签数；bug-solved 本身 +1（走完错误→解决全程）
    score: errorHits.length * 2 + s6Hit.length + (ep.kind === 'bug' && ep.status === 'solved' ? 1 : 0),
  });
}

candidates.sort((a, b) => b.score - a.score);
const OUT = new URL('../meta-pool/e16-candidates.json', import.meta.url).pathname;
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), phrases: PHRASES, s6_patterns: S6_PATTERNS, candidates }, null, 1));
console.log(`候选 ${candidates.length} 段（bug-solved 90 + S6 标签并集）→ ${OUT}`);
console.log(`S5 有错误信号: ${candidates.filter(c => c.s5_error_hits > 0).length} 段；S6 有标签: ${candidates.filter(c => c.s6_patterns.length > 0).length} 段`);
console.log('\nTop 10:');
for (const c of candidates.slice(0, 10)) {
  console.log(`  [${c.score}] ep${c.episode_id} ${c.source} ${c.kind}/${c.status} ~${c.est_tokens}tok 错信号${c.s5_error_hits} | ${(c.topic || '').slice(0, 40)} | ${c.pattern}`);
}
db.close();
