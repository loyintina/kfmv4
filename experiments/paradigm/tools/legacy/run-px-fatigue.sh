#!/bin/bash
# 疲劳区专项 px-ft（2026-08-06，通用特性线第 3 项——与 px-base/px-hl 构成三足）：
#   px-base：永不挂载（基线分布）
#   px-hl：  attach@2,detach@5（摘除残留半衰期）
#   px-ft：  attach@2 永不摘除（疲劳区——持续挂载下效应随轮次衰减吗？）
# 三足同一任务/教官/考生池/轮次上限，曲线直接可比：
#   疲劳判定 = px-ft 挂载段（R3-15）盲判曲线 vs px-base 同轮次基线曲线的差值随轮收缩。
# 时刻表模式强制接管挂摘决策，教官只聊天。
#
# 幂等+断点续跑模板（同 run-px-baseline.sh，2026-08-05 定型）。
cd /root/kfmv4
SCRIPT_DIR="$HOME/.kfmv4/sessions/script"
run() {
  local id="$1" model="$2"
  local meta="$SCRIPT_DIR/$id.exam-meta.json"
  if [ -f "$meta" ] && ! grep -q '"aborted": true' "$meta"; then
    echo "[skip] $id 已完成"; return 0
  fi
  for i in 1 2 3; do
    node experiments/paradigm/tools/plugin-exam.mjs \
      --id "$id" --examiner-model "$model" --examiner-provider "聚光" \
      --examiner-role kfm-dev --pack metacognition \
      --scenario-file experiments/paradigm/scenarios/design-discussion.txt \
      --schedule "attach@2" --turns 15 && return 0
    echo "[retry] $id 第 $i 次失败，10s 后断点续跑"; sleep 10
  done
  echo "[FAIL] $id 三次均失败" >&2; return 1
}
run px-ft-g25-1 "gemini-2.5-pro" & run px-ft-c46-1 "[kiro]claude-sonnet-4-6" & wait
run px-ft-g25-2 "gemini-2.5-pro" & run px-ft-c46-2 "[kiro]claude-sonnet-4-6" & wait
echo FATIGUE-DONE
