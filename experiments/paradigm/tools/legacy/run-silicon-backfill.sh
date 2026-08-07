#!/bin/bash
# 硅基流动系 e11/e12 补跑（2026-08-05 入库版）按上下文窗口分级
# 历史：初版在 /tmp（A 级 GLM-4-32B 48 臂全灭后该模型已除名，本版删除 A 级）
# 二次补跑（round2）：B/D 级首轮成功率仅 19%/32%（429 TPM 聚簇），并发 6→3
# 断点续跑：已归档臂自动跳过，只跑缺口
cd /root/kfmv4
BR="node experiments/paradigm/tools/batch-run.mjs"
COMMON="--task-file /tmp/exp8-task.txt --provider 硅基流动 --arms 8 --concurrency 3"
AB="无,metacognition,metacognition-32k,metacognition-48k,metacognition-64k,metacognition-96k"
C5="metacognition-h4k-x2,metacognition-h15k-x2,metacognition-h24k-x2,metacognition-h32k-x2,metacognition-h45k-x2"
W4="e12-w1-seamless,e12-w2-lightmark,e12-w3-declaration,e12-w4-boundary"

echo "===== B 级 131K：GLM-Z1-9B / GLM-4.5-Air / Ling-mini-2.0 ====="
MB="THUDM/GLM-Z1-9B-0414,zai-org/GLM-4.5-Air,inclusionAI/Ling-mini-2.0"
$BR $COMMON --paradigms "$AB" --models "$MB" --prefix "e11-" 2>&1 | tail -2
$BR $COMMON --paradigms "$C5" --models "$MB" --prefix "e11-" 2>&1 | tail -2
$BR $COMMON --paradigms "metacognition-8k-dup,metacognition-32k-dup,metacognition-48k-dup" --models "$MB" --prefix "e11-" 2>&1 | tail -2
$BR $COMMON --paradigms "$W4" --models "$MB" --prefix "e12-" 2>&1 | tail -2

echo "===== D 级 262K：Qwen3.6-35B / 3.5-9B / 3.5-27B / Step-3.5-Flash（全槽）====="
MD="Qwen/Qwen3.6-35B-A3B,Qwen/Qwen3.5-9B,Qwen/Qwen3.5-27B,stepfun-ai/Step-3.5-Flash"
$BR $COMMON --paradigms "$AB" --models "$MD" --prefix "e11-" 2>&1 | tail -2
$BR $COMMON --paradigms "$C5" --models "$MD" --prefix "e11-" 2>&1 | tail -2
$BR $COMMON --paradigms "metacognition-8k-dup,metacognition-32k-dup,metacognition-48k-dup,metacognition-64k-dup,metacognition-96k-dup" --models "$MD" --prefix "e11-" 2>&1 | tail -2
$BR $COMMON --paradigms "$W4" --models "$MD" --prefix "e12-" 2>&1 | tail -2

echo "===== 补跑全部完成 ====="
