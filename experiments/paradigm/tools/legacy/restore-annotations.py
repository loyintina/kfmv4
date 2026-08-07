#!/usr/bin/env python3
"""restore-annotations.py — 精切标注半自动恢复（2026-08-04）

build-episodes 重跑（修幂等）误清了已标段。从两个源头回填：
1. patterns.md 的模式实例（[kfmv4dev B19] / [handover #5] 等）→ 回填 pattern
2. classification 文件段描述 → 状态线索启发式 → status + note 基础

回填后人工复核（标注本来就该人工，这是恢复脚手架）。
"""
import re, sqlite3
from pathlib import Path

MATERIALS = Path.home() / ".kfmv4" / "materials"
PACKS = MATERIALS / "packs"
DB = MATERIALS / "materials.db"

SESSIONS = {
    "kfmv4dev": "ses_14a552b2fffeeo6FbB3MQJI7TQ",
    "handover": "ses_097843368ffejJGDPa2PNXgmfI",
    "troubleshoot": "ses_063fd57d7ffepMZzVsdv2wNXM2",
    "audit": "ses_141744654ffehLxZxWEQSrD8RN",
}

# ---- 1. 从 patterns.md 提取 (源, 段标识) → 模式名 ----
def parse_patterns():
    mapping = []  # (session_id, uid_or_msg, pattern)
    cur_mode = None
    for line in open(MATERIALS / "patterns.md", encoding="utf-8"):
        m = re.match(r"^###\s+\d+\.\s*(.+)", line.strip())
        if m:
            cur_mode = m.group(1).strip()
            continue
        for src, sid in SESSIONS.items():
            for mm in re.finditer(rf"\[{src} (B\d+|F\d+|#\d+)\]", line):
                if cur_mode: mapping.append((sid, mm.group(1), cur_mode))
    return mapping

# ---- 2. 从 classification 提取段描述 ----
def parse_classification(sid, fname):
    segs = {}
    for line in (PACKS / fname).read_text(encoding="utf-8").splitlines():
        m = re.match(r"^- ([BF]\d+) \[([\d,\-\[\]\s]+)\] ?(?:\*\*)?([^*\n]{2,80})", line.strip())
        if m:
            uid, ranges, topic = m.group(1), m.group(2), m.group(3).strip()
            segs[uid] = (topic, line.strip())
    return segs

def guess_status(desc):
    t = desc.lower()
    if re.search(r"拉锯|未决|依然|仍报|持续|未解决|未完全", t): return "unresolved"
    if re.search(r"已解决|解决|修复|恢复正常|正常了|落地|完成|好了", t): return "solved"
    if re.search(r"讨论|设计|方案|决策|研究|需求", t): return "discussion"
    if re.search(r"运维|清理|配置|环境|推送|评估", t): return "shelved"
    return "pending"

def main():
    c = sqlite3.connect(str(DB))
    c.row_factory = sqlite3.Row
    pat_map = parse_patterns()
    # 段 uid → 模式集合（消息号 #N 反推段：找 user_from<=N<=user_to）
    restored = {"pattern": 0, "status": 0}
    for sid, uid, mode in pat_map:
        if uid.startswith("#"):
            n = int(uid[1:])
            ep = c.execute("SELECT id FROM episodes WHERE session_id=? AND user_from<=? AND user_to>=? LIMIT 1", (sid, n, n)).fetchone()
        else:
            ep = c.execute("SELECT id FROM episodes WHERE session_id=? AND uid=?", (sid, uid)).fetchone()
        if not ep: continue
        cur = c.execute("SELECT pattern FROM episodes WHERE id=?", (ep["id"],)).fetchone()
        pats = set(x for x in (cur["pattern"] or "").split(",") if x)
        pats.add(mode)
        c.execute("UPDATE episodes SET pattern=? WHERE id=?", (",".join(pats), ep["id"]))
        restored["pattern"] += 1
    # classification 状态回填
    import os
    for fname in os.listdir(PACKS):
        if not fname.endswith("-classification.md"): continue
        sid = None
        for src, s in SESSIONS.items():
            if fname.startswith(src) or (src == "handover" and fname.startswith("kfmv4-handover")):
                sid = s
        if not sid: continue
        segs = parse_classification(sid, fname)
        for uid, (topic, line) in segs.items():
            ep = c.execute("SELECT id, note, status FROM episodes WHERE session_id=? AND uid=?", (sid, uid)).fetchone()
            if not ep: continue
            st = guess_status(line)
            if st != "pending":
                c.execute("UPDATE episodes SET status=? WHERE id=?", (st, ep["id"]))
                restored["status"] += 1
            if not (ep["note"] or ""):
                c.execute("UPDATE episodes SET note=? WHERE id=?", (topic, ep["id"]))
    c.commit()
    print("回填:", restored)
    print("已标:", c.execute("SELECT COUNT(*) FROM episodes WHERE status!='pending'").fetchone()[0])
    print("有 pattern:", c.execute("SELECT COUNT(*) FROM episodes WHERE pattern!=''").fetchone()[0])
    # 待复核：有 status 但无 pattern 的 bug/feature 段
    todo = c.execute("SELECT id, uid, status, topic FROM episodes WHERE kind!='other' AND status!='pending' ORDER BY session_id, user_from").fetchall()
    print("待复核段（有状态无 pattern）:", len([t for t in todo if not c.execute('SELECT pattern FROM episodes WHERE id=?', (t['id'],)).fetchone()['pattern']]))

if __name__ == "__main__":
    main()
