#!/usr/bin/env python3
"""restore-from-history.py — 从会话历史重放精切标注（2026-08-04）

build-episodes 曾两次误清 episodes 标注（DELETE 重插）。本脚本从 Reasonix
会话 jsonl 提取所有标注命令（review-episodes --mark / UPDATE episodes SET）
重放。恢复源 = 标注命令本身，无历史则只能人工重标。

用法：python3 experiments/paradigm/tools/restore-from-history.py
"""
import json, re, sqlite3, glob
from pathlib import Path

DB = Path.home() / ".kfmv4" / "materials" / "materials.db"
HIST = Path.home() / ".reasonix" / "projects" / "-root" / "sessions"

def collect_marks():
    """返回 {ep_id: (status, pattern, note)} 和 {uid: (status, pattern, note)}"""
    by_id, by_uid = {}, {}
    for p in glob.glob(str(HIST / "20260804*.jsonl")):
        for line in open(p, encoding="utf-8"):
            try: obj = json.loads(line)
            except Exception: continue
            for msg in obj.get("messages", []):
                cmds = []
                for tc in msg.get("tool_calls", []):
                    try: arg = json.loads(tc.get("arguments", "{}"))
                    except Exception: continue
                    if isinstance(arg, dict) and "command" in arg:
                        cmds.append(arg["command"])
                if not cmds: continue
                joined = "\n".join(cmds)
                # --mark 字面量
                for m in re.finditer(r'--mark (\d+) --status (\w+)(?: --pattern "([^"]*)")?(?: --note "([^"]*)")?', joined):
                    by_id[m.group(1)] = (m.group(2), m.group(3) or "", m.group(4) or "")
                # UPDATE ... WHERE id=N
                for m in re.finditer(r"UPDATE episodes SET status='(\w+)', pattern='([^']*)', note='([^']*)' WHERE id=(\d+)", joined):
                    by_id[m.group(4)] = (m.group(1), m.group(2), m.group(3))
                # SELECT uid + --mark id（同命令配对，解决 id 重分配）
                uid_m = re.search(r"WHERE session_id LIKE '[^']*' AND uid='(B\d+|F\d+)'", joined)
                mk = re.search(r'--mark (\d+) --status (\w+)(?: --pattern "([^"]*)")?(?: --note "([^"]*)")?', joined)
                if uid_m and mk and uid_m.group(1) not in by_uid:
                    by_uid[uid_m.group(1)] = (mk.group(2), mk.group(3) or "", mk.group(4) or "")
                # SELECT uid + UPDATE WHERE id=?（同命令）
                uid_m2 = re.search(r"SELECT id FROM episodes WHERE session_id LIKE '[^']*' AND uid='(B\d+|F\d+)'", joined)
                upd_m = re.search(r"UPDATE episodes SET status='(\w+)', pattern='([^']*)', note='([^']*)' WHERE id=\?", joined)
                if uid_m2 and upd_m and uid_m2.group(1) not in by_uid:
                    by_uid[uid_m2.group(1)] = (upd_m.group(1), upd_m.group(2), upd_m.group(3))
    return by_id, by_uid

def main():
    c = sqlite3.connect(str(DB))
    by_id, by_uid = collect_marks()
    n_id = n_uid = 0
    for ep, mark in by_id.items():
        if c.execute("SELECT 1 FROM episodes WHERE id=?", (ep,)).fetchone():
            st, pat, note = mark
            c.execute("UPDATE episodes SET status=?, pattern=?, note=? WHERE id=?", (st, pat, note, ep))
            n_id += 1
    for uid, mark in by_uid.items():
        for eid, sid in c.execute("SELECT id, session_id FROM episodes WHERE uid=?", (uid,)):
            cur = c.execute("SELECT status FROM episodes WHERE id=?", (eid,)).fetchone()
            if cur and cur[0] == "pending":
                st, pat, note = mark
                c.execute("UPDATE episodes SET status=?, pattern=?, note=? WHERE id=?", (st, pat, note, eid))
                n_uid += 1
    c.commit()
    print(f"[restore] 按 id 重放 {n_id} · 按 uid 重放 {n_uid}")
    done = c.execute("SELECT COUNT(*) FROM episodes WHERE status!='pending'").fetchone()[0]
    total = c.execute("SELECT COUNT(*) FROM episodes").fetchone()[0]
    print(f"[restore] 已标: {done} / {total}")

if __name__ == "__main__":
    main()
