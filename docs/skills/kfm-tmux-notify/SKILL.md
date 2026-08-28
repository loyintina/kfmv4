---
name: kfm-tmux-notify
description: 给 kfm 多 agent 体系里跑在 tmux 会话中的其他 agent（dsh、kfm-na、omp 等）塞一条通知，并确认对方收到。防丢回车、防引号转义、防目标会话不存在。
whenToUse: 当需要把一封信/裁决/通知塞进另一个 tmux 会话让对端 agent 自己读时；尤其适合塞话通知 dsh（kfmv4-9.0/nz 线）和 kfm-na（na 线）。
---

# KFM 多 agent 塞话通知（tmux 防丢）

## 已踩过的坑

- **忘加回车**：`tmux send-keys -t dsh "..."` 后没跟回车键，消息停在输入行，对端 agent 看不到；
- **把 `C-m` 当普通字符发**：`tmux send-keys -t dsh -l "... C-m"` 会在消息末尾追加三个可见字符 `C-m`，而不是提交（用户侧可见输入框里文字后面带 `C-m`）；
- **目标会话不在**：手机断线或 session 被杀，塞话 silent fail，自己以为通知了。

## 正确流程（优先用现成脚本）

kfmv4 仓库已经有一个经过实战修补的原语：

```bash
bash /root/kfmv4/scripts/agent-send.sh <会话名> "消息正文"
```

**永远优先用它**，不要自己拼 `tmux send-keys`。该脚本会做四件事：

1. `tmux has-session` 检查目标存在；
2. 发消息 + 发真正的回车键 `C-m`；
3. 再补一次 `C-m`；
4. `tmux capture-pane` 自验——若消息仍滞留在输入框，自动补 `C-m`，最多 6 次，仍失败则非零退出。

示例：

```bash
bash /root/kfmv4/scripts/agent-send.sh dsh "评审裁决已投：kfmv4-review-trace-revision3-verdict.md——修订 v3 附条件通过。"
bash /root/kfmv4/scripts/agent-send.sh kfm-na "两件事：①...②..."
```

## 只有脚本不可用时才手工 fallback

如果 `scripts/agent-send.sh` 不存在或临时失效，按**两步**发，千万不要把 `C-m` 跟消息一起塞进 `-l`：

```bash
TARGET="dsh"
MSG="评审裁决已投：..."

# ① 检查会话存在
tmux has-session -t "$TARGET" 2>/dev/null || { echo "MISSING $TARGET"; exit 1; }

# ② 发消息本体（字面量，避免命令行转义）
printf '%s' "$MSG" > "/tmp/kfm-notify-${TARGET}.txt"
tmux send-keys -t "$TARGET" -l "$(cat "/tmp/kfm-notify-${TARGET}.txt")"

# ③ 单独发回车（关键：不带 -l，否则 C-m 会变成三个字符）
tmux send-keys -t "$TARGET" C-m

# ④ 自验：看输入框尾部是否仍有消息前缀
sleep 2
tmux capture-pane -pt "$TARGET" -S -3 | grep -F "${MSG:0:20}" >/dev/null && echo "RETRY" || echo "OK"

rm -f "/tmp/kfm-notify-${TARGET}.txt"
```

## 禁忌

- 不要 `tmux send-keys -t dsh "..." Enter`——`Enter` 是字符串不是键；
- 不要 `tmux send-keys -t dsh -l "... C-m"`——会把 `C-m` 当三个字符；
- 不要把消息里的双引号直接嵌进外层双引号命令；
- 不要在目标会话没确认在线时假设对方已读。

## 验收

- 对端 pane 里出现完整消息，输入框尾部没有残留 `C-m`；
- `agent-send.sh` 返回 0（脚本自带自验）。
