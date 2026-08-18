#!/bin/bash
# regenerate.sh — 生成器全回写（一键结束「改代码 → 手动逐级回写」多米诺）
#
# 背景（2026-08-04 巡逻工具化推广实测）：改代码/文档后跑全链，生成器回写链逐个冒头——
# sync-counts → gen-code-inventory → gen-contract-lists 各报漂移，手动逐级回写 +
# 每级单独提交，一轮部署卡 5 轮。本脚本把回写链压成一条命令。
#
# 顺序依赖：gen-contract-lists 从 code-inventory.md 读文件清单 → 必须先 inventory 后 contract。
#
# 用法：
#   bash scripts/regenerate.sh           # 回写全部 + 展示 git 状态（不改提交）
#   bash scripts/regenerate.sh --commit  # 回写 + 精确提交生成物（docs:na 豁免，一次提交收尾）
#   bash scripts/regenerate.sh --check   # 只校验不回写（等价于全链里的 check-only 三连）
set -e
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--check" ]; then
  echo "=== [regenerate] 校验模式（--check-only 四连）==="
  node scripts/check/sync-counts.mjs --check-only
  node scripts/check/gen-code-inventory.mjs --check-only
  node scripts/check/gen-contract-lists.mjs --check-only
  node scripts/check/gen-agent-inbox.mjs --check-only
  echo "=== [regenerate] ✅ 全部生成物与派生真相一致"
  exit 0
fi

echo "=== [regenerate] 1/4 sync-counts（计数回写面）==="
npm run sync-counts

echo "=== [regenerate] 2/4 gen-code-inventory（code-inventory.md）==="
node scripts/check/gen-code-inventory.mjs

echo "=== [regenerate] 3/4 gen-contract-lists（6 域 contract.md，依赖 inventory）==="
node scripts/check/gen-contract-lists.mjs

echo "=== [regenerate] 4/4 gen-agent-inbox（信箱台账投影，依赖信件机读头）==="
node scripts/check/gen-agent-inbox.mjs

echo "=== [regenerate] 回写后 git 状态 ==="
git status --short

if [ "${1:-}" = "--commit" ]; then
  # 精确 add 生成物（不碰 state/巡逻产出/他人改动——git add -A 会把无关改动卷进来）
  git add README.md CLAUDE.md docs/guides/testing.md scripts/agent/semantic-mutate.mjs \
    docs/domains/code-inventory.md docs/domains/*/contract.md \
    docs/ledger/agent-inbox/README.md
  if [ -z "$(git diff --cached --name-only)" ]; then
    echo "=== [regenerate] 无生成物改动，跳过提交 ==="
    exit 0
  fi
  git commit -m "chore(generate): 生成器全回写（sync-counts/inventory/contract 一键同步）

生成物派生真相回写（见 scripts/regenerate.sh 头注：改代码后一键结束回写多米诺）
docs:na"
  echo "=== [regenerate] ✅ 已提交 ==="
fi
