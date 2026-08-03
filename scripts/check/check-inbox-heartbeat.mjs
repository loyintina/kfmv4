/**
 * check-inbox-heartbeat.mjs — 信箱巡逻心跳（F1 机械化主人，2026-08-03，BAR-SEMCHAIN-01 催生）
 *
 * 问题：cron 只管「跑」，没人管「到」——巡逻崩溃/cron 被删/机器宕机/provider 卡死，
 *   全都表现为信箱沉默，而沉默和「一切正常」长得一模一样。08-03 ROOT 事故：
 *   runner 崩了一天无人知晓（state 已写、信箱未投）。
 *
 * 检查：信箱最新巡逻条目（带 HH:MM——与入口文档体检等无时间戳的信箱写者区分）
 *   超过 36h → 报红。巡逻每日 04:17，健康态最大间隔 ≈24h；36h = 容忍一次
 *   构建时点偏差，错过一轮必红。覆盖巡逻失败全谱系，不是某个具体 bug 的钉。
 *
 * 枚举型检查（每次全量重扫信箱），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const INBOX_PATH = join(ROOT, 'docs/ledger/semantic-chain-inbox.md');
const STALE_MS = 36 * 3600 * 1000;

let errors = 0;
function error(msg) {
  console.error(`[check-inbox-heartbeat] ${msg}`);
  errors++;
}

if (!existsSync(INBOX_PATH)) {
  error('⛳ MECH-FLOW-10 信箱不存在（docs/ledger/semantic-chain-inbox.md）——巡逻从未成功跑过或路径有误');
} else {
  const lines = readFileSync(INBOX_PATH, 'utf-8').split('\n');
  // 巡逻行格式：`- YYYY-MM-DD HH:MM …`（必须带时分——无时间戳的信箱行不算巡逻心跳）
  const stamps = lines
    .map((l) => /^- (\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})\s/.exec(l))
    .filter(Boolean)
    .map((m) => new Date(`${m[1]}T${m[2]}:${m[3]}:00`).getTime());
  if (!stamps.length) {
    error('⛳ MECH-FLOW-10 信箱没有任何带时间戳的巡逻条目——semantic-chain.mjs 可能从未成功跑过');
  } else {
    const age = Date.now() - Math.max(...stamps);
    if (age > STALE_MS) {
      const hours = Math.round(age / 3600000);
      error(`⛳ MECH-FLOW-10 巡逻心跳停摆：最新巡逻条目已是 ${hours} 小时前（阈值 36h）。排查路径：tail /var/log/semantic-chain.log 看崩溃堆栈 → crontab -l 看 cron 是否还在 → 手动补跑 node scripts/agent/semantic-chain.mjs`);
    }
  }
}

if (errors > 0) {
  console.error('\n[check-inbox-heartbeat] 巡逻心跳异常，构建中断。');
  process.exit(1);
}
console.log('[check-inbox-heartbeat] OK — 巡逻心跳正常');
