#!/bin/bash
# build-enter-cgroup.sh — 把重编译任务整体放进独立 cgroup「kfm-builds」，
# 与三线交互会话（agent.slice/tmux-default）隔开：重编译的内存尖峰只在自己
# 桶里互杀，不再连坐 agent。（2026-08-21 OOM 事故：omp 读图被共享 3GiB 桶
# 砍死——build+读图+三线 agent 同住一桶，任一方内存一涨全桶遭殃。）
#
# 只做【内存】隔离：agent.slice 的 cgroup.subtree_control 启了 memory+pids，
# 没启 cpu（cpu.weight 写不了）——CPU 争用仍由调用方的 nice/ionice 负责
# （nz build:term 与 NA chain.sh 均已自带 nice -n 10，本脚本只管内存桶）。
#
# 用法：build-enter-cgroup.sh <build-command...>   （exec 执行，调用方换人）
# 环境：KFM_BUILD_MEM  每次进入重建本桶内存上限（字节），默认 1.5 GiB
#   KFM_CGROUP_DIR  桶路径，默认 agent.slice/kfm-builds（自动 mkdir）
set -euo pipefail

BASE=/sys/fs/cgroup
DIR="${KFM_CGROUP_DIR:-agent.slice/kfm-builds}"
MEM="${KFM_BUILD_MEM:-1610612736}"   # 1.5 GiB

[ -d "$BASE/$DIR" ] || mkdir -p "$BASE/$DIR"
echo "$MEM" > "$BASE/$DIR/memory.max"
# 把本 shell（及经它 spawn 的所有后代）搬进隔离桶，再 exec 目标构建。
# cgroup 沿进程树继承，子进程自动落桶。
echo $$ > "$BASE/$DIR/cgroup.procs"
exec "$@"