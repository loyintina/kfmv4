#!/usr/bin/env python3
"""盲判匿名化：提取实验臂的 AI 最终输出 → 匿名文件（随机编号），
条件映射单独保存（判卷子代理拿不到 → 真盲判）。"""
import json, os, re, random, hashlib

DIR = '/root/.kfmv4/sessions/script'
OUT_DIR = '/tmp/blind-judge'
MAP_FILE = '/root/kfmv4/experiments/paradigm/meta-pool/blind-map.json'
PREFIXES = ['e7-t0', 'e7b-t0', 'e7c-t0', 'e8-t0', 'e8b-t0']
TASK = open('/tmp/exp5-task.txt').read().strip()
TASK8 = open('/tmp/exp8-task.txt').read().strip()

os.makedirs(OUT_DIR, exist_ok=True)
arms = []
for f in sorted(os.listdir(DIR)):
    if not f.endswith('.json'):
        continue
    if not any(f.startswith(p) for p in PREFIXES):
        continue
    m = re.match(r'([a-z0-9]+-t0)p(\d)m(\d)r(\d)', f)
    if not m:
        continue
    d = json.load(open(os.path.join(DIR, f)))
    msgs = d.get('messages', [])
    out = ''
    for i in range(len(msgs) - 1, -1, -1):
        if msgs[i].get('role') != 'ai':
            continue
        texts = [b.get('text', '') for b in msgs[i].get('content', []) if b and b.get('type') == 'text' and b.get('text')]
        if texts:
            out = '\n'.join(texts)
            break
    if not out.strip():
        continue
    arms.append({'id': f[:-5], 'batch': m.group(1), 'pi': int(m.group(2)), 'mi': int(m.group(3)),
                 'model': d.get('modelId', 'unknown'), 'out': out})

random.seed(42)  # 固定种子，可复现
random.shuffle(arms)
mapping = {}
for i, a in enumerate(arms):
    anon = f'anon-{i:04d}'
    task = TASK8 if a['batch'].startswith('e8') else TASK
    with open(os.path.join(OUT_DIR, f'{anon}.md'), 'w') as f:
        f.write(f"【任务】\n{task}\n\n【AI 回复】\n{a['out'][:20000]}")
    mapping[anon] = {k: a[k] for k in ('id', 'batch', 'pi', 'mi', 'model')}
    mapping[anon]['outLen'] = len(a['out'])

json.dump(mapping, open(MAP_FILE, 'w'), ensure_ascii=False, indent=1)
print(f'匿名化 {len(arms)} 臂 → {OUT_DIR}/anon-*.md，映射 {MAP_FILE}')
# 批次清单（12 臂/批）
B = 12
anon_ids = sorted(mapping.keys())
for bi in range(0, len(anon_ids), B):
    chunk = anon_ids[bi:bi+B]
    with open(os.path.join(OUT_DIR, f'batch_{bi//B+1:02d}.txt'), 'w') as f:
        for aid in chunk:
            f.write(f'{OUT_DIR}/{aid}.md\n')
print(f'批数: {(len(anon_ids)+B-1)//B}')
