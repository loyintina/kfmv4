#!/bin/bash
# kfm-restart — 安全重启 kfmv4 服务
# 通过 HTTP 端点触发重启（先响应后重启，不会中断调用方）
# 然后轮询等待服务恢复，最后刷新浏览器页面

PORT="${1:-8021}"
BASE="http://127.0.0.1:${PORT}"

echo "[kfm-restart] 正在请求安全重启..."
RESP=$(curl -s -X POST "${BASE}/api/system/restart" 2>/dev/null)
if echo "$RESP" | grep -q "restarting"; then
  echo "[kfm-restart] ✅ 重启已启动: $RESP"
else
  echo "[kfm-restart] ⚠️ 端点不可用，降级为 systemctl restart"
  systemctl restart kfmv4
fi

echo "[kfm-restart] 等待服务恢复（最多30s）..."
for i in $(seq 1 30); do
  sleep 1
  if curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/system/info" 2>/dev/null | grep -q "200"; then
    echo "[kfm-restart] ✅ 服务已恢复（耗时 ${i}s）"
    exit 0
  fi
  printf "."
done
echo ""
echo "[kfm-restart] ❌ 30s 内服务未恢复，请手动检查"
exit 1
