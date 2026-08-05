#!/usr/bin/env python3
"""cost-stats.py — 实验成本统计：会话归档 × 档包长 × 价格表 → 每模型每档成本

口径说明（2026-08-05 定）：
- 输入 token：精确已知（范式包五档 8.1/30.1/47.4/64.5/89.8k + 任务约 150）
- 输出 token：归档 tokenCount 字段作代理（服务器按字符估算，只含输出）
- 聚光换算：1 刀 = 0.16 元（用户提供）；按次 model_price × 4 = 刀（经 3 个命名数据点验证）；
  按量 USD × 0.64 = 元（1 USD = 4 刀）
- 聚光按量倍率：in_usd/M = model_ratio × 2；out_usd/M = in × completion_ratio
"""
import json, glob, os, sys
from collections import defaultdict

SCRIPT = os.path.expanduser('~/.kfmv4/sessions/script')
# 档 → 输入包 token（p0 无包只算任务）
PACK = {0: 0, 1: 8100, 2: 30100, 3: 47400, 4: 64500, 5: 89800}
TASK_TOKENS = 150

# pricing: model → dict
# kind: 'per_call' (元/次) | 'per_token' (元/M in, 元/M out)
JG = 0.64  # 聚光 USD→元
PRICING = {
    # 聚光按次
    '[0.4刀/次]gemini-3.5-flash': {'kind': 'per_call', 'call': 0.1*4*0.16},
    '[酒馆专用0.9刀/次]gemini-2.5-pro': {'kind': 'per_call', 'call': 0.225*4*0.16},
    '[1刀/次]gemini-3-pro-preview-think': {'kind': 'per_call', 'call': 0.25*4*0.16},
    '[kiro]claude-sonnet-4-6': {'kind': 'per_call', 'call': 0.075*4*0.16},
    'kiro-claude-sonnet-5-thinking': {'kind': 'per_call', 'call': 0.125*4*0.16},
    '[kiro]claude-opus-4-8': {'kind': 'per_call', 'call': 0.175*4*0.16},
    '[kiro]claude-opus-4-8-thinking': {'kind': 'per_call', 'call': 0.175*4*0.16},
    'kiro-claude-opus-5': {'kind': 'per_call', 'call': 0.175*4*0.16},
    # 聚光按量
    'gpt-5-mini': {'kind': 'per_token', 'in': 0.625*2*JG, 'out': 0.625*8*2*JG},
    'claude-haiku-4-5-20251001': {'kind': 'per_token', 'in': 2.5*2*JG, 'out': 2.5*5*2*JG},
    '[codex]gpt-5.4-mini': {'kind': 'per_token', 'in': 0.375*2*JG, 'out': 0.375*6*2*JG},
    # [codex]gpt-5.6-luna：阶梯计费 expr 未解，待实测核实——不计入
    # 硅基流动（元/M，2026-08-05 官方价格页）
    'Pro/deepseek-ai/DeepSeek-R1': {'kind': 'per_token', 'in': 4, 'out': 16},
    'Pro/deepseek-ai/DeepSeek-V3': {'kind': 'per_token', 'in': 2, 'out': 8},
    'Qwen/Qwen3.6-35B-A3B': {'kind': 'per_token', 'in': 1.8, 'out': 10.8},
    'Qwen/Qwen3.5-4B': {'kind': 'per_token', 'in': 0, 'out': 0},  # 免费
    'Qwen/Qwen3.5-9B': {'kind': 'per_token', 'in': 0.5, 'out': 4},  # ≤128k 档
    'Qwen/Qwen3.5-27B': {'kind': 'per_token', 'in': 0.6, 'out': 4.8},
    'THUDM/GLM-4-32B-0414': {'kind': 'per_token', 'in': 1.89, 'out': 1.89},
    'THUDM/GLM-Z1-9B-0414': {'kind': 'per_token', 'in': 0, 'out': 0},  # 免费
    'zai-org/GLM-4.5-Air': {'kind': 'per_token', 'in': 1, 'out': 6},
    'inclusionAI/Ling-mini-2.0': {'kind': 'per_token', 'in': 0.5, 'out': 2},
    'stepfun-ai/Step-3.5-Flash': {'kind': 'per_token', 'in': 0.7, 'out': 2.1},
    'Pro/MiniMaxAI/MiniMax-M2.5': {'kind': 'per_token', 'in': 2.1, 'out': 8.4},
}

PREFIXES = sys.argv[1:] or ['e7c-', 'e10-', 'e10b-', 'e9-', 'e9b-', 'e9c-']

def arm_key(fn):
    """e10-t0p3m2r5.json → (prefix, p_idx)"""
    base = os.path.basename(fn)[:-5]
    for p in sorted(PREFIXES, key=len, reverse=True):
        if base.startswith(p):
            rest = base[len(p):]
            try:
                pi = int(rest.split('m')[0].split('p')[1])
            except (IndexError, ValueError):
                return None
            return p, pi
    return None

stats = defaultdict(lambda: {'arms': 0, 'out_tokens': 0})
for fn in glob.glob(os.path.join(SCRIPT, '*.json')):
    k = arm_key(fn)
    if not k:
        continue
    prefix, pi = k
    try:
        d = json.load(open(fn))
    except Exception:
        continue
    model = d.get('modelId', '?')
    stats[(prefix, model, pi)]['arms'] += 1
    stats[(prefix, model, pi)]['out_tokens'] += d.get('tokenCount') or 0

def cost(model, pi, out_tok):
    pr = PRICING.get(model)
    if not pr:
        return None
    if pr['kind'] == 'per_call':
        return pr['call']
    in_tok = PACK[pi] + TASK_TOKENS
    return (in_tok * pr['in'] + out_tok * pr['out']) / 1e6

rows = []
totals = defaultdict(float)
for (prefix, model, pi), s in sorted(stats.items()):
    avg_out = s['out_tokens'] / s['arms'] if s['arms'] else 0
    c = cost(model, pi, avg_out)
    batch = c * s['arms'] if c is not None else None
    if batch is not None:
        totals[prefix] += batch
    rows.append((prefix, model, pi, s['arms'], round(avg_out), c, batch))

cur = None
for prefix, model, pi, arms, avg_out, c, batch in rows:
    if prefix != cur:
        cur = prefix
        print(f'\n## {prefix}')
        print('| 模型 | 档 | 臂 | 平均输出 tok | 单臂成本(元) | 小计(元) |')
        print('|---|---|---|---|---|---|')
    print(f'| {model} | p{pi}({PACK[pi]//1000}k) | {arms} | {avg_out} | '
          f'{f"{c:.4f}" if c is not None else "无价目"} | {f"{batch:.3f}" if batch is not None else "-"} |')

print('\n## 批次总成本（元）')
for p, t in totals.items():
    print(f'- {p}: {t:.2f}')
print(f'- 合计: {sum(totals.values()):.2f}')
