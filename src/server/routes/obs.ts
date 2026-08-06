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
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { load as yamlLoad } from 'js-yaml';
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
    res.json({ balance, inbox: parseInbox(), stack: parseStack(), sys: collectSys(), serverTime: new Date().toISOString() });
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

// ========== 待办解析（stack.yaml 工作栈，2026-08-06 用户拍板：废 STACK.md，yaml 单一出处） ==========
// 状态从散文标记升级为字段（check-stack-status R0 机械把关 schema）——「无标记黑户」
// 从构造上不存在。面板渲染全状态：todo/hold 全亮在前，done 渐淡殿后（用户问过
// 「19 条为什么只显示 3 条」——藏起 done 是旧设计的诚实性缺陷）。
// 单一出处：现场读文件，不缓存副本。

interface StackEntry {
  n: number;
  status: 'done' | 'todo' | 'hold';
  title: string;
  created: string;
  note: string;
  detail: string;
}

const STACK_PATH = path.join(PROJECT_ROOT, 'docs', 'active', 'stack.yaml');

function parseStack(): { entries: StackEntry[]; counts: { todo: number; hold: number; done: number } } {
  const counts = { todo: 0, hold: 0, done: 0 };
  try {
    const doc = yamlLoad(fs.readFileSync(STACK_PATH, 'utf-8')) as { entries?: Array<Record<string, unknown>> };
    const all = Array.isArray(doc?.entries) ? doc.entries : [];
    const entries: StackEntry[] = [];
    for (const e of all) {
      const status = String(e.status) as StackEntry['status'];
      if (status !== 'done' && status !== 'todo' && status !== 'hold') continue;
      counts[status]++;
      entries.push({
        n: Number(e.id),
        status,
        title: String(e.title ?? ''),
        created: String(e.created ?? ''),
        note: String(e.note ?? ''),
        detail: [String(e.title ?? ''), typeof e.detail === 'string' ? e.detail : ''].filter(Boolean).join('\n'),
      });
    }
    // todo/hold 在前（活跃优先），done 殿后；各组内按 id 序
    entries.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || a.n - b.n);
    return { entries, counts };
  } catch {
    return { entries: [], counts };
  }
}

// ========== SYS 竖条采集（2026-08-06 用户定稿：左缘窄竖条，顶到底） ==========
// 三段：SYS 四数（盘/存/载/kfm RSS）+ 服务灯（8021 自己恒绿，ngx/ssh 看端口）
// + cron 清单（crontab 现场解析 → 逐脚本成败标记表末位对比判状态，见 CRON_MARKERS）。
// 缓存：指标/端口 30s（statfs/meminfo 便宜但 execSync 贵），cron 5min（crontab 极少变）。

interface SysMetric { label: string; value: string; pct: number | null }
interface SysService { name: string; ok: boolean }
interface SysCron { name: string; status: 'ok' | 'fail' | 'unknown'; ago: string }
interface SysData { metrics: SysMetric[]; services: SysService[]; cron: SysCron[] }

const SYS_CACHE_MS = 30_000;
const CRON_CACHE_MS = 300_000;
let sysCache: { data: Omit<SysData, 'cron'>; ts: number } | null = null;
let cronCache: { data: SysCron[]; ts: number } | null = null;

// auto-push.sh 无 >> 重定向但脚本内部自记日志——crontab 解析的特例补丁表
const CRON_INTERNAL_LOG: Record<string, string> = {
  'auto-push.sh': '/var/log/kfmv4-autopush.log',
};

// 状态判据：逐脚本成败标记表 + 末位对比（尾 8KB 内最后一个 err 匹配晚于最后一个
// ok 匹配 → fail）。为什么不用通用关键字：entry 的 4KB 窗会吞进上一轮 FAIL（本轮
// 其实 PASS）；obs-agg 的报告正文自带「失败 288」统计字样；sync 的成功输出就是
// git 噪音无 ok 标记——通用正则三种都判错（2026-08-06 实测）。表外新条目走
// DEFAULT 通用回退。诚实边界：脚本崩溃无输出 → unknown（ago 变老是旁证）。
interface CronMarker { ok?: RegExp; err?: RegExp }
const CRON_MARKERS: Record<string, CronMarker> = {
  'sync':        { err: /fatal|failed to push|error: failed/i }, // 成功输出=git 噪音，无 ok 标记
  'clean':       {},                                             // 静默脚本
  'chain':       { ok: /信箱 ←/, err: /💀|Traceback|Command failed/ },
  'chain-bench': { ok: /信箱 ←/, err: /💀|Traceback|Command failed/ },
  'entry':       { ok: /✅ PASS/, err: /❌ FAIL/ },
  'obs-agg':     { err: /Traceback|Command failed|💀/ }, // 报告正文含「失败 N」统计字样，不算错
  'auto-push':   { ok: /部署成功/, err: /部署失败/ },
  'retain':      { err: /Traceback|Error|失败/ },
};
const CRON_MARKER_DEFAULT: CronMarker = { err: /fatal|error|failed|失败|Traceback|❌|✗/i };

function lastIndexOf(re: RegExp | undefined, text: string): number {
  if (!re) return -1;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let last = -1, m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) { last = m.index; if (m[0] === '') break; }
  return last;
}

function fmtAgo(mtimeMs: number): string {
  const h = (Date.now() - mtimeMs) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.round(d)}d`;
  return `${Math.round(d / 7)}w`;
}

function collectCron(): SysCron[] {
  const now = Date.now();
  if (cronCache && now - cronCache.ts < CRON_CACHE_MS) return cronCache.data;
  let out: SysCron[] = [];
  try {
    const tab = execSync('crontab -l', { encoding: 'utf-8', timeout: 5000 });
    for (const line of tab.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      // 名字 = 行内第一个脚本 basename 去扩展名缩写（先去前导点：/root/.kfmv4-sync.sh）
      const sm = t.match(/([\w.-]+\.(?:sh|mjs|cjs|js))/);
      if (!sm) continue;
      const name = sm[1].replace(/\.(sh|mjs|cjs|js)$/, '').replace(/^\./, '')
        .replace(/^kfmv4-/, '').replace(/^semantic-/, '').replace(/^routine-entry-validation/, 'entry')
        .replace(/^session-retention/, 'retain').replace(/^obs-aggregate/, 'obs-agg')
        .replace(/^clean-npm-temp/, 'clean');
      // 同一脚本多行（chain 每日 + --with-bench 周一）：带参数的给后缀区分
      const suffix = t.includes('--with-bench') ? '-bench' : '';
      const logM = t.match(/>>\s*(\/var\/log\/[\w.-]+)/);
      const logPath = logM?.[1] ?? CRON_INTERNAL_LOG[sm[1]];
      let status: SysCron['status'] = 'unknown';
      let ago = '—';
      if (logPath) {
        try {
          const st = fs.statSync(logPath);
          ago = fmtAgo(st.mtimeMs);
          if (st.size > 0) {
            const fd = fs.openSync(logPath, 'r');
            const buf = Buffer.alloc(Math.min(8192, st.size));
            fs.readSync(fd, buf, 0, buf.length, Math.max(0, st.size - buf.length));
            fs.closeSync(fd);
            const tail = buf.toString('utf-8');
            const mk = CRON_MARKERS[name + suffix] ?? CRON_MARKER_DEFAULT;
            status = lastIndexOf(mk.err, tail) > lastIndexOf(mk.ok, tail) ? 'fail' : 'ok';
          }
        } catch { /* 日志还没产生 → unknown */ }
      }
      const full = name + suffix;
      if (!out.some(c => c.name === full)) out.push({ name: full, status, ago });
    }
  } catch { /* crontab 不可用 → 空列表 */ }
  cronCache = { data: out, ts: now };
  return out;
}

function collectSysFast(): Omit<SysData, 'cron'> {
  const now = Date.now();
  if (sysCache && now - sysCache.ts < SYS_CACHE_MS) return sysCache.data;
  // 磁盘（statfs：bavail 口径≈df Use%）
  let diskPct = 0;
  try {
    const s = fs.statfsSync('/');
    diskPct = Math.round((1 - Number(s.bavail) / Number(s.blocks)) * 100);
  } catch { /* 保留 0 */ }
  // 内存（/proc/meminfo：1 - MemAvailable/MemTotal）
  let memPct = 0;
  try {
    const mi = fs.readFileSync('/proc/meminfo', 'utf-8');
    const total = Number(mi.match(/MemTotal:\s+(\d+)/)?.[1]);
    const avail = Number(mi.match(/MemAvailable:\s+(\d+)/)?.[1]);
    if (total > 0 && avail >= 0) memPct = Math.round((1 - avail / total) * 100);
  } catch { /* 保留 0 */ }
  // 负载（1 分钟 loadavg / 核数——除以核数才是强度）
  const loadPct = Math.round((os.loadavg()[0] / Math.max(1, os.cpus().length)) * 100);
  // kfmv4 进程自身 RSS（MB）——内存泄漏直读仪
  const kfmRssMb = Math.round(process.memoryUsage().rss / 1e6);
  // 端口存活（一次 ss 全取）
  let ngx = false, ssh = false;
  try {
    const ss = execSync('ss -tlnH', { encoding: 'utf-8', timeout: 5000 });
    ngx = /:80\s/.test(ss);
    ssh = /:22\s/.test(ss);
  } catch { /* ss 不可用 → 全 false（灯自己会说话） */ }
  const data: Omit<SysData, 'cron'> = {
    metrics: [
      { label: '盘', value: `${diskPct}%`, pct: diskPct },
      { label: '存', value: `${memPct}%`, pct: memPct },
      { label: '载', value: `${loadPct}%`, pct: loadPct },
      { label: 'kfm', value: `${kfmRssMb}M`, pct: null },
    ],
    services: [
      { name: '8021', ok: true }, // 能响应这个请求本身就是绿的
      { name: 'ngx', ok: ngx },
      { name: 'ssh', ok: ssh },
    ],
  };
  sysCache = { data, ts: now };
  return data;
}

function collectSys(): SysData {
  return { ...collectSysFast(), cron: collectCron() };
}
