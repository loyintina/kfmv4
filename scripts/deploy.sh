#!/bin/bash
# deploy.sh — 修复部署闭环：构建 → 重启 → 版本握手验证
# 根解「反复修反复没效果」历史高发模式：修复后线上跑的还是旧包
# （diagnostics 构建/Bundle #4「环境版本错位」）。修复工作流（bug-fix.yaml）的部署步。
set -e
cd "$(dirname "$0")/.."
PORT="${1:-8021}"
BASE="http://127.0.0.1:${PORT}"

echo "=== [deploy] 1/3 构建 ==="
npm run build

NEW_BUILD_TIME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('dist/build-info.json','utf-8')).buildTime)")
echo "=== [deploy] 2/3 重启（新包 buildTime: ${NEW_BUILD_TIME}）==="
bash scripts/kfm-restart.sh "${PORT}"

echo "=== [deploy] 3/3 版本握手：验证运行进程已加载新包 ==="
RUNNING=$(curl -s "${BASE}/api/system/info" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).buildInfo?.buildTime||'')}catch{console.log('')}})")
if [ -z "$RUNNING" ]; then
  echo "=== [deploy] ❌ /api/system/info 无 buildInfo——运行进程仍是旧包（不认识版本握手）"
  echo "=== [deploy] 需要再重启一次（旧包不认识重启端点的新行为时手动 systemctl restart kfmv4）"
  exit 1
fi
if [ "$RUNNING" \< "$NEW_BUILD_TIME" ]; then
  echo "=== [deploy] ❌ 运行进程 buildTime=${RUNNING} 早于新包 ${NEW_BUILD_TIME}——旧包！"
  exit 1
fi
echo "=== [deploy] ✅ 运行进程已确认加载新包（running=${RUNNING}）"
