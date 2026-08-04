#!/bin/bash
# auto-push.sh — 主仓自动推送（2026-08-02 补缺口：除私有数据同步外，主仓代码无自动推送）
#
# 闸 0：freshness 红（有未部署提交）→ 先部署（check 全链门 + 重启），否则推不了最新
# 闸 1：工作树有「非构建戳」未提交改动 → 跳过不推（真实工作在进行，不越权提交）
# 闸 2：pre-push 钩子跑全链 check——失败则 push 被钩子拦下，记录日志
# 顺序：先推后戳——戳提交在 push 后，本地留着（2026-08-04 根治后戳提交不再触发
# freshness 红：check-deploy-freshness 只查「最后一个改 src/ 的提交」，build 戳不算未部署）
# 边界：机器机制（cron），非 agent 主动 push；CLAUDE.md 纪律注明机制层例外。
set -u
REPO=/root/kfmv4
LOG=/var/log/kfmv4-autopush.log
STAMP="$(date +%Y-%m-%d\ %H:%M:%S)"

cd "$REPO" || { echo "$STAMP 失败: 无法进入 $REPO" >> "$LOG"; exit 1; }

# 闸 0：freshness 红 → 先部署（4:57 安静窗口：巡逻 4:17/体检 4:47 已完成）
if ! node scripts/check/check-deploy-freshness.mjs >/dev/null 2>&1; then
  echo "$STAMP freshness 红 → 自动部署" >> "$LOG"
  if bash scripts/deploy.sh >> "$LOG" 2>&1; then
    echo "$STAMP 部署成功" >> "$LOG"
  else
    echo "$STAMP 部署失败（check 链未过），跳过推送" >> "$LOG"
    exit 1
  fi
fi

# 闸 1：非戳未提交改动 → 跳过（兼容暂存/未暂存戳）
CHANGED=$(git status --porcelain | grep -vE '^[ M]M? public/index.html$' | grep -v '^?? public/index.html$' | wc -l)
if [ "$CHANGED" -gt 0 ]; then
  echo "$STAMP 跳过: 工作树有 $CHANGED 处非戳改动（真实工作进行中，不越权）" >> "$LOG"
  exit 0
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

# 戳提交（push 后）
if git status --porcelain | grep -q 'public/index.html'; then
  git add public/index.html
  git commit -q -m "chore(build): 构建缓存戳" 2>/dev/null || echo "$STAMP 戳提交失败" >> "$LOG"
fi
echo "$STAMP 完成" >> "$LOG"
