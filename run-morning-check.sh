#!/bin/bash
cd /root/kfmv4 || exit 1
node scripts/check/gen-agent-inbox.mjs 2>&1 | tail -1
node scripts/check/check-agent-inbox.mjs 2>&1 | grep -v "f3\." | grep -E "MECH-FLOW|OK —|失败" | head -10
