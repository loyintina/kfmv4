#!/usr/bin/env python3
"""extract-operit.py — chat-backups 提取器（operit 时代会话 → materials.db）

.kfmv4/chat-backups/*.json（operit_chat_archive）——用户接 api 入门到 v4 早期
的完整会话（02-25 → 08-05，27 文件 106MB）。第一性原理：最大扩充素材库，
按范式价值筛选（用户方法论/决策模式片段）。

格式：{chats:[{id,title,messages:[{baseMessage:{sender,content,timestamp},...}]}]}
入库：sessions(id=operit-<文件序号>, source=operit) + messages(user/assistant text)

用法：python3 experiments/paradigm/tools/extract-operit.py [--all] [--file <名>]
"""
import json, re, sqlite3, sys
from pathlib import Path

HOME = Path.home()
BACKUPS = HOME / '.kfmv4' / 'chat-backups'
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'
ARGV = sys.argv[1:]
ONLY = ARGV[ARGV.index('--file') + 1] if '--file' in ARGV else None

db = sqlite3.connect(str(DB))

def strip_attachments(text):
    """去掉 <attachment ...>...</attachment> 噪音"""
    if not text: return ''
    t = re.sub(r'<attachment.*?</attachment>', ' ', text, flags=re.S)
    return t.strip()

def import_file(fpath, seq_no):
    key = f'operit-{seq_no:02d}'
    if db.execute('SELECT COUNT(*) FROM sessions WHERE id=?', (key,)).fetchone()[0]:
        return f'{key}: 已入库，跳过'
    try:
        d = json.loads(fpath.read_text(encoding='utf-8'))
    except Exception as e:
        return f'{key}: 读取失败 {e}'
    chats = d.get('chats', [])
    if not chats:
        return f'{key}: 无 chats'
    c = chats[0]
    msgs = c.get('messages', [])
    title = (c.get('title') or fpath.stem)[:60]
    # 提取消息（user/assistant 文本）
    rows = []
    for m in msgs:
        b = m.get('baseMessage', {})
        sender = b.get('sender')
        # operit sender 归一化：user/ai/summary（ai=assistant，summary=压缩摘要跳过）
        role = {'user': 'user', 'ai': 'assistant'}.get(sender)
        if not role or sender == 'summary':
            continue
        content = strip_attachments(b.get('content'))
        if not content:
            continue
        ts = b.get('timestamp') or 0
        rows.append((ts, role, content))
    if not rows:
        return f'{key}: 无有效消息'
    rows.sort(key=lambda r: r[0])
    db.execute('INSERT INTO sessions(id,source,title,dir,started_at,ended_at,user_msgs,all_msgs) VALUES(?,?,?,?,?,?,?,?)',
               (key, 'operit', title, str(fpath), rows[0][0], rows[-1][0],
                sum(1 for r in rows if r[1] == 'user'), len(rows)))
    for i, (ts, sender, content) in enumerate(rows):
        db.execute('INSERT INTO messages(session_id,seq,role,ts,text) VALUES(?,?,?,?,?)',
                   (key, i + 1, sender, ts, content))
    db.commit()
    return f'{key}: {title[:30]} | user {sum(1 for r in rows if r[1]=="user")} / msgs {len(rows)}'

files = sorted(BACKUPS.glob('chat_*.json')) if not ONLY else [BACKUPS / ONLY]
print(f'chat-backups 文件: {len(files)}', flush=True)
for i, f in enumerate(files):
    print(f'  {import_file(f, i + 1)}', flush=True)
print('完成 | sessions 总数:', db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0])
