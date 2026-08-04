#!/usr/bin/env python3
"""extract-omp-jsonl.py — omp 会话完整提取器（2026-08-04 修正）

omp 完整对话在 ~/.omp/agent/sessions/*.jsonl（事件流：message 事件含
user/assistant/toolResult；content blocks 含 text/toolCall/thinking）。
history.db 只是 prompt 索引——此前误判「omp 无 AI 侧」已修正。

入库（与 opencode 同构）：
  sessions: id=omp-<文件名>, source=omp
  messages: user/assistant 文本（seq 递增）
  reasoning: assistant thinking
  tool_calls: toolCall（input）+ toolResult（output）

用法：python3 experiments/paradigm/tools/extract-omp-jsonl.py [--dir <sessions 子目录>]
"""
import json, sqlite3, sys
from pathlib import Path

HOME = Path.home()
SESSIONS = HOME / '.omp' / 'agent' / 'sessions'
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'
ONLY_DIR = sys.argv[sys.argv.index('--dir') + 1] if '--dir' in sys.argv else None

db = sqlite3.connect(str(DB))

def extract_jsonl(path):
    """解析单个 omp 会话 jsonl → 结构化消息序列。返回 (msgs, thinkings, tools)"""
    msgs = []   # {role, text, ts}
    thinkings = []  # {seq, text, ts}
    tools = []   # {seq, name, input, output, ts}
    seq = 0
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        try:
            ev = json.loads(line)
        except:
            continue
        if ev.get('type') != 'message':
            continue
        m = ev.get('message', {})
        role = m.get('role')
        ts = ev.get('timestamp') or ''
        if role == 'user':
            seq += 1
            for b in (m.get('content') or []):
                if b.get('type') == 'text' and b.get('text'):
                    msgs.append({'role': 'user', 'text': b['text'], 'ts': ts, 'seq': seq})
        elif role == 'assistant':
            for b in (m.get('content') or []):
                t = b.get('type')
                if t == 'text' and b.get('text'):
                    seq += 1
                    msgs.append({'role': 'assistant', 'text': b['text'], 'ts': ts, 'seq': seq})
                elif t == 'thinking' and b.get('thinking'):
                    seq += 1
                    thinkings.append({'seq': seq, 'text': b['thinking'], 'ts': ts})
                elif t == 'toolCall':
                    seq += 1
                    tools.append({'seq': seq, 'name': b.get('name', ''),
                                  'input': json.dumps(b.get('arguments', {}), ensure_ascii=False)[:2000],
                                  'output': '', 'ts': ts, 'id': b.get('id', '')})
        elif role == 'toolResult':
            # 匹配最近同名 toolCall（按 id）
            tid = m.get('toolCallId') or ''
            for t in reversed(tools):
                if t.get('id') == tid or (t['name'] and t['output'] == ''):
                    t['output'] = ''.join(b.get('text', '') for b in (m.get('content') or []) if b.get('type') == 'text')[:3000]
                    break
    return msgs, thinkings, tools

def import_file(path):
    key = f"omp-{path.stem[:40]}"
    if db.execute('SELECT COUNT(*) FROM sessions WHERE id=?', (key,)).fetchone()[0]:
        return f'{key}: 已入库，跳过'
    msgs, thinkings, tools = extract_jsonl(path)
    if not msgs:
        return f'{key}: 无消息，跳过'
    title = msgs[0]['text'][:40] if msgs else path.stem
    ts0 = msgs[0]['ts'] if msgs else ''
    db.execute('INSERT INTO sessions(id,source,title,dir,started_at,ended_at,user_msgs,all_msgs) VALUES(?,?,?,?,?,?,?,?)',
               (key, 'omp', title, str(path.parent), ts0, ts0,
                sum(1 for m in msgs if m['role'] == 'user'), len(msgs)))
    for m in msgs:
        db.execute('INSERT INTO messages(session_id,seq,role,ts,text) VALUES(?,?,?,?,?)',
                   (key, m['seq'], m['role'], m['ts'], m['text']))
    for t in thinkings:
        db.execute('INSERT INTO reasoning(session_id,seq,ts,text) VALUES(?,?,?,?)',
                   (key, t['seq'], t['ts'], t['text']))
    for t in tools:
        db.execute('INSERT INTO tool_calls(session_id,seq,ts,tool,status,input,output) VALUES(?,?,?,?,?,?,?)',
                   (key, t['seq'], t['ts'], t['name'], 'completed', t['input'], t['output']))
    db.commit()
    return f'{key}: user {sum(1 for m in msgs if m["role"]=="user")} / msgs {len(msgs)} / thinking {len(thinkings)} / tools {len(tools)}'

# 扫会话文件
target = SESSIONS / ONLY_DIR if ONLY_DIR else SESSIONS
files = sorted(target.rglob('*.jsonl'))
print(f'sessions 文件: {len(files)}', flush=True)
done = 0
for f in files:
    try:
        r = import_file(f)
        print(f'  {r}', flush=True)
        done += 1
    except Exception as e:
        print(f'  ✗ {f.name}: {e}', flush=True)
print(f'完成 {done}/{len(files)}')
