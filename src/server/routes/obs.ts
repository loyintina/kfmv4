/**
 * routes/obs.ts — 观测台数据端点（8.5 史官制度 · HUD，2026-08-05 立项）
 *
 * /api/obs/hud：聚合 HUD 面板数据。骨架版：deepseek 官方余额（实时拉取）+ 服务器时间；
 * 其余数据面（调用统计/运行任务/信箱/cron/系统状态等）按设计分框预留，后续逐栏填充。
 *
 * 余额数据源：GET https://api.deepseek.com/user/balance（官方开放平台唯一账户接口，
 * 返回 is_available + balance_infos[]：total/granted/topped_up 分解）。
 * 「实时更新」= 每次请求直接拉官方（不缓存）——余额接口免费且轻量，30s 级轮询无压力。
 *
 * /test 校准页 + /api/obs/viewport 回传（2026-08-06，守视基建）：手机浏览器开
 * /kfmv4/test（经 nginx /kfmv4/ 整段代理直达，无需新增映射规则）→ 页面自动量
 * innerWidth/innerHeight/devicePixelRatio POST 回 /api/obs/viewport → 存
 * ~/.kfmv4/browser-relay/viewport.json，scripts/agent/browser-relay.mjs 下次开
 * 标签即按真机视口渲染。挂 8021 常驻服务而非 daemon 自身：daemon 闲置会退，
 * 校准页须随时可开。
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

  // 守视视口校准回传：/test 页 POST 真机实测视口 → 存 viewport.json（browser-relay 读）
  router.post('/obs/viewport', (req, res) => {
    const b = req.body || {};
    const w = Math.round(Number(b.width)), h = Math.round(Number(b.height)), d = Number(b.deviceScaleFactor) || 2;
    if (!(w >= 100 && w <= 2000 && h >= 100 && h <= 4000 && d > 0 && d <= 5)) {
      res.status(400).json({ ok: false, error: '视口数值不合理' });
      return;
    }
    const viewport = { width: w, height: h, deviceScaleFactor: d, userAgent: String(b.userAgent || ''), updatedAt: new Date().toISOString() };
    const dir = path.join(KFM_DATA_DIR, 'browser-relay');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'viewport.json'), JSON.stringify(viewport, null, 2));
    res.json({ ok: true, viewport });
  });
}

// 校准页挂在 app 上（非 /api 路由）：GET /test 与 /kfmv4/test 均可达——
// 后者经 nginx /kfmv4/ 代理供手机外网访问。页面用相对路径 POST api/obs/viewport，
// 两种前缀下都解析到已挂载的 /obs/viewport 端点。
const CALIBRATE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>守视校准</title><body style="font:16px/2 monospace;background:#111;color:#eee;padding:24px">
<h3>守视 · 视口校准</h3><div id="m">测量中…</div>
<script>
const v = { width: window.innerWidth, height: window.innerHeight, deviceScaleFactor: window.devicePixelRatio, userAgent: navigator.userAgent };
fetch('api/obs/viewport', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) }).then(r => r.json()).then(r => {
  document.getElementById('m').textContent = r.ok
    ? '已记录：' + r.viewport.width + '×' + r.viewport.height + ' @' + r.viewport.deviceScaleFactor + 'x（守视新开标签页生效）'
    : '记录失败：' + r.error;
});
</script>`;

export function setupObsPages(app: { get: (p: string, h: (_req: unknown, res: { type: (t: string) => { send: (s: string) => void } }) => void) => void }): void {
  const handler = (_req: unknown, res: { type: (t: string) => { send: (s: string) => void } }) => res.type('html').send(CALIBRATE_HTML);
  app.get('/test', handler);
  app.get('/kfmv4/test', handler);
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
