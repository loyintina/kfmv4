#!/usr/bin/env python3
"""review-episodes.py — 段精切工作台（2026-08-04）

逐段拉回合链（user 消息 + AI 回复摘要 + 工具序列）→ 人工（AI）判断 →
写回标注（status/pattern/note + 回合 feedback）。水磨工夫，一次一段。

用法：
  python3 review-episodes.py --show <ep_id>     # 拉段的回合链
  python3 review-episodes.py --next             # 下一个 pending 的 bug/feature 段
  python3 review-episodes.py --mark <ep_id> --status solved|shelved|unresolved|discussion \
      --pattern "两机制打架,可回退" --note "..."   # 写回标注
"""
import sqlite3, sys, json
from pathlib import Path

DB = Path.home() / ".kfmv4" / "materials" / "materials.db"
c = sqlite3.connect(str(DB))
c.row_factory = sqlite3.Row

def get_ep(ep_id):
    return c.execute("SELECT * FROM episodes WHERE id=?", (ep_id,)).fetchone()

def show(ep):
    sid, s, e = ep["session_id"], ep["seq_start"], ep["seq_end"]
    print(f"=== {ep['uid']} [{ep['kind']}] {ep['topic']}  (user {ep['user_from']}-{ep['user_to']}, seq {s}-{e}) ===")
    # 回合链：user 消息为主干，夹 AI text/tool 摘要
    rows = c.execute("SELECT seq, role, text FROM messages WHERE session_id=? AND seq BETWEEN ? AND ? ORDER BY seq", (sid, s, e)).fetchall()
    tools = c.execute("SELECT seq, tool, substr(input,1,40) AS input FROM tool_calls WHERE session_id=? AND seq BETWEEN ? AND ?", (sid, s, e)).fetchall()
    tmap = {r["seq"]: r for r in tools}
    for r in rows:
        seq, role, text = r["seq"], r["role"], r["text"]
        if role == "user":
            print(f"\n  👤[{seq}] {text[:120]}")
        else:
            print(f"  🤖[{seq}] {text[:150]}")
        for t in tmap.get(seq, []):
            pass
    # 工具在回合间（按 seq 打印）
    print("\n  -- 工具序列 --")
    for t in tools:
        print(f"    [{t['seq']}] {t['tool']} {t['input']}")

def mark(ep_id, status, pattern, note):
    c.execute("UPDATE episodes SET status=?, pattern=?, note=? WHERE id=?",
              (status, pattern, note, ep_id))
    c.commit()
    print(f"[mark] {ep_id} → {status} | {pattern} | {note[:50]}")

def main():
    a = sys.argv[1:]
    if "--show" in a:
        ep = get_ep(int(a[a.index("--show") + 1]))
        if ep: show(ep)
    elif "--next" in a:
        ep = c.execute("SELECT * FROM episodes WHERE status='pending' AND kind!='other' ORDER BY session_id, user_from LIMIT 1").fetchone()
        if ep: show(ep)
        else: print("无 pending 段")
    elif "--mark" in a:
        ep_id = int(a[a.index("--mark") + 1])
        get = lambda k: a[a.index(k) + 1] if k in a else ""
        mark(ep_id, get("--status") or "pending", get("--pattern"), get("--note"))

if __name__ == "__main__":
    main()
