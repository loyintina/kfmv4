---
name: kfm-tmux-notify
description: 给 kfm 多 agent 体系里跑在 tmux 会话中的其他 agent（dsh、kfm-na、omp 等）塞一条通知，并确认对方收到。防丢回车、防引号转义、防目标会话不存在。
whenToUse: 当需要把一封信/裁决/通知塞进另一个 tmux 会话让对端 agent 自己读时；尤其适合塞话通知 dsh（kfmv4-9.0/nz 线）和 kfm-na（na 线）。
---

# KFM 多 agent 塞话通知（tmux 防丢）

## 已踩过的坑

- **忘加回车**：`tmux send-keys -t dsh "..."` 后没跟 `Enter` 或 `C-m`，消息停在输入行，对端 agent 看不到。
- **引号/反斜杠被本地 shell 吃掉**：消息里带 `"`、`` ` ``、`$`、`!` 时，直接拼进命令行会转义失败或触发历史展开。
- **目标会话不在**：手机断线或 session 被杀，塞话 silent fail，自己以为通知了。
- **消息太长被截断/换行异常**：超过一行的通知塞进去变成多行，对端 agent 解析混乱。

## 正确流程（永远按这个顺序）

### 1. 确认目标会话存在

```bash
tmux has-session -t <session> 2>/dev/null && echo "OK <session>" || echo "MISSING <session>"
```

会话不存在时，**不要重试塞话**。立即报告用户或等对端重连。

### 2. 把消息写进临时文件（避免命令行转义）

```bash
# 会话名 与 消息正文
TARGET="dsh"  # 或 kfm-na / omp
MSG='评审裁决已投：kfmv4-review-trace-revision3-verdict.md——修订 v3 附条件通过；余两处单行同步漏待修。'

# 写文件（无变量展开、无历史展开）
printf '%s' "$MSG" > "/tmp/kfm-notify-${TARGET}.txt"
```

如果消息本身需要跨行，文件内保留 `\n` 即可；但建议通知尽量单段，避免对端按多行执行。

### 3. 塞话：用 `-l` 发字面量 + `C-m` 代替 Enter

```bash
tmux send-keys -t "$TARGET" -l "$(cat "/tmp/kfm-notify-${TARGET}.txt")" C-m
```

**必须同时满足**：
- `-l`：按字面量发，tmux 不做键名解析；
- `C-m`：等效回车，绝对不要写 `Enter` 字符串；
- 文件内容作为整体一次性发，避免本地 shell 二次转义。

### 4. 验证对方确实收到

等 1 秒，然后抓目标会话最后 3 行：

```bash
sleep 1
tmux capture-pane -pt "$TARGET" -S -3 | grep -F "${MSG:0:20}"
```

- 命中 = 消息已落在对端 pane 里，对端 agent 会自己排队读取。
- 未命中 = 重发一次；仍不中，报用户“目标会话无响应”。

### 5. 清理临时文件

```bash
rm -f "/tmp/kfm-notify-${TARGET}.txt"
```

## 多目标同发（模板）

```bash
MSG='评审双裁决已投：①...②...'
for TARGET in dsh kfm-na; do
  tmux has-session -t "$TARGET" 2>/dev/null || { echo "MISSING $TARGET"; continue; }
  printf '%s' "$MSG" > "/tmp/kfm-notify-${TARGET}.txt"
  tmux send-keys -t "$TARGET" -l "$(cat "/tmp/kfm-notify-${TARGET}.txt")" C-m
  sleep 1
  tmux capture-pane -pt "$TARGET" -S -3 | grep -F "${MSG:0:20}" >/dev/null && echo "OK $TARGET" || echo "RETRY $TARGET"
  rm -f "/tmp/kfm-notify-${TARGET}.txt"
done
```

## 禁忌

- 不要直接 `tmux send-keys -t dsh "..." Enter`——`Enter` 是字符串不是键；
- 不要把消息里的双引号直接嵌进外层双引号命令；
- 不要在目标会话没确认在线时假设对方已读；
- 不要把机密信息写进 `/tmp/kfm-notify-*.txt` 后忘记删。

## 验收

- `tmux capture-pane` 能在目标 pane 最后 3 行里找到消息前 20 个字符；
- 目标会话不存在时流程明确失败并报出，不静默丢消息。
