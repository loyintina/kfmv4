#!/bin/bash
# 残留半衰期专项 px-hl（2026-08-05，通用特性线第 1 项）：
# 时刻表模式硬脚本——基线 R1-2 → 挂载 R3-5（3 轮）→ 摘除 → 强制观测 R6-15（10 轮），
# 教官只聊天无权干预。挂载/摘除时机对所有跑次一致，曲线直接可比。
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
      --scenario-file experiments/paradigm/scenarios/design-discussion.txt \
      --schedule "attach@2,detach@5" --turns 15 && return 0
    echo "[retry] $id 第 $i 次失败，10s 后断点续跑"; sleep 10
  done
  echo "[FAIL] $id 三次均失败" >&2; return 1
}
run px-hl-g25-1 "gemini-2.5-pro" & run px-hl-c46-1 "[kiro]claude-sonnet-4-6" & wait
run px-hl-g25-2 "gemini-2.5-pro" & run px-hl-c46-2 "[kiro]claude-sonnet-4-6" & wait
echo HALFLIFE-DONE
