#!/usr/bin/env python3
"""extract-session.py — 单会话用户消息提取器（paradigm 研究线，2026-08-04）

把 opencode 会话的用户消息提取为可读文本（AI 精审素材用）：
  ~/.kfmv4/materials/packs/<slug>-user-msgs.txt

用法：python3 experiments/paradigm/tools/extract-session.py <session_id> [slug]
"""
import sqlite3, json, sys
from datetime import datetime
from pathlib import Path

HOME = Path.home()
PACKS = HOME / ".kfmv4" / "materials" / "packs"

DB = HOME / ".local" / "share" / "opencode" / "opencode.db"

def kimi_messages(sid):
    """kimi 会话：~/.kimi-code/sessions/*/session_<id>/agents/main/wire.jsonl
    用户消息 = turn.prompt 的 input。"""
    import glob as _glob
    files = _glob.glob(str(Path.home() / ".kimi-code/sessions" / "*" / f"session_{sid}" / "agents" / "main" / "wire.jsonl"))
    out = []
    for f in files:
        for line in open(f, encoding="utf-8", errors="ignore"):
            try: d = json.loads(line)
            except Exception: continue
            if d.get("type") != "turn.prompt":
                continue
            inp = d.get("input")
            text = inp if isinstance(inp, str) else (inp.get("text") or str(inp) if isinstance(inp, dict) else str(inp))
            if not text or not text.strip():
                continue
            t = d.get("time", "")
            out.append((t, text.strip()))
    out.sort(key=lambda x: str(x[0]))
    return out

def qoder_messages(sid):
    """qoder 会话：~/.qoder-cn/logs/sessions/<wd>/<uuid>/segments/*.jsonl
    用户消息 = input.prompt.submitted 的 text_preview（事件流无完整 AI 内容）。"""
    import glob as _glob
    segs = _glob.glob(str(Path.home() / ".qoder-cn/logs/sessions" / "*" / sid / "segments" / "*.jsonl"))
    out = []
    for f in segs:
        for line in open(f, encoding="utf-8"):
            try: d = json.loads(line)
            except Exception: continue
            if d.get("type") != "input.prompt.submitted":
                continue
            data = d.get("data", {})
            text = (data.get("text_preview") or "").strip()
            if not text or data.get("is_meta"):
                continue
            out.append((d.get("ts", ""), text))
    out.sort(key=lambda x: x[0])
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = "kimi" if "kimi" in args else ("qoder" if "qoder" in args else "opencode")
    rest = [a for a in args if a not in ("opencode", "qoder", "kimi")]
    sid = rest[0] if rest else "ses_14a552b2fffeeo6FbB3MQJI7TQ"
    slug = rest[1] if len(rest) > 1 else (sid[:20] if src == "qoder" else "session")
    PACKS.mkdir(parents=True, exist_ok=True)
    if src == "kimi":
        rows = kimi_messages(sid)
        out = [f'[{i:>4}|{str(t)[:16]}] {text}' for i, (t, text) in enumerate(rows)]
        dest = PACKS / f"{slug}-user-msgs.txt"
        dest.write_text('\n'.join(out), encoding='utf-8')
        print(f'[extract-session] kimi {len(out)} 条用户消息 → {dest}')
        return
    if src == "qoder":
        rows = qoder_messages(sid)
        out = [f'[{i:>4}|{t[:16].replace("T"," ")}] {text}' for i, (t, text) in enumerate(rows)]
        dest = PACKS / f"{slug}-user-msgs.txt"
        dest.write_text('\n'.join(out), encoding='utf-8')
        print(f'[extract-session] qoder {len(out)} 条用户消息 → {dest}')
        return
    c = sqlite3.connect(str(DB))
    c.row_factory = sqlite3.Row
    s = c.execute("SELECT title FROM session WHERE id=?", (sid,)).fetchone()
    msgs = c.execute(
        "SELECT id, time_created FROM message WHERE session_id=? AND json_extract(data,'$.role')='user' ORDER BY time_created",
        (sid,)).fetchall()
    out = []
    for i, m in enumerate(msgs):
        parts = c.execute(
            "SELECT data FROM part WHERE message_id=? AND json_extract(data,'$.type')='text'", (m["id"],)).fetchall()
        text = ''
        for p in parts:
            try: text += json.loads(p[0]).get('text', '')
            except Exception: pass
        text = text.strip().replace('\n', ' ')
        if not text:
            text = '（空/纯工具消息）'
        t = datetime.fromtimestamp(m["time_created"] / 1000).strftime('%m-%d %H:%M')
        out.append(f'[{i:>4}|{t}] {text}')
    c.close()
    dest = PACKS / f"{slug}-user-msgs.txt"
    dest.write_text('\n'.join(out), encoding='utf-8')
    print(f'[extract-session] {len(out)} 条用户消息 → {dest}')
    print(f'[extract-session] 会话: {s["title"] if s else sid}')

if __name__ == "__main__":
    main()
