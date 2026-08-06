#!/usr/bin/env python3
"""recompute-cells.py — 用判卷归档重算 e11/e12 格均值（v2 主尺，总分 0-20）。

臂来源（2026-08-06 arm-store 一期）：arms.db 优先——语义列（paradigm/model）写入时
已落定，不再需要「批1 无哈希按下标、批2/3 哈希反查」的文件名考古；DB 不存在时
回落 sessions/script 文件（旧逻辑，仅迁移过渡期兼容）。
用法：recompute-cells.py [判卷归档路径]（默认 meta-pool/judge-e11-e12-v2-flash.json）"""
import glob, hashlib, json, os, re, sqlite3, sys
from collections import defaultdict

DB = os.path.expanduser('~/.kfmv4/experiments/arms.db')
SCRIPT = os.path.expanduser(os.environ.get('ARM_SCRIPT_DIR', '~/.kfmv4/sessions/script'))
JUDGE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(__file__), '..', 'meta-pool', 'judge-e11-e12-v2-flash.json')

EXP = {
    'e11': {
        'groups': [
            ('A+B', ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k',
                     'metacognition-64k', 'metacognition-96k'],
             ['A 无包', 'B-8.1k', 'B-30.1k', 'B-47.4k', 'B-64.5k', 'B-89.8k']),
            ('C', ['metacognition-h4k-x2', 'metacognition-h15k-x2', 'metacognition-h24k-x2',
                   'metacognition-h32k-x2', 'metacognition-h45k-x2'],
             ['C-8.0k', 'C-31.0k', 'C-48.7k', 'C-65.1k', 'C-91.5k']),
            ('D', ['metacognition-8k-dup', 'metacognition-32k-dup', 'metacognition-48k-dup',
                   'metacognition-64k-dup', 'metacognition-96k-dup'],
             ['D-16.3k', 'D-60.2k', 'D-94.9k', 'D-129.0k', 'D-179.5k']),
        ],
    },
    'e12': {
        'groups': [('W', ['e12-w1-seamless', 'e12-w2-lightmark', 'e12-w3-declaration',
                          'e12-w4-boundary'],
                    ['W1 无缝', 'W2 轻标记', 'W3 显式宣言', 'W4 边界声明'])],
    },
}
# 任务文本：仓库副本为准（/tmp 会蒸发），/tmp 兜底兼容旧流程
_TASK_REPO = os.path.join(os.path.dirname(__file__), '..', 'scenarios', 'e8-task.txt')
TASK = open(_TASK_REPO if os.path.exists(_TASK_REPO) else '/tmp/exp8-task.txt', encoding='utf-8').read().strip()

def ai_text_from(d):
    """末条 AI 文本（推理模型回落 reasoning 通道）+ modelId。"""
    msgs = [m for m in d.get('messages', []) if m.get('role') in ('ai', 'assistant')]
    if not msgs:
        return '', d.get('modelId', '?')
    c = msgs[-1].get('content')
    if isinstance(c, list):
        txt = '\n'.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text')
        if not txt:
            txt = '\n'.join(b.get('reasoning', '') or '' for b in c if isinstance(b, dict))
        return txt, d.get('modelId', '?')
    return str(c or ''), d.get('modelId', '?')

def iter_arms_db(exp):
    """DB 路径：语义列直给（paradigm/model），残臂防线照旧。"""
    con = sqlite3.connect(DB)
    for arm_id, paradigm, model, content in con.execute(
            'SELECT arm_id, paradigm, model, content FROM arms WHERE experiment = ? ORDER BY arm_id', (exp,)):
        d = json.loads(content)
        txt, _ = ai_text_from(d)
        yield arm_id, paradigm, model, txt
    con.close()

def iter_arms_file(exp):
    """文件回落（旧逻辑）：哈希反查 / 批1 下标。"""
    cfg = EXP[exp]
    for path in sorted(glob.glob(f'{SCRIPT}/{exp}-t0p*m*.json')):
        base = os.path.basename(path)[:-5]
        m = re.match(rf'{exp}-t0p(\d+)m(\d+)r\d+(?:-([0-9a-f]{{6}}))?$', base)
        if not m:
            continue
        pidx, fhash = int(m.group(1)), m.group(3)
        d = json.load(open(path, encoding='utf-8'))
        txt, model = ai_text_from(d)
        if fhash:
            paradigm = None
            plist_all = [p for _, plist, _ in cfg['groups'] for p in plist]
            for pname in plist_all:
                if hashlib.md5(f'{TASK}|{pname}|{model}'.encode()).hexdigest()[:6] == fhash:
                    paradigm = pname; break
        else:
            paradigm = cfg['groups'][0][1][pidx] if pidx < len(cfg['groups'][0][1]) else None
        yield base, paradigm, model, txt

ITER = iter_arms_db if os.path.exists(DB) else iter_arms_file

def run(exp):
    cfg = EXP[exp]
    para_map = {}
    for gname, plist, labels in cfg['groups']:
        for i, p in enumerate(plist):
            para_map[p] = labels[i]
    judge = json.load(open(JUDGE, encoding='utf-8'))
    cells = defaultdict(list)
    skipped, nojudge = [], []
    for base, paradigm, model, txt in ITER(exp):
        # 残臂防线：末条 AI 为空/错误桩的不进格
        if len(txt) < 50 or txt.startswith('[错误') or '[错误: terminated]' in txt:
            skipped.append(base + '（残臂）'); continue
        label = para_map.get(paradigm)
        if label is None:
            skipped.append(base + (f'（未知范式 {paradigm}）' if paradigm == '?' else '（范式无槽位）')); continue
        j = judge.get(base)
        if not j or not j.get('score'):
            nojudge.append(base); continue
        s = j['score']
        total = s['meta_depth'] + s['self_dissection'] + s['boundary_awareness'] + s['reasoning_visible']
        cells[(model, label)].append(total)

    models = sorted({md for md, _ in cells})
    order = [lab for _, plist, labels in cfg['groups'] for lab in labels]
    src = 'arms.db' if ITER is iter_arms_db else '文件'
    print(f'== {exp} 格均值（v2 总分 0-20，{os.path.basename(JUDGE)}，臂源 {src}）==')
    print('槽位 | ' + ' | '.join(m[:20] for m in models))
    for lab in [l for l in order if any(l == ll for _, ll in cells)]:
        row = [lab]
        for md in models:
            v = cells.get((md, lab), [])
            row.append(f'{sum(v)/len(v):.2f}（n={len(v)}）' if v else '—')
        print(' | '.join(row))
    if nojudge: print(f'\n[warn] 无判分 {len(nojudge)} 臂：', nojudge[:6])
    if skipped: print(f'[warn] 跳过 {len(skipped)}：', skipped[:6])

run('e11')
print()
run('e12')
