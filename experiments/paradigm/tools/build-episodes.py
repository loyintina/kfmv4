#!/usr/bin/env python3
"""build-episodes.py — 段/回合结构落库（2026-08-04）

把人工精切的段（classification 文件）+ 机器预切（未覆盖区）写入 materials.db：
  episodes（段：类型/状态/主题/来源） + turns（回合：user 消息为界）。

用法：python3 experiments/paradigm/tools/build-episodes.py
"""
import re, sqlite3, sys
from pathlib import Path

MATERIALS = Path.home() / ".kfmv4" / "materials"
DB = MATERIALS / "materials.db"
PACKS = MATERIALS / "packs"

CLASS_FILES = {
    "ses_14a552b2fffeeo6FbB3MQJI7TQ": "kfmv4dev-classification.md",
    "ses_097843368ffejJGDPa2PNXgmfI": "kfmv4-handover-classification.md",
    "ses_063fd57d7ffepMZzVsdv2wNXM2": "kfmv4-troubleshoot-classification.md",
    "ses_141744654ffehLxZxWEQSrD8RN": "kfmv4-audit-classification.md",
}

# 解析段行：- B1 [1-3] **标题** 或 - F1 [4-38] 标题
SEG_RE = re.compile(r"^- ([BF])(\d+) \[([\d,\-\[\]\s]+)\] ?(?:\*\*)?([^*\n]{2,60})")

def parse_segments(path):
    segs = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = SEG_RE.match(line.strip())
        if not m:
            continue
        kind, num, ranges, topic = m.group(1), int(m.group(2)), m.group(3), m.group(4).strip()
        nums = [int(x) for x in re.findall(r"\d+", ranges)]
        if not nums:
            continue
        segs.append({
            "id": f"{kind}{num}", "kind": "bug" if kind == "B" else "feature",
            "from": min(nums), "to": max(nums), "topic": topic,
        })
    return segs

def user_seqs(c, sid):
    return [r[0] for r in c.execute(
        "SELECT seq FROM messages WHERE session_id=? AND role='user' ORDER BY seq", (sid,))]

def build(c):
    c.executescript("""
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT, uid TEXT, kind TEXT, status TEXT DEFAULT 'pending',
      user_from INTEGER, user_to INTEGER, seq_start INTEGER, seq_end INTEGER,
      topic TEXT, pattern TEXT DEFAULT '', source TEXT, note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER, user_idx INTEGER, user_seq INTEGER,
      seq_start INTEGER, seq_end INTEGER
    );
    """)
    for sid, fname in CLASS_FILES.items():
        # 幂等：重跑先清该会话旧段/回合
        c.execute("DELETE FROM turns WHERE episode_id IN (SELECT id FROM episodes WHERE session_id=?)", (sid,))
        c.execute("DELETE FROM episodes WHERE session_id=?", (sid,))
        cfile = PACKS / fname
        if not cfile.exists():
            print(f"[episodes] 缺 {fname}"); continue
        segs = parse_segments(cfile)
        seqs = user_seqs(c, sid)  # 用户消息 seq（升序）
        n = 0
        for s in segs:
            fi, ti = s["from"], min(s["to"], len(seqs) - 1)
            if fi >= len(seqs):
                continue
            start = seqs[fi]
            end = seqs[ti + 1] - 1 if ti + 1 < len(seqs) else 10**12
            cur = c.execute("INSERT INTO episodes(session_id,uid,kind,user_from,user_to,seq_start,seq_end,topic,source) VALUES(?,?,?,?,?,?,?,?,?)",
                            (sid, s["id"], s["kind"], fi, ti, start, end, s["topic"], "manual"))
            ep_id = cur.lastrowid
            # 回合：段内每个 user 消息为界
            for ui in range(fi, ti + 1):
                t_start = seqs[ui]
                t_end = seqs[ui + 1] - 1 if ui + 1 < len(seqs) else end
                c.execute("INSERT INTO turns(episode_id,user_idx,user_seq,seq_start,seq_end) VALUES(?,?,?,?,?)",
                          (ep_id, ui, t_start, t_start, min(t_end, end)))
            n += 1
        # 机器预切：未覆盖的用户消息区 → other 段
        covered = []
        for r in c.execute("SELECT user_from, user_to FROM episodes WHERE session_id=?", (sid,)):
            covered.extend(range(r[0], r[1] + 1))
        uncovered = [i for i in range(len(seqs)) if i not in set(covered)]
        # 合并连续未覆盖区为段
        if uncovered:
            groups = []
            run = [uncovered[0]]
            for i in uncovered[1:]:
                if i == run[-1] + 1: run.append(i)
                else: groups.append(run); run = [i]
            groups.append(run)
            for g in groups:
                start = seqs[g[0]]
                end = seqs[g[-1] + 1] - 1 if g[-1] + 1 < len(seqs) else 10**12
                c.execute("INSERT INTO episodes(session_id,uid,kind,user_from,user_to,seq_start,seq_end,topic,source) VALUES(?,?,?,?,?,?,?,?,?)",
                          (sid, f"O{g[0]}-{g[-1]}", "other", g[0], g[-1], start, end, "（未分类区：介绍/推进/杂项）", "heuristic"))
                for ui in g:
                    t_start = seqs[ui]
                    t_end = seqs[ui + 1] - 1 if ui + 1 < len(seqs) else end
                    # 查刚插入的 episode id
                    ep = c.execute("SELECT id FROM episodes WHERE session_id=? AND user_from=? AND user_to=? AND source='heuristic'",
                                   (sid, g[0], g[-1])).fetchone()
                    c.execute("INSERT INTO turns(episode_id,user_idx,user_seq,seq_start,seq_end) VALUES(?,?,?,?,?)",
                              (ep[0], ui, t_start, t_start, min(t_end, end)))
        print(f"[episodes] {fname}: 人工段 {n} + 预切 other 段 {len(groups) if uncovered else 0}")
    c.commit()
    for t in ("episodes", "turns"):
        print(f"[episodes] {t}: {c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]}")

if __name__ == "__main__":
    c = sqlite3.connect(str(DB))
    build(c)
    c.close()
