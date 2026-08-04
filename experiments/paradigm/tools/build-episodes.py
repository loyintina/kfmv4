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
    "ses_0b64338f0ffe19Oza4gW1ACwZb": "kfmv4-handover-sync-classification.md",
    "ses_0912cd17dffe6W2r9h34Ia0s4w": "kfmv4-dev-takeover-classification.md",
    "ses_0c4d31276ffekqCW6vy3LLZ5z9": "oc-tmux-omp-classification.md",
    "ses_05f165247ffeQpTyQxFOveonDp": "omp-key-config-classification.md",
    "ses_11f896be5ffeaCLXrQ3R28l0vZ": "guizang-reading-classification.md",
    "qoder-f4fde5d9-3141-414b-bc00-a9b2ebe72de0": "qoder-root-kfmv4-1-classification.md",
    "qoder-cb4a4fc9-7c3b-46c7-943b-283315096247": "qoder-root-1-classification.md",
    "qoder-08199521-0067-4640-807f-4fe2f965434a": "qoder-root-2-classification.md",
    "qoder-640387e6-fba9-493d-bb2b-12ff7235884a": "qoder-root-3-classification.md",
    "qoder-1a83caf2-f9d3-4162-9a55-bbf55a424827": "qoder-kfmv4-2-classification.md",
    "qoder-ef557a52-ed18-4115-b7ba-c564b2c5558b": "qoder-x-ef557a52-classification.md",
    "qoder-f83335ca-bdf9-4540-8937-bbbea61e386e": "qoder-coldstart-lab1-classification.md",
    "qoder-2542c893-76dc-403d-a188-b7dc67c976e3": "qoder-coldstart-lab1-classification.md",
    "qoder-b520873e-8392-4c8e-80a7-ca50f8f7f422": "qoder-coldstart-lab1-classification.md",
    "qoder-92a53457-7e38-48fb-9d3a-a9735aa128be": "qoder-coldstart-lab1-classification.md",
    "qoder-b5bb03d8-3870-494c-80ce-3e831697435e": "qoder-coldstart-lab1-classification.md",
    "qoder-2ba9fb60-89be-452c-a6d7-098b27e5b938": "qoder-coldstart-lab1-classification.md",
    "qoder-7771d852-a2e8-4fb4-a443-5dc773eab37b": "qoder-coldstart-lab1-classification.md",
    "qoder-e507c745-d106-4b3a-a2a0-86e36e40d6a4": "qoder-coldstart-lab1-classification.md",
    "qoder-7808a9bc-befd-4370-860d-66de3af27595": "qoder-coldstart-lab1-classification.md",
    "qoder-57c8d1c5-debd-496d-90ef-1aae3c6e8a0f": "qoder-coldstart-lab1-classification.md",
    "qoder-5a0ed84d-5933-412d-b10c-3d3edae77561": "qoder-coldstart-lab1-classification.md",
    "qoder-48c0cd58-c88c-4d4b-b223-9737a47f46ee": "qoder-coldstart-lab1-classification.md",
    "qoder-98e09c81-3fb4-4ed0-8916-5346d32cb732": "qoder-coldstart-lab1-classification.md",
    "kimi-0e56b3a5-bfda-4c82-8e48-5629a00532a3": "kimi-long-classification.md",
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
        # 幂等：已存在的段不重插（绝不清标注——标注是人工精切成果，见 restore-from-history 事故）
        existing = {r[0] for r in c.execute("SELECT uid FROM episodes WHERE session_id=?", (sid,))}
        cfile = PACKS / fname
        if not cfile.exists():
            print(f"[episodes] 缺 {fname}"); continue
        segs = parse_segments(cfile)
        seqs = user_seqs(c, sid)  # 用户消息 seq（升序）
        n = 0
        for s in segs:
            if s["id"] in existing: continue  # 已存在不重插（保留精切标注）
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
                if f"O{g[0]}-{g[-1]}" in existing: continue
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
