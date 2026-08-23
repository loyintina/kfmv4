#!/bin/bash
# agent-notify.sh — agent 会话「跨会话投递完成通知」协议
# 用途：worker 会话干完自己这轮、要交棒时，写一条完成信号；评审侧的
#       watch 只读这个文件即可立刻知道「对方结束了」，不必轮询 pane 等空闲。
# 用法：agent-notify.sh <session> <status>
#   <session> 必填：本会话名（dsh / kfm-na / psh ...）
#   <status>  可选：done / review-ready / blocked / error ...
# 产物：一行 JSON 追加到 /tmp/kfm-note/notify.log（易失，跨会话信号用）
# 调用方：各 agent 会话在其回复收尾时执行（如 `bash /root/kfmv4/scripts/agent-notify.sh dsh done`）

set -u
dir=/tmp/kfm-note
mkdir -p "$dir"
printf '{"ts":%s,"session":"%s","status":"%s"}\n' \
  "$(date +%s%3N)" "${1:-unknown}" "${2:-done}" >> "$dir/notify.log"
# 回显一条，便于 agent 确认已投递（不吞错误）
echo "[agent-notify] ${1:-unknown} ${2:-done} -> /tmp/kfm-note/notify.log"
