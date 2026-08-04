#!/usr/bin/env python3
"""gen-slices-summary.py — 切片摘要汇总生成器（2026-08-04）

从 materials.db 的 episodes 生成 md：按源（operit/omp/opencode/kimi/qoder）
分组，每段一行（uid | kind/status | pattern | 会话 | 主题 | seq 范围）。
用途：素材库的可视化导航层——一眼看全所有切片。

用法：python3 experiments/paradigm/tools/gen-slices-summary.py [--out <路径>]
"""
import sqlite3, sys
from pathlib import Path

HOME = Path.home()
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'
OUT = Path(sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else str(HOME / '.kfmv4' / 'materials' / 'slices-summary.md'))

db = sqlite3.connect(str(DB))
db.row_factory = sqlite3.Row

SOURCE_ORDER = ['operit', 'omp', 'opencode', 'kimi', 'qoder']
SOURCE_NAME = {'operit': 'operit（kfm 早期，02-25 起）', 'omp': 'omp（05-27 起）',
               'opencode': 'opencode（06-11 起）', 'kimi': 'kimi（07-27 起，当前）', 'qoder': 'qoder'}

lines = ['# 素材库切片摘要（560 段 · 按源分类）',
         '',
         '> 自动生成：gen-slices-summary.py。每段 = episodes 索引（范围引用 messages 全量）。',
         '> 分类：kind（bug/feature/other）+ status（solved/unresolved/discussion/shelved）+ pattern（范式标注）。',
         '']

total = 0
for src in SOURCE_ORDER:
    rows = db.execute('''SELECT e.uid,e.kind,e.status,e.pattern,e.seq_start,e.seq_end,substr(e.topic,1,55) topic,
      substr(s.title,1,28) sess FROM episodes e JOIN sessions s ON e.session_id=s.id
      WHERE s.source=? ORDER BY e.id''', (src,)).fetchall()
    if not rows: continue
    n = len(rows)
    total += n
    lines.append(f'## {src}（{n} 段）— {SOURCE_NAME.get(src, src)}')
    lines.append('')
    lines.append('| 段 | 类型 | 状态 | 范式 | 会话 | 主题 | 范围 |')
    lines.append('|----|------|------|------|------|------|------|')
    for r in rows:
        pat = r['pattern'] or '—'
        lines.append(f"| {r['uid']} | {r['kind']} | {r['status']} | {pat} | {r['sess']} | {r['topic']} | {r['seq_start']}-{r['seq_end']} |")
    lines.append('')

lines.insert(2, f'> 全库切片：{total} 段。')
OUT.write_text('\n'.join(lines))
print(f'已生成 {OUT}（{total} 段）')
