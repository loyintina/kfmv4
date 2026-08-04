#!/usr/bin/env python3
"""annotate-pattern.py — 补 episodes 缺省的 pattern 标注（2026-08-04 接手审计）
审计发现 101/264 段 pattern 为空。用便宜链 LLM 按 32 引导模式逐段判断。
⚠️ uid 跨会话不唯一——按 id 更新。
用法：--dry-run（建议不写库）/ --apply（写库）/ --uid <段id>
"""
import json, os, re, sqlite3, sys, time, urllib.request
from pathlib import Path

HOME = Path.home()
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'
ENV = {}
for line in (HOME / '.kfmv4' / '.env').read_text().splitlines():
    t = line.strip()
    if t and not t.startswith('#') and '=' in t:
        k, v = t.split('=', 1)
        ENV[k.strip()] = v.strip().strip('"').strip("'")

ARGV = sys.argv[1:]
DRY = '--dry-run' in ARGV
APPLY = '--apply' in ARGV
ONLY = ARGV[ARGV.index('--uid') + 1] if '--uid' in ARGV else None

PATTERNS = ['验证优先','心法前置','补丁vs根因','两机制打架','读码优先','复用既有','实现边界控制',
    '删繁','设计主权','可回退铁律','复盘沉淀','施压式验收','验收清单模式','深挖根因+对标成熟',
    '全链路验证','数量覆盖质疑','架构性质校验','彻底重构决策','落盘兜底机制','版本哲学',
    '主产物vs副产物','全量原则','prompt单一原则','总runner自动化','溯源审计','重构优于补丁',
    '筛选vs压缩','修尺量物','冰山理论','数据实验优先','庙算','检查发现率信号']

def call_llm(prompt, system='你是素材库段标注员。只输出要求的 JSON，不要任何多余文字。'):
    key = ENV.get('KFM_PROVIDER_DEEPSEEK') or ENV.get('DEEPSEEK_API_KEY')
    if not key:
        raise RuntimeError('无 deepseek key')
    body = json.dumps({
        'model': 'deepseek-v4-flash',
        'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': prompt}],
        'max_tokens': 3000,
        'thinking': {'type': 'disabled'},  # 标注是抽取型任务，关思考提速
        'reasoning_effort': 'low',
    }).encode()
    req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=body,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data['choices'][0]['message']['content']

def extract_json(text):
    # 兼容 {..} 对象或 [..] 数组（LLM 可能省略 annotations 外壳）
    for pat in (r'\{[\s\S]*\}', r'\[[\s\S]*\]'):
        m = re.search(pat, text)
        if not m: continue
        try:
            j = json.loads(m.group(0))
            # 数组直接当 annotations
            if isinstance(j, list):
                return {'annotations': j}
            return j
        except: continue
    return None

db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row
if ONLY:
    missing = db.execute('SELECT id,uid,kind,topic,note FROM episodes WHERE uid=?', (ONLY,)).fetchall()
else:
    missing = db.execute("SELECT id,uid,kind,topic,note FROM episodes WHERE pattern IS NULL OR pattern=''").fetchall()
print(f'[annotate] 待标注段: {len(missing)}', flush=True)

total = applied = 0
for i in range(0, len(missing), 10):
    batch = missing[i:i + 10]
    seg_lines = '\n'.join(f"{e['id']}|{e['uid']}|{e['kind']}|{(e['topic'] or '')[:80]}|{(e['note'] or '')[:80]}" for e in batch)
    prompt = (f'你是素材库段标注员。下面每行是一个会话段落：「id|段id|类型|主题|备注」。\n'
              f'输入行号从 1 开始。为每行从以下 32 个引导模式中选 0-2 个最贴切的范式标签（0 个=杂项/无范式，用空数组）：\n'
              + '\n'.join(f'{i+1}.{p}' for i, p in enumerate(PATTERNS)) +
              '\n只输出 JSON：{\"annotations\":[{\"line\":1,\"pattern\":[\"删繁\"]}]}。'
              'line 是输入行号（从 1 开始，对应上面每行输入），pattern 从 32 个模式中选 0-2 个，不确定给空数组。\n\n待标注段落（行号 1 起）：\n' + seg_lines)
    try:
        text = call_llm(prompt)
        j = extract_json(text)
        anns = j['annotations'] if j and isinstance(j.get('annotations'), list) else []
    except Exception as e:
        print(f'[annotate] 批 {i//10+1} 失败: {e}', flush=True)
        continue
    for a in anns:
        if not isinstance(a, dict): continue
        ln = a.get('line') or a.get('id') or a.get('idx')
        if not isinstance(ln, int) or ln < 1 or ln > len(batch): continue
        tags = a.get('pattern') or a.get('tags') or a.get('patterns') or []
        pats = ','.join(p for p in tags if p in PATTERNS)
        a['_batch'] = batch[ln - 1]
        total += 1
        be = a['_batch']
        if APPLY:
            db.execute('UPDATE episodes SET pattern=? WHERE id=?', (pats, be['id']))
            applied += 1
        else:
            print(f'{be["id"]} {be["uid"]} → {pats or "(无)"}', flush=True)
db.commit()
if DRY: print(f'[annotate] dry-run 建议 {total} 段（未写库）', flush=True)
if APPLY: print(f'[annotate] 已写库 {applied} 段', flush=True)
