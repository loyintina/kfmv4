#!/bin/bash
# supervisor.sh — nz server 守护（镜 na 的 Termux am start 拉回腿）
#
#   setsid bash nz/supervisor.sh &     # 常驻（退出会话不死）
#   NZ_PORT=8123 NZ_SUPER_LOG=/tmp/x.log bash nz/supervisor.sh   # 测试口
#
# 职责只有一条：server 进程死了就拉回。boot/exit 行落日志——
# nz-restart.sh 靠 boot 行计数判断「新进程已活」（镜 na 的 boot 报告行）。
# gate（restart-req）在 server 侧值守，本脚本不碰文件。
set -u
cd "$(dirname "$0")"   # nz/（脚本就在 nz/ 下；本文件由 tests/ spawn 时以 nz/ 为 cwd）

LOG="${NZ_SUPER_LOG:-/tmp/nz-server.log}"
BOOT_MARKER='[boot]'

boot_count() {
    grep -ac "^$BOOT_MARKER" "$LOG" 2>/dev/null || echo 0
}

echo "[supervisor] 起 pid=$$ ts=$(date -Is) log=$LOG" >> "$LOG"
while true; do
    # tsx 跑法与现役一致（node_modules/.bin/tsx）；NZ_PORT 透传给 server
    echo "$BOOT_MARKER pid-listed ts=$(date -Is)" >> "$LOG"
    node_modules/.bin/tsx src/server/index.ts >> "$LOG" 2>&1
    CODE=$?
    echo "[exit] code=$CODE ts=$(date -Is)" >> "$LOG"
    # 1 秒内连退=配置错（端口占用等），退避防刷屏；正常 gate 重启 0.5s 即拉
    sleep 0.5
done
