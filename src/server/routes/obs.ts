/**
 * routes/obs.ts — 观测台数据端点（8.5 史官制度 · HUD，2026-08-05 立项）
 *
 * /api/obs/hud：聚合 HUD 面板数据。骨架版：deepseek 官方余额（实时拉取）+ 服务器时间；
 * 其余数据面（调用统计/运行任务/信箱/cron/系统状态等）按设计分框预留，后续逐栏填充。
 *
 * 余额数据源：GET https://api.deepseek.com/user/balance（官方开放平台唯一账户接口，
 * 返回 is_available + balance_infos[]：total/granted/topped_up 分解）。
 * 「实时更新」= 每次请求直接拉官方（不缓存）——余额接口免费且轻量，30s 级轮询无压力。
 */
import type { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { resolveKey } from '../env-store.js';
import { KFM_DATA_DIR, PROJECT_ROOT } from '../path-utils.js';

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';
// 余额缓存：deepseek /user/balance 接口免费轻量（无 chat 接口的并发压力），
// 5s 一次外部请求 = 17280 次/天，强度很低（2026-08-06 用户定稿 5s 轮询）。
const BALANCE_CACHE_MS = 5_000;

interface BalanceOk {
  total: string;
  granted: string;
  toppedUp: string;
  isAvailable: boolean;
  fetchedAt: string;
}
interface BalanceErr {
  error: string;
}
type Balance = BalanceOk | BalanceErr;

let balanceCache: { data: Balance; ts: number } | null = null;

async function fetchDeepseekBalance(): Promise<Balance> {
  if (balanceCache && Date.now() - balanceCache.ts < BALANCE_CACHE_MS) {
    return balanceCache.data;
  }
  try {
    const provs = JSON.parse(fs.readFileSync(path.join(KFM_DATA_DIR, 'providers.json'), 'utf-8'));
    const ds = (provs as Array<{ id: string; apiKey: string }>).find(p => p.id === 'deepseek');
    if (!ds) return { error: 'providers.json 无 deepseek 条目' };
    const key = resolveKey(ds.apiKey);
    if (!key.value) return { error: `deepseek apiKey 未解析（缺 ${key.missingVar || '值'}）` };
    const res = await fetch(DEEPSEEK_BALANCE_URL, {
      headers: { Authorization: `Bearer ${key.value}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `balance HTTP ${res.status}` };
    const j = await res.json() as { is_available?: boolean; balance_infos?: Array<Record<string, unknown>> };
    const info = j.balance_infos?.[0] ?? {};
    const data: Balance = {
      total: String(info.total_balance ?? '?'),
      granted: String(info.granted_balance ?? '0'),
      toppedUp: String(info.topped_up_balance ?? '0'),
      isAvailable: !!j.is_available,
      fetchedAt: new Date().toISOString(),
    };
    balanceCache = { data, ts: Date.now() };
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 80) : String(e) };
  }
}

export function setupObsRoutes(router: Router): void {
  router.get('/obs/hud', async (_req, res) => {
    const balance = await fetchDeepseekBalance();
    res.json({ balance, inbox: parseInbox(), serverTime: new Date().toISOString() });
  });
}

// ========== 信箱解析（semantic-chain-inbox.md，ledger 层账本·只追加） ==========
// 每行：`- YYYY-MM-DD [HH:MM] <标记> <内容>`——标记家族：⚠️ 待裁决 / ✅ 干净 /
// 💀 崩溃 / 📊 观测统计 / 其他中性。单一出处：现场读文件，不缓存副本（语义生成原则）。
// 最新在前（账本倒序时间线）。

interface InboxEntry {
  date: string;
  time: string;
  type: 'warn' | 'ok' | 'dead' | 'stat' | 'other';
  text: string;
}

const INBOX_PATH = path.join(PROJECT_ROOT, 'docs', 'ledger', 'semantic-chain-inbox.md');
const INBOX_LINE_RE = /^-?\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})?\s*(⚠️|✅|💀|📊)?\s*(.*)$/;

function inboxTypeOf(mark: string | undefined): InboxEntry['type'] {
  switch (mark) {
    case '⚠️': return 'warn';
    case '✅': return 'ok';
    case '💀': return 'dead';
    case '📊': return 'stat';
    default: return 'other';
  }
}

function parseInbox(): InboxEntry[] {
  try {
    const text = fs.readFileSync(INBOX_PATH, 'utf-8');
    const entries: InboxEntry[] = [];
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('#')) continue; // 头部注释
      const m = line.match(INBOX_LINE_RE);
      if (!m) continue;
      const [, date, time = '', mark, body] = m;
      entries.push({ date, time, type: inboxTypeOf(mark), text: body.trim() });
    }
    return entries.reverse(); // 最新在前
  } catch {
    return [];
  }
}
