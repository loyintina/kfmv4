#!/usr/bin/env python3
"""
meta-density.py — 元认知密度判卷尺（paradigm 实验自动判卷，2026-08-05 定稿）

判卷尺 metaRe（「我 + 思考动词」频率/臂），经 e7 已发表数值标定（总偏差 5.0/12 格）：
  动词表 = 思考|考虑|权衡|假设|推测|反思|怀疑|复盘|审视|意识|判断|想|验证|排除
  前缀   = 我/我们 + 间隔 ≤2 字（同句内，跨句号不计）
  计数   = 末条 AI 消息的 text block（think/tool 不计）
  e7 复现：mm3 2.0/6.8/5.0/7.0/8.1/6.8（发表 2.1/6.3/4.8/6.4/6.9/6.0）——
  同尺可比，勿再改动词表；要改就整条实验线重测。

臂名解码（2026-08-05 臂名哈希化后）：
  无哈希（e7/e11 批1 旧命名）→ 按下标 p 查该批次 paradigms 清单；
  有哈希（e11 批2/3、e12 起）→ 对 paradigm 全集 × 文件 modelId 重算
  md5(task|paradigm|model)[:6] 反查——m 下标跨批次语义不同（批3a 无 opus），
  模型一律取文件内 modelId，不信下标。

用法：
  python3 meta-density.py --prefix e11- --experiment e11
  python3 meta-density.py --prefix e7-  --experiment e7
  python3 meta-density.py --prefix e12- --experiment e12
"""
import argparse, glob, hashlib, json, os, re
from collections import defaultdict

SCRIPT = os.path.expanduser('~/.kfmv4/sessions/script')
PARADIGMS = os.path.expanduser('~/.kfmv4/paradigms')

META_RE = re.compile(
    r'我(?:们)?[^。!！?？\n]{0,2}(?:思考|考虑|权衡|假设|推测|反思|怀疑|复盘|审视|意识|判断|想|验证|排除)')

# 实验配置：组 → (批次 paradigms 清单（下标序）, 槽位标签, 任务文本)
# 槽位标签与组内 paradigm 一一对应；A/B/C/D 为 e11 实验条件。
def load_task(path):
    with open(path, encoding='utf-8') as f:
        return f.read().strip()

EXP = {
    'e7': {
        'groups': [('e7', ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k',
                            'metacognition-64k', 'metacognition-96k'],
                    ['无包', 'v1-8k', '32k', '48k', '64k', '96k'])],
        'task_file': '/tmp/exp5-task.txt',
    },
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
        'task_file': '/tmp/exp8-task.txt',
    },
    'e12': {
        'groups': [('W', ['e12-w1-seamless', 'e12-w2-lightmark', 'e12-w3-declaration',
                          'e12-w4-boundary'],
                    ['W1 无缝', 'W2 轻标记', 'W3 显式宣言', 'W4 边界声明'])],
        'task_file': '/tmp/exp8-task.txt',
    },
}


def ai_text(path):
    with open(path, encoding='utf-8') as f:
        d = json.load(f)
    msgs = [m for m in d.get('messages', []) if m.get('role') in ('ai', 'assistant')]
    if not msgs:
        return '', d.get('modelId', '?')
    c = msgs[-1].get('content')
    if isinstance(c, list):
        return ('\n'.join(b.get('text', '') for b in c
                          if isinstance(b, dict) and b.get('type') == 'text'),
                d.get('modelId', '?'))
    return str(c or ''), d.get('modelId', '?')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prefix', required=True)
    ap.add_argument('--experiment', required=True, choices=list(EXP))
    args = ap.parse_args()
    cfg = EXP[args.experiment]
    task = load_task(cfg['task_file'])

    # 哈希反查表：md5(task|paradigm|model)[:6] → (组, 槽位)——model 维逐文件填
    # 先建 paradigm → (组, 槽位) 映射，运行时按文件 modelId 现算哈希
    para_map = {}
    for gname, plist, labels in cfg['groups']:
        for i, p in enumerate(plist):
            para_map[p] = labels[i]

    cells = defaultdict(list)   # (modelId, 槽位) → [(匹配数, 字符数)]
    skipped = []
    for path in sorted(glob.glob(f'{SCRIPT}/{args.prefix}t0p*m*.json')):
        base = os.path.basename(path)
        m = re.match(rf'{re.escape(args.prefix)}t0p(\d+)m(\d+)r\d+(?:-([0-9a-f]{{6}}))?\.json', base)
        if not m:
            skipped.append(base)
            continue
        pidx, _mi, fhash = int(m.group(1)), m.group(2), m.group(3)
        txt, model = ai_text(path)
        if fhash:
            label = None
            for pname, lab in para_map.items():
                h = hashlib.md5(f'{task}|{pname}|{model}'.encode()).hexdigest()[:6]
                if h == fhash:
                    label = lab
                    break
            if label is None:
                skipped.append(base + '（哈希无对应 paradigm/model）')
                continue
        else:
            # 旧命名：下标查第一组清单（e7/e11 批1 均单任务多档，p 即槽位）
            label = para_map.get(cfg['groups'][0][1][pidx]) if pidx < len(cfg['groups'][0][1]) else None
            if label is None:
                skipped.append(base)
                continue
        cells[(model, label)].append((len(META_RE.findall(txt)), len(txt)))

    models = sorted({md for md, _ in cells})
    # 槽位按组定义顺序排
    order = [lab for _, plist, labels in cfg['groups'] for lab in labels]
    labels_seen = [lab for lab in order if any(l == lab for _, l in cells)]

    print(f'== {args.experiment} 元认知密度（均值匹配数/臂）==')
    header = '槽位 | ' + ' | '.join(m[:16] for m in models)
    print(header)
    for lab in labels_seen:
        row = [lab]
        for md in models:
            v = cells.get((md, lab), [])
            row.append(f'{sum(x[0] for x in v) / len(v):.1f}（n={len(v)}）' if v else '—')
        print(' | '.join(row))

    print(f'\n== {args.experiment} 归一化密度（匹配数/千字符）==')
    print(header)
    for lab in labels_seen:
        row = [lab]
        for md in models:
            v = cells.get((md, lab), [])
            if v:
                hits = sum(x[0] for x in v)
                chars = sum(x[1] for x in v)
                row.append(f'{hits / chars * 1000:.2f}（n={len(v)}）' if chars else '—')
            else:
                row.append('—')
        print(' | '.join(row))

    if skipped:
        print(f'\n[warn] 跳过 {len(skipped)} 个文件：', skipped[:8], '…' if len(skipped) > 8 else '')


if __name__ == '__main__':
    main()
