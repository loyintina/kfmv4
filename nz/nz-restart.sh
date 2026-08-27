#!/bin/bash
# nz-restart.sh — 体面重启 nz server（2026-08-27，热更新闭环的重启腿；
# 镜 na-restart.sh 五步：触发→等死→拉回→等新 boot→ping 判卷）
#
#   bash nz/nz-restart.sh
#
# 前置：server 跑在 supervisor.sh 下（没守护时本脚本只触发了退出，
# 没人拉回——先起 supervisor）。链路：gate 目录 touch restart-req →
# server 值守摘触发+遗言+exit(0) → 探活断=确认死 → supervisor 拉回 →
# 日志 boot 行计数增加 = 新进程已活 → curl ping 判卷。
set -u

GATE="${NZ_GATE_DIR:-/tmp/nz-gate}"
LOG="${NZ_SUPER_LOG:-/tmp/nz-server.log}"
PORT="${NZ_PORT:-8023}"

boot_count() {
    grep -ac '^\[boot\]' "$LOG" 2>/dev/null || echo 0
}
alive() {
    curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/"
}

BEFORE=$(boot_count)
echo "=== ① 触发 restart-req ==="
if ! alive; then
    echo "❌ 8023 本就不通——server 没跑或没在 supervisor 下（先起守护）" >&2
    exit 66
fi
mkdir -p "$GATE"
touch "$GATE/restart-req"

echo "=== ② 等死（探活失败=死透，上限 10s） ==="
DEAD=0
for _ in $(seq 1 20); do
    alive || { DEAD=1; break; }
    sleep 0.5
done
[ "$DEAD" = 1 ] && echo "    已断连" || { echo "❌ 10s 未死——值守没看到触发文件？" >&2; exit 1; }

echo "=== ③ 等 supervisor 拉回（boot 计数增加，上限 20s） ==="
OK=0
for _ in $(seq 1 40); do
    [ "$(boot_count)" -gt "$BEFORE" ] && { OK=1; break; }
    sleep 0.5
done
[ "$OK" = 1 ] || { echo "❌ 20s 无新 boot 行——守护活着吗？（tail $LOG 看看）" >&2; exit 1; }

echo "=== ④ ping 判卷 ==="
sleep 0.5
if alive; then
    echo "✅ 重启闭环完成（遗言：$(tail -1 "$GATE/last-will.log" 2>/dev/null || echo '无')）"
else
    echo "❌ 新 boot 行有了但探活不过——起的是半死态？" >&2
    exit 1
fi
