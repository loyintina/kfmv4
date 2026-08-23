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
#       ③ 目标正在回复时消息会**自动排队**（与用户打字同管道），回复完才处理，
#          无需调用方守卫空闲——TUI 忙时自动缓冲输入。
#
# 注：多行/长文本在部分 TUI 里直接回车会把 Enter 当换行而非提交——本脚本
#     发完文本后再补发一个 C-m 尝试提交（kimi TUI 实测如此），调用方仍应自测。
#
# 投后自验（2026-08-23 复盘裁决④，9.0 出补丁评审批）：目标忙时上面补发的
# C-m 会被 TUI 吞掉，消息滞留输入框（IME 讨伐期实测踩中两次）。纪律会忘，
# 脚本不会——投递后自动 capture-pane 看输入框区域（pane 尾部若干行），消息
# 前缀还在 = 没提交成功 → 补 C-m 重试，最多 6 次；仍滞留则非零退出让调用方
# 知道没送达，不许静默失败。

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

# 自验循环：消息仍滞留 = 补 C-m。检测口径（v2，首发实弹抓出的洞）：
# 长消息在输入框里会滚动，可视尾部只见消息末尾、前缀早已滚出——只看
# 尾部窗口 + 前缀会假阴性（消息明明滞留却报已送达，首发即踩）。故取
# 首/中/尾三个 24 字符片段，且只看「框线行」（│ 开头——会话区回显无
# 边框，天然排除），任一片段出现在框线行 = 滞留。grep -F 定字串防正则
# 误伤。
PREFIX="${MSG:0:24}"
LEN=${#MSG}
MID="${MSG:$((LEN / 2)):24}"
SUFFIX="${MSG:$((LEN > 24 ? LEN - 24 : 0)):24}"
in_box() {
  tmux capture-pane -t "$TARGET" -p 2>/dev/null | grep '^[[:space:]]*│' \
    | grep -qFe "$PREFIX" -e "$MID" -e "$SUFFIX"
}
attempt=0
while [ $attempt -lt 6 ]; do
  sleep 2
  if in_box; then
    attempt=$((attempt + 1))
    tmux send-keys -t "$TARGET" C-m 2>/dev/null
  else
    if [ $attempt -gt 0 ]; then
      echo "[agent-send] 投后自验：补 C-m ${attempt} 次后确认送达"
    fi
    exit 0
  fi
done
echo "[agent-send] ⚠ 重试 6 次后消息仍滞留 $TARGET 输入框（目标可能卡死），请人工核查" >&2
exit 1
