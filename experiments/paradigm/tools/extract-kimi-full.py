#!/usr/bin/env python3
"""extract-kimi-full.py — kimi 会话完整提取器（2026-08-04 补缺口）

extract-all 的 kimi_session 只提 user（turn.prompt）——assistant 回复/思考全缺。
本工具从 wire.jsonl 完整提取：user（turn.prompt）+ assistant（content.part text）
+ thinking（content.part think）→ materials.db。

wire 结构（kimi-code sessions/*/session_*/agents/main/wire.jsonl）：
  turn.prompt {input, time}                    → user 消息
  context.append_loop_event {event:{type:content.part, part:{type:text/think}}} → assistant 文本/思考

用法：python3 experiments/paradigm/tools/extract-kimi-full.py [--sid <session_id>]
"""
import json, glob, sqlite3, sys
from pathlib import Path

HOME = Path.home()
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'
ONLY = sys.argv[sys.argv.index('--sid') + 1] if '--sid' in sys.argv else None

db = sqlite3.connect(str(DB))

def find_wires(sid):
    return glob.glob(str(HOME / '.kimi-code' / 'sessions' / '*' / f'session_{sid}' / 'agents' / 'main' / 'wire.jsonl'))

def extract_wire(wire):
    """返回 {user:[(ts,text)], assistant:[(ts,text)], thinking:[(ts,text)]}"""
    out = {'user': [], 'assistant': [], 'thinking': []}
    for line in open(wire, encoding='utf-8', errors='ignore'):
        try:
            d = json.loads(line)
        except:
            continue
        t = d.get('type')
        if t == 'turn.prompt':
            inp = d.get('input')
            text = ''
            if isinstance(inp, str):
                text = inp
            elif isinstance(inp, dict):
                text = inp.get('text') or inp.get('content') or ''
            elif isinstance(inp, list):  # input: [{type:text, text:...}]
                for b in inp:
                    if isinstance(b, dict) and b.get('type') == 'text' and b.get('text'):
                        text = b['text']; break
            if text and text.strip() and not text.strip().startswith('<system-reminder>'):
                out['user'].append((d.get('time') or 0, text.strip()))
        elif t == 'context.append_loop_event':
            ev = d.get('event') or {}
            if ev.get('type') == 'content.part':
                part = ev.get('part') or {}
                pt = part.get('type')
                ts = d.get('time') or 0
                if pt == 'text' and part.get('text'):
                    out['assistant'].append((ts, part['text']))
                elif pt == 'think' and part.get('think'):
                    out['thinking'].append((ts, part['think']))
    return out

# 找 kimi 会话（materials.db 里 source=kimi 的）
if ONLY:
    sids = [ONLY]
else:
    sids = [r[0][5:] for r in db.execute("SELECT id FROM sessions WHERE source='kimi'")]
print(f'kimi 会话: {len(sids)}', flush=True)
for sid in sids:
    key = f'kimi-{sid}'
    wires = find_wires(sid)
    if not wires:
        print(f'  {key}: wire 未找到'); continue
    data = {'user': [], 'assistant': [], 'thinking': []}
    for w in wires:
        r = extract_wire(w)
        for k in data: data[k].extend(r[k])
    # 排序（按时间合并）
    all_msgs = sorted([(ts, 'user', t) for ts, t in data['user']] +
                      [(ts, 'assistant', t) for ts, t in data['assistant']], key=lambda x: x[0])
    if not all_msgs:
        print(f'  {key}: 无消息'); continue
    # 清旧重入
    db.execute('DELETE FROM messages WHERE session_id=?', (key,))
    for i, (ts, role, text) in enumerate(all_msgs):
        db.execute('INSERT INTO messages(session_id,seq,role,ts,text) VALUES(?,?,?,?,?)', (key, i + 1, role, ts, text))
    for i, (ts, text) in enumerate(sorted(data['thinking'], key=lambda x: x[0])):
        db.execute('INSERT INTO reasoning(session_id,seq,ts,text) VALUES(?,?,?,?)', (key, i + 1, ts, text))
    db.execute('UPDATE sessions SET user_msgs=?, all_msgs=? WHERE id=?',
               (len(data['user']), len(all_msgs), key))
    db.commit()
    print(f'  {key}: user {len(data["user"])} / assistant {len(data["assistant"])} / thinking {len(data["thinking"])} / 总计 {len(all_msgs)}')
print('完成')
