#!/bin/bash
# agent-send.sh — 「塞对话」通用原语：向任意 agent 会话窗口注入一条消息
#
# 定位：agent 集群 N×N 网格通信的「投递/唤醒」动作。任意 agent 均可调用，
#       目标 = 任意会话窗口（含评审/其它线），不依赖单一中心。
#       （与 agent-notify.sh 互补：send=把消息塞进对方窗口；notify=对方投递完成信号。）
#       内容留痕仍走 agent-inbox（信箱），本原语只管「时序投递」。
#
# 用法：bash agent-send.sh <target-session> <message>
#   <target-session> 必填：目标窗口名（dsh / kfm-na / omp / psh ...，见会话注册表）
#   <message>        必填：要注入的消息文本（建议引用真实信件文件，如「查看 docs/.../x.md」）
#
# 安全：① 目标会话必须存在（tmux has-session），否则拒绝并报错；
#       ② 只对目标 session 做 send-keys，不改其内容、不动文件；
#       ③ 注入时机由调用方负责（建议在目标空闲时注入；活跃时注入可能打断其回复）。
#
# 注：多行/长文本在部分 TUI 里直接回车会把 Enter 当换行而非提交——本脚本
#     发完文本后再补发一个 C-m 尝试提交（kimi TUI 实测如此），调用方仍应自测。

set -u
TARGET="${1:-}"
MSG="${2:-}"
if [ -z "$TARGET" ] || [ -z "$MSG" ]; then
  echo "用法: bash $0 <target-session> <message>" >&2
  exit 2
fi
if ! tmux has-session -t "$TARGET" 2>/dev/null; then
  echo "[agent-send] ❌ 会话不存在: $TARGET" >&2
  exit 1
fi
# 注入消息，随后补一次回车提交
tmux send-keys -t "$TARGET" "$MSG" C-m 2>&1
tmux send-keys -t "$TARGET" C-m 2>&1
echo "[agent-send] $TARGET <- ${MSG:0:60}"
