#!/usr/bin/env python3
"""extract-omp-db.py — omp 会话入库 materials.db（2026-08-04 接手 omp 线）

omp = 纯 prompt 流（无 AI 回复/工具/思考）。入库：
  sessions: id=omp-<session 短id>|omp-NULL, source=omp, title, user_msgs=all_msgs=条数
  messages: role=user（omp 只有用户指令）, seq 连续, text=prompt, ts=created_at
omp 无 reasoning/tool_calls/patches（AI 侧不存在）。

用法：python3 experiments/paradigm/tools/extract-omp-db.py [--session <短id>|NULL] [--all]
"""
import sqlite3, sys
from pathlib import Path

HOME = Path.home()
OMP_DB = HOME / '.omp' / 'agent' / 'history.db'
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'

ARGV = sys.argv[1:]
ONLY = ARGV[ARGV.index('--session') + 1] if '--session' in ARGV else None
ALL = '--all' in ARGV

oc = sqlite3.connect(str(OMP_DB))
oc.row_factory = sqlite3.Row
db = sqlite3.connect(str(DB))

def import_session(sid, slug):
    if sid is None:
        rows = oc.execute('SELECT id,prompt,created_at,cwd FROM history WHERE session_id IS NULL ORDER BY id').fetchall()
        key = 'omp-NULL'
    else:
        rows = oc.execute('SELECT id,prompt,created_at,cwd FROM history WHERE session_id=? ORDER BY id', (sid,)).fetchall()
        key = f'omp-{slug}'
    if not rows:
        print(f'  {key}: 无消息，跳过')
        return 0
    # 已存在则跳过（幂等）
    if db.execute('SELECT COUNT(*) FROM sessions WHERE id=?', (key,)).fetchone()[0]:
        print(f'  {key}: 已入库，跳过')
        return 0
    title = str(rows[0]['prompt'])[:40] or slug or 'omp 会话'
    db.execute('INSERT INTO sessions(id,source,title,dir,started_at,ended_at,user_msgs,all_msgs) VALUES(?,?,?,?,?,?,?,?)',
               (key, 'omp', title, str(rows[0]['cwd'] or ''), rows[0]['created_at'], rows[-1]['created_at'], len(rows), len(rows)))
    for i, r in enumerate(rows):
        db.execute('INSERT INTO messages(session_id,seq,role,ts,text) VALUES(?,?,?,?,?)',
                   (key, i + 1, 'user', r['created_at'], r['prompt']))
    db.commit()
    print(f'  {key}: 入库 {len(rows)} 条 prompt')
    return len(rows)

if ALL:
    sess = oc.execute('SELECT session_id, COUNT(*) c FROM history GROUP BY session_id ORDER BY c DESC').fetchall()
    for s in sess:
        slug = str(s['session_id'] or 'NULL')[:20]
        import_session(s['session_id'], slug)
else:
    # 默认只入大会话（≥10 条，排除命令残留小会话）
    sess = oc.execute('SELECT session_id, COUNT(*) c FROM history GROUP BY session_id HAVING c>=10 ORDER BY c DESC').fetchall()
    for s in sess:
        if ONLY and ONLY not in str(s['session_id'] or 'NULL'):
            continue
        slug = str(s['session_id'] or 'NULL')[:20]
        import_session(s['session_id'], slug)
print('完成')
