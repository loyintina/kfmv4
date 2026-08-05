#!/usr/bin/env python3
"""audit-arms.py — e11/e12 臂位全量审计：列出缺失/重复/残臂/无法归组。
2026-08-05 扩展：硅基流动 10 模型按上下文窗口分档期望（与 /tmp/silicon-backfill.sh 分级一致），
每模型只审计它物理上能跑的槽位，不可跑槽位不报「空」。"""
import glob, hashlib, json, os, re
from collections import defaultdict

SCRIPT = os.path.expanduser('~/.kfmv4/sessions/script')
TASK = open('/tmp/exp8-task.txt', encoding='utf-8').read().strip()

AB_L = ['A 无包', 'B-8.1k', 'B-30.1k', 'B-47.4k', 'B-64.5k', 'B-89.8k']
C_L = ['C-8.0k', 'C-31.0k', 'C-48.7k', 'C-65.1k', 'C-91.5k']
D_L = ['D-16.3k', 'D-60.2k', 'D-94.9k', 'D-129.0k', 'D-179.5k']
W_L = ['W1 无缝', 'W2 轻标记', 'W3 显式宣言', 'W4 边界声明']
E11_ALL = AB_L + C_L + D_L

# 模型 → 期望槽位（按窗口分档；GLM-4-32B 已除名，列入只为给它的失败残臂归组）
MODEL_SLOTS = {
    # 聚光 4（全槽）
    '[codex]gpt-5.6-luna': E11_ALL + W_L,
    '[酒馆专用0.9刀/次]gemini-2.5-pro': E11_ALL + W_L,
    '[kiro]claude-opus-4-8': E11_ALL + W_L,
    '[1刀/次]gemini-3-pro-preview-think': E11_ALL + W_L,
    # 硅基 B 级 131K：D 档只跑 ≤48k-dup
    'THUDM/GLM-Z1-9B-0414': AB_L + C_L + D_L[:3] + W_L,
    'zai-org/GLM-4.5-Air': AB_L + C_L + D_L[:3] + W_L,
    'inclusionAI/Ling-mini-2.0': AB_L + C_L + D_L[:3] + W_L,
    # 硅基 C 级 164K：D 档跳 96k-dup
    'Pro/deepseek-ai/DeepSeek-R1': AB_L + C_L + D_L[:4] + W_L,
    'Pro/deepseek-ai/DeepSeek-V3': AB_L + C_L + D_L[:4] + W_L,
    # 硅基 D 级 262K / E 级 197K：全槽
    'Qwen/Qwen3.6-35B-A3B': E11_ALL + W_L,
    'Qwen/Qwen3.5-9B': E11_ALL + W_L,
    'Qwen/Qwen3.5-27B': E11_ALL + W_L,
    'stepfun-ai/Step-3.5-Flash': E11_ALL + W_L,
    'Pro/MiniMaxAI/MiniMax-M2.5': E11_ALL + W_L,
    # 已除名（2026-08-05 v4）：只跑了 A+B 前 3 + C 前 2 + D 前 1，全灭残臂
    'THUDM/GLM-4-32B-0414': AB_L[:3] + C_L[:2] + D_L[:1],
}

E11_GROUPS = [
    ('A+B', ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k',
             'metacognition-64k', 'metacognition-96k'],
     ['A 无包', 'B-8.1k', 'B-30.1k', 'B-47.4k', 'B-64.5k', 'B-89.8k'], 8),
    ('C', ['metacognition-h4k-x2', 'metacognition-h15k-x2', 'metacognition-h24k-x2',
           'metacognition-h32k-x2', 'metacognition-h45k-x2'],
     ['C-8.0k', 'C-31.0k', 'C-48.7k', 'C-65.1k', 'C-91.5k'], 8),
    ('D', ['metacognition-8k-dup', 'metacognition-32k-dup', 'metacognition-48k-dup',
           'metacognition-64k-dup', 'metacognition-96k-dup'],
     ['D-16.3k', 'D-60.2k', 'D-94.9k', 'D-129.0k', 'D-179.5k'], 8),
]
E12_GROUP = ('W', ['e12-w1-seamless', 'e12-w2-lightmark', 'e12-w3-declaration',
                   'e12-w4-boundary'],
             ['W1 无缝', 'W2 轻标记', 'W3 显式宣言', 'W4 边界声明'], 8)

def ai_last(path):
    d = json.load(open(path, encoding='utf-8'))
    msgs = [m for m in d.get('messages', []) if m.get('role') in ('ai', 'assistant')]
    if not msgs:
        return '', d.get('modelId', '?')
    c = msgs[-1].get('content')
    txt = '\n'.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text') if isinstance(c, list) else str(c or '')
    # 推理模型适配：正文空时回落 reasoning 通道（GLM-Z1-9B 等），避免误判残臂
    if not txt and isinstance(c, list):
        txt = '\n'.join(b.get('reasoning', '') or '' for b in c if isinstance(b, dict))
    return txt, d.get('modelId', '?')

def audit(exp, groups):
    para_map = {}
    for gname, plist, labels, _n in groups:
        for i, p in enumerate(plist):
            para_map[p] = (gname, labels[i])
    # 期望哈希 → (槽位, model, paradigm)——只建模型物理可跑的槽位
    hash_expect = {}
    for pname, (gname, lab) in para_map.items():
        for md, allowed in MODEL_SLOTS.items():
            if lab not in allowed:
                continue
            h = hashlib.md5(f'{TASK}|{pname}|{md}'.encode()).hexdigest()[:6]
            hash_expect[h] = (lab, md, pname)
    cells = defaultdict(list)   # (lab, model) → [(base, r, stub)]
    unknown = []
    for path in sorted(glob.glob(f'{SCRIPT}/{exp}-t0p*m*.json')):
        base = os.path.basename(path)[:-5]
        m = re.match(rf'{exp}-t0p(\d+)m(\d+)r(\d+)(?:-([0-9a-f]{{6}}))?$', base)
        if not m:
            unknown.append(base + '（命名不匹配）'); continue
        pidx, r, fhash = int(m.group(1)), int(m.group(3)), m.group(4)
        txt, model = ai_last(path)
        stub = len(txt) < 50 or txt.startswith('[错误') or '[错误: terminated]' in txt
        if fhash:
            hit = hash_expect.get(fhash)
            if not hit or hit[1] != model:
                unknown.append(f'{base}（哈希 {fhash} 无对应 model={model[:14]}）'); continue
            lab = hit[0]
        else:
            plist = groups[0][1]
            if pidx >= len(plist):
                unknown.append(base); continue
            lab = para_map[plist[pidx]][1]
        cells[(lab, model)].append((base, r, stub))
    # 汇总（只审计模型期望的槽位）
    all_labels = [lab for _, _, labels, _ in groups for lab in labels]
    print(f'===== {exp} 审计 =====')
    for lab in all_labels:
        for md, allowed in MODEL_SLOTS.items():
            if lab not in allowed:
                continue
            v = cells.get((lab, md), [])
            if not v:
                print(f'  [空] {lab} × {md[:18]}: 无文件'); continue
            stubs = [b for b, _, s in v if s]
            rs = defaultdict(list)
            for b, rr, s in v:
                rs[rr].append(b)
            dups = {rr: bs for rr, bs in rs.items() if len(bs) > 1}
            have = set(rs)
            missing_r = [rr for rr in range(8) if rr not in have]
            flags = []
            if stubs: flags.append(f'残臂={stubs}')
            if dups: flags.append(f'重复r={ {rr: bs for rr, bs in dups.items()} }')
            if missing_r: flags.append(f'缺r={missing_r}')
            if len(v) != 8 or flags:
                print(f'  {lab} × {md[:18]}: n={len(v)} ' + ('；'.join(flags) if flags else ''))
    if unknown:
        print(f'  [无法归组 {len(unknown)}]')
        for u in unknown[:12]: print('   ', u)

audit('e11', E11_GROUPS)
audit('e12', [E12_GROUP])
