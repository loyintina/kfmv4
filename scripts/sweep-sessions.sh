#!/usr/bin/env bash
# sweep-sessions.sh — sessions 目录清扫（script 分流的兜底回收）
#
# 规则（见 experiments/paradigm/results-session-leak-rootcause.md §4-1）：
#   1. 根目录下 24h 未动（mtime）的已知 script 前缀会话文件
#      → 移到 sessions/script/，文件名加 .stranded 后缀（僵尸/残骸形态，不再参与任何读写）
#   2. sessions/script/ 下 14 天前的 .stranded 残卷 → 删除
#   3. sessions/script/ 下 14 天前的 sandbox-* 臂沙箱目录 → 删除
#      （沙箱唯一用途是脚本判卷 diff，判卷产出已落盘 meta-pool；超期老臂判卷标 skip）
#
# 24h 余量的理由：在跑的臂会持续 append（mtime 新鲜），plugin-exam 断点续跑
# 跨重启要读历史会话文件，24h 不动 = 确认死亡才回收。
# 前缀白名单只覆盖实验脚本体系；patrol- 是主线巡逻系统的会话，不在此列。
#
# 用法：bash scripts/sweep-sessions.sh [--dry-run]
set -u

# 与服务端 path-utils.ts 对齐：ROOT_DIR = KFM_ROOT 或 HOME，sessions 在其下 .kfmv4/
KFM_ROOT_EFFECTIVE="${KFM_ROOT:-$HOME}"
SESSIONS_DIR="${KFM_ROOT_EFFECTIVE}/.kfmv4/sessions"
SCRIPT_DIR="${SESSIONS_DIR}/script"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

[ -d "$SESSIONS_DIR" ] || exit 0
mkdir -p "$SCRIPT_DIR"

# 已知 script 前缀（e1- 连带匹配 e11-/e12-/e13-，均属实验体系）
is_script_prefix() {
  case "$1" in
    bi-*|e1-*|e4-*|e5-*|e7-*|e9-*|pd-*|pl-*|px-*|judge-*|probe-*) return 0 ;;
    *) return 1 ;;
  esac
}

moved=0
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  is_script_prefix "$base" || continue
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] 滞留回收: $base -> script/${base%.json}.stranded.json"
  else
    mv "$f" "${SCRIPT_DIR}/${base%.json}.stranded.json"
  fi
  moved=$((moved + 1))
done < <(find "$SESSIONS_DIR" -maxdepth 1 -type f -name '*.json' -mmin +1440 -print0)

deleted=0
while IFS= read -r -d '' f; do
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] 残卷删除: $(basename "$f")"
  else
    rm -f "$f"
  fi
  deleted=$((deleted + 1))
done < <(find "$SCRIPT_DIR" -maxdepth 1 -type f -name '*.stranded.json' -mtime +14 -print0)

# 规则 3（2026-08-06 用户拍板）：script/ 下 14 天前的 sandbox-* 臂沙箱目录 → 删除。
# 沙箱 = 逐臂 fixture 副本，唯一用途是脚本判卷 diff（judge-e13-script），判卷产出
# 已落盘 meta-pool/judge-*.json；14 天余量覆盖「跑数→判卷→复核」全周期。
# 超期再判的老臂会被标 skip（判卷脚本对无沙箱臂不报错，语义安全）。
sbox=0
while IFS= read -r -d '' d; do
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] 沙箱删除: $(basename "$d")"
  else
    rm -rf "$d"
  fi
  sbox=$((sbox + 1))
done < <(find "$SCRIPT_DIR" -maxdepth 1 -type d -name 'sandbox-*' -mtime +14 -print0)

echo "[sweep-sessions] 滞留回收 ${moved} 个，残卷删除 ${deleted} 个，沙箱删除 ${sbox} 个$([ "$DRY_RUN" = "1" ] && echo '（dry-run）')"
