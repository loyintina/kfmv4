#!/bin/bash
# 插件矩阵 px-1（2026-08-05）：gemini-2.5-pro ×2 + [kiro]claude-sonnet-4-6 ×2，并发 2
# 与 px-g25-1 合为 gemini-2.5-pro ×3 重复；c46 为中档第二模型 ×2。
# 全部 --examiner-role kfm-dev（避免面板激活角色污染人格底材）。
# 注意：本批起教官提示词新增「摘除后至少观察 4 轮再 end」，与 px-g25-1 跨批对照时需注明。
# 2026-08-05 第二批（-4/-5/-3/-4 后缀）：首批 4 跑撞上两个 bug——
# ① kiro-claude 归档 content 含 null 块崩驱动器（已修，三处防空）；
# ② flash 教官间歇空响应 2 次重试不够（已改 4 次+退避）。残骸保留作审计迹。
cd /root/kfmv4
run() {
  node experiments/paradigm/tools/plugin-exam.mjs \
    --id "$1" --examiner-model "$2" --examiner-provider "聚光" \
    --examiner-role kfm-dev --pack metacognition \
    --scenario-file experiments/paradigm/scenarios/design-discussion.txt --turns 14
}
run px-g25-4 "gemini-2.5-pro" & run px-c46-3 "[kiro]claude-sonnet-4-6" & wait
run px-g25-5 "gemini-2.5-pro" & run px-c46-4 "[kiro]claude-sonnet-4-6" & wait
echo MATRIX-DONE
