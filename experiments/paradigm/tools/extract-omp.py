#!/usr/bin/env python3
"""extract-omp.py — omp 会话提取器（2026-08-04 接手 omp 线）

omp 会话 = 纯 prompt 流（history.db：id/prompt/created_at/cwd/session_id，
无 AI 回复/工具——用户喂给 omp 的指令序列，引导模板原料）。
本工具：按 session_id 分组导出 + 生成审核清单（一行一会话，逐个过）。

用法：
  python3 experiments/paradigm/tools/extract-omp.py --export   # 导出各会话 prompt 全文到 packs/omp/
  python3 experiments/paradigm/tools/extract-omp.py --list     # 打印会话清单（主题线索 + 条数）
"""
import sqlite3, sys
from datetime import datetime
from pathlib import Path

HOME = Path.home()
OMP_DB = HOME / '.omp' / 'agent' / 'history.db'
PACKS = HOME / '.kfmv4' / 'materials' / 'packs' / 'omp'

EXPORT = '--export' in sys.argv
LIST = '--list' in sys.argv

db = sqlite3.connect(str(OMP_DB))
db.row_factory = sqlite3.Row

sess = db.execute('SELECT session_id, COUNT(*) c, MIN(created_at) t0, MAX(created_at) t1 FROM history GROUP BY session_id ORDER BY c DESC').fetchall()
print(f'omp 会话数: {len(sess)}（共 {sum(s["c"] for s in sess)} 条 prompt）', flush=True)

if EXPORT:
    PACKS.mkdir(parents=True, exist_ok=True)
    for s in sess:
        sid = s['session_id'] or 'NULL'
        rows = db.execute('SELECT id,prompt,cwd,created_at FROM history WHERE session_id IS ? ORDER BY id',
                          (s['session_id'],)).fetchall()
        lines = [f'# omp 会话 {sid} | {s["c"]} 条 | {datetime.fromtimestamp(s["t0"]/1000).strftime("%m-%d %H:%M") if s["t0"] else "?"} 起\n']
        for r in rows:
            t = datetime.fromtimestamp(r['created_at']/1000).strftime('%m-%d %H:%M') if r['created_at'] else '?'
            lines.append(f'[{t}|{str(r["cwd"] or "")[:30]}] {r["prompt"]}\n')
        fn = PACKS / f'{sid[:20] or "NULL"}.txt'
        fn.write_text('\n'.join(lines))
    print(f'已导出 {len(sess)} 会话 → {PACKS}', flush=True)

if LIST or EXPORT:
    for s in sess:
        sid = s['session_id'] or 'NULL'
        first = db.execute('SELECT prompt FROM history WHERE session_id IS ? ORDER BY id LIMIT 1', (s['session_id'],)).fetchone()
        t0 = datetime.fromtimestamp(s['t0']/1000).strftime('%m-%d') if s['t0'] else '?'
        hint = str(first['prompt'])[:60] if first else ''
        print(f'  {sid[:24]:26} {s["c"]:4} 条 ({t0}) | {hint}', flush=True)
