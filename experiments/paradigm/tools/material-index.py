#!/usr/bin/env python3
"""
material-index.py — 工具会话素材索引器（paradigm 研究线，2026-08-04）

只读元数据，不动内容。目标：把所有 AI 工具会话（opencode/omp/kimi/qoder-cn）
列成清单，按工作目录/主题聚簇成「包」候选——供用户浏览、挑包、逐包审核。

产物：stdout 汇总 + ~/.kfmv4/materials/index.md（可选 --write）。

用法：
  python3 experiments/paradigm/tools/material-index.py [--write]
"""
import json, os, re, sqlite3, sys
from pathlib import Path

HOME = Path.home()
MATERIALS = HOME / ".kfmv4" / "materials"

# ========== opencode: session/message 表 ==========
def opencode_index():
    db = HOME / ".local" / "share" / "opencode" / "opencode.db"
    out = []
    if not db.exists():
        return out, "opencode.db 不存在"
    c = sqlite3.connect(str(db))
    c.row_factory = sqlite3.Row
    try:
        rows = c.execute("""
            SELECT s.id, s.title, s.directory, s.time_created, s.time_updated,
                   s.tokens_input, s.tokens_output, s.agent, s.model,
                   (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) AS msg_count
            FROM session s ORDER BY s.time_updated DESC
        """).fetchall()
        for r in rows:
            out.append({
                "source": "opencode", "session": r["id"], "title": r["title"] or "",
                "dir": r["directory"] or "", "created": r["time_created"],
                "updated": r["time_updated"], "msgs": r["msg_count"],
                "tokens_in": r["tokens_input"] or 0, "tokens_out": r["tokens_output"] or 0,
                "agent": r["agent"] or "", "model": r["model"] or "",
            })
    finally:
        c.close()
    return out, f"{len(out)} 会话"

# ========== omp: history 表（prompt 历史） ==========
def omp_index():
    db = HOME / ".omp" / "agent" / "history.db"
    out = []
    if not db.exists():
        return out, "history.db 不存在"
    c = sqlite3.connect(str(db))
    c.row_factory = sqlite3.Row
    try:
        rows = c.execute("""
            SELECT COALESCE(session_id, '（散 prompt）') AS sid, cwd,
                   COUNT(*) AS n, MIN(created_at) AS t0, MAX(created_at) AS t1
            FROM history GROUP BY sid ORDER BY t1 DESC
        """).fetchall()
        for r in rows:
            out.append({
                "source": "omp", "session": r["sid"], "title": "",
                "dir": r["cwd"] or "", "created": r["t0"], "updated": r["t1"],
                "msgs": r["n"], "tokens_in": 0, "tokens_out": 0,
                "agent": "", "model": "",
            })
    finally:
        c.close()
    return out, f"{len(out)} 会话组 / 共 {sum(x['msgs'] for x in out)} prompt"

# ========== kimi: sessions/*/state.json ==========
def kimi_index():
    out = []
    base = HOME / ".kimi-code" / "sessions"
    if not base.exists():
        return out, "sessions 不存在"
    for wd in sorted(base.iterdir()):
        if not wd.is_dir():
            continue
        for sess in sorted(wd.iterdir()):
            state = sess / "state.json"
            if not state.exists():
                continue
            try:
                s = json.loads(state.read_text())
            except Exception:
                continue
            wire = sess / "agents" / "main" / "wire.jsonl"
            nlines = sum(1 for _ in wire.open(errors="ignore")) if wire.exists() else 0
            out.append({
                "source": "kimi", "session": sess.name, "title": s.get("title", ""),
                "dir": s.get("workDir", ""), "created": s.get("createdAt", ""),
                "updated": s.get("updatedAt", ""), "msgs": nlines,
                "tokens_in": 0, "tokens_out": 0, "agent": "", "model": "",
            })
    return out, f"{len(out)} 会话"

# ========== qoder-cn: logs/sessions/<wd>/<uuid>/segments/*.jsonl ==========
def qoder_index():
    out = []
    base = HOME / ".qoder-cn" / "logs" / "sessions"
    if not base.exists():
        return out, "sessions 不存在"
    for wd in sorted(base.iterdir()):
        if not wd.is_dir():
            continue
        for sess in sorted(wd.iterdir()):
            segs = sess / "segments"
            n = 0
            files = sorted(segs.glob("*.jsonl")) if segs.exists() else []
            for f in files:
                n += sum(1 for _ in f.open(errors="ignore"))
            t0 = files[0].name[:16].replace("T", " ") if files else ""
            t1 = files[-1].name[:16].replace("T", " ") if files else ""
            out.append({
                "source": "qoder", "session": sess.name, "title": "",
                "dir": wd.name, "created": t0, "updated": t1,
                "msgs": n, "tokens_in": 0, "tokens_out": 0,
                "agent": "", "model": "",
            })
    return out, f"{len(out)} 会话 / {sum(x['msgs'] for x in out)} segment"

# ========== 聚合 ==========
def main():
    write = "--write" in sys.argv
    listing = "--list" in sys.argv
    idx = []
    stats = {}
    for fn in (opencode_index, omp_index, kimi_index, qoder_index):
        try:
            rows, note = fn()
        except Exception as e:
            print(f"[material-index] {fn.__name__} 失败: {e}")
            continue
        idx.extend(rows)
        stats[fn.__name__.replace("_index", "")] = note
        print(f"[material-index] {fn.__name__.replace('_index', '')}: {note}")

    total_msgs = sum(x["msgs"] for x in idx)
    print(f"[material-index] 合计 {len(idx)} 会话 · {total_msgs} 消息/行")

    if listing:
        write_listing(idx)
        return

    # 按工作目录聚簇（主题包候选）
    from collections import defaultdict
    by_dir = defaultdict(list)
    for x in idx:
        by_dir[x["dir"] or "（无目录）"].append(x)
    print(f"\n=== 按工作目录聚簇（{len(by_dir)} 组）——主题包候选 ===")
    for d, sess in sorted(by_dir.items(), key=lambda kv: -sum(s["msgs"] for s in kv[1])):
        n_long = sum(1 for s in sess if s["msgs"] >= 5)
        srcs = ",".join(sorted({s["source"] for s in sess}))
        print(f"  {d[:70]:<72} {len(sess):>3} 会话 {sum(s['msgs'] for s in sess):>6} 消息"
              f"（≥5 消息 {n_long} 个） 源: {srcs}")

    # 最长的 15 个会话
    print(f"\n=== 最长 15 会话 ===")
    for s in sorted(idx, key=lambda x: -x["msgs"])[:15]:
        title = (s["title"] or s["session"])[:44]
        print(f"  {s['source']:<8} {s['msgs']:>6} 消息  {title:<46} {s['dir'][:40]}")

    if write:
        MATERIALS.mkdir(parents=True, exist_ok=True)
        lines = [f"# 工具会话素材索引（{len(idx)} 会话 · {total_msgs} 消息）\n",
                 f"> 生成：material-index.py。源：opencode/omp/kimi/qoder-cn。codex 无对话日志（logs 表为运行日志）。\n"]
        for d, sess in sorted(by_dir.items(), key=lambda kv: -sum(s["msgs"] for s in kv[1])):
            lines.append(f"\n## {d or '（无目录）'}（{len(sess)} 会话 · {sum(s['msgs'] for s in sess)} 消息）\n")
            for s in sorted(sess, key=lambda x: -(x["msgs"])):
                lines.append(f"- [{s['source']}] {s['msgs']} 消息"
                             f" {s['updated'] or s['created'] or ''} {(s['title'] or s['session'])[:60]}\n")
        (MATERIALS / "index.md").write_text("".join(lines), encoding="utf-8")
        print(f"\n[material-index] 已写 {MATERIALS / 'index.md'}")

# ========== 清单输出（--list）：筛选有价值会话，一行一个 ==========
def write_listing(idx):
    """筛选：≥5 消息（排除冷启动一轮接手+一轮反应）；omp 散 prompt 特殊标记。
    产物：~/.kfmv4/materials/pack-list.md —— 逐会话审核清单（做完打 ✅ 备注产物）。"""
    VALUABLE_MIN = 5  # 消息数下限：一轮实验（接手+反应 ≈ 2-3 条）无范式价值

    def path_of(s):
        """给会话的可操作路径（供审核时打开）"""
        if s["source"] == "opencode":
            return f"~/.local/share/opencode/opencode.db (session {s['session']})"
        if s["source"] == "omp":
            return f"~/.omp/agent/history.db (session {s['session']})"
        if s["source"] == "kimi":
            return f"~/.kimi-code/sessions/wd_root_*/{s['session']}/agents/main/wire.jsonl"
        if s["source"] == "qoder":
            return f"~/.qoder-cn/logs/sessions/{s['dir']}/{s['session']}/segments/"
        return "?"

    def topic_hint(s):
        """主题线索：标题 / 首条用户消息（omp 有 prompt 原文）"""
        if s["source"] == "omp" and s["session"] != "（散 prompt）":
            return s["session"][:20]  # 无标题，给 session 前缀
        return (s["title"] or s["session"])[:70]

    # ---- 排除规则（冷启动/无价值类别，用户审核可加回）----
    COLDSTART_RE = re.compile(r"接手|了解|全面评估|现状|takeover|assessment|analyse|analyze", re.I)
    def is_coldstart(s):
        # 冷启动实验：标题含 kfmv4-lab（试卷快照，不分大小写）+ 接手/评估类词，一轮接手+一轮反应
        t = s["title"] or ""
        return "lab" in t.lower() and bool(COLDSTART_RE.search(t))
    def is_subagent_exec(s):
        return "subagent" in (s["title"] or "").lower()
    def is_new_session(s):
        return (s["title"] or "").startswith("New session")

    valuable, excluded = [], {"coldstart": 0, "subagent": 0, "new_session": 0}
    for s in idx:
        if s["source"] != "omp" and is_coldstart(s):
            excluded["coldstart"] += 1; continue
        if s["source"] != "omp" and is_subagent_exec(s):
            excluded["subagent"] += 1; continue
        if s["source"] != "omp" and is_new_session(s):
            excluded["new_session"] += 1; continue
        if s["msgs"] >= VALUABLE_MIN or s["source"] == "omp":
            valuable.append(s)
        else:
            excluded.setdefault("short", 0); excluded["short"] += 1
    dropped = sum(excluded.values())

    MATERIALS.mkdir(parents=True, exist_ok=True)
    L = []
    L.append("# 素材会话清单（逐会话审核，2026-08-04）\n")
    L.append("> 玩法：**一行一个会话**。做完打 ✅ 并备注产物；⬜ = 待审。\n")
    L.append(f"> 筛选：消息数 ≥ {VALUABLE_MIN}；自动排除冷启动接手类 {excluded['coldstart']} 项"
             f"（kfmv4-lab 试卷 + 接手/评估标题）、@explore subagent 执行 {excluded['subagent']} 项、"
             f"无标题 New session {excluded['new_session']} 项、短会话 {excluded.get('short', 0)} 项；"
             "omp 散 prompt 是单条 prompt 序列（引导模板原料，无会话上下文，特殊标记）。\n")
    L.append(f"> 合计 {len(valuable)} 项候选 · 全量 {len(idx)} 会话。"
             "审核可增删——觉得某条无价值直接删行，觉得被排除的有价值加回来。\n")

    for src in ("opencode", "qoder", "kimi", "omp"):
        rows = sorted([s for s in valuable if s["source"] == src], key=lambda x: -x["msgs"])
        if not rows:
            continue
        L.append(f"\n## {src}（{len(rows)} 项）\n")
        L.append("| ✅/⬜ | 会话 | 路径 | 消息 | 主题线索 | 产物 |")
        L.append("|------|------|------|------|---------|------|")
        for s in rows:
            mark = "⬜"
            note = "omp 散 prompt（引导模板原料）" if (s["source"] == "omp" and s["session"] == "（散 prompt）") else ""
            L.append(f"| {mark} | {topic_hint(s)} | `{path_of(s)}` | {s['msgs']} | {s['dir'][:40]} | {note} |")
    L.append("\n---\n> 产物列：审核完填写（如「提炼决策范式候选」「引导模板 ×N」）。")

    (MATERIALS / "pack-list.md").write_text("\n".join(L), encoding="utf-8")
    print(f"[material-list] 已写 {MATERIALS / 'pack-list.md'}（候选 {len(valuable)} 项）")

if __name__ == "__main__":
    main()
