#!/usr/bin/env python3
"""bug-scan.py — 素材会话 bug 片段粗扫描（paradigm 研究线，2026-08-04）
启发式 v1：用户消息含「现象/问题信号词」= bug 开始；含「收尾信号词」= 段结束。
粗口径统计（宁粗勿漏），供人工精审。"""
import sqlite3, json, re, sys

def opencode_user_messages(sid):
    c = sqlite3.connect('/root/.local/share/opencode/opencode.db')
    msgs = c.execute("SELECT id, time_created, data FROM message WHERE session_id=? AND json_extract(data,'$.role')='user' ORDER BY time_created", (sid,)).fetchall()
    out = []
    for mid, ts, data in msgs:
        parts = c.execute("SELECT data FROM part WHERE message_id=? AND json_extract(data,'$.type')='text'", (mid,)).fetchall()
        text = ''
        for p in parts:
            try: text += json.loads(p[0]).get('text','')
            except: pass
        out.append({'ts': ts, 'text': text.strip()})
    c.close()
    return out

START = re.compile(r'不对|错了|坏了|没生效|不生效|没反应|不工作|问题|为什么|啥原因|什么原因|失败|报错|错乱|闪退|异常|bug|BUG|不行|不显示|没看到|消失|抖动|跳动|卡住|卡在|变了|不能用')
END = re.compile(r'^(好|可以|好了|可以了|解决了|搞定|算了|不关注|那就这样|先这样|懂了|明白了|理解了|OK|ok|行)$')

def scan(msgs):
    bugs = []
    cur = None  # {start_idx, start_ts, start_text, texts:[]}
    for i, m in enumerate(msgs):
        t = m['text']
        if not t.strip():
            continue
        if cur is not None:
            cur['texts'].append(t)
            if END.match(t.strip()) or (len(cur['texts']) > 2 and END.search(t)):
                bugs.append(cur); cur = None
            continue
        if START.search(t):
            cur = {'start_idx': i, 'start_ts': m['ts'], 'start_text': t[:120], 'texts': [t], 'end_idx': i}
    if cur: bugs.append(cur)
    return bugs

if __name__ == '__main__':
    sid = sys.argv[1] if len(sys.argv) > 1 else 'ses_14a552b2fffeeo6FbB3MQJI7TQ'
    msgs = opencode_user_messages(sid)
    bugs = scan(msgs)
    print(f'用户消息 {len(msgs)} 条 → bug 片段 {len(bugs)} 个\n')
    total_msgs = sum(len(b['texts']) for b in bugs)
    print(f'bug 片段覆盖用户消息 {total_msgs} 条（{total_msgs*100//len(msgs)}%）\n')
    print('=== 前 12 个 bug 主题 ===')
    for b in bugs[:12]:
        print(f'[{b["start_idx"]:>4}] {b["start_text"][:90]}')
