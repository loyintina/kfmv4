#!/usr/bin/env python3
"""annotate-operit.py — operit 会话范式候选筛选（2026-08-04）

第一性原理：从 operit 全量消息中筛「适合范式包的片段」——用户方法论/决策
模式/复盘的高价值段落。用便宜链 LLM 批量判断：user 消息按主题分组 → 每段
范式价值（高/中/低 + 范式类型）+ 段边界建议。

用法：
  python3 experiments/paradigm/tools/annotate-operit.py --sid operit-07 [--dry-run|--apply]
"""
import json, re, sqlite3, sys, urllib.request
from pathlib import Path

HOME = Path.home()
DB = HOME / '.kfmv4' / 'materials' / 'materials.db'
ARGV = sys.argv[1:]
SID = ARGV[ARGV.index('--sid') + 1] if '--sid' in ARGV else 'operit-07'
DRY = '--dry-run' in ARGV
APPLY = '--apply' in ARGV

# deepseek key
ENV = {}
for line in (HOME / '.kfmv4' / '.env').read_text().splitlines():
    t = line.strip()
    if t and not t.startswith('#') and '=' in t:
        k, v = t.split('=', 1)
        ENV[k.strip()] = v.strip().strip('"').strip("'")
KEY = ENV.get('KFM_PROVIDER_DEEPSEEK')

PATTERNS = ['验证优先','心法前置','补丁vs根因','两机制打架','读码优先','复用既有','实现边界控制',
    '删繁','设计主权','可回退铁律','复盘沉淀','施压式验收','验收清单模式','深挖根因+对标成熟',
    '全链路验证','数量覆盖质疑','架构性质校验','彻底重构决策','落盘兜底机制','版本哲学',
    '主产物vs副产物','全量原则','prompt单一原则','总runner自动化','溯源审计','重构优于补丁',
    '筛选vs压缩','修尺量物','冰山理论','数据实验优先','庙算','检查发现率信号','现象vs指标','硬约束优先于文档约束']

def call_llm(prompt):
    body = json.dumps({'model':'deepseek-v4-flash',
        'messages':[{'role':'system','content':'你是素材库范式候选筛选员。只输出 JSON。'},{'role':'user','content':prompt}],
        'max_tokens':3000,'thinking':{'type':'disabled'}}).encode()
    req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=body,
        headers={'Content-Type':'application/json','Authorization':f'Bearer {KEY}'})
    data = json.loads(urllib.request.urlopen(req, timeout=120).read())
    return data['choices'][0]['message']['content']

def extract_json(text):
    for pat in (r'\{[\s\S]*\}', r'\[[\s\S]*\]'):
        m = re.search(pat, text)
        if not m: continue
        try:
            j = json.loads(m.group(0))
            return {'annotations': j} if isinstance(j, list) else j
        except: continue
    return None

db = sqlite3.connect(str(DB))
db.row_factory = sqlite3.Row
users = db.execute('SELECT seq,ts,text FROM messages WHERE session_id=? AND role="user" AND ts>0 ORDER BY ts', (SID,)).fetchall()
print(f'{SID}: user 消息 {len(users)} 条', flush=True)

# 按主题分组：相邻 user 消息（间隔 < 30 分钟）归一组
groups = []
cur = [users[0]]
for u in users[1:]:
    if u['ts'] - cur[-1]['ts'] > 30 * 60 * 1000:
        groups.append(cur); cur = [u]
    else:
        cur.append(u)
groups.append(cur)
print(f'主题分组 {len(groups)} 组', flush=True)

# LLM 批量判断（每批 8 组）
BATCH = 8
results = []
for i in range(0, len(groups), BATCH):
    batch = groups[i:i + BATCH]
    lines = '\n'.join(f"{i+j+1}|{g[0]['text'][:60]}" for j, g in enumerate(batch))
    prompt = (f'下面每行是一个对话片段（行号|首条用户消息），共 {len(batch)} 行。\n'
              f'必须为每一行判断范式价值（缺一行=不合格）：\n'
              f'- value: high/mid/low（用户方法论/决策模式/复盘=high；功能迭代=mid；闲聊运维=low）\n'
              f'- pattern: 从以下模式选 0-2 个（无则空数组）\n{PATTERNS}\n'
              f'只输出 JSON：{{"items":[{{"line":1,"value":"high","pattern":["补丁vs根因"]}}]}}，items 必须 {len(batch)} 项，line 从 1 到 {len(batch)} 全覆盖。\n{lines}')
    try:
        text = call_llm(prompt)
        j = extract_json(text)
        items = j.get('items') if j and isinstance(j.get('items'), list) else []
        # 校验：行覆盖不足则带反馈重问一次
        covered = set()
        for it in items:
            ln = it.get('line')
            if isinstance(ln, int) and 1 <= ln <= len(batch):
                covered.add(ln)
        if len(covered) < len(batch):
            try:
                text2 = call_llm(prompt + '\n[提醒] 上次 items 不完整（覆盖 ' + str(len(covered)) + '/' + str(len(batch)) + '），请补全全部行。')
                j2 = extract_json(text2)
                items = j2.get('items') if j2 and isinstance(j2.get('items'), list) else items
            except: pass
        for it in items:
            ln = it.get('line')
            if isinstance(ln, int) and 1 <= ln <= len(batch):
                results.append((i + ln, it.get('value', 'low'), it.get('pattern') or []))
    except Exception as e:
        print(f'  批 {i // BATCH + 1} 失败: {e}', flush=True)
    print(f'  批 {i // BATCH + 1} 完成', flush=True)

# 输出结果
high = [r for r in results if r[1] == 'high']
mid = [r for r in results if r[1] == 'mid']
print(f'\n范式价值：high {len(high)} / mid {len(mid)} / low {len(results) - len(high) - len(mid)}', flush=True)
for ln, val, pats in results:
    if val != 'low':
        g = groups[ln - 1]
        print(f'  [{val}] 组{ln}（{len(g)}条）{str(g[0]["text"])[:40]} → {",".join(pats)}', flush=True)
if APPLY:
    # 落库：high 段生成 episodes（粗切）
    for ln, val, pats in results:
        if val != 'high': continue
        g = groups[ln - 1]
        uall = [u['seq'] for u in users]
        s1, s2 = g[0]['seq'], g[-1]['seq']
        db.execute('INSERT INTO episodes(session_id,uid,kind,status,user_from,user_to,seq_start,seq_end,topic,pattern,source,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                   (SID, f'P{ln:03d}', 'feature', 'discussion', 1, 1, s1, s2,
                    str(g[0]['text'])[:50], ','.join(p for p in pats if p in PATTERNS), 'manual', 'operit 范式候选（LLM 筛选）'))
    db.commit()
    print(f'已落库 {len([r for r in results if r[1]=="high"])} 段（high）', flush=True)
