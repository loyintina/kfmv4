#!/bin/bash
# deploy-fast.sh — 会话中途快部署：esbuild + 重启 + 握手（跳过全链测试，约几秒）
#
# 存在意义：check-deploy-freshness 硬门要求「源码比包新 = 链红」，
# 每次提交后都要刷新包体才能转绿；全链（36 步含 npm test）太重，
# 快通道保提交节奏。交付验证前仍应跑完整 deploy.sh（全链 + 部署）。
set -e
cd "$(dirname "$0")/.."
PORT="${1:-8021}"
BASE="http://127.0.0.1:${PORT}"

echo "=== [deploy-fast] 1/3 快构建（--fast 跳过全链）==="
node build.mjs --fast

NEW_BUILD_TIME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('dist/build-info.json','utf-8')).buildTime)")
echo "=== [deploy-fast] 2/3 重启（新包 buildTime: ${NEW_BUILD_TIME}）==="
bash scripts/kfm-restart.sh "${PORT}"

echo "=== [deploy-fast] 3/3 版本握手 ==="
RUNNING=$(curl -s "${BASE}/api/system/info" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).buildInfo?.buildTime||'')}catch{console.log('')}})")
if [ -z "$RUNNING" ]; then
  echo "=== [deploy-fast] ❌ /api/system/info 无 buildInfo——运行进程仍是旧包"
  exit 1
fi
if [ "$RUNNING" \< "$NEW_BUILD_TIME" ]; then
  echo "=== [deploy-fast] ❌ 运行进程 buildTime=${RUNNING} 早于新包 ${NEW_BUILD_TIME}——旧包！"
  exit 1
fi
echo "=== [deploy-fast] ✅ 运行进程已确认加载新包（running=${RUNNING}）"
