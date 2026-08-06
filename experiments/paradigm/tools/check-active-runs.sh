#!/bin/bash
# check-active-runs.sh — 重启/部署服务器前的在跑实验检查（2026-08-05）
#
# 背景：服务器重启会杀掉所有实验进程。plugin-exam 已有断点续跑兜底，
# 但重启仍浪费已烧的 token（中断轮重跑）。部署方（人 / 任何 agent）在
# 重启 8021 服务前跑一下这个脚本，确认没有实验在跑，或有意识放行。
#
# 检查项：
#   ① 进行中的插件实验：exam-state.json 存在但对应 exam-meta.json 缺失或 aborted
#   ② batch-run / judge-llm / plugin-exam 的存活进程
# 退出码：0 = 无在跑实验（可安全重启），1 = 有在跑实验（建议等或确认后放行）
SCRIPT_DIR="$HOME/.kfmv4/sessions/script"
found=0

echo "== 进行中的插件实验（有状态无完成元数据）=="
shopt -s nullglob
for st in "$SCRIPT_DIR"/*.exam-state.json; do
  id="$(basename "$st" .exam-state.json)"
  meta="$SCRIPT_DIR/$id.exam-meta.json"
  if [ ! -f "$meta" ] || grep -q '"aborted": true' "$meta"; then
    turn=$(grep -o '"turn": *[0-9]*' "$st" | head -1 | grep -o '[0-9]*')
    echo "  ⚠ $id（已完成 ${turn:-?} 轮，可断点续跑）"
    found=1
  fi
done
[ "$found" = 0 ] && echo "  （无）"

echo "== 实验相关进程 =="
procs=$(pgrep -af 'plugin-exam|batch-run|judge-llm|run-silicon|run-px' | grep -v check-active-runs || true)
if [ -n "$procs" ]; then
  echo "$procs" | sed 's/^/  ⚠ /'
  found=1
else
  echo "  （无）"
fi

if [ "$found" = 1 ]; then
  echo ""
  echo "结论：有在跑实验。重启前建议等待完成，或确认后放行（plugin-exam 跑次可断点续跑）。"
  exit 1
fi
echo ""
echo "结论：无在跑实验，可安全重启。"
exit 0
