#!/usr/bin/env python3
"""extract-all.py — 素材全量提取器（opencode → materials.db，2026-08-04）

把 opencode 会话的**全量数据**（用户消息 + AI text/reasoning/tool 调用/patch）
提取进 ~/.kfmv4/materials/materials.db（SQLite + FTS5 全文索引）。
粗筛入库，切片/精选是后置工作。

用法：
  python3 experiments/paradigm/tools/extract-all.py --session <id> [--slug <名>]
  python3 experiments/paradigm/tools/extract-all.py --all-opencode
"""
import json, sqlite3, sys
from datetime import datetime
from pathlib import Path

HOME = Path.home()
MATERIALS = HOME / ".kfmv4" / "materials"
DB_PATH = MATERIALS / "materials.db"
OPENCODE_DB = HOME / ".local" / "share" / "opencode" / "opencode.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, source TEXT, title TEXT, dir TEXT,
  started_at INTEGER, ended_at INTEGER, user_msgs INTEGER, all_msgs INTEGER
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT, seq INTEGER, role TEXT, ts INTEGER, text TEXT
);
CREATE TABLE IF NOT EXISTS reasoning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT, seq INTEGER, ts INTEGER, text TEXT
);
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT, seq INTEGER, ts INTEGER,
  tool TEXT, status TEXT, input TEXT, output TEXT
);
CREATE TABLE IF NOT EXISTS patches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT, seq INTEGER, hash TEXT, files TEXT
);
CREATE INDEX IF NOT EXISTS idx_msg_sess ON messages(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_tool_sess ON tool_calls(session_id, seq);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  session_id, role, text, content='messages', content_rowid='id'
);
"""

def init_db():
    MATERIALS.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_PATH))
    c.executescript(SCHEMA)
    return c

def opencode_session(c, sid):
    """提取单个 opencode 会话全量 → 入库。返回统计。"""
    oc = sqlite3.connect(str(OPENCODE_DB))
    oc.row_factory = sqlite3.Row
    s = oc.execute("SELECT * FROM session WHERE id=?", (sid,)).fetchone()
    if not s:
        oc.close(); return None
    msgs = oc.execute(
        "SELECT id, time_created FROM message WHERE session_id=? ORDER BY time_created", (sid,)).fetchall()

    user_n = ai_n = 0
    seq = 0
    for m in msgs:
        role_row = oc.execute("SELECT json_extract(data,'$.role') AS role FROM message WHERE id=?", (m["id"],)).fetchone()
        role = role_row["role"] if role_row else None
        parts = oc.execute(
            "SELECT data FROM part WHERE message_id=? ORDER BY time_created", (m["id"],)).fetchall()
        # 按 part 类型分流
        texts, reasonings, tools, patches = [], [], [], []
        for (pd,) in parts:
            try: d = json.loads(pd)
            except Exception: continue
            t = d.get("type")
            if t == "text" and d.get("text"):
                texts.append(d["text"])
            elif t == "reasoning" and d.get("text"):
                reasonings.append(d["text"])
            elif t == "tool":
                tools.append(d)
            elif t == "patch":
                patches.append(d)
        if role == "user" or (role is None and texts):  # user 消息（含无 role 的老格式）
            role = "user"
        if role == "user":
            user_n += 1
            c.execute("INSERT INTO messages(session_id,seq,role,ts,text) VALUES(?,?,?,?,?)",
                      (sid, seq, "user", m["time_created"], "\n".join(texts)))
            seq += 1
        elif role == "assistant":
            ai_n += 1
            if texts:
                c.execute("INSERT INTO messages(session_id,seq,role,ts,text) VALUES(?,?,?,?,?)",
                          (sid, seq, "assistant", m["time_created"], "\n".join(texts)))
                seq += 1
            for r in reasonings:
                c.execute("INSERT INTO reasoning(session_id,seq,ts,text) VALUES(?,?,?,?)",
                          (sid, seq, m["time_created"], r))
            for t in tools:
                st = t.get("state", {})
                c.execute("INSERT INTO tool_calls(session_id,seq,ts,tool,status,input,output) VALUES(?,?,?,?,?,?,?)",
                          (sid, seq, m["time_created"], t.get("tool"), st.get("status"),
                           json.dumps(st.get("input", {}), ensure_ascii=False)[:20000],
                           str(st.get("output", ""))[:20000]))
                seq += 1  # 工具调用也占序号（回合链顺序）
            for p in patches:
                c.execute("INSERT INTO patches(session_id,seq,hash,files) VALUES(?,?,?,?)",
                          (sid, seq, p.get("hash"), json.dumps(p.get("files", []), ensure_ascii=False)))
                seq += 1
    # 会话元数据
    c.execute("""INSERT OR REPLACE INTO sessions(id,source,title,dir,started_at,ended_at,user_msgs,all_msgs)
                 VALUES(?,?,?,?,?,?,?,?)""",
              (sid, "opencode", s["title"] or "", s["directory"] or "", s["time_created"], s["time_updated"],
               user_n, user_n + ai_n))
    # FTS 重建（content= 外部内容表：直接 INSERT 列值建立索引不可靠，用 rebuild 从 messages 全量重建）
    c.execute("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')")
    oc.close()
    return {"session": sid, "title": s["title"], "user": user_n, "ai": ai_n}

def main():
    c = init_db()
    args = sys.argv[1:]
    if "--all-opencode" in args:
        oc = sqlite3.connect(str(OPENCODE_DB))
        sids = [r[0] for r in oc.execute("SELECT id FROM session")]
        oc.close()
        total = []
        for sid in sids:
            r = opencode_session(c, sid)
            if r:
                total.append(r)
                print(f"  [{r['title'][:30]}] user={r['user']} ai={r['ai']}")
        c.commit()
        print(f"[extract-all] opencode 全量 {len(total)} 会话入库")
    else:
        sid = args[args.index("--session") + 1] if "--session" in args else None
        if not sid:
            print("用法: --session <id> | --all-opencode"); sys.exit(2)
        r = opencode_session(c, sid)
        c.commit()
        print(f"[extract-all] {r['title']} 入库: user={r['user']} ai={r['ai']}")
    # 库统计
    for t in ("sessions", "messages", "reasoning", "tool_calls", "patches"):
        n = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"[extract-all] {t}: {n}")
    c.close()

if __name__ == "__main__":
    main()
