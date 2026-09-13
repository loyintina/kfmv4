#!/bin/bash
# doctor.sh — 环境体检（铃开考前置；五项各出 ✓/✗，全过 exit 0）
# 用法: bash bin/doctor.sh [--dry-run-tolerant]
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../lib/config.sh
source "$HERE/lib/config.sh"
ensure_dirs

TOLERANT=0
[[ ${1:-} == "--dry-run-tolerant" ]] && TOLERANT=1

fails=0
ck() { # ck <名> <命令...>
    local name="$1"; shift
    if "$@" >/dev/null 2>&1; then
        echo "  ✓ $name"
    else
        echo "  ✗ $name"; fails=$((fails+1))
    fi
}

echo "[doctor] redroid 考场环境体检"
ck "adb 可执行"            test -x "$ADB_BIN"
ck "redroid 设备在线"      "$ADB_BIN" -s "$REDROID_SERIAL" get-state
ck "na-regress 可读"       test -r "$NA_REGRESS"
ck "na-shot 可读"          test -r "$NA_SHOT"
ck "tc 可用（v2 预留）"    bash -c 'command -v tc >/dev/null'
ck "python3 可用（JSON 闸）" bash -c 'command -v python3 >/dev/null'
ck "归档目录可写"          bash -c "touch '$EVIDENCE_DIR/.wtest' && rm -f '$EVIDENCE_DIR/.wtest'"

if [[ $TOLERANT == 1 ]]; then
    echo "[doctor] dry-run 宽容模式：设备/na 乐器三项降级为警告，工具链与目录仍硬性"
    # 硬性项重查：工具链（adb/python3）+ 目录可写；设备与 na 乐器缺失只警告
    fails=0
    ck "adb 可执行（硬性）"     test -x "$ADB_BIN"
    ck "python3 可用（硬性）"   bash -c 'command -v python3 >/dev/null'
    ck "归档目录可写（硬性）"   bash -c "touch '$EVIDENCE_DIR/.wtest' && rm -f '$EVIDENCE_DIR/.wtest'"
fi

if [[ $fails -eq 0 ]]; then
    echo "[doctor] 全过"
else
    echo "[doctor] $fails 项未过"
fi
exit "$fails"
