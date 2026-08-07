#!/bin/bash
# e13 点火循环——重试到齐（2026-08-06，用户已批预算 <10 元）
# 192 臂 = 3 任务 × {无包, behavior-discipline} × {35B, 27B, V3, M2.5} × 8 重复
# 教训复用：① batch-run 幂等（语义三键查重），循环重跑零浪费；
#          ② 串行调用（3 任务顺序跑、并发 2）防硅基 TPM 429 风暴（e11 尸检）；
#          ③ 完成判定看 arms.db 实数不看出码（被杀进程 exit 也可能是 0）。
cd /root/kfmv4
TOTAL=192

count() {
  node -e '
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.env.HOME + "/.kfmv4/experiments/arms.db", { readOnly: true });
const c = db.prepare("SELECT COUNT(*) c FROM arms WHERE arm_id LIKE ?").get("e13-%").c;
db.close(); console.log(c);' 2>/dev/null
}

run_task() { # task-file
  node experiments/paradigm/tools/batch-run.mjs \
    --task-file "$1" \
    --paradigms "无,behavior-discipline" \
    --models "Qwen/Qwen3.6-35B-A3B,Qwen/Qwen3.5-27B,Pro/deepseek-ai/DeepSeek-V3,Pro/MiniMaxAI/MiniMax-M2.5" \
    --provider "硅基流动" --arms 8 --concurrency 2 --prefix "e13-" --retries 4 \
    --tools "read,grep,glob,write" \
    --sandbox-template experiments/paradigm/fixtures/e13-sandbox-template
}

for i in $(seq 1 10); do
  echo "===== 第 $i 轮 $(date +%H:%M:%S)（已入库 $(count)/$TOTAL）====="
  run_task experiments/paradigm/scenarios/e13-t1-verify.txt
  run_task experiments/paradigm/scenarios/e13-t2-docplace.txt
  run_task experiments/paradigm/scenarios/e13-t3-scope.txt
  c=$(count)
  echo "===== 第 $i 轮结束，已入库 $c/$TOTAL ====="
  if [ "$c" -ge "$TOTAL" ]; then echo E13-ALL-DONE; exit 0; fi
  echo "未齐，120s 后第 $((i+1)) 轮"; sleep 120
done
echo "E13-INCOMPLETE（10 轮仍未齐，人工看日志）" >&2; exit 1
