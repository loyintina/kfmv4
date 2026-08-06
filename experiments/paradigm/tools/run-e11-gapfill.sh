#!/bin/bash
# e11 硅基 D 高档补臂——重试到齐（2026-08-06）
# 背景：主线部署硬杀（pkill 级）+ 硅基不稳定，补臂两批三次被 Terminated/风暴。
# batch-run 幂等（语义三键查重，已跑过的臂自动跳过），循环重试零浪费。
# 完成判定不看出码看 arms.db 实数（被杀的进程 exit 也可能是 0）。
cd /root/kfmv4
need() { # paradigm, model, 目标数
  node -e '
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.env.HOME + "/.kfmv4/experiments/arms.db", { readOnly: true });
const c = db.prepare("SELECT COUNT(*) c FROM arms WHERE paradigm = ? AND model = ?").get(process.argv[1], process.argv[2]).c;
db.close(); process.exit(c >= Number(process.argv[3]) ? 0 : 1);' "$1" "$2" "$3" 2>/dev/null
}
cmd1() {
  node experiments/paradigm/tools/batch-run.mjs --task-file experiments/paradigm/scenarios/e8-task.txt \
    --paradigms "metacognition-48k-dup" \
    --models "Qwen/Qwen3.5-9B,Qwen/Qwen3.6-35B-A3B,stepfun-ai/Step-3.5-Flash,THUDM/GLM-Z1-9B-0414" \
    --provider "硅基流动" --arms 8 --concurrency 2 --prefix "e11-" --retries 4
}
cmd2() {
  node experiments/paradigm/tools/batch-run.mjs --task-file experiments/paradigm/scenarios/e8-task.txt \
    --paradigms "metacognition-96k-dup" \
    --models "Qwen/Qwen3.5-27B,Qwen/Qwen3.5-9B,Qwen/Qwen3.6-35B-A3B,stepfun-ai/Step-3.5-Flash" \
    --provider "硅基流动" --arms 8 --concurrency 2 --prefix "e11-" --retries 4
}
done1() { need metacognition-48k-dup "Qwen/Qwen3.5-9B" 8 && need metacognition-48k-dup "Qwen/Qwen3.6-35B-A3B" 8 && need metacognition-48k-dup "stepfun-ai/Step-3.5-Flash" 8 && need metacognition-48k-dup "THUDM/GLM-Z1-9B-0414" 8; }
done2() { need metacognition-96k-dup "Qwen/Qwen3.5-27B" 8 && need metacognition-96k-dup "Qwen/Qwen3.5-9B" 8 && need metacognition-96k-dup "Qwen/Qwen3.6-35B-A3B" 8 && need metacognition-96k-dup "stepfun-ai/Step-3.5-Flash" 8; }
for i in $(seq 1 10); do
  echo "===== 第 $i 轮 $(date +%H:%M:%S) ====="
  done1 && echo "[cmd1] 已齐" || cmd1
  done2 && echo "[cmd2] 已齐" || cmd2
  if done1 && done2; then echo GAPFILL-ALL-DONE; exit 0; fi
  echo "未齐，120s 后第 $((i+1)) 轮"; sleep 120
done
echo "GAPFILL-INCOMPLETE（10 轮仍未齐，人工看日志）" >&2; exit 1
