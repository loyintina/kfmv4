#!/bin/bash
# 基线分布实验 px-base（2026-08-05，用户拍板「先通用特性」线）：
# 同场景同教官但永不挂载，g25×2 + c46×2，测无包基线质量分布。
# 与 px-1 挂载实验的差异仅在教官提示词（design-discussion-nomount.md：action 限 none/end）。
#
# 幂等+断点续跑模板（2026-08-05 部署误杀三次实验后定型，新 wrapper 照抄）：
#   ① exam-meta.json 已存在且无 aborted:true → 跳过（重复执行零成本）；
#   ② plugin-exam 每轮落盘 exam-state.json，中止退场退出码 1；
#   ③ 每个 id 最多 3 次尝试，失败拉起自动断点续跑。
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
      --instructor-file experiments/paradigm/instructors/design-discussion-nomount.md \
      --scenario-file experiments/paradigm/scenarios/design-discussion.txt --turns 14 && return 0
    echo "[retry] $id 第 $i 次失败，10s 后断点续跑"; sleep 10
  done
  echo "[FAIL] $id 三次均失败" >&2; return 1
}
run px-base-g25-1 "gemini-2.5-pro" & run px-base-c46-1 "[kiro]claude-sonnet-4-6" & wait
run px-base-g25-2 "gemini-2.5-pro" & run px-base-c46-2 "[kiro]claude-sonnet-4-6" & wait
echo BASELINE-DONE
