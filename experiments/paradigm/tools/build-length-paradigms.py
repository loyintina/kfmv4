#!/usr/bin/env python3
"""拼嵌套长度梯度范式包 v3：按「用户消息」块切分（细粒度），
质量序逐块追加，严格嵌套 32k⊂64k⊂96k⊂128k。"""
import os, json, re

BASE = '/root/kfmv4/experiments/paradigm/meta-pool/episodes'
V1 = open('/root/.kfmv4/paradigms/metacognition.md').read().strip()
# 2026-08-08 .kfmv4 重构：梯度档是实验输入，产出落实验区（paradigm-packs/），不进池
OUT = '/root/.kfmv4/experiments/paradigm/paradigm-packs'
INDEX = json.load(open('/root/kfmv4/experiments/paradigm/meta-pool/index.json'))

T0 = [675, 672, 899, 831, 1060, 1090, 966, 1051, 889]
T1 = [780, 743, 763, 774, 821, 900, 910, 914, 921, 924, 932, 933, 939, 951,
      953, 967, 969, 970, 973, 990, 1073, 1083, 1086, 1096, 1099, 556, 726]
T2 = [593, 594, 676, 725, 732, 733, 753, 765, 828, 832, 843, 844, 845, 851,
      857, 876, 898, 909, 923, 934, 935, 936, 937, 996, 998]
ORDER = T0 + T1 + T2
SKIP = {999, 1001}
files = {i['id']: i['file'] for i in INDEX}

def split_blocks(body):
    """按 **用户：** 开头切块；块内保留从用户消息到下一用户消息前的内容"""
    parts = re.split(r'(?m)(?=^\*\*用户：\*\*)', body)
    return [p.strip() for p in parts if p.strip()]

# 质量序收集块
pool = [('v1', V1)]
for eid in ORDER:
    if eid in SKIP or eid not in files: continue
    body = open(os.path.join(BASE, files[eid])).read().strip()
    for b in split_blocks(body):
        pool.append((str(eid), b))
total = sum(len(b) for _, b in pool)
print(f'块级池: {len(pool)} 块, 总字符 {total:,} ≈ {int(total*0.75/1000)}k token')

targets = {
    'metacognition-32k': int(32_000 / 0.75),
    'metacognition-64k': int(64_000 / 0.75),
    'metacognition-96k': int(96_000 / 0.75),
    'metacognition-128k': int(128_000 / 0.75),
}
segs, acc_len, written = [], 0, set()
for name, src in pool:
    segs.append((name, src)); acc_len += len(src)
    for pname, tgt in targets.items():
        if pname not in written and acc_len >= tgt:
            body = '\n\n---\n\n'.join(s[1] for s in segs)
            with open(os.path.join(OUT, pname + '.md'), 'w') as f:
                f.write(body)
            written.add(pname)
            used = {}
            for n, _ in segs: used[n] = used.get(n, 0) + 1
            print(f'{pname}: {len(body):,} 字符 ≈ {int(len(body)*0.75/1000)}k token | 块 {len(segs)} | 段 {sorted(used)}')
db.close() if 'db' in dir() else None
