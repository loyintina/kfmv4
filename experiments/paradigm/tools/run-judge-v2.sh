#!/bin/bash
# run-judge-v2.sh — e11/e12 v2 判卷（断点续判 + 重试，2026-08-06）
# judge-llm 原生断点续判（归档内已判条目跳过），本 wrapper 只负责：
# 进程被杀/异常退出后重拉，最多 5 次。判卷完成（退出码 0）即收工。
cd /root/kfmv4
for i in 1 2 3 4 5; do
  node experiments/paradigm/tools/judge-llm.mjs \
    --prefixes e11-t0,e12-t0 --rubric v2 \
    --judge-model deepseek-v4-flash --judge-provider deepseek \
    --task-file experiments/paradigm/scenarios/e8-task.txt \
    --out experiments/paradigm/meta-pool/judge-e11-e12-v2-flash.json \
    --concurrency 6 && exit 0
  echo "[retry] 判卷第 $i 次中断，15s 后断点续判"; sleep 15
done
echo "[FAIL] 判卷五次均失败" >&2; exit 1
