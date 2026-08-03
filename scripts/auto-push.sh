#!/bin/bash
# auto-push.sh — 主仓自动推送（2026-08-02 补缺口：除私有数据同步外，主仓代码无自动推送）
#
# 安全三闸：
#   1. 工作树有「非构建戳」未提交改动 → 跳过不推（真实工作在进行，不越权提交）
#   2. 只有构建戳脏（public/index.html）→ 按惯例 chore(build) 提交后推
#   3. pre-push 钩子跑全链 check——失败则 push 被钩子拦下，记录日志
# 边界：这是机器机制（cron），不是 agent 主动 push——CLAUDE.md「agent 从不主动
# push」纪律的适用范围是会话内 agent 行为，机制层 push 不受此限。
set -u
REPO=/root/kfmv4
LOG=/var/log/kfmv4-autopush.log
STAMP="$(date +%Y-%m-%d\ %H:%M:%S)"

cd "$REPO" || { echo "$STAMP 失败: 无法进入 $REPO" >> "$LOG"; exit 1; }

# 闸 1：非戳未提交改动 → 跳过
CHANGED=$(git status --porcelain | grep -v '^ M public/index.html$' | grep -v '^?? public/index.html$' | wc -l)
if [ "$CHANGED" -gt 0 ]; then
  echo "$STAMP 跳过: 工作树有 $CHANGED 处非戳改动（真实工作进行中，不越权）" >> "$LOG"
  exit 0
fi

# 闸 2：只有戳脏 → 按惯例提交
if git status --porcelain | grep -q 'public/index.html'; then
  git add public/index.html
  git commit -q -m "chore(build): 构建缓存戳" 2>/dev/null || echo "$STAMP 戳提交失败" >> "$LOG"
fi

# 推 master（pre-push 钩子跑全链，失败自动拦下）
if git push origin master >> "$LOG" 2>&1; then
  echo "$STAMP 推送 master 成功" >> "$LOG"
else
  echo "$STAMP 推送 master 失败（pre-push 检查未过或网络问题）" >> "$LOG"
  exit 1
fi

# 推新 tag（远端没有的）
for tag in $(git tag); do
  if ! git ls-remote --tags origin "$tag" | grep -q "$tag"; then
    git push origin "$tag" >> "$LOG" 2>&1 && echo "$STAMP 推送 tag $tag" >> "$LOG"
  fi
done
echo "$STAMP 完成" >> "$LOG"
